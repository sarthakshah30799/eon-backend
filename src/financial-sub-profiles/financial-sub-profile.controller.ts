import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Session,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CreateFinancialSubProfileDto } from "./dto/create-financial-sub-profile.dto";
import { UpdateFinancialSubProfileDto } from "./dto/update-financial-sub-profile.dto";
import { FinancialSubProfileResponseDto } from "./dto/financial-sub-profile-response.dto";
import { FinancialSubProfileListQueryDto } from "./dto/financial-sub-profile-list-query.dto";
import { FinancialSubProfileListResponseDto } from "./dto/financial-sub-profile-list-response.dto";
import { FinancialSubProfileService } from "./financial-sub-profile.service";

@ApiTags("financial-sub-profiles")
@ApiCookieAuth("sessionId")
@ApiBearerAuth()
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("financial-sub-profiles")
export class FinancialSubProfileController {
  constructor(private readonly financialSubProfileService: FinancialSubProfileService) {}

  @Get()
  @ApiOperation({ summary: "Get all financial sub profiles (paginated/filtered)" })
  @ApiResponse({
    status: 200,
    description: "Paginated list of financial sub profiles",
    type: FinancialSubProfileListResponseDto,
  })
  async findAll(@Query() query: FinancialSubProfileListQueryDto): Promise<FinancialSubProfileListResponseDto> {
    return this.financialSubProfileService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get financial sub profile by UUID" })
  @ApiParam({ name: "id", description: "Financial sub profile UUID" })
  @ApiResponse({ status: 200, type: FinancialSubProfileResponseDto })
  @ApiResponse({ status: 404, description: "Not found" })
  async findById(@Param("id") id: string): Promise<FinancialSubProfileResponseDto> {
    return this.financialSubProfileService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a financial sub profile" })
  @ApiResponse({ status: 201, type: FinancialSubProfileResponseDto })
  async create(
    @Body() dto: CreateFinancialSubProfileDto,
    @Session() session: any,
  ): Promise<FinancialSubProfileResponseDto> {
    return this.financialSubProfileService.create(dto, session.userId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a financial sub profile" })
  @ApiParam({ name: "id", description: "Financial sub profile UUID" })
  @ApiResponse({ status: 200, type: FinancialSubProfileResponseDto })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateFinancialSubProfileDto,
    @Session() session: any,
  ): Promise<FinancialSubProfileResponseDto> {
    return this.financialSubProfileService.update(id, dto, session.userId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a financial sub profile" })
  @ApiParam({ name: "id", description: "Financial sub profile UUID" })
  @ApiResponse({ status: 200, description: "Successfully deleted" })
  async delete(@Param("id") id: string): Promise<{ message: string }> {
    return this.financialSubProfileService.delete(id);
  }
}
