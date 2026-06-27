import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ConfigService } from '../config/config.service';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

const configService = new ConfigService();

export const AppDataSource2 = new DataSource({
  type: 'postgres',
  host: configService.database.host,
  port: configService.database.port,
  username: configService.database.username,
  password: configService.database.password,
  database: configService.database.database2,
  ssl: configService.database.ssl,
  entities: [__dirname + '/../manual-bill-books/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations2/*{.ts,.js}'],
  synchronize: configService.database.synchronize,
  namingStrategy: new SnakeNamingStrategy(),
  logging: true,
});
