import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ResolveDocumentProfileRulesDto {
  @ApiPropertyOptional({ description: 'Profile selection value' })
  @IsString()
  @IsOptional()
  profileSelection?: string;

  @ApiPropertyOptional({ description: 'Entity selection value' })
  @IsString()
  @IsOptional()
  entitySelection?: string;

  @ApiPropertyOptional({ description: 'Field selection key' })
  @IsString()
  @IsOptional()
  fieldSelection?: string;

  @ApiPropertyOptional({ description: 'Field selection value' })
  @IsString()
  @IsOptional()
  fieldValue?: string;
}

