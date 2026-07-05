import { IsString, IsNotEmpty, IsOptional, IsUUID, IsNumber, IsDateString, Min, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateChequeBookDto {
  @ApiProperty({ description: 'Dispatch Date', example: '2026-06-25' })
  @IsDateString()
  @IsNotEmpty()
  dispatchDate: string;

  @ApiProperty({ description: 'Branch ID (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ description: 'Bank Account Code', example: 'AXISHO' })
  @IsString()
  @IsNotEmpty()
  bankAccountCode: string;

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

  @ApiProperty({ description: 'Check Book No/Code', required: false })
  @IsString()
  @IsOptional()
  no?: string;

  @ApiProperty({ description: 'MV No. To', required: false })
  @IsOptional()
  mvNoTo?: any;
}

export class ApproveRejectChequeBookDto {
  @ApiProperty({ description: 'Status', example: 'Approved' })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty({ description: 'Approval Remarks', required: false })
  @IsString()
  @IsOptional()
  approvalRemarks?: string;

  @ApiProperty({ description: 'From Date Filter', required: false, example: '2026-06-25' })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiProperty({ description: 'To Date Filter', required: false, example: '2026-06-30' })
  @IsDateString()
  @IsOptional()
  toDate?: string;
}

export class BulkReviewChequeBookItemDto {
  @ApiProperty({ description: 'Check Book Entry ID (UUID)' })
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

export class BulkReviewChequeBooksDto {
  @ApiProperty({ description: 'List of reviews', type: [BulkReviewChequeBookItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkReviewChequeBookItemDto)
  reviews: BulkReviewChequeBookItemDto[];
}

export class SaveChequeBookAssignmentItemDto {
  @ApiProperty({ description: 'ChequeBook entry ID (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  checkBookId: string;

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

export class SaveChequeBookAssignmentsDto {
  @ApiProperty({ description: 'List of cashier assignments', type: [SaveChequeBookAssignmentItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveChequeBookAssignmentItemDto)
  assignments: SaveChequeBookAssignmentItemDto[];
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
