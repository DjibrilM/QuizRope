import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("AllExceptionsFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const resBody =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof resBody === "object" && resBody !== null
        ? (resBody as any).message || resBody
        : exception instanceof Error
          ? exception.message
          : "Internal server error";

    const stack = exception instanceof Error ? exception.stack : undefined;

    this.logger.error(
      `\n==================== [HTTP EXCEPTION] ====================\n` +
        `Timestamp: ${new Date().toISOString()}\n` +
        `Request:   ${request.method} ${request.url}\n` +
        `Status:    ${status}\n` +
        `Message:   ${typeof message === "object" ? JSON.stringify(message, null, 2) : message}\n` +
        (request.body && Object.keys(request.body).length > 0
          ? `Body:      ${JSON.stringify(request.body, null, 2)}\n`
          : "") +
        `Stack:     ${stack || "No stack trace"}\n` +
        `==========================================================\n`,
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}

