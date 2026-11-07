import { Logger } from "@nestjs/common";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GEMINI_MODEL } from "../constants";

const logger = new Logger("GeminiConfig");

export let isGeminiConfigured = false;
let langchainModel: ChatGoogleGenerativeAI | null = null;

export function initializeGemini() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    logger.error(
      "Missing Gemini API key. Set GEMINI_API_KEY to enable AI question generation.",
    );
    isGeminiConfigured = false;
    return null;
  }

  try {
    const modelName = process.env.GEMINI_MODEL || GEMINI_MODEL;
    langchainModel = new ChatGoogleGenerativeAI({
      model: modelName,
      apiKey,
      temperature: 0.7,
      maxOutputTokens: 8192,
    });
    isGeminiConfigured = true;
    logger.log(`Gemini AI initialized via LangChain with model: ${modelName}`);
    return langchainModel;
  } catch (error) {
    logger.error("Gemini initialization failed:", error.message);
    isGeminiConfigured = false;
    return null;
  }
}

export function getLangChainModel(): ChatGoogleGenerativeAI | null {
  if (!langchainModel && process.env.GEMINI_API_KEY) {
    initializeGemini();
  }
  return langchainModel;
}
