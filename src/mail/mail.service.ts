import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailConfig } from './entities/mail-config.entity';
import { ConfigService } from '../config/config.service';
import { SaveSmtpConfigDto } from './dto/smtp-config.dto';
import { EncryptionUtil } from './utils/encryption.util';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly encryptionUtil: EncryptionUtil;

  constructor(
    @InjectRepository(MailConfig)
    private readonly mailConfigRepository: Repository<MailConfig>,
    private readonly configService: ConfigService,
  ) {
    const secret = this.configService.get('SESSION_SECRET');
    this.encryptionUtil = new EncryptionUtil(secret);
  }

  async getSmtpConfig(): Promise<MailConfig | null> {
    return this.mailConfigRepository.findOne({
      where: {},
    });
  }

  async saveSmtpConfig(dto: SaveSmtpConfigDto): Promise<MailConfig> {
    const existing = await this.getSmtpConfig();

    let passwordEncrypted: string;
    if (dto.password) {
      passwordEncrypted = this.encryptionUtil.encrypt(dto.password);
    } else if (existing && existing.password) {
      passwordEncrypted = existing.password;
    } else {
      throw new Error('SMTP password is required for initial configuration.');
    }

    const secure = dto.port === 465;

    // Verify connection with new configuration before saving
    const decryptedPassword = dto.password || this.encryptionUtil.decrypt(passwordEncrypted);
    await this.verifyTransport({
      host: dto.host.trim(),
      port: dto.port,
      secure,
      username: dto.username.trim(),
      password: decryptedPassword,
    });

    // Delete existing config to avoid primary key conflicts when changing username
    await this.mailConfigRepository.clear();

    const config = this.mailConfigRepository.create({
      host: dto.host.trim(),
      port: dto.port,
      username: dto.username.trim(),
      password: passwordEncrypted,
      senderEmail: dto.senderEmail ? dto.senderEmail.trim() : undefined,
    });

    return this.mailConfigRepository.save(config);
  }

  async verifySettings(dto: SaveSmtpConfigDto): Promise<void> {
    let password = dto.password;
    if (!password) {
      // If password is not provided, try to fetch the saved password
      const savedConfig = await this.getSmtpConfig();
      if (savedConfig && savedConfig.password) {
        password = this.encryptionUtil.decrypt(savedConfig.password);
      } else {
        throw new Error('SMTP password is required to verify settings');
      }
    }

    const secure = dto.port === 465;

    await this.verifyTransport({
      host: dto.host,
      port: dto.port,
      secure,
      username: dto.username,
      password,
    });
  }

  private async verifyTransport(params: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  }): Promise<void> {
    const transport = nodemailer.createTransport({
      host: params.host,
      port: params.port,
      secure: params.secure,
      auth: {
        user: params.username,
        pass: params.password,
      },
    });

    await transport.verify();
  }

  async sendEmail(params: {
    from?: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ messageId: string }> {
    const config = await this.getSmtpConfig();
    if (!config) {
      throw new Error('Mail settings are not configured in the database yet.');
    }

    const decryptedPassword = this.encryptionUtil.decrypt(config.password);
    const secure = config.port === 465;

    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure,
      auth: {
        user: config.username,
        pass: decryptedPassword,
      },
    });

    const fromAddress = params.from || config.senderEmail || config.username;

    // Parse comma-separated lists of emails into arrays
    const toEmails = params.to.split(',').map((email) => email.trim()).filter(Boolean);
    const ccEmails = params.cc ? params.cc.split(',').map((email) => email.trim()).filter(Boolean) : undefined;
    const bccEmails = params.bcc ? params.bcc.split(',').map((email) => email.trim()).filter(Boolean) : undefined;

    const info = await transport.sendMail({
      from: fromAddress,
      to: toEmails,
      cc: ccEmails,
      bcc: bccEmails,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });

    return { messageId: info.messageId };
  }
}
