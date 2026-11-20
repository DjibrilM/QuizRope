import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Logger, Inject, forwardRef } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChildrenService } from "../children/children.service";
import {
  HomeworkService,
  buildHomeworkChatSystemInstruction,
  extractStreamChunkText,
} from "../homework/homework.service";
import { GEMINI_MODEL } from "../constants";

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
      : process.env.NODE_ENV === "production"
        ? false
        : true,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  // Active AI streams — aborted when client emits homework:stop or disconnects
  private activeStreams = new Map<string, AbortController>();

  constructor(
    @Inject(forwardRef(() => ChildrenService))
    private childrenService: ChildrenService,
    private homeworkService: HomeworkService,
  ) {}

  afterInit() {
    this.logger.log("WebSocket Gateway initialized (Socket.io)");
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // Abort any active AI stream for this client
    this.activeStreams.get(client.id)?.abort();
    this.activeStreams.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("qr:create")
  async handleQRCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { parentId: string },
  ) {
    try {
      const session = await this.childrenService.createQRSession(data.parentId);
      client.emit("qr:create", {
        sessionToken: session.sessionToken,
        qrData: session.qrData,
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      client.emit("error", { message: error.message });
    }
  }

  @SubscribeMessage("qr:join")
  async handleQRJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionToken: string; childId: string },
  ) {
    try {
      const session = await this.childrenService.validateSession(
        data.sessionToken,
      );
      if (!session) {
        client.emit("error", { message: "Invalid or expired session" });
        return;
      }

      await this.childrenService.linkChildToSession(
        data.sessionToken,
        data.childId,
      );

      client.emit("qr:linked", { success: true, parentId: session.parentId });
      this.logger.log(`Child ${data.childId} linked via QR session`);
    } catch (error) {
      client.emit("error", { message: error.message });
    }
  }

  @SubscribeMessage("session:watch")
  handleSessionWatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionToken?: string; childId?: string },
  ) {
    if (data?.sessionToken) {
      client.join(`session:${data.sessionToken.toUpperCase()}`);
    }
    if (data?.childId) {
      client.join(`child:${data.childId}`);
    }
    this.logger.log(
      `Client ${client.id} watching session=${data?.sessionToken ?? "-"} child=${data?.childId ?? "-"}`,
    );
  }

  emitSessionAuthorized(
    sessionToken: string,
    data: { parentId: string; childId?: string | null },
  ) {
    const room = `session:${sessionToken.toUpperCase()}`;
    this.server.to(room).emit("session:authorized", data);
    this.logger.log(`Session ${sessionToken} authorized, notified room`);
  }

  emitGuestLinkRedeemed(
    code: string,
    data: { parentId: string; childId: string; displayName?: string },
  ) {
    const room = `session:${code.toUpperCase()}`;
    this.server.to(room).emit("guest-link:redeemed", data);
    this.logger.log(`Guest link ${code} redeemed, notified room`);
  }

  emitChildDeleted(sessionToken: string, childId: string) {
    const room = `session:${sessionToken.toUpperCase()}`;
    this.server.to(room).emit("child:deleted", { childId });
    this.server.to(`child:${childId}`).emit("child:deleted", { childId });
    this.logger.log(
      `Child ${childId} deleted, notified session ${sessionToken}`,
    );
  }

  emitChildDeletedToChild(childId: string) {
    this.server.to(`child:${childId}`).emit("child:deleted", { childId });
    this.logger.log(`Child ${childId} deleted, notified child room`);
  }

  emitChildUnlinked(childId: string, sessionTokens: string[] = []) {
    for (const token of sessionTokens) {
      this.server
        .to(`session:${token.toUpperCase()}`)
        .emit("child:unlinked", { childId });
    }
    this.server.to(`child:${childId}`).emit("child:unlinked", { childId });
    this.logger.log(`Child ${childId} unlinked, notified device rooms`);
  }

  // ─── Homework chat ───────────────────────────────────────────────────────────

  @SubscribeMessage("homework:join")
  handleHomeworkJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    client.join(`hw:${data.sessionId}`);
    this.logger.log(
      `Client ${client.id} joined homework session ${data.sessionId}`,
    );
  }

  @SubscribeMessage("homework:chat")
  async handleHomeworkChat(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { sessionId: string; message: string; language?: string },
  ) {
    const { sessionId, message, language } = data;

    this.logger.log(
      `[Gemini] homework:chat start session=${sessionId} client=${client.id} msgLen=${message.length}`,
    );

    const controller = new AbortController();
    this.activeStreams.set(client.id, controller);

    try {
      const [session, history] = await Promise.all([
        this.homeworkService.getSessionRaw(sessionId),
        this.homeworkService.fetchChatHistory(sessionId),
        this.homeworkService.saveMessage(sessionId, "user", message),
      ]);

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        this.logger.error(
          `[Gemini] homework:chat aborted — GEMINI_API_KEY not configured session=${sessionId}`,
        );
        client.emit("homework:error", "AI not configured");
        return;
      }

      const model = new ChatGoogleGenerativeAI({
        model: GEMINI_MODEL,
        apiKey,
        maxOutputTokens: 2560,
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 },
      });

      const rawContext = session.answersMarkdown || "";
      const sessionContext =
        rawContext.length > 3000
          ? rawContext.slice(0, 3000) + "\n...[truncated]"
          : rawContext;

      let systemInstruction = buildHomeworkChatSystemInstruction({
        sessionContext,
        subject: session.subject || "General",
        language,
      });

      if (session.chatSummary) {
        systemInstruction += `\n\nHere is a summary of the conversation so far, for context:\n${session.chatSummary}`;
      }

      // Only pass unsummarized history exactly to prevent redundant token usage
      const unsummarizedStartIndex = session.summarizedMessageCount || 0;
      const conversationMessages = history
        .slice(unsummarizedStartIndex)
        .map((m) => ({
          role: m.role === "user" ? ("human" as const) : ("ai" as const),
          content: m.content,
        }));

      const msgs = [
        new SystemMessage(systemInstruction),
        ...conversationMessages.map((m) =>
          m.role === "human"
            ? new HumanMessage(m.content)
            : new AIMessage(m.content),
        ),
        new HumanMessage(message),
      ];

      let fullResponse = "";

      this.logger.log(
        `[Gemini] homework:chat streaming session=${sessionId} model=${GEMINI_MODEL} historyLen=${history.length}`,
      );

      try {
        const stream = await model.stream(msgs, {
          signal: controller.signal,
        } as any);

        for await (const chunk of stream) {
          if (controller.signal.aborted) break;
          const token = extractStreamChunkText(chunk.content);
          if (token) {
            fullResponse += token;
            client.emit("homework:token", token);
          }
        }
      } catch (err: any) {
        if (!controller.signal.aborted) {
          this.logger.error(
            `[Gemini] homework:chat stream error session=${sessionId}: ${err.message}`,
            err.stack,
          );
          throw err;
        }
        this.logger.log(
          `[Gemini] homework:chat stream aborted by client session=${sessionId}`,
        );
      }

      // Save whatever was generated (full or partial)
      if (fullResponse) {
        const saved = await this.homeworkService.saveMessage(
          sessionId,
          "ai",
          fullResponse,
        );
        this.logger.log(
          `[Gemini] homework:chat done session=${sessionId} responseLen=${fullResponse.length}`,
        );
        client.emit("homework:done", saved);

        // Fire and forget the background summarization logic so it doesn't block the connection
        this.homeworkService
          .summarizeConversationContext(sessionId)
          .catch((err) => {
            this.logger.error(
              "Failed to run background context summarization:",
              err.message,
            );
          });
      } else {
        client.emit("homework:stopped");
      }
    } catch (error: any) {
      this.logger.error(
        `\n❌ [Gemini] homework:chat unhandled error session=${sessionId}: ${error.message}`,
        error.stack,
      );
      client.emit(
        "homework:error",
        error.message || "Failed to generate response. Please try again.",
      );
    } finally {
      this.activeStreams.delete(client.id);
    }
  }

  @SubscribeMessage("homework:guest-chat")
  async handleGuestHomeworkChat(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionContext: string;
      history: { role: "user" | "model"; content: string }[];
      message: string;
      language?: string;
    },
  ) {
    const controller = new AbortController();
    this.activeStreams.set(client.id, controller);

    try {
      let fullResponse = "";
      const stream = this.homeworkService.guestChatStream(
        data.sessionContext || "",
        data.history || [],
        data.message,
        controller.signal,
        data.language,
      );

      for await (const token of stream) {
        if (controller.signal.aborted) break;
        fullResponse += token;
        client.emit("homework:token", token);
      }

      if (controller.signal.aborted) {
        client.emit("homework:stopped");
      } else if (fullResponse) {
        client.emit("homework:done", {
          _id: `guest-${Date.now()}`,
          role: "ai",
          content: fullResponse,
        });
      } else {
        client.emit("homework:stopped");
      }
    } catch (err: any) {
      if (
        controller.signal.aborted ||
        err.name === "AbortError" ||
        err.message?.includes("aborted") ||
        err.message?.includes("reading from the stream")
      ) {
        client.emit("homework:stopped");
      } else {
        this.logger.error(
          `\n❌ [Gemini] homework:guest-chat error: ${err.message}`,
          err.stack,
        );
        client.emit(
          "homework:error",
          err.message || "Failed to generate response. Please try again.",
        );
      }
    } finally {
      this.activeStreams.delete(client.id);
    }
  }

  @SubscribeMessage("homework:stop")
  handleHomeworkStop(@ConnectedSocket() client: Socket) {
    const controller = this.activeStreams.get(client.id);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(client.id);
    }
  }
}
