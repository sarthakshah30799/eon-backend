import { Body, Controller, Get, Param, Post, Put, Query, Session, UseGuards } from "@nestjs/common";
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
import { StateService } from "./state.service";
import { CreateStateDto } from "./dto/create-state.dto";
import { UpdateStateDto } from "./dto/update-state.dto";
import { StateResponseDto } from "./dto/state-response.dto";
import { StateListQueryDto } from "./dto/state-list-query.dto";
import { StateListResponseDto } from "./dto/state-list-response.dto";

@ApiTags("states")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("states")
export class StateController {
  constructor(private readonly stateService: StateService) {}

  @Get()
  @ApiOperation({ summary: "Get paginated states" })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 10 })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "countryId", required: false, type: String })
  @ApiQuery({ name: "code", required: false, type: String })
  @ApiQuery({ name: "name", required: false, type: String })
  @ApiQuery({ name: "gstStateCode", required: false, type: String })
  @ApiQuery({ name: "ctrStateCode", required: false, type: String })
  @ApiResponse({ status: 200, description: "Paginated list of states", type: StateListResponseDto })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async findAll(@Query() query: StateListQueryDto): Promise<StateListResponseDto> {
    return this.stateService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get state by ID" })
  @ApiParam({ name: "id", description: "State UUID" })
  @ApiResponse({ status: 200, description: "State details", type: StateResponseDto })
  @ApiResponse({ status: 404, description: "State not found" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async findById(@Param("id") id: string): Promise<StateResponseDto> {
    return this.stateService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new state" })
  @ApiResponse({ status: 201, description: "State created", type: StateResponseDto })
  @ApiResponse({ status: 400, description: "Invalid input" })
  @ApiResponse({ status: 404, description: "Country not found" })
  @ApiResponse({ status: 409, description: "State already exists" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async create(
    @Body() dto: CreateStateDto,
    @Session() session: any,
  ): Promise<StateResponseDto> {
    return this.stateService.create(dto, session.userId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a state" })
  @ApiParam({ name: "id", description: "State UUID" })
  @ApiResponse({ status: 200, description: "State updated", type: StateResponseDto })
  @ApiResponse({ status: 404, description: "State not found" })
  @ApiResponse({ status: 409, description: "State already exists" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateStateDto,
    @Session() session: any,
  ): Promise<StateResponseDto> {
    return this.stateService.update(id, dto, session.userId);
  }
}
