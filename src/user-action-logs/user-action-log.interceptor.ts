import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { UserActionLogsService } from './user-action-logs.service';

type JwtUserPayload = {
  sub?: number;
  taiKhoan?: string;
  hoVaTen?: string;
  role?: string;
};

@Injectable()
export class UserActionLogInterceptor implements NestInterceptor {
  constructor(private readonly userActionLogsService: UserActionLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request & { user?: JwtUserPayload }>();
    const method = (req.method || '').toUpperCase();

    if (!this.shouldLog(req.path, method)) {
      return next.handle();
    }

    const startAction = this.resolveAction(req.path, method);
    const moduleKey = this.resolveModuleKey(req.path);
    const endpoint = `${method} ${req.path}`;
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip;
    const userAgent = req.headers['user-agent'] ?? null;
    const requestData = this.sanitizeBody(req.body);

    return next.handle().pipe(
      tap(() => {
        const statusCode = context.switchToHttp().getResponse().statusCode ?? 200;
        void this.userActionLogsService.createLog({
          user: req.user,
          httpMethod: method,
          endpoint,
          statusCode,
          action: startAction,
          moduleKey,
          ipAddress,
          userAgent,
          requestData,
        });
      }),
      catchError((error: unknown) => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response?.statusCode && response.statusCode >= 400 ? response.statusCode : 500;

        void this.userActionLogsService.createLog({
          user: req.user,
          httpMethod: method,
          endpoint,
          statusCode,
          action: startAction,
          moduleKey,
          ipAddress,
          userAgent,
          requestData,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });

        return throwError(() => error);
      }),
    );
  }

  private shouldLog(path: string, method: string): boolean {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return false;
    }

    const excludedPrefixes = ['/api/uploads', '/uploads', '/auth/login', '/auth/refresh'];
    return !excludedPrefixes.some((prefix) => path.startsWith(prefix));
  }

  private resolveModuleKey(path: string): string | null {
    const normalized = path.replace(/^\/api\//, '').replace(/^\//, '');
    const [segment] = normalized.split('/');
    return segment || null;
  }

  private resolveAction(path: string, method: string): string {
    const moduleKey = this.resolveModuleKey(path) ?? 'unknown';
    const actionByMethod: Record<string, string> = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };

    return `${actionByMethod[method] ?? 'ACTION'}_${moduleKey.toUpperCase()}`;
  }

  private sanitizeBody(body: unknown): Prisma.InputJsonObject | undefined {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return undefined;
    }

    const hiddenKeys = new Set(['matKhau', 'password', 'refreshToken', 'token']);
    const output: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (hiddenKeys.has(key)) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = value;
      }
    }

    return output as Prisma.InputJsonObject;
  }
}
