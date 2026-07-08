import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PasswordPolicyResponseDto } from './password-policy.dto';
import { PasswordPolicyService } from './password-policy.service';

@ApiTags('additional-settings')
@Controller('additional-settings')
export class PasswordPolicyController {
  constructor(private readonly passwordPolicyService: PasswordPolicyService) {}

  @Get('password-policy')
  @ApiOperation({ summary: 'Get resolved password policy without authentication' })
  @ApiResponse({ status: 200, type: PasswordPolicyResponseDto })
  async getPasswordPolicy(): Promise<PasswordPolicyResponseDto> {
    return this.passwordPolicyService.getPasswordPolicy();
  }
}

