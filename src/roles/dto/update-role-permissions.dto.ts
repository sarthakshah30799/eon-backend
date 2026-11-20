import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional } from "class-validator";

export class UpdateRolePermissionsDto {
  @ApiPropertyOptional({
    description: "Permissions matrix mapped by menu ID to actions",
    type: "object",
    additionalProperties: {
      type: "object",
      additionalProperties: { type: "boolean" },
    },
  })
  @IsOptional()
  @IsObject()
  permissions?: Record<string, Record<string, boolean>>;

  [key: string]: any;
}
