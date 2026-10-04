import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import {
  configureApp,
  createOpenApiDocument,
  DOCS_PATH,
} from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  configureApp(app);
  app.enableCors({
    origin: config.get<string>('FRONTEND_URL', 'http://localhost:5173'),
  });
  SwaggerModule.setup(DOCS_PATH, app, () => createOpenApiDocument(app));

  await app.listen(config.get<number>('PORT', 3001), '0.0.0.0');
}
await bootstrap();
