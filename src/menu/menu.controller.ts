import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Session,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenuResponseDto } from './dto/menu-response.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { UserService } from '../users/user.service';

@ApiTags('menus')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard)
@Controller('menus')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
    private readonly userService: UserService,
  ) {}

  @Get('tree')
  @ApiOperation({ summary: 'Get menu tree (nested hierarchy for sidebar)' })
  @ApiResponse({ status: 200, description: 'Menu tree', type: [MenuResponseDto] })
  async findTree(
    @Session() session: any,
    @Query('includeAdmin') includeAdmin?: string,
  ): Promise<MenuResponseDto[]> {
    const user = await this.userService.findById(session.userId, session.userId);
    const shouldIncludeAdmin =
      includeAdmin === undefined ? user.isAdmin === true : includeAdmin === 'true';
    return this.menuService.findTree(
      shouldIncludeAdmin,
      user.isAdmin === true,
      user.permissions,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all menus (flat list)' })
  @ApiResponse({ status: 200, description: 'List of menus', type: [MenuResponseDto] })
  async findAll(
    @Session() session: any,
    @Query('includeAdmin') includeAdmin?: string,
  ): Promise<MenuResponseDto[]> {
    const user = await this.userService.findById(session.userId, session.userId);
    const shouldIncludeAdmin =
      includeAdmin === undefined ? user.isAdmin === true : includeAdmin === 'true';
    return this.menuService.findAll(
      shouldIncludeAdmin,
      user.isAdmin === true,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get menu by ID' })
  @ApiParam({ name: 'id', description: 'Menu UUID' })
  @ApiResponse({ status: 200, description: 'Menu details', type: MenuResponseDto })
  @ApiResponse({ status: 404, description: 'Menu not found' })
  async findById(@Param('id') id: string, @Session() session: any): Promise<MenuResponseDto> {
    const user = await this.userService.findById(session.userId, session.userId);
    return this.menuService.findById(id, user.isAdmin === true, user.isAdmin === true);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new menu item' })
  @ApiResponse({ status: 201, description: 'Menu created', type: MenuResponseDto })
  async create(@Body() dto: CreateMenuDto, @Session() session: any): Promise<MenuResponseDto> {
    const user = await this.userService.findById(session.userId, session.userId);
    return this.menuService.create(
      dto,
      session.userId,
      user.isAdmin === true,
      user.isAdmin === true,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a menu item' })
  @ApiParam({ name: 'id', description: 'Menu UUID' })
  @ApiResponse({ status: 200, description: 'Menu updated', type: MenuResponseDto })
  @ApiResponse({ status: 404, description: 'Menu not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMenuDto,
    @Session() session: any,
  ): Promise<MenuResponseDto> {
    const user = await this.userService.findById(session.userId, session.userId);
    return this.menuService.update(
      id,
      dto,
      session.userId,
      user.isAdmin === true,
      user.isAdmin === true,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a menu item' })
  @ApiParam({ name: 'id', description: 'Menu UUID' })
  @ApiResponse({ status: 200, description: 'Menu deleted' })
  @ApiResponse({ status: 404, description: 'Menu not found' })
  async delete(
    @Param('id') id: string,
    @Session() session: any,
  ): Promise<{ message: string }> {
    const user = await this.userService.findById(session.userId, session.userId);
    return this.menuService.delete(id, user.isAdmin === true, user.isAdmin === true);
  }
}
