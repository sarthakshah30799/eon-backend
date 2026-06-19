import { ApiProperty } from '@nestjs/swagger';
import { SessionPolicyCodeEnum } from './session-policy.enum';

export interface SessionPolicyConfig {
  allowMultipleLogin?: boolean;
  idleTimeoutSeconds?: number;
}

export const SESSION_POLICY_CHILDREN = [
  {
    code: SessionPolicyCodeEnum.AllowMultipleLogin,
    label: 'Allow Multiple Login',
  },
  {
    code: SessionPolicyCodeEnum.IdleTimeoutSeconds,
    label: 'Idle Timeout Seconds',
  },
] as const;

export class SessionPolicyResponseDto {
  @ApiProperty({ example: false, required: false })
  allowMultipleLogin?: boolean;

  @ApiProperty({ example: 0, required: false })
  idleTimeoutSeconds?: number;

  static fromConfig(config: SessionPolicyConfig): SessionPolicyResponseDto {
    const dto = new SessionPolicyResponseDto();
    if (config.allowMultipleLogin !== undefined) {
      dto.allowMultipleLogin = config.allowMultipleLogin;
    }
    if (config.idleTimeoutSeconds !== undefined) {
      dto.idleTimeoutSeconds = config.idleTimeoutSeconds;
    }
    return dto;
  }
}
