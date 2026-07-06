import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Session,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ParseUUIDPipe } from '@nestjs/common';
import { Response } from 'express';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { RecordTransactionPrintDto } from './dto/record-transaction-print.dto';
import { TransactionsService } from './transactions.service';
import { Transaction } from './entities/transaction.entity';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

type UploadedDraftFile = {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@ApiTags('transactions')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get transactions filtered by slug and current branch' })
  @ApiResponse({ status: 200, description: 'List of transactions', type: [Transaction] })
  async getTransactions(
    @Session() session: any,
    @Query('slug') slug?: string,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
  ): Promise<Transaction[]> {
    const effectiveBranchId =
      session?.isAdmin || session?.isHoStaff ? branchId || session?.activeBranchId : session?.activeBranchId;
    return this.transactionsService.getTransactions(slug, effectiveBranchId, search);
  }

  @Post('drafts')
  @ApiOperation({ summary: 'Create a transaction draft with multipart attachments' })
  @ApiResponse({ status: 201, description: 'Transaction draft created successfully' })
  @UseInterceptors(AnyFilesInterceptor())
  async createDraft(
    @Body() body: Record<string, any>,
    @UploadedFiles() files: UploadedDraftFile[] = [],
    @Session() session: any,
  ): Promise<Transaction> {
    return this.transactionsService.createDraft(body, files, session?.userId ?? null);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiResponse({ status: 200, description: 'Transaction details', type: Transaction })
  async getTransactionById(@Param('id') id: string): Promise<Transaction | null> {
    return this.transactionsService.getTransactionById(id);
  }

  @Get(':id/documents/:documentId/download')
  @ApiOperation({ summary: 'Download or preview a transaction document' })
  async downloadDocument(
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.transactionsService.downloadDocument(transactionId, documentId);

    if ('redirectUrl' in payload) {
      return res.redirect(payload.redirectUrl);
    }

    res.status(HttpStatus.OK);
    res.setHeader('Content-Disposition', `inline; filename="${payload.fileName}"`);
    res.setHeader('Content-Type', payload.mimeType);
    return payload.file;
  }

  @Post(':id/print')
  @ApiOperation({ summary: 'Record a purchase print and optionally send the customer copy by email' })
  @ApiResponse({ status: 201, description: 'Print recorded successfully' })
  async recordPrint(
    @Param('id') transactionId: string,
    @Body() dto: RecordTransactionPrintDto,
    @Session() session: any,
  ): Promise<{ message: string; messageId?: string }> {
    return this.transactionsService.recordPrint(transactionId, dto, session?.userId ?? null);
  }
}
