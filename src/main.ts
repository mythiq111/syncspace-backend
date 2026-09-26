// backend/src/main.ts

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new GlobalExceptionFilter());
  // Allowed browser origins: CORS_ORIGIN (comma-separated) plus, outside production, the local network
  // (so the phone app / another computer on the same Wi-Fi can use the API during development).
  const allowed = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((o) => o.trim());
  const lan = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || allowed.includes(origin) || (process.env.NODE_ENV !== 'production' && lan.test(origin))),
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  await app.listen(port);
  console.log(`EmpFlow NestJS Backend Monolith running on port ${port}`);
}

if (require.main === module) {
  bootstrap();
}
