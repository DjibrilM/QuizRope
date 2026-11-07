import {
  BadRequestException,
  BadGatewayException,
  ServiceUnavailableException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Question } from "./schemas/question.schema";
import { isGeminiConfigured } from "../config/gemini.config";
import { invokeQuestionGraph } from "./question.graph";

@Injectable()
export class QuestionProviderService {
  private readonly logger = new Logger(QuestionProviderService.name);

  constructor(
    @InjectModel(Question.name) private questionModel: Model<Question>,
  ) {}

  /**
   * @param threadId Unique ID per match/session — the graph uses this to
   * persist conversation history so Gemini never repeats questions.
   */
  async getQuestions(
    subject: string,
    difficulty: string,
    count: number = 10,
    threadId?: string,
    context?: string,
    language?: string,
  ): Promise<Question[]> {
    if (!isGeminiConfigured) {
      this.logger.error("Gemini is not configured — refusing to generate questions.");
      throw new ServiceUnavailableException(
        "AI question generation is unavailable: GEMINI_API_KEY is not configured.",
      );
    }

    try {
      this.logger.log(
        `[Gemini] Starting AI question generation: subject=${subject} difficulty=${difficulty} count=${count} thread=${threadId}`,
      );
      const questions = await this.generateWithGraph(
        subject,
        difficulty,
        count,
        threadId,
        context,
        language,
      );

      if (!questions || questions.length === 0) {
        throw new BadGatewayException("Gemini returned an empty list of questions.");
      }

      return questions;
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }

      this.logger.error(
        `[Gemini] Question generation failed: ${error.message}`,
        error.stack,
      );
      throw new BadGatewayException(
        `Failed to reach or generate questions from Gemini AI: ${error.message}`,
      );
    }
  }

  private async generateWithGraph(
    subject: string,
    difficulty: string,
    count: number,
    threadId?: string,
    context?: string,
    language?: string,
  ): Promise<Question[]> {
    const thread = threadId || `oneoff-${Date.now()}`;

    const parsed = await invokeQuestionGraph(
      subject,
      difficulty,
      count,
      thread,
      context,
      language,
    );

    const questions = await Promise.all(
      parsed.map((q: any) =>
        this.questionModel.create({
          ...q,
          subject,
          difficulty,
          generatedBy: "langchain-gemini",
        }),
      ),
    );

    this.logger.log(
      `Generated ${questions.length} questions via LangGraph/Gemini (thread: ${thread})`,
    );
    return questions;
  }

  /**
   * Generate questions without persisting them to MongoDB.
   * Used by stateless guest endpoints.
   */
  async generateRaw(
    subject: string,
    difficulty: string,
    count: number,
    context?: string,
    language?: string,
  ): Promise<
    {
      text: string;
      options: string[];
      correctIndex: number;
      subject: string;
      difficulty: string;
      explanation: string;
    }[]
  > {
    if (!isGeminiConfigured) {
      this.logger.error("Gemini is not configured — refusing to generate questions.");
      throw new ServiceUnavailableException(
        "AI question generation is unavailable: GEMINI_API_KEY is not configured.",
      );
    }

    try {
      const thread = `guest-${Date.now()}`;
      const parsed = await invokeQuestionGraph(
        subject,
        difficulty,
        count,
        thread,
        context,
        language,
      );

      if (!parsed || parsed.length === 0) {
        throw new BadGatewayException("Gemini returned an empty list of questions.");
      }

      return parsed.map((q: any) => ({
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
        subject: subject.toUpperCase(),
        difficulty: difficulty.toUpperCase(),
        explanation: q.explanation || "",
      }));
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }

      this.logger.error(
        `[Gemini] Question generation failed for guest: ${error.message}`,
        error.stack,
      );
      throw new BadGatewayException(
        `Failed to reach or generate questions from Gemini AI: ${error.message}`,
      );
    }
  }
}
