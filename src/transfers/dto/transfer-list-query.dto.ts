import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import {
  CurrencyTransferStatus,
  CurrencyTransferType,
} from "../transfers.enums";

export class TransferListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Object.values(CurrencyTransferType) })
  @IsIn(Object.values(CurrencyTransferType))
  @IsOptional()
  transferType?: CurrencyTransferType;

  @ApiPropertyOptional({ enum: Object.values(CurrencyTransferStatus) })
  @IsIn(Object.values(CurrencyTransferStatus))
  @IsOptional()
  status?: CurrencyTransferStatus;

  @ApiPropertyOptional({
    description: "Search transfer number or bill reference",
  })
  @IsString()
  @IsOptional()
  search?: string;
}
