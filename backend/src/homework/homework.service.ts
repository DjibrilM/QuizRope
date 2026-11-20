import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HomeworkSession } from './schemas/homework-session.schema';
import { HomeworkChat } from './schemas/homework-chat.schema';
import { Child } from '../children/schemas/child.schema';
import { GEMINI_MODEL } from '../constants';
import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { sanitizeJson, normalizeEscapedProseNewlines } from '../common/utils/json-sanitizer';

/**
 * Surgical extraction of the first well-formed JSON object from a string.
 * Automatically recovers from LLM output truncation or omitted closing quotes/braces.
 */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { 
      depth--; 
      if (depth === 0) return text.slice(start, i + 1); 
    }
  }

  // Model finished generating or was truncated without closing quote/brace:
  if (depth > 0) {
    let repaired = text.slice(start).trimEnd();
    if (repaired.endsWith('```')) {
      repaired = repaired.slice(0, -3).trimEnd();
    }
    if (inString) {
      repaired += '"';
    }
    while (depth > 0) {
      repaired += '\n}';
      depth--;
    }
    return repaired;
  }

  return null;
}

/**
 * Fallback repair for unescaped double quotes inside JSON string values
 * (e.g. prose quotes like "hello" or SVG attributes if unconstrained output slips).
 */
function repairUnescapedJsonQuotes(raw: string): string {
  let result = '';
  let inString = false;
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];

    if (inString && ch === '\\') {
      result += ch + (raw[i + 1] ?? '');
      i += 2;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        result += ch;
        i++;
        continue;
      }

      // Check whether this quote cleanly terminates a JSON string
      let j = i + 1;
      while (j < raw.length && /\s/.test(raw[j])) j++;
      const nextToken = raw[j];

      if (
        j >= raw.length ||
        nextToken === ',' ||
        nextToken === '}' ||
        nextToken === ']' ||
        nextToken === ':'
      ) {
        inString = false;
        result += ch;
      } else {
        result += '\\"';
      }
      i++;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

export const HOMEWORK_MATH_FORMAT_RULES = `- **MATH FORMATTING & SYNTAX (CRITICAL)**:
  - NEVER place an equation, calculation, or math step on the same line at the end of an explanation sentence (for example, NEVER write "Subtract 2 from both sides then x + 2 = 5" or "We get x + 2 = 5").
  - ALWAYS write the explanation sentence first, leave a blank line, and place the equation or math expression on its OWN separate display line wrapped in $$ ... $$:
    Example:
    Subtract 2 from both sides to isolate $x$:

    $$x + 2 = 5$$
  - Put EVERY equation, arithmetic step, calculation, formula, fraction, root, or exponent (such as $$x + 2 = 5$$ or $$10 + 10 = 20$$) on its own separate $$ ... $$ line.
  - Use inline $ ... $ ONLY for isolated single variables or constants mentioned inside prose (such as $x$, $y$, or $\\pi$), never for equations or multi-term expressions.
  - Inside math delimiters, use clean standard LaTeX (such as \\frac{a}{b}, \\sqrt{x}, \\times, \\div).
  - Use standard Markdown (### headings, - bullet lists, **bold**) for text formatting, never raw LaTeX document commands like \\section* or \\begin{itemize} or \\textbf.`;

const KID_CALLOUT_GUIDE = `- **KID-FRIENDLY CALLOUT BOXES (Markdown blockquotes)**:
  Format callouts across TWO lines (short 2-4 word title after the tag on line 1, explanation on line 2 starting with "> "):
  > [!IDEA] Short Big Idea
  > Explain WHY the concept works using an everyday analogy (pizza, balance scales, steps).
  Supported tags: [!IDEA], [!TIP], [!WATCHOUT], [!CHECK], [!EXAMPLE].`;

const CHAT_DIAGRAM_GUIDE = `- **VISUAL DIAGRAMS IN CHAT**: Whenever a visual makes a step click, emit a fenced diagram JSON block on its own lines (use sparingly when truly helpful):
  - Types: "number_line", "bar_model", "fraction_model", "geometry", "coordinate_grid", "flowchart" ("vertical"|"cycle"|"tree"), "bar_chart", "timeline", "venn", or custom dark-theme "svg".
  - Allowed "color": "purple" | "mint" | "blue" | "amber" | "pink" | "red".`;

const DIAGRAM_TYPES_GUIDE = `Available visual diagram schemas (pick the clearest one for the topic; keep labels short, kid-friendly, and clear; allowed "color" values are "purple", "mint", "blue", "amber", "pink", "red"):
- "number_line": { "type": "number_line", "title": "...", "min": -2, "max": 10, "step": 1, "points": [{"value": 2, "label": "Start", "color": "blue", "open": false}], "hops": [{"from": 2, "to": 5, "label": "+3", "color": "purple"}], "range": {"from": 3, "to": 10, "fromOpen": true, "arrowRight": true, "color": "mint"}, "caption": "..." }
- "fraction_model" or "bar_model": { "type": "fraction_model", "title": "...", "rows": [{"label": "1/2", "total": 2, "filled": 1, "color": "purple"}, {"label": "2/4", "total": 4, "filled": 2, "color": "mint"}], "caption": "..." } OR part-whole bar { "type": "bar_model", "title": "...", "rows": [{"label": "Total = 5", "segments": [{"units": 2, "label": "x (2)", "color": "purple"}, {"units": 3, "label": "+3", "color": "amber"}]}], "caption": "..." }
- "geometry": { "type": "geometry", "title": "...", "shape": "right_triangle"|"triangle"|"rectangle"|"square"|"circle"|"angle", "degrees": 60, "labels": {"a": "3 cm", "b": "4 cm", "c": "5 cm", "radius": "5 cm", "diameter": "10 cm", "top": "...", "left": "...", "right": "...", "bottom": "...", "angle": "90°", "area": "..."}, "caption": "..." }
- "coordinate_grid": { "type": "coordinate_grid", "title": "...", "xMin": -4, "xMax": 6, "yMin": -4, "yMax": 6, "points": [{"x": 0, "y": 1, "label": "(0,1)", "color": "mint"}], "lines": [{"points": [[0,1],[2,5]], "label": "y = 2x + 1", "color": "purple"}], "caption": "..." }
- "flowchart": { "type": "flowchart", "title": "...", "layout": "vertical"|"cycle"|"tree", "nodes": [{"id": "n1", "label": "Short title", "detail": "Kid-friendly clue", "color": "purple"}], "edges": [{"from": "n1", "to": "n2", "label": "-2"}], "caption": "..." }
  - Use "cycle" (3-6 nodes) for water cycle, life cycle, rock cycle, photosynthesis; "tree" for factor trees, grammar trees, classifications; "vertical" for multi-step thinking processes.
- "bar_chart": { "type": "bar_chart", "title": "...", "unit": "...", "bars": [{"label": "Item", "value": 12, "color": "blue"}], "caption": "..." }
- "timeline": { "type": "timeline", "title": "...", "events": [{"date": "1776", "title": "...", "description": "...", "color": "amber"}], "caption": "..." }
- "venn": { "type": "venn", "title": "...", "sets": [{"title": "Group A", "items": ["..."], "color": "purple"}, {"title": "Group B", "items": ["..."], "color": "mint"}], "overlap": {"title": "Both", "items": ["..."]}, "caption": "..." }
- "svg": { "type": "svg", "title": "...", "svg": "<svg viewBox='0 0 360 220' xmlns='http://www.w3.org/2000/svg'>...</svg>", "caption": "..." }
  - Use "svg" ONLY when custom labeled science/geography art is needed (e.g., plant cell organelles, layers of Earth, volcano, circuit, lever, atom, shaded slices). Use single quotes inside SVG attributes, dark-theme friendly bright fills (#A78BFA, #34D399, #60A5FA, #FBBF24, #F472B6, #1B1626 backing, #FFFFFF labels), inline attributes ONLY (NO <script>, NO <style> CSS classes, NO external images), font-size='12', and keep text well spaced cleanly inside viewBox.`;

const HOMEWORK_PROMPT = `You are a warm, extraordinarily clear K-12 tutor at QuizRope teaching children directly.
Your mission is to analyze the student's homework image and craft a visual, deeply educational mini-lesson that ANY child can understand at a glance.

LANGUAGE RULE:
Write ALL explanations, headings, callout titles, table cells, and diagram labels in the SAME language written on the homework image (default to clear, friendly English if unclear).

STRICT JSON OUTPUT:
Return ONLY a single valid raw JSON object (no markdown fences) matching this structure:

{
  "title": "Short kid-friendly title",
  "subject": "MATH|SCIENCE|ENGLISH|HISTORY|GEOGRAPHY",
  "topics": ["topic1", "topic2"],
  "diagrams": [
    {
      "id": "visual1",
      "type": "flowchart|number_line|fraction_model|bar_model|geometry|coordinate_grid|bar_chart|timeline|venn|svg",
      "title": "Helpful visual title",
      "caption": "One sentence explaining what this visual shows"
    }
  ],
  "answers_markdown": "Full rich educational explanation with [[diagram:visual1]] placed right where seeing it helps most."
}

HOW TO MAKE THE LESSON EXTRAORDINARILY EDUCATIONAL FOR KIDS:
1. **Start with Intuition (> [!IDEA])**: Begin with a '> [!IDEA]' callout box explaining *what this topic is really about* and *why it works* in simple everyday words + a relatable kid analogy (pizza, game points, balance scale, steps).
2. **Teach With Visual Diagrams**: Always include **1 to 3 helpful visuals** in the "diagrams" array and embed each one in "answers_markdown" on its own line as [[diagram:visual1]], [[diagram:visual2]], etc., RIGHT where seeing the picture makes the step click!
${DIAGRAM_TYPES_GUIDE}
3. **Guided Bite-Sized Steps**:
   - Use clear headings (### Step 1: ..., ### Step 2: ...) and short 1-3 sentence paragraphs.
   - Never skip reasoning or dump a bare final answer — explain *why* we take each step before writing the math!
   - When comparing rules, properties, conversions, vocabulary, or multi-part cases, include a clean Markdown **table** (| Col | Col |).
4. **Pedagogical Callouts & Review**:
${KID_CALLOUT_GUIDE}
   - End with helpful '> [!TIP]', '> [!WATCHOUT]', and '> [!CHECK]' cards so the student retains the concept and knows how to check their own work!
5. **MATH FORMATTING**:
${HOMEWORK_MATH_FORMAT_RULES}
6. **CRITICAL JSON INTEGRITY**: Keep the lesson rich, clear, and well within token bounds so the returned raw JSON object is always valid and complete.`;

export interface HomeworkDiagramPayload {
  id?: string;
  type: string;
  [key: string]: unknown;
}

interface GeminiHomeworkResult {
  title: string;
  subject: string;
  topics: string[];
  diagrams?: HomeworkDiagramPayload[];
  answers_markdown: string;
}

/**
 * Replaces `[[diagram:id]]` tokens with fenced ```diagram blocks that the mobile
 * client renders interactively, and appends any unreferenced diagrams.
 */
export function injectDiagramsIntoMarkdown(
  markdown: string,
  diagrams?: HomeworkDiagramPayload[],
): string {
  if (!Array.isArray(diagrams) || diagrams.length === 0) {
    return markdown;
  }

  const byId = new Map<string, { idx: number; fence: string }>();
  const fences: { id?: string; fence: string }[] = [];

  diagrams.forEach((diag, idx) => {
    if (!diag || typeof diag !== 'object' || typeof diag.type !== 'string') {
      return;
    }
    const { id, ...specWithoutId } = diag;
    const fence = `\n\n\`\`\`diagram\n${JSON.stringify(specWithoutId)}\n\`\`\`\n\n`;
    const entry = { id, fence };
    fences.push(entry);
    if (typeof id === 'string' && id.trim()) {
      const normalized = id.trim().toLowerCase();
      byId.set(normalized, { idx: fences.length - 1, fence });
    }
  });

  if (fences.length === 0) return markdown;

  const usedIndices = new Set<number>();
  let result = (markdown || '').replace(
    /\[\[\s*diagram\s*:\s*([^\]\s]+)\s*\]\]|\{\{\s*diagram\s*:\s*([^}\s]+)\s*\}\}/gi,
    (_, idA, idB) => {
      const key = (idA || idB || '').trim().toLowerCase();
      const found = byId.get(key);
      if (found) {
        usedIndices.add(found.idx);
        return found.fence;
      }
      return '';
    },
  );

  const unplaced = fences
    .filter((_, idx) => !usedIndices.has(idx))
    .map((f) => f.fence.trim());

  if (unplaced.length > 0) {
    const appendix = unplaced.join('\n\n');
    result = result.trim()
      ? `${result.trim()}\n\n${appendix}`
      : appendix;
  }

  return result.replace(/\n{3,}/g, '\n\n').trim();
}

export function extractStreamChunkText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string') {
        return part.text;
      }
      return '';
    })
    .join('');
}

export function buildHomeworkChatSystemInstruction(params: {
  sessionContext: string;
  subject?: string;
  language?: string;
  conciseFollowUp?: boolean;
}): string {
  const { sessionContext, subject, language, conciseFollowUp } = params;
  const subjectLine = subject ? `\nSubject: ${subject}.` : '';
  const followUpLine = conciseFollowUp
    ? `\n- **STYLE**: When you ask a follow-up check question at the end, keep the question to ONE short friendly sentence.`
    : '';
  const fence = '```';

  return `You are an encouraging K-12 tutor assistant in QuizRope — an educational tug-of-war quiz app for children.
Your ONLY job is to help the student understand their homework.${subjectLine}
Homework content for context:
${sessionContext}

STRICT RULES — follow all of these without exception:
1. ONLY discuss the student's homework and related school subjects. If asked about anything unrelated, politely decline and redirect to the homework.
2. NEVER simply give the final answer — always guide, explain, and scaffold so the student actually learns.
3. NEVER discuss violence, adult content, personal information, politics, religion, or anything inappropriate for children.
4. NEVER impersonate other people, claim to be human, or role-play as a different AI system.
5. Keep all language simple, warm, encouraging, and easy for K-12 kids to understand.
6. If a student mentions personal distress or safety concerns, respond with care and encourage them to talk to a trusted adult.

TEACHING & VISUAL GUIDE:
- Explain the "why" in plain everyday words with analogies before showing formulas.
${KID_CALLOUT_GUIDE}
${CHAT_DIAGRAM_GUIDE}
- Put diagram JSON inside ${fence}diagram ... ${fence} only when visual structure truly helps.${followUpLine}
${HOMEWORK_MATH_FORMAT_RULES}
7. Always respond in the language identified by this BCP-47 code: ${language || 'en'}.`;
}

@Injectable()
export class HomeworkService {
  private readonly logger = new Logger(HomeworkService.name);

  constructor(
    @InjectModel(HomeworkSession.name)
    private sessionModel: Model<HomeworkSession>,
    @InjectModel(HomeworkChat.name)
    private chatModel: Model<HomeworkChat>,
    @InjectModel(Child.name)
    private childModel: Model<Child>,
  ) {}

  async analyze(
    parentId: string,
    imageBase64: string,
    mimeType: string,
    childId?: string,
  ): Promise<HomeworkSession> {
    // Validate the childId belongs to this parent before associating
    if (childId && Types.ObjectId.isValid(childId)) {
      const child = await this.childModel.findOne({
        _id: new Types.ObjectId(childId),
        parentId: new Types.ObjectId(parentId),
      });
      if (!child) {
        throw new ForbiddenException('Child does not belong to this parent');
      }
    }

    const session = await this.sessionModel.create({
      parentId: new Types.ObjectId(parentId),
      ...(childId && Types.ObjectId.isValid(childId) ? { childId: new Types.ObjectId(childId) } : {}),
      imageBase64,
      imageMimeType: mimeType,
      status: 'PROCESSING',
    });

    this.runAnalysis(session._id.toString(), imageBase64, mimeType).catch(
      async (err) => {
        this.logger.error(
          `\n❌ Homework analysis background task failed for ${session._id}: ${err.message}`,
          err.stack,
        );
        await this.sessionModel.findByIdAndUpdate(session._id, {
          status: 'FAILED',
          errorMessage: err.message,
        });
      },
    );

    return session;
  }
  private createVisionModel(apiKey: string): ChatGoogleGenerativeAI {
    return new ChatGoogleGenerativeAI({
      model: GEMINI_MODEL,
      apiKey,
      maxOutputTokens: 8192,
      temperature: 0.1,
      json: true,
      thinkingConfig: { thinkingBudget: 512 },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    });
  }

  private parseHomeworkResult(
    text: string,
    contextLabel: string,
  ): {
    title: string;
    subject: string;
    topics: string[];
    answersMarkdown: string;
  } {
    const extracted = extractJsonObject(text);
    if (!extracted) {
      this.logger.error(
        `\n❌ [Gemini] ${contextLabel} — no JSON object.\nRaw text received:\n${text}\n`,
      );
      throw new Error(`Gemini returned invalid response: ${text.slice(0, 300)}`);
    }

    let result: GeminiHomeworkResult;
    const sanitized = sanitizeJson(extracted);
    try {
      result = JSON.parse(sanitized);
    } catch (firstErr: any) {
      try {
        const repairedQuotes = sanitizeJson(repairUnescapedJsonQuotes(extracted));
        result = JSON.parse(repairedQuotes);
        this.logger.warn(
          `[Gemini] ${contextLabel} recovered from unescaped JSON quotes.`,
        );
      } catch (err: any) {
        this.logger.error(
          `\n❌ [Gemini] ${contextLabel} — invalid JSON: ${firstErr.message}\nRaw JSON candidate:\n${extracted}\n`,
          err.stack,
        );
        throw new Error(`Invalid JSON format: ${firstErr.message}`);
      }
    }

    const validSubjects = ['MATH', 'SCIENCE', 'ENGLISH', 'HISTORY', 'GEOGRAPHY'];
    const subject = validSubjects.includes(result.subject?.toUpperCase())
      ? result.subject.toUpperCase()
      : 'SCIENCE';

    const cleanedMarkdown = normalizeEscapedProseNewlines(
      result.answers_markdown || '',
    );
    const answersMarkdown = injectDiagramsIntoMarkdown(
      cleanedMarkdown,
      result.diagrams,
    );

    return {
      title: result.title || 'Homework',
      subject,
      topics: result.topics || [],
      answersMarkdown,
    };
  }

  private async runAnalysis(
    sessionId: string,
    base64: string,
    mimeType: string,
  ): Promise<void> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    this.logger.log(`[Gemini] Invoking homework analysis for session=${sessionId} model=${GEMINI_MODEL}`);

    const model = this.createVisionModel(apiKey);

    let response: Awaited<ReturnType<typeof model.invoke>>;
    try {
      response = await model.invoke([
        new HumanMessage({
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
            { type: 'text', text: HOMEWORK_PROMPT },
          ],
        }),
      ]);
    } catch (err: any) {
      this.logger.error(
        `\n❌ [Gemini] Homework analysis invoke failed session=${sessionId}:\n` +
          `Error: ${err.message}\n` +
          `Status: ${err.status || err.code || 'UNKNOWN'}\n` +
          `Details: ${JSON.stringify(err.response?.data || err.cause || err)}\n`,
        err.stack,
      );
      throw err;
    }

    const text =
      extractStreamChunkText(response.content) ||
      (typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content));

    const parsed = this.parseHomeworkResult(
      text,
      `Homework analysis session=${sessionId}`,
    );

    await this.sessionModel.findByIdAndUpdate(sessionId, {
      status: 'READY',
      title: parsed.title,
      subject: parsed.subject,
      topics: parsed.topics,
      answersMarkdown: parsed.answersMarkdown,
    });

    this.logger.log(`[Gemini] Homework session=${sessionId} analyzed OK subject=${parsed.subject} topics=${parsed.topics.length}`);
  }

  async getSession(sessionId: string, userId: string, role: 'parent' | 'child' = 'parent'): Promise<HomeworkSession> {
    if (!Types.ObjectId.isValid(sessionId)) throw new NotFoundException();
    
    const query: any = { _id: sessionId };
    if (role === 'child') {
      query.childId = new Types.ObjectId(userId);
    } else {
      query.parentId = new Types.ObjectId(userId);
    }

    const session = await this.sessionModel.findOne(query);
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async getSessionRaw(sessionId: string): Promise<HomeworkSession> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async getSessions(userId: string, role: 'parent' | 'child' = 'parent'): Promise<HomeworkSession[]> {
    const query: any = {};
    if (role === 'child') {
      query.childId = new Types.ObjectId(userId);
    } else {
      query.parentId = new Types.ObjectId(userId);
    }

    return this.sessionModel
      .find(query)
      .sort({ createdAt: -1 })
      .select('-imageBase64') // don't return full base64 in list
      .lean<HomeworkSession[]>();
  }

  async fetchChatHistory(sessionId: string): Promise<HomeworkChat[]> {
    return this.chatModel
      .find({ sessionId: new Types.ObjectId(sessionId) })
      .sort({ createdAt: 1 })
      .lean<HomeworkChat[]>();
  }

  async getChatHistory(sessionId: string, userId: string, role: 'parent' | 'child' = 'parent'): Promise<HomeworkChat[]> {
    await this.getSession(sessionId, userId, role);
    return this.fetchChatHistory(sessionId);
  }

  async getPaginatedChatHistory(
    sessionId: string,
    userId: string,
    skip: number,
    limit: number,
    role: 'parent' | 'child' = 'parent',
  ): Promise<HomeworkChat[]> {
    await this.getSession(sessionId, userId, role);

    return this.chatModel
      .find({ sessionId: new Types.ObjectId(sessionId) })

      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean<HomeworkChat[]>();
  }

  async saveMessage(
    sessionId: string,
    role: 'user' | 'ai',
    content: string,
  ): Promise<HomeworkChat> {
    return this.chatModel.create({
      sessionId: new Types.ObjectId(sessionId),
      role,
      content,
    });
  }

  /**
   * Summarizes a batch of older messages and appends to the session's chatSummary.
   * This implements "Context Engineering" to prevent linear prompt scaling while
   * retaining infinite memory of the conversation.
   */
  async summarizeConversationContext(sessionId: string): Promise<void> {
    const session = await this.getSessionRaw(sessionId);
    const history = await this.fetchChatHistory(sessionId);

    const KEEP_UNSUMMARIZED_BUFFER = 6;
    const SUMMARY_BATCH_SIZE = 10;
    
    // Total number of messages that theoretically *can* be summarized right now
    const summarizeableCount = history.length - KEEP_UNSUMMARIZED_BUFFER;
    
    // We only trigger a summary if we have accumulated enough unsummarized messages
    const unsummarizedCount = summarizeableCount - (session.summarizedMessageCount || 0);

    if (unsummarizedCount < SUMMARY_BATCH_SIZE) {
      return; // Not enough new messages to justify a summary pass yet
    }

    // Grab the exact slice of messages to summarize (from last summary point to the buffer)
    const startIndex = session.summarizedMessageCount || 0;
    const endIndex = startIndex + unsummarizedCount;
    const messagesToSummarize = history.slice(startIndex, endIndex);

    if (messagesToSummarize.length === 0) return;

    this.logger.log(`Summarizing ${messagesToSummarize.length} messages for session ${sessionId}...`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn('Skipping summarization: GEMINI_API_KEY not configured');
      return;
    }

    const model = new ChatGoogleGenerativeAI({
      model: GEMINI_MODEL,
      apiKey,
      maxOutputTokens: 1024, // High level abstract summary
      temperature: 0.1, // Keep it deterministic and factual
    });

    const conversationText = messagesToSummarize
      .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
      .join('\n\n');

    let summaryPrompt = `You are a conversation summarizer for QuizRope, a K-12 educational app.
Compress the following exchange between a Student and a Tutor into a dense, factual summary.
Keep absolutely all important facts, concepts discussed, and the student's current level of understanding.
Do NOT output conversational filler, greetings, or any content unrelated to the educational subject matter.
STRICT: Never summarize or retain any content that is off-topic, inappropriate for children, or outside the scope of K-12 homework.`;

    if (session.chatSummary) {
      summaryPrompt += `\n\nThere is already an existing summary of previous messages. Update and append to this existing summary based on the new exchange.

EXISTING SUMMARY:
${session.chatSummary}`;
    }

    summaryPrompt += `\n\nNEW CONVERSATION TO SUMMARIZE:
${conversationText}`;

    try {
      const response = await model.invoke([new HumanMessage(summaryPrompt)]);
      const newSummaryText = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);

      await this.sessionModel.findByIdAndUpdate(sessionId, {
        chatSummary: newSummaryText.trim(),
        summarizedMessageCount: endIndex,
      });

      this.logger.log(`Successfully updated conversation summary for session ${sessionId} (Count: ${endIndex})`);
    } catch (error) {
      this.logger.error(`Context summarization failed for session ${sessionId}:`, error.message);
    }
  }

  async linkMatch(sessionId: string, matchId: string): Promise<void> {
    await this.sessionModel.findByIdAndUpdate(sessionId, {
      linkedMatchId: new Types.ObjectId(matchId),
      quizTaken: true,
      $addToSet: { linkedMatchIds: new Types.ObjectId(matchId) },
    });
  }

  /** Stateless: analyze homework synchronously — no DB writes. For guest mode. */
  async analyzeGuestStateless(
    imageBase64: string,
    mimeType: string,
  ): Promise<{ title: string; subject: string; topics: string[]; answersMarkdown: string; status: string }> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    this.logger.log(`[Gemini] Invoking guest stateless analysis model=${GEMINI_MODEL}`);

    const model = this.createVisionModel(apiKey);

    let response: Awaited<ReturnType<typeof model.invoke>>;
    try {
      response = await model.invoke([
        new HumanMessage({
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            { type: 'text', text: HOMEWORK_PROMPT },
          ],
        }),
      ]);
    } catch (err: any) {
      this.logger.error(
        `\n❌ [Gemini] Guest stateless analysis invoke failed:\n` +
          `Error: ${err.message}\n` +
          `Status: ${err.status || err.code || 'UNKNOWN'}\n` +
          `Details: ${JSON.stringify(err.response?.data || err.cause || err)}\n`,
        err.stack,
      );
      throw err;
    }

    const text =
      extractStreamChunkText(response.content) ||
      (typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content));

    const parsed = this.parseHomeworkResult(text, 'Guest stateless analysis');

    this.logger.log(`[Gemini] Guest stateless analysis OK subject=${parsed.subject} topics=${parsed.topics.length}`);
    return {
      ...parsed,
      status: 'READY',
    };
  }

  /** Stateless: single-turn chat with session context — no DB writes. For guest mode. */
  async guestChatStateless(
    sessionContext: string,
    history: { role: 'user' | 'model'; content: string }[],
    message: string,
  ): Promise<{ response: string }> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    this.logger.log(`[Gemini] Guest chat invoke model=${GEMINI_MODEL} historyLen=${history.length} msgLen=${message.length}`);

    const systemInstruction = buildHomeworkChatSystemInstruction({
      sessionContext,
    });

    const model = new ChatGoogleGenerativeAI({
      model: GEMINI_MODEL,
      apiKey,
      maxOutputTokens: 2560,
      temperature: 0.7,
      thinkingConfig: { thinkingBudget: 0 },
    });

    const msgs = [
      new SystemMessage(systemInstruction),
      ...history.map((m) => m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)),
      new HumanMessage(message),
    ];

    let response: Awaited<ReturnType<typeof model.invoke>>;
    try {
      response = await model.invoke(msgs);
    } catch (err: any) {
      this.logger.error(
        `\n❌ [Gemini] Guest chat invoke failed:\n` +
          `Error: ${err.message}\n` +
          `Status: ${err.status || err.code || 'UNKNOWN'}\n` +
          `Details: ${JSON.stringify(err.response?.data || err.cause || err)}\n`,
        err.stack,
      );
      throw err;
    }

    const text = extractStreamChunkText(response.content) || JSON.stringify(response.content);
    this.logger.log(`[Gemini] Guest chat OK responseLen=${text.length}`);
    return { response: text };
  }

  /** Stateless: streaming single-turn chat — sends tokens as an async iterable. For guest mode via socket.io. */
  async *guestChatStream(
    sessionContext: string,
    history: { role: 'user' | 'model'; content: string }[],
    message: string,
    signal?: AbortSignal,
    language?: string,
  ): AsyncIterable<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    // Truncate context to avoid bloating every request with the full homework analysis
    const context = sessionContext.length > 3000
      ? sessionContext.slice(0, 3000) + '\n...[truncated]'
      : sessionContext;

    const systemInstruction = buildHomeworkChatSystemInstruction({
      sessionContext: context,
      language,
      conciseFollowUp: true,
    });

    const model = new ChatGoogleGenerativeAI({
      model: GEMINI_MODEL,
      apiKey,
      maxOutputTokens: 2560,
      temperature: 0.7,
      thinkingConfig: { thinkingBudget: 0 },
    });

    const msgs = [
      new SystemMessage(systemInstruction),
      ...history.map((m) =>
        m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
      ),
      new HumanMessage(message),
    ];

    try {
      const stream = await model.stream(msgs, signal ? ({ signal } as any) : undefined);
      for await (const chunk of stream) {
        if (signal?.aborted) break;
        const token = extractStreamChunkText(chunk.content);
        if (token) yield token;
      }
    } catch (err: any) {
      // Normal cancellation / client disconnect — don't treat as an unexpected error
      if (
        signal?.aborted ||
        err.name === 'AbortError' ||
        err.message?.includes('aborted') ||
        err.message?.includes('reading from the stream')
      ) {
        this.logger.log('[Gemini] guestChatStream aborted cleanly by client.');
        return;
      }

      this.logger.error(
        `\n❌ [Gemini] guestChatStream failed:\n` +
          `Error: ${err.message}\n` +
          `Status: ${err.status || err.code || 'UNKNOWN'}\n` +
          `Details: ${JSON.stringify(err.response?.data || err.cause || err)}\n`,
        err.stack,
      );
      throw err;
    }
  }

  /** Create a homework session for a ghost (guest) user — no parent account needed. */
  async analyzeForGuest(
    guestId: string,
    imageBase64: string,
    mimeType: string,
  ): Promise<HomeworkSession> {
    const session = await this.sessionModel.create({
      guestId,
      imageBase64,
      imageMimeType: mimeType,
      status: 'PROCESSING',
    });

    this.runAnalysis(session._id.toString(), imageBase64, mimeType).catch(
      async (err) => {
        this.logger.error(
          `\n❌ Ghost homework analysis background task failed for ${session._id}: ${err.message}`,
          err.stack,
        );
        await this.sessionModel.findByIdAndUpdate(session._id, {
          status: 'FAILED',
          errorMessage: err.message,
        });
      },
    );

    return session;
  }

  /** Retrieve homework sessions for a ghost user by guestId. */
  async getGhostSessions(guestId: string): Promise<HomeworkSession[]> {
    return this.sessionModel
      .find({ guestId })
      .sort({ createdAt: -1 })
      .select('-imageBase64')
      .lean<HomeworkSession[]>();
  }

  /** Retrieve a single ghost session (no parentId check). */
  async getGhostSession(sessionId: string, guestId: string): Promise<HomeworkSession> {
    if (!Types.ObjectId.isValid(sessionId)) throw new NotFoundException();
    const session = await this.sessionModel.findOne({ _id: sessionId, guestId });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  /**
   * Erases all data associated with a child (sessions, chats).
   */
  async deleteAllByChild(childId: string): Promise<void> {
    const oid = new Types.ObjectId(childId);

    // 1. Delete all homework sessions
    await this.sessionModel.deleteMany({ childId: oid });

    // 2. Delete all homework chats related to this child
    await this.chatModel.deleteMany({ childId: oid });

    this.logger.log(`All homework data for child ${childId} erased.`);
  }
}
