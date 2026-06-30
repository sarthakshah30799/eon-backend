import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '../config/config.service';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

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
        ssl: configService.database.ssl,
        autoLoadEntities: true,
        entities: [__dirname + '/../!(manual-bill-books)/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/../migrations/*{.ts,.js}'],
        synchronize: false, // Ensure you handle schema changes properly
        migrationsRun: configService.database.migrationsRun,
        logging: true,
        namingStrategy: new SnakeNamingStrategy(),
      }),
    }),
    // Secondary Database Connection
    TypeOrmModule.forRootAsync({
      name: 'database2', // Unique name for the second connection
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.database2.host,
        port: configService.database2.port,
        username: configService.database2.username,
        password: configService.database2.password,
        database: configService.database2.database,
        ssl: configService.database.ssl,
        entities: [__dirname + '/../manual-bill-books/**/*.entity{.ts,.js}'],
        synchronize: false, // Ensure you handle schema changes properly
        migrationsRun: false,
        logging: true,
        namingStrategy: new SnakeNamingStrategy(),
      }),
    }),
  ],
})
export class DatabaseModule { }
