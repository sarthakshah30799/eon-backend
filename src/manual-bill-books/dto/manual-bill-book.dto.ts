import { IsString, IsNotEmpty, IsOptional, IsUUID, IsNumber, IsDateString, Min, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateManualBookDto {
  @ApiProperty({ description: 'Dispatch Date', example: '2026-06-25' })
  @IsDateString()
  @IsNotEmpty()
  dispatchDate: string;

  @ApiProperty({ description: 'Branch ID (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ description: 'Transaction Type', example: 'PB-RETAIL PURCHASE' })
  @IsString()
  @IsNotEmpty()
  transactionType: string;

  @ApiProperty({ description: 'Book No. From', example: 101 })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  bookNoFrom: number;

  @ApiProperty({ description: 'Book No. To', example: 105 })
  @IsNumber()
  @IsNotEmpty()
  bookNoTo: number;

  @ApiProperty({ description: 'No Of Voucher Per Book', example: 50 })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  vouchersPerBook: number;

  @ApiProperty({ description: 'MV No. From', example: 5001 })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  mvNoFrom: number;

  @ApiProperty({ description: 'Assigned To', example: 'BRANCH MANAGER' })
  @IsString()
  @IsNotEmpty()
  assignedTo: string;

  @ApiProperty({ description: 'Remarks', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiProperty({ description: 'Manual Bill Book No/Code', required: false })
  @IsString()
  @IsOptional()
  no?: string;

  @ApiProperty({ description: 'MV No. To', required: false })
  @IsOptional()
  mvNoTo?: any;
}

export class ApproveRejectManualBookDto {
  @ApiProperty({ description: 'Status', example: 'Approved' })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty({ description: 'Approval Remarks', required: false })
  @IsString()
  @IsOptional()
  approvalRemarks?: string;
}

export class BulkReviewItemDto {
  @ApiProperty({ description: 'Manual Book Entry ID (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Status', example: 'Approved' })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty({ description: 'Approval Remarks', required: false })
  @IsString()
  @IsOptional()
  approvalRemarks?: string;
}

export class BulkReviewManualBooksDto {
  @ApiProperty({ description: 'List of reviews', type: [BulkReviewItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkReviewItemDto)
  reviews: BulkReviewItemDto[];
}

export class AssignPageItemDto {
  @ApiProperty({ description: 'Manual Book entry ID (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  manualBookId: string;

  @ApiProperty({ description: 'Book No within the range' })
  @IsNumber()
  @Min(1)
  bookNo: number;

  @ApiProperty({ description: 'User ID (UUID) to assign the pages to' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Remarks', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class AssignPagesDto {
  @ApiProperty({ description: 'List of page assignments', type: [AssignPageItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignPageItemDto)
  assignments: AssignPageItemDto[];
}

export class TransferPagesDto {
  @ApiProperty({ description: 'List of page numbers to transfer', type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  pageNos: number[];

  @ApiProperty({ description: 'Target User ID (UUID) to transfer to' })
  @IsUUID()
  @IsNotEmpty()
  targetUserId: string;
}

export class UpdatePageStatusDto {
  @ApiProperty({ description: 'List of page numbers', type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  pageNos: number[];

  @ApiProperty({ description: 'New status for the pages', enum: ['VOID'] })
  @IsString()
  @IsNotEmpty()
  status: 'VOID';

  @ApiProperty({ description: 'Optional remarks explaining why', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class ReturnPagesDto {
  @ApiProperty({ description: 'List of page numbers to return', type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  pageNos: number[];
}
