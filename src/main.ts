// backend/src/main.ts

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableCors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',') });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  await app.listen(port);
  console.log(`EmpFlow NestJS Backend Monolith running on port ${port}`);
}

if (require.main === module) {
  bootstrap();
}
