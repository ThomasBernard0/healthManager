import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccessController } from './access.controller.js';
import { AccessGuard } from './access.guard.js';

@Module({
  controllers: [AccessController],
  providers: [{ provide: APP_GUARD, useClass: AccessGuard }],
})
export class AccessModule {}
