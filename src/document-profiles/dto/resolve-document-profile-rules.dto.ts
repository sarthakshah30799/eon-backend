import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ResolveDocumentProfileRulesDto {
  @ApiPropertyOptional({ description: 'Group selection value' })
  @IsUUID()
  @IsOptional()
  groupSelection?: string;

  @ApiPropertyOptional({ description: 'Entity selection value' })
  @IsUUID()
  @IsOptional()
  entitySelection?: string;
}
