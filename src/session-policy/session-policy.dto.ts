import { ApiProperty } from '@nestjs/swagger';
import { SessionPolicyCodeEnum } from './session-policy.enum';

export interface SessionPolicyConfig {
  allowMultipleLogin: boolean;
  idleTimeoutSeconds: number;
}

export const DEFAULT_SESSION_POLICY: SessionPolicyConfig = {
  allowMultipleLogin: false,
  idleTimeoutSeconds: 0,
};

export const SESSION_POLICY_CHILDREN = [
  {
    code: SessionPolicyCodeEnum.AllowMultipleLogin,
    label: 'Allow Multiple Login',
    defaultValue: false,
  },
  {
    code: SessionPolicyCodeEnum.IdleTimeoutSeconds,
    label: 'Idle Timeout Seconds',
    defaultValue: DEFAULT_SESSION_POLICY.idleTimeoutSeconds,
  },
] as const;

export class SessionPolicyResponseDto {
  @ApiProperty({ example: false })
  allowMultipleLogin: boolean;

  @ApiProperty({ example: 0 })
  idleTimeoutSeconds: number;

  static fromConfig(config: SessionPolicyConfig): SessionPolicyResponseDto {
    const dto = new SessionPolicyResponseDto();
    dto.allowMultipleLogin = config.allowMultipleLogin;
    dto.idleTimeoutSeconds = config.idleTimeoutSeconds;
    return dto;
  }
}
