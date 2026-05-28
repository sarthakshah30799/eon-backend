import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { ConfigService } from '../config/config.service';

const PgSession = connectPgSimple(session);

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  private configService = new ConfigService();

  use(req: Request, res: Response, next: NextFunction) {
    const ssl = this.configService.database.ssl;

    session({
      store: new PgSession({
        conObject: {
          host: this.configService.database.host,
          port: this.configService.database.port,
          user: this.configService.database.username,
          password: this.configService.database.password,
          database: this.configService.database.database,
          ssl,
        },
        tableName: 'user_sessions',
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      },
      name: 'sessionId',
    })(req, res, next);
  }
}
