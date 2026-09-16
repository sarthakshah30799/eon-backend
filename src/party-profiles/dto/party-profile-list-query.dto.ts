import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { BooleanQuery } from "../../common/transformers/parse-boolean-query";
import { ClientType } from "../party-profile.entity";
import { WorkflowStatus } from "../../common/enums/workflow-status.enum";

export class PartyProfileListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Search query by code, name, or city" })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: "Filter by Party Profile code" })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: "Filter by Party Profile name" })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: "Filter by Active status" })
  @IsBoolean()
  @IsOptional()
  @BooleanQuery()
  active?: boolean;

  @ApiPropertyOptional({
    description: "When false, include inactive party profiles",
  })
  @IsBoolean()
  @IsOptional()
  @BooleanQuery()
  activeOnly?: boolean;

  @ApiPropertyOptional({
    description: "Filter by workflow status",
    enum: WorkflowStatus,
  })
  @IsEnum(WorkflowStatus)
  @IsOptional()
  status?: WorkflowStatus;

  @ApiPropertyOptional({
    description: "Filter by individual party profile flag",
  })
  @IsBoolean()
  @IsOptional()
  @BooleanQuery()
  isIndividual?: boolean;

  @ApiPropertyOptional({
    description: "Filter by one or more Party Profile types",
    enum: ClientType,
    isArray: true,
  })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    const values = Array.isArray(value) ? value : String(value).split(",");
    return values.map((item) => String(item).trim()).filter(Boolean);
  })
  @IsArray()
  @IsEnum(ClientType, { each: true })
  @IsOptional()
  type?: ClientType[];

  @ApiPropertyOptional({
    description: "Filter by one or more branch ids",
    isArray: true,
  })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    const values = Array.isArray(value) ? value : String(value).split(",");
    return values.map((item) => String(item).trim()).filter(Boolean);
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({ description: "Filter by sale-enabled party profiles" })
  @IsBoolean()
  @IsOptional()
  @BooleanQuery()
  sale?: boolean;

  @ApiPropertyOptional({
    description: "Filter by purchase-enabled party profiles",
  })
  @IsBoolean()
  @IsOptional()
  @BooleanQuery()
  purchase?: boolean;

  @ApiPropertyOptional({
    description: "Filter by Entity Type category option id",
  })
  @IsUUID()
  @IsOptional()
  entityTypeId?: string;

  @ApiPropertyOptional({ description: "Filter by Group category option id" })
  @IsUUID()
  @IsOptional()
  groupId?: string;
}
