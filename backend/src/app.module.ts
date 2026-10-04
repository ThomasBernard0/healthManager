import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { API_PREFIX } from './app.setup.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

// Built SPA (frontend/dist), served so production is a single service.
// Unknown non-API paths fall back to index.html for client-side routing.
const frontendDist = join(import.meta.dirname, '..', '..', 'frontend', 'dist');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...(existsSync(frontendDist)
      ? [
          ServeStaticModule.forRoot({
            rootPath: frontendDist,
            exclude: [`/${API_PREFIX}/{*path}`],
          }),
        ]
      : []),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
