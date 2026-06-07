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
import { CreateFinancialCodeDto } from "./dto/create-financial-code.dto";
import { UpdateFinancialCodeDto } from "./dto/update-financial-code.dto";
import { FinancialCodeResponseDto } from "./dto/financial-code-response.dto";
import { FinancialCodeListQueryDto } from "./dto/financial-code-list-query.dto";
import { FinancialCodeListResponseDto } from "./dto/financial-code-list-response.dto";
import { FinancialCodeService } from "./financial-code.service";

@ApiTags("financial-codes")
@ApiCookieAuth("sessionId")
@ApiBearerAuth()
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("financial-codes")
export class FinancialCodeController {
  constructor(private readonly financialCodeService: FinancialCodeService) {}

  @Get()
  @ApiOperation({ summary: "Get all financial codes (paginated/filtered)" })
  @ApiResponse({
    status: 200,
    description: "Paginated list of financial codes",
    type: FinancialCodeListResponseDto,
  })
  async findAll(@Query() query: FinancialCodeListQueryDto): Promise<FinancialCodeListResponseDto> {
    return this.financialCodeService.findAll(query);
  }

  @Get("by-code/:code")
  @ApiOperation({ summary: "Get financial code by code string" })
  @ApiParam({ name: "code", description: "Financial code string" })
  @ApiResponse({ status: 200, type: FinancialCodeResponseDto })
  async findByCode(@Param("code") code: string): Promise<FinancialCodeResponseDto> {
    return this.financialCodeService.findByCode(code);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get financial code by UUID" })
  @ApiParam({ name: "id", description: "Financial code UUID" })
  @ApiResponse({ status: 200, type: FinancialCodeResponseDto })
  @ApiResponse({ status: 404, description: "Not found" })
  async findById(@Param("id") id: string): Promise<FinancialCodeResponseDto> {
    return this.financialCodeService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a financial code" })
  @ApiResponse({ status: 201, type: FinancialCodeResponseDto })
  async create(
    @Body() dto: CreateFinancialCodeDto,
    @Session() session: any,
  ): Promise<FinancialCodeResponseDto> {
    return this.financialCodeService.create(dto, session.userId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a financial code" })
  @ApiParam({ name: "id", description: "Financial code UUID" })
  @ApiResponse({ status: 200, type: FinancialCodeResponseDto })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateFinancialCodeDto,
    @Session() session: any,
  ): Promise<FinancialCodeResponseDto> {
    return this.financialCodeService.update(id, dto, session.userId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a financial code" })
  @ApiParam({ name: "id", description: "Financial code UUID" })
  @ApiResponse({ status: 200, description: "Successfully deleted" })
  async delete(@Param("id") id: string): Promise<{ message: string }> {
    return this.financialCodeService.delete(id);
  }
}
