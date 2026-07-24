import {
  Body,
  Controller,
  BadRequestException,
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
  ForbiddenException,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ParseUUIDPipe } from '@nestjs/common';
import { Response } from 'express';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { RecordTransactionPrintDto } from './dto/record-transaction-print.dto';
import { TransactionsService } from './transactions.service';
import { PurchaseRuleService } from './purchase-rule.service';
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
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly purchaseRuleService: PurchaseRuleService,
  ) {}

  @Get('ad1/agents')
  @ApiOperation({ summary: 'Get agents for AD1 transactions' })
  async getAd1Agents(
    @Session() session: any,
    @Query('search') search?: string,
  ): Promise<any[]> {
    return this.transactionsService.getAd1Agents(session?.activeBranchId, search);
  }

  @Get()
  @ApiOperation({ summary: 'Get transactions filtered by slug and current branch' })
  @ApiResponse({ status: 200, description: 'List of transactions', type: [Transaction] })
  async getTransactions(
    @Session() session: any,
    @Query('slug') slug?: string,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('partyProfileId') partyProfileId?: string,
    @Query('transactionType') transactionType?: string,
  ): Promise<Transaction[]> {
    const effectiveBranchId = session?.isAdmin || session?.isHoStaff
      ? branchId?.trim() || undefined
      : session?.activeBranchId;
    return this.transactionsService.getTransactions(
      slug,
      effectiveBranchId,
      search,
      status as any,
      partyProfileId,
      transactionType as any,
    );
  }

  @Get('quantity-availability')
  @ApiOperation({ summary: 'Get approved quantity availability for a branch, currency, and product' })
  async getQuantityAvailability(
    @Session() session: any,
    @Query('branchId') branchId?: string,
    @Query('currencyId') currencyId?: string,
    @Query('productId') productId?: string,
    @Query('excludeTransactionId') excludeTransactionId?: string,
  ): Promise<{
    branchId: string;
    currencyId: string;
    productId: string;
    purchasedQuantity: string;
    soldQuantity: string;
    availableQuantity: string;
  }> {
    const effectiveBranchId = session?.isAdmin || session?.isHoStaff
      ? branchId?.trim() || undefined
      : session?.activeBranchId;
    if (!effectiveBranchId) {
      throw new BadRequestException('Branch is required');
    }

    return this.transactionsService.getQuantityAvailability(
      effectiveBranchId,
      String(currencyId ?? ''),
      String(productId ?? ''),
      excludeTransactionId ?? undefined,
    );
  }

  @Post(':id/account-postings/rebuild')
  @ApiOperation({ summary: 'Queue a manual account posting rebuild for a transaction' })
  async requestAccountPostingRebuild(
    @Param('id') transactionId: string,
    @Session() session: any,
  ): Promise<{ message: string }> {
    if (!session?.userId) {
      throw new BadRequestException('User session not found');
    }

    return this.transactionsService.requestAccountPostingRebuild(
      transactionId,
      session.userId,
    );
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
    return this.transactionsService.createDraft(
      body,
      files,
      session?.userId ?? null,
      session?.activeBranchId ?? null,
      session?.activeCounterId ?? null,
    );
  }

  @Post('tax-preview')
  @ApiOperation({ summary: 'Preview GST tax calculation for a transaction payload' })
  async previewTax(
    @Body() body: Record<string, any>,
  ): Promise<Record<string, any>> {
    return this.transactionsService.previewTransactionTax(body);
  }

  @Post('purchase-rule-preview')
  @ApiOperation({ summary: 'Preview purchase rule validation for a transaction payload' })
  async previewPurchaseRule(
    @Body() body: Record<string, any>,
  ): Promise<Record<string, any>> {
    return this.purchaseRuleService.preview(body);
  }

  @Get('next-number')
  @ApiOperation({ summary: 'Get next transaction number preview' })
  async getNextNumber(
    @Query('slug') slug: string,
    @Query('branchId') branchId: string,
  ): Promise<{ nextNumber: string }> {
    return this.transactionsService.getNextTransactionNumber(slug, branchId);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a draft transaction' })
  @ApiResponse({ status: 200, description: 'Transaction approved successfully' })
  async approveTransaction(
    @Param('id') transactionId: string,
    @Body() body: { approvalRemarks?: string },
    @Session() session: any,
  ): Promise<Transaction> {
    if (!session?.userId) {
      throw new BadRequestException('User session not found');
    }

    return this.transactionsService.approveTransaction(
      transactionId,
      session.userId,
      body?.approvalRemarks ?? null,
      session?.activeCounterId ?? null,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiResponse({ status: 200, description: 'Transaction details', type: Transaction })
  async getTransactionById(
    @Param('id') id: string,
    @Session() session: any,
  ): Promise<Transaction | null> {
    return this.transactionsService.getTransactionById(
      id,
      session?.userId ?? null,
      session?.activeBranchId ?? null,
    );
  }

  @Get(':id/documents/:documentId/download')
  @ApiOperation({ summary: 'Download or preview a transaction document' })
  async downloadDocument(
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Session() session: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.transactionsService.downloadDocument(
      transactionId,
      documentId,
      session?.userId ?? null,
      session?.activeBranchId ?? null,
    );

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
    return this.transactionsService.recordPrint(
      transactionId,
      dto,
      session?.userId ?? null,
      session?.activeBranchId ?? null,
    );
  }
}
