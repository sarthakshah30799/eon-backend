import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Session,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
} from "@nestjs/swagger";
import { CounterService } from "./counter.service";
import { CreateCounterDto } from "./dto/create-counter.dto";
import { UpdateCounterDto } from "./dto/update-counter.dto";
import { CounterResponseDto } from "./dto/counter-response.dto";
import { CounterListQueryDto } from "./dto/counter-list-query.dto";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { PaginatedResponseDto } from "../common/pagination";

@ApiTags("counters")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("counters")
export class CounterController {
  constructor(private readonly counterService: CounterService) {}

  @Get()
  @ApiOperation({ summary: "Get all counters" })
  @ApiResponse({
    status: 200,
    description: "Paginated list of counters",
  })
  async findAll(
    @Query() query: CounterListQueryDto,
  ): Promise<PaginatedResponseDto<CounterResponseDto>> {
    return this.counterService.findAll(query);
  }

  @Get(":id/permissions")
  @ApiOperation({ summary: "Get permissions matrix for a counter" })
  @ApiParam({ name: "id", description: "Counter UUID" })
  @ApiResponse({ status: 200, description: "Permissions matrix" })
  @ApiResponse({ status: 404, description: "Counter not found" })
  async getPermissions(
    @Param("id") id: string,
  ): Promise<Record<string, Record<string, boolean>>> {
    return this.counterService.getCounterPermissions(id);
  }

  @Post(":id/permissions")
  @ApiOperation({ summary: "Update permissions matrix for a counter" })
  @ApiParam({ name: "id", description: "Counter UUID" })
  @ApiResponse({ status: 200, description: "Success message" })
  @ApiResponse({ status: 404, description: "Counter not found" })
  async updatePermissions(
    @Param("id") id: string,
    @Body() body: Record<string, Record<string, boolean>>,
    @Session() session: any,
  ): Promise<{ message: string }> {
    return this.counterService.updateCounterPermissions(
      id,
      body,
      session.userId,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get counter by ID" })
  @ApiParam({ name: "id", description: "Counter UUID" })
  @ApiResponse({
    status: 200,
    description: "Counter details",
    type: CounterResponseDto,
  })
  @ApiResponse({ status: 404, description: "Counter not found" })
  async findById(@Param("id") id: string): Promise<CounterResponseDto> {
    return this.counterService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new counter" })
  @ApiResponse({
    status: 201,
    description: "Counter created",
    type: CounterResponseDto,
  })
  async create(
    @Body() dto: CreateCounterDto,
    @Session() session: any,
  ): Promise<CounterResponseDto> {
    return this.counterService.create(dto, session.userId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a counter" })
  @ApiParam({ name: "id", description: "Counter UUID" })
  @ApiResponse({
    status: 200,
    description: "Counter updated",
    type: CounterResponseDto,
  })
  @ApiResponse({ status: 404, description: "Counter not found" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCounterDto,
    @Session() session: any,
  ): Promise<CounterResponseDto> {
    return this.counterService.update(id, dto, session.userId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a counter" })
  @ApiParam({ name: "id", description: "Counter UUID" })
  @ApiResponse({ status: 200, description: "Counter deleted" })
  @ApiResponse({ status: 404, description: "Counter not found" })
  async delete(@Param("id") id: string): Promise<{ message: string }> {
    return this.counterService.delete(id);
  }
}
