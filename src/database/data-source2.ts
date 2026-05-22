import { DataSource } from 'typeorm';
import { ConfigService } from '../config/config.service';

const configService = new ConfigService();

export const AppDataSource2 = new DataSource({
  type: 'postgres',
  host: configService.database.host,
  port: configService.database.port,
  username: configService.database.username,
  password: configService.database.password,
  database: configService.database.database2,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations2/*{.ts,.js}'],
  synchronize: configService.database.synchronize,
  logging: true,
});
