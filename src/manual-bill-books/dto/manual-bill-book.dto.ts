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

  @ApiProperty({ description: 'From Date Filter', required: false, example: '2026-06-25' })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiProperty({ description: 'To Date Filter', required: false, example: '2026-06-30' })
  @IsDateString()
  @IsOptional()
  toDate?: string;
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

export class SaveAllocationItemDto {
  @ApiProperty({ description: 'Manual Book entry ID (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  manualBookId: string;

  @ApiProperty({ description: 'Book No within the range' })
  @IsNumber()
  @Min(1)
  bookNo: number;

  @ApiProperty({ description: 'Cashier user ID (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  cashierId: string;

  @ApiProperty({ description: 'Remarks', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class SaveAllocationsDto {
  @ApiProperty({ description: 'List of cashier allocations', type: [SaveAllocationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveAllocationItemDto)
  allocations: SaveAllocationItemDto[];
}
