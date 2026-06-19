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
import { CreateCorporateClientDto } from "../corporate-clients/dto/create-corporate-client.dto";
import { UpdateCorporateClientDto } from "../corporate-clients/dto/update-corporate-client.dto";
import { CorporateClientResponseDto } from "../corporate-clients/dto/corporate-client-response.dto";
import { CorporateClientListQueryDto } from "../corporate-clients/dto/corporate-client-list-query.dto";
import { CorporateClientListResponseDto } from "../corporate-clients/dto/corporate-client-list-response.dto";
import { FfmcClientService } from "./ffmc-client.service";

@ApiTags("ffmc-clients")
@ApiCookieAuth("sessionId")
@ApiBearerAuth()
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("ffmc-clients")
export class FfmcClientController {
  constructor(private readonly ffmcClientService: FfmcClientService) {}

  @Get()
  @ApiOperation({ summary: "Get all FFMC clients (paginated/filtered)" })
  @ApiResponse({ status: 200, type: CorporateClientListResponseDto })
  async findAll(@Query() query: CorporateClientListQueryDto): Promise<CorporateClientListResponseDto> {
    return this.ffmcClientService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get FFMC client by UUID" })
  @ApiParam({ name: "id", description: "FFMC client UUID" })
  @ApiResponse({ status: 200, type: CorporateClientResponseDto })
  @ApiResponse({ status: 404, description: "Not found" })
  async findById(@Param("id") id: string): Promise<CorporateClientResponseDto> {
    return this.ffmcClientService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "Create an FFMC client" })
  @ApiResponse({ status: 201, type: CorporateClientResponseDto })
  async create(
    @Body() dto: CreateCorporateClientDto,
    @Session() session: any,
  ): Promise<CorporateClientResponseDto> {
    return this.ffmcClientService.create(dto, session.userId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update an FFMC client" })
  @ApiParam({ name: "id", description: "FFMC client UUID" })
  @ApiResponse({ status: 200, type: CorporateClientResponseDto })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCorporateClientDto,
    @Session() session: any,
  ): Promise<CorporateClientResponseDto> {
    return this.ffmcClientService.update(id, dto, session.userId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete an FFMC client" })
  @ApiParam({ name: "id", description: "FFMC client UUID" })
  @ApiResponse({ status: 200, description: "Successfully deleted" })
  async delete(@Param("id") id: string): Promise<{ message: string }> {
    return this.ffmcClientService.delete(id);
  }
}
