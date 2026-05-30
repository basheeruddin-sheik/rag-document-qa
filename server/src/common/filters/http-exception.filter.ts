import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Global exception filter: standardises ALL error responses.
// Without this, NestJS returns different shapes for different errors.
// With this, every error looks like:
//   { statusCode, message, path, timestamp }
//
// It also logs server errors (5xx) via NestJS Logger so they appear in logs.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Log 5xx errors as proper errors; 4xx are just warnings
    if (status >= 500) {
      this.logger.error(
        `[${req.method}] ${req.url} → ${status}`,
        (exception as Error)?.stack,
      );
    } else {
      this.logger.warn(`[${req.method}] ${req.url} → ${status}`);
    }

    res.status(status).json({
      statusCode: status,
      message:
        typeof message === 'object' && 'message' in (message as object)
          ? (message as any).message
          : message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
