import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { configureApp, createOpenApiDocument } from '../app.setup.js';

// Preview mode builds the module graph without instantiating providers,
// so no database (or DATABASE_URL) is needed.
const app = await NestFactory.create(AppModule, {
  preview: true,
  logger: ['error', 'warn'],
});
configureApp(app);

const outFile = resolve(process.cwd(), '..', 'frontend', 'openapi.json');
writeFileSync(
  outFile,
  JSON.stringify(createOpenApiDocument(app), null, 2) + '\n',
);
console.log(`OpenAPI spec written to ${outFile}`);
await app.close();
