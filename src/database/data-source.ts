// Load environment variables for CLI tools (typeorm) that import this file directly
import 'dotenv/config';

import { DataSource } from 'typeorm';
import { ConfigService } from '../config/config.service';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

// Ensure TypeScript recognizes the CommonJS `__dirname` global when compiled via ts-node
declare const __dirname: string;

const configService = new ConfigService();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.database.host,
  port: configService.database.port,
  username: configService.database.username,
  password: configService.database.password,
  database: configService.database.database,
  ssl: configService.database.ssl,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: configService.database.synchronize,
  namingStrategy: new SnakeNamingStrategy(),
  logging: true,
});
