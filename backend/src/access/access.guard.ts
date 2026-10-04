import { createHash, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC } from './public.decorator.js';

export const ACCESS_KEY_HEADER = 'x-access-key';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Every API route requires the X-Access-Key header to match ACCESS_KEY.
 * Fails closed: without ACCESS_KEY configured, every protected call is rejected.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  private readonly logger = new Logger(AccessGuard.name);
  private readonly expected: Buffer | null;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService,
  ) {
    const key = config.get<string>('ACCESS_KEY');
    this.expected = key ? digest(key) : null;
    if (!this.expected) {
      this.logger.warn('ACCESS_KEY is not set: every API call will be rejected');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const provided = context.switchToHttp().getRequest<Request>().header(ACCESS_KEY_HEADER);
    if (this.expected && provided && timingSafeEqual(digest(provided), this.expected)) {
      return true;
    }
    throw new UnauthorizedException();
  }
}
