import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { TransactionLog } from './entities/transaction-log.entity';
import { TransactionLogAction } from './transactions.enums';
import { RecordTransactionPrintDto } from './dto/record-transaction-print.dto';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(TransactionLog, 'database2')
    private readonly transactionLogRepository: Repository<TransactionLog>,
    private readonly mailService: MailService,
  ) {}

  async recordPrint(
    transactionId: string,
    dto: RecordTransactionPrintDto,
    performedById: string | null,
  ): Promise<{ message: string; messageId?: string }> {
    const message = `${dto.copyType === 'DUPLICATE_COPY' ? 'Duplicate' : 'Customer'} copy printed`;
    let messageId: string | undefined;

    if (dto.sendEmail) {
      if (!dto.recipientEmail) {
        throw new BadRequestException('Recipient email is required to send the customer copy');
      }

      const sent = await this.mailService.sendEmail({
        to: dto.recipientEmail,
        subject: dto.subject || 'Buy From Print Copy',
        text: dto.text || 'Please find the requested transaction copy attached in the email body.',
        html: dto.html,
      });
      messageId = sent.messageId;
    }

    await this.transactionLogRepository.save(
      this.transactionLogRepository.create({
        transactionId,
        action: TransactionLogAction.PRINT,
        message,
        metadata: {
          copyType: dto.copyType,
          sendEmail: Boolean(dto.sendEmail),
          recipientEmail: dto.recipientEmail || null,
          subject: dto.subject || null,
          emailMessageId: messageId || null,
        },
        performedById,
      }),
    );

    return {
      message,
      messageId,
    };
  }
}
