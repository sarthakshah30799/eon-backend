import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from "class-validator";

export enum TransferPrintCopyType {
  CUSTOMER_COPY = "CUSTOMER_COPY",
  DUPLICATE_COPY = "DUPLICATE_COPY",
}

export class RecordTransferPrintDto {
  @ApiProperty({ enum: TransferPrintCopyType, required: false })
  @IsEnum(TransferPrintCopyType)
  @IsOptional()
  copyType?: TransferPrintCopyType;

  @ApiPropertyOptional({
    description: "Recipient email address for the print copy",
  })
  @IsString()
  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @ApiPropertyOptional({ description: "Email subject" })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({ description: "Plain text fallback for email" })
  @IsString()
  @IsOptional()
  text?: string;

  @ApiPropertyOptional({ description: "Printable HTML for email or archive" })
  @IsString()
  @IsOptional()
  html?: string;

  @ApiPropertyOptional({
    description: "Whether the same content should be emailed",
  })
  @IsBoolean()
  @IsOptional()
  sendEmail?: boolean;
}
