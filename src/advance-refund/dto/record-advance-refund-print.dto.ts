import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from "class-validator";
import { AdvanceRefundPrintCopyType } from "../advance-refund.enums";

export class RecordAdvanceRefundPrintDto {
  @ApiProperty({ enum: AdvanceRefundPrintCopyType, required: false })
  @IsEnum(AdvanceRefundPrintCopyType)
  @IsOptional()
  copyType?: AdvanceRefundPrintCopyType;

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

  @ApiPropertyOptional({
    description:
      "Printable HTML is not persisted; the client uses it only for the print window.",
  })
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
