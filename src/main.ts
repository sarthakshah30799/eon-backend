import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Maraekat API')
    .setDescription('API documentation for Maraekat application with user authentication, CRUD operations for companies, branches, counters, currencies, roles, users, and dynamic menu system.')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('companies', 'Company management')
    .addTag('branches', 'Branch management')
    .addTag('counters', 'Counter management')
    .addTag('currencies', 'Currency management')
    .addTag('countries', 'Country management')
    .addTag('states', 'State management')
    .addTag('roles', 'Role management')
    .addTag('menus', 'Dynamic menu management')
    .addCookieAuth('sessionId')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
  console.log('Application is running on: http://localhost:3000');
  console.log('Swagger documentation available at: http://localhost:3000/api');
}
bootstrap();
