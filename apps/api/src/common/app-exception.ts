import { HttpException } from '@nestjs/common';
import { type ErrorCode, httpStatusFor } from '@poyalo/contracts';

/** Throw this for every expected failure. The filter turns it into the D3 §3 error envelope. */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, httpStatusFor(code));
  }
}
