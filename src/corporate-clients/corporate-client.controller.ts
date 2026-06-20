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
import { CreateCorporateClientDto } from "./dto/create-corporate-client.dto";
import { UpdateCorporateClientDto } from "./dto/update-corporate-client.dto";
import { CorporateClientResponseDto } from "./dto/corporate-client-response.dto";
import { CorporateClientListQueryDto } from "./dto/corporate-client-list-query.dto";
import { CorporateClientListResponseDto } from "./dto/corporate-client-list-response.dto";
import { CorporateClientService } from "./corporate-client.service";

@ApiTags("corporate-clients")
@ApiCookieAuth("sessionId")
@ApiBearerAuth()
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("corporate-clients")
export class CorporateClientController {
  constructor(private readonly corporateClientService: CorporateClientService) {}

  @Get("types")
  @ApiOperation({ summary: "Get all corporate client profile types as key-value pairs" })
  @ApiResponse({ status: 200, description: "List of profile types" })
  async getTypes(): Promise<{ value: string; label: string }[]> {
    return this.corporateClientService.getTypes();
  }

  @Get()
  @ApiOperation({ summary: "Get all corporate clients (paginated/filtered)" })
  @ApiResponse({
    status: 200,
    description: "Paginated list of corporate clients",
    type: CorporateClientListResponseDto,
  })
  async findAll(@Query() query: CorporateClientListQueryDto): Promise<CorporateClientListResponseDto> {
    return this.corporateClientService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get corporate client by UUID" })
  @ApiParam({ name: "id", description: "Corporate client UUID" })
  @ApiResponse({ status: 200, type: CorporateClientResponseDto })
  @ApiResponse({ status: 404, description: "Not found" })
  async findById(@Param("id") id: string): Promise<CorporateClientResponseDto> {
    return this.corporateClientService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a corporate client" })
  @ApiResponse({ status: 201, type: CorporateClientResponseDto })
  async create(
    @Body() dto: CreateCorporateClientDto,
    @Session() session: any,
  ): Promise<CorporateClientResponseDto> {
    return this.corporateClientService.create(dto, session.userId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a corporate client" })
  @ApiParam({ name: "id", description: "Corporate client UUID" })
  @ApiResponse({ status: 200, type: CorporateClientResponseDto })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCorporateClientDto,
    @Session() session: any,
  ): Promise<CorporateClientResponseDto> {
    return this.corporateClientService.update(id, dto, session.userId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a corporate client" })
  @ApiParam({ name: "id", description: "Corporate client UUID" })
  @ApiResponse({ status: 200, description: "Successfully deleted" })
  async delete(@Param("id") id: string): Promise<{ message: string }> {
    return this.corporateClientService.delete(id);
  }
}
