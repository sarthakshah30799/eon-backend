import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '../config/config.service';

@Module({
  imports: [
    // Primary Database Connection
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.database.host,
        port: configService.database.port,
        username: configService.database.username,
        password: configService.database.password,
        database: configService.database.database,
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/../migrations/*{.ts,.js}'],
        synchronize: false,
        migrationsRun: false,
        logging: true,
      }),
    }),
    // Secondary Database Connection
    TypeOrmModule.forRootAsync({
      name: 'database2', // Unique name for the second connection
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.database.host,
        port: configService.database.port,
        username: configService.database.username,
        password: configService.database.password,
        database: configService.database.database2,
        entities: [__dirname + '/../**/*.entity{.ts,.js}'], // Using the same entities, or you can separate them
        synchronize: false, // Ensure you handle schema changes properly
        migrationsRun: false,
        logging: true,
      }),
    }),
  ],
})
export class DatabaseModule { }
