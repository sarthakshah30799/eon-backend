import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MailService } from './mail.service';
import { SaveSmtpConfigDto, SmtpConfigResponseDto } from './dto/smtp-config.dto';
import { SendMailDto } from './dto/send-mail.dto';

@ApiTags('mail')
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get current SMTP configuration' })
  @ApiResponse({ status: 200, type: SmtpConfigResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getConfig(): Promise<SmtpConfigResponseDto> {
    const config = await this.mailService.getSmtpConfig();
    const dto = new SmtpConfigResponseDto();
    if (config) {
      dto.host = config.host;
      dto.port = config.port;
      dto.username = config.username;
      dto.hasPassword = !!config.password;
      dto.senderEmail = config.senderEmail;
    } else {
      dto.host = '';
      dto.port = 587;
      dto.username = '';
      dto.hasPassword = false;
      dto.senderEmail = '';
    }
    return dto;
  }

  @Post('config')
  @ApiOperation({ summary: 'Save SMTP configuration (verifies connection first)' })
  @ApiResponse({ status: 200, type: SmtpConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid settings or verification failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async saveConfig(
    @Body() dto: SaveSmtpConfigDto,
  ): Promise<SmtpConfigResponseDto> {
    const config = await this.mailService.saveSmtpConfig(dto);
    const responseDto = new SmtpConfigResponseDto();
    responseDto.host = config.host;
    responseDto.port = config.port;
    responseDto.username = config.username;
    responseDto.hasPassword = !!config.password;
    responseDto.senderEmail = config.senderEmail;
    return responseDto;
  }

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test SMTP connection with provided parameters' })
  @ApiResponse({ status: 200, description: 'Connection successful' })
  @ApiResponse({ status: 400, description: 'Connection failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async testConnection(@Body() dto: SaveSmtpConfigDto): Promise<{ message: string }> {
    await this.mailService.verifySettings(dto);
    return { message: 'SMTP connection established successfully' };
  }

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a test email' })
  @ApiResponse({ status: 200, description: 'Email sent' })
  @ApiResponse({ status: 400, description: 'Failed to send' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async sendTestMail(@Body() dto: SendMailDto): Promise<{ message: string; messageId: string }> {
    const result = await this.mailService.sendEmail({
      from: dto.from,
      to: dto.to,
      cc: dto.cc,
      bcc: dto.bcc,
      subject: dto.subject,
      text: dto.text,
    });
    return { message: 'Email sent successfully', messageId: result.messageId };
  }
}
