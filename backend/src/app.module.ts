import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { API_PREFIX } from './app.setup.js';
import { AccessModule } from './access/access.module.js';
import { FoodsModule } from './foods/foods.module.js';
import { GoalsModule } from './goals/goals.module.js';
import { HealthModule } from './health/health.module.js';
import { LogEntriesModule } from './log-entries/log-entries.module.js';
import { MealsModule } from './meals/meals.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SummaryModule } from './summary/summary.module.js';

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
    AccessModule,
    HealthModule,
    GoalsModule,
    LogEntriesModule,
    FoodsModule,
    MealsModule,
    SummaryModule,
  ],
})
export class AppModule {}
