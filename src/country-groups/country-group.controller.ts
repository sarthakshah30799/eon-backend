import { Body, Controller, Delete, Get, Param, Post, Put, Session, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CountryGroupService } from "./country-group.service";
import { CreateCountryGroupDto } from "./dto/create-country-group.dto";
import { UpdateCountryGroupDto } from "./dto/update-country-group.dto";
import { CountryGroupResponseDto } from "./dto/country-group-response.dto";

@ApiTags("country-groups")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("country-groups")
export class CountryGroupController {
  constructor(private readonly countryGroupService: CountryGroupService) {}

  @Get()
  @ApiOperation({ summary: "Get all country groups" })
  @ApiResponse({ status: 200, description: "List of country groups", type: [CountryGroupResponseDto] })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async findAll(): Promise<CountryGroupResponseDto[]> {
    return this.countryGroupService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get country group by ID" })
  @ApiParam({ name: "id", description: "Country group UUID" })
  @ApiResponse({ status: 200, description: "Country group details", type: CountryGroupResponseDto })
  @ApiResponse({ status: 404, description: "Country group not found" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async findById(@Param("id") id: string): Promise<CountryGroupResponseDto> {
    return this.countryGroupService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new country group" })
  @ApiResponse({ status: 201, description: "Country group created", type: CountryGroupResponseDto })
  @ApiResponse({ status: 400, description: "Invalid input" })
  @ApiResponse({ status: 409, description: "Country group already exists" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async create(
    @Body() dto: CreateCountryGroupDto,
    @Session() session: any,
  ): Promise<CountryGroupResponseDto> {
    return this.countryGroupService.create(dto, session.userId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a country group" })
  @ApiParam({ name: "id", description: "Country group UUID" })
  @ApiResponse({ status: 200, description: "Country group updated", type: CountryGroupResponseDto })
  @ApiResponse({ status: 404, description: "Country group not found" })
  @ApiResponse({ status: 409, description: "Country group already exists" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCountryGroupDto,
    @Session() session: any,
  ): Promise<CountryGroupResponseDto> {
    return this.countryGroupService.update(id, dto, session.userId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a country group" })
  @ApiParam({ name: "id", description: "Country group UUID" })
  @ApiResponse({ status: 200, description: "Country group deleted" })
  @ApiResponse({ status: 404, description: "Country group not found" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async delete(@Param("id") id: string): Promise<{ message: string }> {
    return this.countryGroupService.delete(id);
  }
}
