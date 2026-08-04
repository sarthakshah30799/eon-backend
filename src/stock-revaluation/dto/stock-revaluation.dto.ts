import { IsDateString, IsEnum, IsNotEmpty, IsNumberString, IsUUID, Matches, ValidateNested, IsArray, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { StockRevaluationFrequency } from '../stock-revaluation.enums';

export class StockRevaluationRateDto {
  @IsDateString()
  date: string;

  @IsNotEmpty()
  @Matches(/^[A-Za-z]{3,}$/)
  currencyCode: string;

  @IsNumberString()
  rate: string;
}

export class ProcessStockRevaluationDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  branchIds: string[];

  @IsEnum(StockRevaluationFrequency)
  frequency: StockRevaluationFrequency;

  @ValidateNested({ each: true })
  @Type(() => StockRevaluationRateDto)
  rates: StockRevaluationRateDto[];
}
