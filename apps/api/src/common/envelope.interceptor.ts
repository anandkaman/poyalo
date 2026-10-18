import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import type { SuccessEnvelope } from '@poyalo/contracts';
import { map, type Observable } from 'rxjs';

/** Handlers may return this to add pagination info to `meta`. */
export class Paginated<T> {
  constructor(
    readonly items: T,
    readonly nextCursor: string | null,
  ) {}
}

/** Wraps every successful response as `{ data, meta }` (docs/D3 §3). */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<SuccessEnvelope<unknown>> {
    const req = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(
      map((result: unknown) => {
        const meta = { request_id: req.ctx?.requestId ?? '', region: req.ctx?.regionCode ?? null };
        if (result instanceof Paginated) {
          return { data: result.items, meta: { ...meta, next_cursor: result.nextCursor } };
        }
        return { data: result ?? null, meta };
      }),
    );
  }
}
