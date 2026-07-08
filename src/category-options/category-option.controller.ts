import {
  Body,
  Controller,
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
  ApiQuery,
} from "@nestjs/swagger";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CreateSelectOptionDto } from "./dto/create-category-option.dto";
import { UpdateSelectOptionDto } from "./dto/update-category-option.dto";
import { SelectOptionResponseDto } from "./dto/category-option-response.dto";
import { StaticSelectOptionResponseDto } from "./dto/static-select-option-response.dto";
import { SelectOptionService } from "./category-option.service";
import { CategoryOptionCodeEnum } from "./category-option-code.enum";

@ApiTags("select-options")
@ApiCookieAuth("sessionId")
@ApiBearerAuth()
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("select-options")
export class SelectOptionController {
  constructor(private readonly selectOptionService: SelectOptionService) {}

  @Get("codes")
  @ApiOperation({ summary: "Get all select option codes" })
  @ApiResponse({
    status: 200,
    description: "List of codes",
    schema: { type: "array", items: { enum: Object.values(CategoryOptionCodeEnum) } },
  })
  async getCodes(): Promise<CategoryOptionCodeEnum[]> {
    return this.selectOptionService.getCodes();
  }

  @Get("all")
  @ApiOperation({ summary: "Get all select options" })
  @ApiQuery({ name: "search", required: false, description: "Search by value" })
  @ApiResponse({
    status: 200,
    description: "List of select options",
    type: [SelectOptionResponseDto],
  })
  async getAllOptions(@Query('search') search?: string): Promise<SelectOptionResponseDto[]> {
    return this.selectOptionService.getAllOptions(search);
  }

  @Get("static/:code")
  @ApiOperation({ summary: "Get static select options for a code" })
  @ApiParam({ name: "code", description: "Static lookup code" })
  @ApiResponse({
    status: 200,
    description: "List of static select options",
    type: [StaticSelectOptionResponseDto],
  })
  async getStaticOptionsByCode(
    @Param("code") code: string,
  ): Promise<StaticSelectOptionResponseDto[]> {
    return this.selectOptionService.getStaticOptionsByCode(code);
  }

  @Get("item/:id")
  @ApiOperation({ summary: "Get a select option by id" })
  @ApiParam({ name: "id", description: "Select option UUID" })
  @ApiResponse({
    status: 200,
    description: "Select option details",
    type: SelectOptionResponseDto,
  })
  async getOptionById(@Param("id") id: string): Promise<SelectOptionResponseDto> {
    return this.selectOptionService.getOptionById(id);
  }

  @Get(":code")
  @ApiOperation({ summary: "Get select options by code" })
  @ApiParam({ name: "code", description: "Lookup code" })
  @ApiResponse({
    status: 200,
    description: "List of select options",
    type: [SelectOptionResponseDto],
  })
  async getOptionsByCode(@Param("code") code: string): Promise<SelectOptionResponseDto[]> {
    return this.selectOptionService.getOptionsByCode(code);
  }

  @Post()
  @ApiOperation({ summary: "Create a select option" })
  @ApiResponse({
    status: 201,
    description: "Select option created",
    type: SelectOptionResponseDto,
  })
  async create(
    @Body() dto: CreateSelectOptionDto,
    @Session() session: any,
  ): Promise<SelectOptionResponseDto> {
    return this.selectOptionService.create(dto, session.userId);
  }

  @Post("bulk-upsert")
  @ApiOperation({ summary: "Bulk upsert select options" })
  @ApiResponse({
    status: 200,
    description: "Select options saved",
    type: [SelectOptionResponseDto],
  })
  async bulkUpsert(
    @Body() dto: CreateSelectOptionDto[],
    @Session() session: any,
  ): Promise<SelectOptionResponseDto[]> {
    return this.selectOptionService.bulkUpsert(dto, session.userId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a select option" })
  @ApiParam({ name: "id", description: "Select option UUID" })
  @ApiResponse({
    status: 200,
    description: "Select option updated",
    type: SelectOptionResponseDto,
  })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateSelectOptionDto,
    @Session() session: any,
  ): Promise<SelectOptionResponseDto> {
    return this.selectOptionService.update(id, dto, session.userId);
  }

}
