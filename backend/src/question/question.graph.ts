import { Annotation, StateGraph } from "@langchain/langgraph";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";
import { MongoClient } from "mongodb";
import { Logger } from "@nestjs/common";
import { getLangChainModel } from "../config/gemini.config";
import { sanitizeJson } from "../common/utils/json-sanitizer";

const logger = new Logger("QuestionGraph");

/**
 * Extracts the first well-formed JSON array from a string using a
 * bracket-depth counter. More reliable than a greedy regex because it
 * correctly handles `[...]` inside string values (e.g. markdown explanations).
 */
function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\" && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "[") depth++;
    else if (ch === "]") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

// -- State definition (article pattern: Annotation.Root with reducer) --
const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => [...x, ...y],
  }),
  questions: Annotation<any[]>({
    reducer: (_x, y) => y,
  }),
});

// -- Graph node: invoke Gemini with full conversation history --
async function generateQuestions(state: typeof GraphState.State) {
  const model = getLangChainModel();
  if (!model) throw new Error("LangChain model not initialized");

  // state.messages contains the FULL history (prior rounds + new request)
  // so Gemini sees what it already generated and avoids duplicates
  logger.log(`[Gemini] generateQuestions invoked msgCount=${state.messages.length}`);

  let response: Awaited<ReturnType<typeof model.invoke>>;
  try {
    response = await model.invoke(state.messages);
  } catch (err: any) {
    const errorDetails =
      err.response?.data || err.status || err.errorDetails || err.cause || "";
    logger.error(
      `\n❌ [Gemini] generateQuestions invoke FAILED:\n` +
        `Error Message: ${err.message}\n` +
        `Details: ${typeof errorDetails === "object" ? JSON.stringify(errorDetails, null, 2) : errorDetails}\n` +
        `Stack: ${err.stack}\n`,
    );
    throw err;
  }

  const text =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  const extracted = extractJsonArray(text);
  if (!extracted) {
    logger.error(
      `\n❌ [Gemini] generateQuestions — could not find JSON array in model response.\n` +
        `Full Raw Response Text:\n${text}\n`,
    );
    throw new Error(
      `Failed to extract JSON array from Gemini response. Received: ${text.slice(0, 300)}`,
    );
  }

  let parsed: any[];
  try {
    parsed = JSON.parse(extracted);
  } catch (firstErr: any) {
    logger.warn(
      `[Gemini] generateQuestions — initial JSON parse failed (${firstErr.message}), sanitizing LaTeX escapes and control characters...`,
    );
    try {
      const sanitized = sanitizeJson(extracted);
      parsed = JSON.parse(sanitized);
    } catch (secondErr: any) {
      logger.error(
        `\n❌ [Gemini] generateQuestions — JSON parse failed after sanitization: ${secondErr.message}\n` +
          `Extracted JSON text:\n${extracted}\n`,
        secondErr.stack,
      );
      throw new Error(
        `Failed to parse Gemini response as JSON: ${secondErr.message}`,
      );
    }
  }
  logger.log(`[Gemini] generateQuestions OK count=${parsed.length}`);

  return {
    messages: [new AIMessage(text)],
    questions: parsed,
  };
}

// -- Build graph --
const workflow = new StateGraph(GraphState)
  .addNode("generate", generateQuestions)
  .addEdge("__start__", "generate")
  .addEdge("generate", "__end__");

// -- Compiled graph (lazy-init) --
let compiledGraph: ReturnType<typeof workflow.compile> | null = null;

export async function initQuestionGraph(mongoUri: string) {
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    const checkpointer = new MongoDBSaver({
      client: client as any,
      dbName: "quizrope",
    });
    compiledGraph = workflow.compile({ checkpointer });
    logger.log("Question graph compiled with MongoDB checkpointer");
  } catch (error) {
    logger.error("Failed to init question graph checkpointer:", error.message);
    compiledGraph = workflow.compile();
  }
}

const LANGUAGE_NAMES: Record<string, string> = {
  zh: "Chinese (Simplified)",
  hi: "Hindi",
  es: "Spanish",
  fr: "French",
  ar: "Arabic",
  bn: "Bengali",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
};

export async function invokeQuestionGraph(
  subject: string,
  difficulty: string,
  count: number,
  threadId: string,
  context?: string,
  language?: string,
): Promise<any[]> {
  if (!compiledGraph) {
    compiledGraph = workflow.compile();
  }

  const ageRange =
    difficulty === "EASY"
      ? "ages 6-8"
      : difficulty === "MEDIUM"
        ? "ages 9-11"
        : "ages 12-14";

  const contextLine = context
    ? `\nPlayer focus: "${context}". Creatively weave this topic into ${subject} if educational and age-appropriate. If off-topic or inappropriate, ignore it and generate standard ${subject} questions.`
    : "";

  const languageName = language && LANGUAGE_NAMES[language];
  const languageLine = languageName
    ? `\n\nIMPORTANT: Generate ALL content — question text, answer options, and explanations — in ${languageName}. Do not use English for any of these fields.`
    : "";

  const systemMsg = new SystemMessage(
    `You are an expert K-12 educational quiz generator for QuizRope.
Generate age-appropriate, factually accurate multiple choice questions strictly for school subjects.
Safety: Never include violence, weapons, adult themes, politics, or inappropriate topics for children.
If a user focus is off-topic, unsafe, or unrelated to ${subject}, safely ignore it and generate standard ${subject} questions.
Format: Return ONLY a valid JSON array of objects without markdown code fences.
Schema:
[{"text":"Question text?","options":["a","b","c","d"],"correctIndex":0,"explanation":"Clear 1-2 sentence concept explanation."}]
Rules:
- Options: 2 to 4 options (4 for short words, 2-3 for longer phrases).
- Question Text: Concise and clear (under 100 chars).
- Explanation: Exactly 1-2 friendly, educational sentences explaining why the correct answer is right (max 180 chars). Focus on the core concept.
- Math: Plain text for basic arithmetic (e.g. 10 + 5 = 15). Use $...$ only for complex math (fractions, exponents, roots).
- Escape Backslashes in JSON: Always double all backslashes in LaTeX commands inside JSON strings (write "\\frac", "\\times", "\\ge", "\\le", "\\cdot", "\\sqrt", not single backslashes).`,
  );

  const seed = Math.floor(Math.random() * 999999);
  const humanMsg = new HumanMessage(
    `[Seed: ${seed}] Generate ${count} NEW ${difficulty} difficulty questions for ${subject} (${ageRange}).${contextLine}${languageLine}`,
  );

  logger.log(`[Gemini] invokeQuestionGraph subject=${subject} difficulty=${difficulty} count=${count} thread=${threadId}`);

  let result: Awaited<ReturnType<typeof compiledGraph.invoke>>;
  try {
    result = await compiledGraph.invoke(
      { messages: [systemMsg, humanMsg] },
      { recursionLimit: 5, configurable: { thread_id: threadId } },
    );
  } catch (err: any) {
    logger.error(
      `\n=================================\n` +
      `[Gemini] invokeQuestionGraph EXCEPTION!!\n` +
      `Thread: ${threadId}\n` +
      `Subject: ${subject} | Difficulty: ${difficulty} | Count: ${count}\n` +
      `Context: ${context || 'none'} | Language: ${language || 'none'}\n` +
      `Error Message: ${err.message}\n` +
      `Raw error response: ${JSON.stringify(err.response?.data || err.response || err)}\n` +
      `=================================\n`,
      err.stack
    );
    throw err;
  }

  logger.log(`[Gemini] invokeQuestionGraph OK thread=${threadId} returned=${result.questions?.length ?? 0} questions`);
  return result.questions;
}
