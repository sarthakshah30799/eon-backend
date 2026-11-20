import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from "class-validator";
import { TransactionProfileType, TransactionType } from "../transactions.enums";

export class CreateTransactionAd1Dto {
  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @ApiProperty({ enum: TransactionProfileType })
  @IsEnum(TransactionProfileType)
  profileType: TransactionProfileType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  counterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dealId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  docNo: string;

  @ApiProperty()
  @IsDateString()
  transactionDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  marketingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  segmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  servicedById?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  servicedBy: string;

  @ApiProperty()
  @IsUUID()
  purposeId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  remitterName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, {
    message: "PAN No must be a valid 10-character Indian PAN",
  })
  pan: string;

  @ApiProperty()
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  beneficiaryName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  beniAddress: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  beneAccountNumber: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  beneBankName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  beneBankAddress: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  swiftCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  iban?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bsbCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transitNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  routingNo?: string;

  @ApiProperty()
  @IsUUID()
  currencyId: string;

  @ApiProperty()
  @IsNumberString()
  fcyAmount: string;

  @ApiProperty()
  @IsNumberString()
  rate: string;

  @ApiProperty()
  @IsNumberString()
  inrAmount: string;
}

export class UpdateTransactionAd1Dto extends CreateTransactionAd1Dto {}
