import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { BookingMasterType } from "./create-expense-income-booking-master.dto";

export class ExpenseIncomeBookingMasterListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: BookingMasterType,
    description: "Filter by type",
  })
  @IsEnum(BookingMasterType)
  @IsOptional()
  type?: BookingMasterType;

  @ApiPropertyOptional({
    description: "Global search across code and description",
  })
  @IsString()
  @IsOptional()
  search?: string;
}
