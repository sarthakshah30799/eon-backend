import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { ConfigService } from "../config/config.service";
import { SessionPolicyService } from "../session-policy/session-policy.service";

const PgSession = connectPgSimple(session);

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SessionMiddleware.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly sessionPolicyService: SessionPolicyService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    this.logger.log(
      `[DEBUG] incoming request method=${req.method} path=${req.originalUrl ?? req.url} cookieSession=${Boolean((req as any).cookies?.sessionId)} && ${this.configService.isProduction}`,
    );

    const ssl = this.configService.database.ssl;

    const sessionMiddleware = session({
      store: new PgSession({
        conObject: {
          host: this.configService.database.host,
          port: this.configService.database.port,
          user: this.configService.database.username,
          password: this.configService.database.password,
          database: this.configService.database.database,
          ssl,
        },
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

    sessionMiddleware(req, res, async (error) => {
      if (error) {
        this.logger.error(
          `[DEBUG] session middleware error method=${req.method} path=${req.originalUrl ?? req.url} message=${error.message}`,
          error.stack,
        );
        next(error);
        return;
      }

      try {
        const policy = await this.sessionPolicyService.getSessionPolicy();
        const sessionData = req.session as
          | (typeof req.session & { userId?: string })
          | undefined;

        this.logger.log(
          `[DEBUG] session attached method=${req.method} path=${req.originalUrl ?? req.url} userId=${sessionData?.userId ?? "null"} activeBranchId=${sessionData?.activeBranchId ?? "null"} activeCounterId=${sessionData?.activeCounterId ?? "null"} sessionExpired=${Boolean((req as any).sessionExpired)}`,
        );

        if (sessionData?.userId) {
          if (policy.idleTimeoutSeconds > 0) {
            if (
              this.sessionPolicyService.isSessionExpired(sessionData, policy)
            ) {
              (req as any).sessionExpired = true;
              this.logger.log(
                `[DEBUG] session expired method=${req.method} path=${req.originalUrl ?? req.url} userId=${sessionData.userId}`,
              );
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
        this.logger.error(
          `[DEBUG] session policy error method=${req.method} path=${req.originalUrl ?? req.url} message=${(policyError as Error).message}`,
          (policyError as Error).stack,
        );
        next(policyError as Error);
        return;
      }

      this.logger.log(
        `[DEBUG] request continuing method=${req.method} path=${req.originalUrl ?? req.url}`,
      );
      next();
    });
  }
}
