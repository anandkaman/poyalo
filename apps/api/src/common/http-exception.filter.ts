import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ErrorCode, ErrorEnvelope } from '@poyalo/contracts';
import { AppException } from './app-exception';

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'MAINTENANCE',
};

/** Every error leaves the API as the D3 §3 error envelope, with a stable `code`. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const meta = { request_id: req.ctx?.requestId ?? '' };

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ErrorEnvelope['error'] = { code: 'INTERNAL_ERROR', message: 'Something went wrong' };

    if (exception instanceof AppException) {
      status = exception.getStatus();
      body = { code: exception.code, message: exception.message, details: exception.details };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : String((response as { message?: unknown }).message ?? exception.message);
      body = { code: STATUS_TO_CODE[status] ?? 'INTERNAL_ERROR', message };
    } else {
      this.logger.error({ err: exception, request_id: meta.request_id }, 'Unhandled exception');
    }

    if (body.details === undefined) delete body.details;
    res.status(status).json({ error: body, meta } satisfies ErrorEnvelope);
  }
}
