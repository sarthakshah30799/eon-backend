import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ResolveDocumentProfileRulesDto {
  @ApiPropertyOptional({ description: 'Group selection value' })
  @IsString()
  @IsOptional()
  groupSelection?: string;

  @ApiPropertyOptional({ description: 'Entity selection value' })
  @IsString()
  @IsOptional()
  entitySelection?: string;
}
