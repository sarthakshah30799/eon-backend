import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Session, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CountryService } from "./country.service";
import { CreateCountryDto } from "./dto/create-country.dto";
import { UpdateCountryDto } from "./dto/update-country.dto";
import { CountryResponseDto } from "./dto/country-response.dto";
import { CountryListQueryDto } from "./dto/country-list-query.dto";
import { CountryListResponseDto } from "./dto/country-list-response.dto";
import { CountryRiskCategory } from "./country.entity";
import {
  CreateCountryAccessRulesDto,
  CreateCountryBlockDto,
} from "./dto/country-access-rule.dto";

@ApiTags("countries")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("countries")
export class CountryController {
  constructor(private readonly countryService: CountryService) {}

  @Get()
  @ApiOperation({ summary: "Get paginated countries" })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 10 })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "code", required: false, type: String })
  @ApiQuery({ name: "name", required: false, type: String })
  @ApiQuery({ name: "riskCategory", required: false, enum: CountryRiskCategory })
  @ApiQuery({ name: "restrictedCountry", required: false, type: Boolean })
  @ApiQuery({ name: "greyListCountry", required: false, type: Boolean })
  @ApiQuery({ name: "baseCountry", required: false, type: Boolean })
  @ApiResponse({ status: 200, description: "Paginated list of countries", type: CountryListResponseDto })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async findAll(@Query() query: CountryListQueryDto): Promise<CountryListResponseDto> {
    return this.countryService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get country by ID" })
  @ApiParam({ name: "id", description: "Country UUID" })
  @ApiResponse({ status: 200, description: "Country details", type: CountryResponseDto })
  @ApiResponse({ status: 404, description: "Country not found" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async findById(@Param("id") id: string): Promise<CountryResponseDto> {
    return this.countryService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new country" })
  @ApiResponse({ status: 201, description: "Country created", type: CountryResponseDto })
  @ApiResponse({ status: 400, description: "Invalid input" })
  @ApiResponse({ status: 409, description: "Country already exists" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async create(
    @Body() dto: CreateCountryDto,
    @Session() session: any,
  ): Promise<CountryResponseDto> {
    return this.countryService.create(dto, session.userId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a country" })
  @ApiParam({ name: "id", description: "Country UUID" })
  @ApiResponse({ status: 200, description: "Country updated", type: CountryResponseDto })
  @ApiResponse({ status: 404, description: "Country not found" })
  @ApiResponse({ status: 409, description: "Country already exists" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCountryDto,
    @Session() session: any,
  ): Promise<CountryResponseDto> {
    return this.countryService.update(id, dto, session.userId);
  }

  @Patch(":id/block")
  @ApiOperation({ summary: "Block or unblock a country" })
  async setBlockedState(
    @Param("id") id: string,
    @Body() dto: CreateCountryBlockDto,
    @Session() session: any,
  ): Promise<CountryResponseDto> {
    return this.countryService.update(
      id,
      {
        isBlocked: dto.isBlocked,
        blockedReason: dto.blockedReason ?? null,
      },
      session.userId,
    );
  }

  @Post(":id/unblock-access")
  @ApiOperation({ summary: "Create unblock access rules for a country" })
  async createUnblockAccessRules(
    @Param("id") id: string,
    @Body() dto: CreateCountryAccessRulesDto,
    @Session() session: any,
  ) {
    return this.countryService.createCountryAccessRules(id, dto, session.userId);
  }

  @Get(":id/unblock-access")
  @ApiOperation({ summary: "List unblock access rules for a country" })
  async listUnblockAccessRules(@Param("id") id: string) {
    return this.countryService.listCountryAccessRules(id);
  }

  @Delete("unblock-access/:ruleId")
  @ApiOperation({ summary: "Revoke an unblock access rule" })
  async revokeUnblockAccessRule(@Param("ruleId") ruleId: string, @Session() session: any) {
    return this.countryService.revokeCountryAccessRule(ruleId, session.userId);
  }
}
