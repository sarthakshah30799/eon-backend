import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction, RequestHandler } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import { ConfigService } from "../config/config.service";
import { SessionPolicyService } from "../session-policy/session-policy.service";

const PgSession = connectPgSimple(session);

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  private readonly sessionMiddleware: RequestHandler;

  constructor(
    private readonly configService: ConfigService,
    private readonly sessionPolicyService: SessionPolicyService,
  ) {
    const ssl = this.configService.database.ssl;

    // One shared pool for the process. Creating PgSession inside use() leaked
    // a new pool (and connections) on every HTTP request.
    const pool = new Pool({
      host: this.configService.database.host,
      port: this.configService.database.port,
      user: this.configService.database.username,
      password: this.configService.database.password,
      database: this.configService.database.database,
      ssl,
      max: 5,
      idleTimeoutMillis: 30_000,
    });

    this.sessionMiddleware = session({
      store: new PgSession({
        pool,
        tableName: "user_sessions",
        createTableIfMissing: true,
      }),
      secret:
        this.configService.secretSessionKey ||
        "your-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: this.configService.isProduction,
        sameSite: this.configService.isProduction ? "none" : "lax",
      },
      name: "sessionId",
    });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    this.sessionMiddleware(req, res, async (error) => {
      if (error) {
        next(error);
        return;
      }

      try {
        const policy = await this.sessionPolicyService.getSessionPolicy();
        const sessionData = req.session as
          | (typeof req.session & { userId?: string })
          | undefined;

        if (sessionData?.userId) {
          if (policy.idleTimeoutSeconds > 0) {
            if (
              this.sessionPolicyService.isSessionExpired(sessionData, policy)
            ) {
              (req as any).sessionExpired = true;
              res.clearCookie("sessionId");
              sessionData.destroy(() => {
                next();
              });
              return;
            }

            this.sessionPolicyService.applyPolicyToSession(sessionData, policy);
            this.sessionPolicyService.touchSession(sessionData);
          }
        }
      } catch (policyError) {
        next(policyError as Error);
        return;
      }

      next();
    });
  }
}
