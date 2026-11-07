import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  // Warn if using default JWT secret in production
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret && process.env.NODE_ENV === "production") {
    logger.error(
      "JWT_SECRET environment variable is not set! This is a critical security risk in production.",
    );
    process.exit(1);
  }
  if (!jwtSecret) {
    logger.warn(
      "JWT_SECRET not set — using dev fallback. Set JWT_SECRET in production!",
    );
  }

  // Disable NestJS built-in body parser (default 100 kb) so our custom limit applies
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Re-register body parser with a 10 mb limit for JSON endpoints (images now use multer)
  app.use(require("express").json({ limit: "10mb" }));
  app.use(require("express").urlencoded({ limit: "10mb", extended: true }));

  // CORS: allow specific origins in production, permissive in dev
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : undefined;

  app.enableCors({
    origin: "*",
    credentials: true,
  });

  console.log(process.env.GEMINI_API_KEY);

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  // Prevent aborted AI stream rejections from crashing the Node.js process
  process.on("unhandledRejection", (reason: any) => {
    if (
      reason?.message?.includes("reading from the stream") ||
      reason?.name === "AbortError" ||
      reason?.name === "GoogleGenerativeAIAbortError" ||
      reason?.message?.includes("aborted")
    ) {
      logger.log("[Stream] AI stream aborted cleanly by client disconnect.");
      return;
    }
    logger.error("Unhandled Promise Rejection:", reason?.stack || reason);
  });

  process.on("uncaughtException", (error: any) => {
    if (
      error?.message?.includes("reading from the stream") ||
      error?.name === "AbortError" ||
      error?.name === "GoogleGenerativeAIAbortError" ||
      error?.message?.includes("aborted")
    ) {
      logger.log("[Stream] Uncaught stream abort exception handled gracefully.");
      return;
    }
    logger.error("Uncaught Exception:", error?.stack || error);
  });

  const port = process.env.PORT || 3000;
  console.log(port);
  await app.listen(port);
  logger.log(`Server running on http://localhost:${port}`);
}
bootstrap();
