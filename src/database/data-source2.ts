import "dotenv/config";
import { DataSource } from "typeorm";
import { ConfigService } from "../config/config.service";
import { SnakeNamingStrategy } from "typeorm-naming-strategies";

const configService = new ConfigService();

export const AppDataSource2 = new DataSource({
  type: "postgres",
  host: configService.database2.host,
  port: configService.database2.port,
  username: configService.database2.username,
  password: configService.database2.password,
  database: configService.database2.database,
  ssl: configService.database.ssl,
  entities: [
    __dirname + "/../manual-bill-books/**/*.entity{.ts,.js}",
    __dirname + "/../chequebooks/**/*.entity{.ts,.js}",
    __dirname + "/../transactions/**/*.entity{.ts,.js}",
  ],
  migrations: [__dirname + "/../migrations2/*{.ts,.js}"],
  synchronize: configService.database.synchronize,
  namingStrategy: new SnakeNamingStrategy(),
  logging: true,
});
