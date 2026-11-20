import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional } from "class-validator";

export class UpdateCounterPermissionsDto {
  @ApiPropertyOptional({
    description: "Counter permissions matrix mapped by menu ID to actions",
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
