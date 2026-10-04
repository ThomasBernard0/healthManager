import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AccessModule } from './../src/access/access.module.js';
import { configureApp } from './../src/app.setup.js';
import { HealthModule } from './../src/health/health.module.js';

async function createApp(accessKey: string | undefined): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        ignoreEnvVars: true,
        load: [() => (accessKey ? { ACCESS_KEY: accessKey } : {})],
      }),
      AccessModule,
      HealthModule,
    ],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

describe('Access key (e2e)', () => {
  describe('with ACCESS_KEY set', () => {
    let app: INestApplication<App>;
    beforeAll(async () => {
      app = await createApp('s3cret-key');
    });
    afterAll(() => app.close());

    it('rejects calls without the key', () =>
      request(app.getHttpServer()).get('/api/access').expect(401));

    it('rejects a wrong key', () =>
      request(app.getHttpServer()).get('/api/access').set('X-Access-Key', 'nope').expect(401));

    it('accepts the right key', () =>
      request(app.getHttpServer()).get('/api/access').set('X-Access-Key', 's3cret-key').expect(204));

    it('keeps the health check public', () =>
      request(app.getHttpServer()).get('/api/health').expect(200));
  });

  describe('without ACCESS_KEY', () => {
    let app: INestApplication<App>;
    beforeAll(async () => {
      app = await createApp(undefined);
    });
    afterAll(() => app.close());

    it('fails closed', () =>
      request(app.getHttpServer()).get('/api/access').set('X-Access-Key', '').expect(401));
  });
});
