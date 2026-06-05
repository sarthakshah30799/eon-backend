import { Body, Controller, Get, Param, Post, Put, Session, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { AdditionalSettingService } from "./additional-setting.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { UpdateSubcategoryDto } from "./dto/update-subcategory.dto";
import { CategoryResponseDto } from "./dto/category-response.dto";
import { ValueType } from "./advanced-setting.entity";

@ApiTags("additional-settings")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("additional-settings")
export class AdditionalSettingController {
  constructor(private readonly service: AdditionalSettingService) {}

  @Get("value-types")
  @ApiOperation({ summary: "Get all allowed setting value types" })
  @ApiResponse({ status: 200, type: [String] })
  async getValueTypes(): Promise<string[]> {
    return Object.values(ValueType);
  }

  @Get()
  @ApiOperation({ summary: "Get all additional setting categories with subcategories" })
  @ApiResponse({ status: 200, type: [CategoryResponseDto] })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async findAll(): Promise<CategoryResponseDto[]> {
    const categories = await this.service.findAll();
    return categories.map(cat => CategoryResponseDto.fromEntity(cat));
  }

  @Post()
  @ApiOperation({ summary: "Create a new additional setting category with subcategories" })
  @ApiResponse({ status: 201, type: CategoryResponseDto })
  @ApiResponse({ status: 400, description: "Invalid input" })
  @ApiResponse({ status: 409, description: "Conflict" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async create(
    @Body() dto: CreateCategoryDto,
    @Session() session: any,
  ): Promise<CategoryResponseDto> {
    const category = await this.service.create(dto, session.userId);
    return CategoryResponseDto.fromEntity(category);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update category title" })
  @ApiParam({ name: "id", description: "Category UUID" })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  @ApiResponse({ status: 404, description: "Category not found" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async updateCategory(
    @Param("id") id: string,
    @Body() dto: UpdateCategoryDto,
    @Session() session: any,
  ): Promise<CategoryResponseDto> {
    const category = await this.service.updateCategory(id, dto, session.userId);
    return CategoryResponseDto.fromEntity(category);
  }

  @Put(":id/subcategories/:subcategoryId")
  @ApiOperation({ summary: "Update subcategory details" })
  @ApiParam({ name: "id", description: "Category UUID" })
  @ApiParam({ name: "subcategoryId", description: "Subcategory UUID" })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  @ApiResponse({ status: 404, description: "Not found" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async updateSubcategory(
    @Param("id") id: string,
    @Param("subcategoryId") subcategoryId: string,
    @Body() dto: UpdateSubcategoryDto,
    @Session() session: any,
  ): Promise<CategoryResponseDto> {
    const category = await this.service.updateSubcategory(id, subcategoryId, dto, session.userId);
    return CategoryResponseDto.fromEntity(category);
  }
}
