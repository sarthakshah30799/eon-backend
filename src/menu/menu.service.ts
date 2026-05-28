import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Menu } from './menu.entity';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenuResponseDto } from './dto/menu-response.dto';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
  ) {}

  async findTree(): Promise<MenuResponseDto[]> {
    // Fetch root-level menus (no parent) with all nested children
    const roots = await this.menuRepository.find({
      where: { parent: IsNull(), isActive: true },
      relations: ['children', 'children.children', 'children.children.children'],
      order: { sortOrder: 'ASC' },
    });
    return roots.map(root => MenuResponseDto.fromEntity(root, true));
  }

  async findAll(): Promise<MenuResponseDto[]> {
    const menus = await this.menuRepository.find({
      relations: ['parent'],
      order: { sortOrder: 'ASC' },
    });
    return menus.map(m => MenuResponseDto.fromEntity(m, false));
  }

  async findById(id: string): Promise<MenuResponseDto> {
    const menu = await this.menuRepository.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });
    if (!menu) {
      throw new NotFoundException(`Menu with id ${id} not found`);
    }
    return MenuResponseDto.fromEntity(menu, true);
  }

  async create(dto: CreateMenuDto, userId: string): Promise<MenuResponseDto> {
    const { parentId, ...rest } = dto;
    const menu = this.menuRepository.create({
      ...rest,
      parent: parentId ? { id: parentId } as any : null,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.menuRepository.save(menu);
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateMenuDto, userId: string): Promise<MenuResponseDto> {
    const menu = await this.menuRepository.findOne({ where: { id } });
    if (!menu) {
      throw new NotFoundException(`Menu with id ${id} not found`);
    }
    const { parentId, ...rest } = dto;
    Object.assign(menu, rest);
    if (parentId !== undefined) {
      menu.parent = parentId ? { id: parentId } as any : null;
    }
    menu.updatedBy = userId;
    await this.menuRepository.save(menu);
    return this.findById(id);
  }

  async delete(id: string): Promise<{ message: string }> {
    const menu = await this.menuRepository.findOne({ where: { id } });
    if (!menu) {
      throw new NotFoundException(`Menu with id ${id} not found`);
    }
    await this.menuRepository.remove(menu);
    return { message: `Menu with id ${id} deleted successfully` };
  }
}
