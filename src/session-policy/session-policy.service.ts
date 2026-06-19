import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdvancedSetting, NodeType } from '../additional-settings/advanced-setting.entity';
import { User } from '../users/user.entity';
import {
  SessionPolicyConfig,
  SessionPolicyResponseDto,
  SESSION_POLICY_CHILDREN,
} from './session-policy.dto';
import {
  SessionPolicyCodeEnum,
  SessionPolicyValidationCodeEnum,
} from './session-policy.enum';

@Injectable()
export class SessionPolicyService {
  private cachedPolicy: SessionPolicyConfig | null = null;

  constructor(
    @InjectRepository(AdvancedSetting)
    private readonly settingRepository: Repository<AdvancedSetting>,
  ) {}

  private createPolicyException(
    code: SessionPolicyValidationCodeEnum,
    message: string,
    details?: Record<string, unknown>,
  ): HttpException {
    return new HttpException(
      {
        message,
        code,
        details,
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  private toSafeInteger(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  parsePolicyInteger(
    value: string,
    fieldName: string,
    allowZero = true,
    treatEmptyAsZero = false,
  ): number {
    const trimmed = value.trim();

    if (!trimmed) {
      if (treatEmptyAsZero) {
        return 0;
      }

      throw this.createPolicyException(
        SessionPolicyValidationCodeEnum.InvalidPolicyConfig,
        `${fieldName} is required`,
        { fieldName },
      );
    }

    if (!/^-?\d+$/.test(trimmed)) {
      throw this.createPolicyException(
        SessionPolicyValidationCodeEnum.InvalidPolicyConfig,
        `${fieldName} must be a valid integer`,
        { fieldName, value: trimmed },
      );
    }

    const parsed = Number.parseInt(trimmed, 10);

    if (parsed < 0) {
      throw this.createPolicyException(
        SessionPolicyValidationCodeEnum.InvalidPolicyConfig,
        `${fieldName} cannot be negative`,
        { fieldName, value: parsed },
      );
    }

    if (!allowZero && parsed === 0) {
      throw this.createPolicyException(
        SessionPolicyValidationCodeEnum.InvalidPolicyConfig,
        `${fieldName} must be greater than zero`,
        { fieldName, value: parsed },
      );
    }

    return parsed;
  }

  parsePolicyBoolean(value: string, fieldName: string): boolean {
    const trimmed = value.trim().toLowerCase();

    if (!trimmed) {
      throw this.createPolicyException(
        SessionPolicyValidationCodeEnum.InvalidPolicyConfig,
        `${fieldName} is required`,
        { fieldName },
      );
    }

    if (['true', 'yes', '1'].includes(trimmed)) {
      return true;
    }

    if (['false', 'no', '0'].includes(trimmed)) {
      return false;
    }

    throw this.createPolicyException(
      SessionPolicyValidationCodeEnum.InvalidPolicyConfig,
      `${fieldName} must be YES or NO`,
      { fieldName, value: trimmed },
    );
  }

  private normalizeOptionalCount(value: unknown): number | undefined {
    const parsed = this.toSafeInteger(value);
    return parsed === null ? undefined : parsed >= 0 ? parsed : undefined;
  }

  buildConfigFromRows(rows: AdvancedSetting[]): SessionPolicyConfig {
    const rowMap = new Map<string, AdvancedSetting>();
    for (const row of rows) {
      const key = row.code?.trim().toUpperCase();
      if (key) {
        rowMap.set(key, row);
      }
    }

    return this.validatePolicyConfig({
      allowMultipleLogin: rowMap.get(SessionPolicyCodeEnum.AllowMultipleLogin)?.valueBoolean,
      idleTimeoutSeconds: this.normalizeOptionalCount(
        rowMap.get(SessionPolicyCodeEnum.IdleTimeoutSeconds)?.valueNumber,
      ),
    });
  }

  validatePolicyConfig(config: SessionPolicyConfig): SessionPolicyConfig {
    const normalized: SessionPolicyConfig = {
      allowMultipleLogin: config.allowMultipleLogin,
      idleTimeoutSeconds: this.normalizeOptionalCount(config.idleTimeoutSeconds),
    };

    if (normalized.idleTimeoutSeconds !== undefined && normalized.idleTimeoutSeconds < 0) {
      throw this.createPolicyException(
        SessionPolicyValidationCodeEnum.InvalidPolicyConfig,
        'Idle timeout cannot be negative',
        {
          idleTimeoutSeconds: normalized.idleTimeoutSeconds,
        },
      );
    }

    return normalized;
  }

  async getSessionPolicyEntity(): Promise<AdvancedSetting | null> {
    const rows = await this.settingRepository.find({
      where: {
        code: SessionPolicyCodeEnum.Policy,
        nodeType: NodeType.Category,
      },
      relations: ['children'],
      order: {
        createdAt: 'ASC',
      },
    });

    return rows[0] || null;
  }

  async getSessionPolicy(forceReload = false): Promise<SessionPolicyConfig> {
    if (!forceReload && this.cachedPolicy) {
      return this.cachedPolicy;
    }

    const category = await this.getSessionPolicyEntity();
    const config = category ? this.buildConfigFromRows(category.children || []) : {};

    this.cachedPolicy = config;
    return config;
  }

  async getSessionPolicyDto(forceReload = false): Promise<SessionPolicyResponseDto> {
    return SessionPolicyResponseDto.fromConfig(await this.getSessionPolicy(forceReload));
  }

  invalidateCache(): void {
    this.cachedPolicy = null;
  }

  getChildrenTemplate() {
    return SESSION_POLICY_CHILDREN;
  }

  isPolicyCategory(code?: string | null): boolean {
    return String(code ?? '').trim().toUpperCase() === SessionPolicyCodeEnum.Policy;
  }

  applyPolicyToSession(session: any, policy: SessionPolicyConfig): void {
    const resolved = this.validatePolicyConfig(policy);
    if (resolved.idleTimeoutSeconds !== undefined && resolved.idleTimeoutSeconds > 0) {
      session.lastActivityAt = session.lastActivityAt ?? Date.now();
      session.cookie.maxAge = resolved.idleTimeoutSeconds * 1000;
    }
  }

  shouldInvalidatePriorSessions(policy: SessionPolicyConfig): boolean {
    return this.validatePolicyConfig(policy).allowMultipleLogin !== true;
  }

  async applyLoginSessionPolicy(
    user: Pick<User, 'id' | 'email' | 'isAdmin'>,
    session: any,
    invalidateUserSessions: (userId: string, currentSessionId?: string) => Promise<void>,
  ): Promise<{ message: string; sessionsInvalidated: number }> {
    const policy = await this.getSessionPolicy();
    const shouldInvalidate = this.shouldInvalidatePriorSessions(policy);

    if (shouldInvalidate) {
      await invalidateUserSessions(user.id, session.id);
    }

    session.userId = user.id;
    session.email = user.email;
    session.isAdmin = user.isAdmin === true;
    const resolved = this.validatePolicyConfig(policy);
    if (resolved.idleTimeoutSeconds !== undefined && resolved.idleTimeoutSeconds > 0) {
      this.applyPolicyToSession(session, resolved);
      this.touchSession(session);
    }

    return {
      message: shouldInvalidate
        ? 'Login successful - previous sessions have been invalidated'
        : 'Login successful',
      sessionsInvalidated: shouldInvalidate ? 1 : 0,
    };
  }

  touchSession(session: any): void {
    session.lastActivityAt = Date.now();
  }

  isSessionExpired(session: any, policy: SessionPolicyConfig): boolean {
    const resolved = this.validatePolicyConfig(policy);
    if (resolved.idleTimeoutSeconds === undefined || resolved.idleTimeoutSeconds <= 0) {
      return false;
    }

    const lastActivityAt = this.toSafeInteger(session?.lastActivityAt);
    if (!lastActivityAt) {
      return false;
    }

    return Date.now() - lastActivityAt >= resolved.idleTimeoutSeconds * 1000;
  }
}
