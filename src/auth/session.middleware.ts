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
    session({
      store: new PgSession({
        conString: `postgresql://${this.configService.database.username}:${this.configService.database.password}@${this.configService.database.host}:${this.configService.database.port}/${this.configService.database.database}`,
        tableName: 'user_sessions',
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
