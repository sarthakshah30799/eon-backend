import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Menu } from './menu.entity';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenuResponseDto } from './dto/menu-response.dto';
import { normalizeMenuPath } from './menu-path.util';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
  ) {}

  async findTree(): Promise<MenuResponseDto[]> {
    const menus = await this.menuRepository.find({
      where: { isActive: true },
      relations: ['parent'],
      order: { sortOrder: 'ASC' },
    });

    const flatMenus = menus.map(menu => MenuResponseDto.fromEntity(menu, false));
    const childrenByParent = new Map<string | null, MenuResponseDto[]>();

    for (const menu of flatMenus) {
      const parentId = menu.parentId ?? null;
      const items = childrenByParent.get(parentId) ?? [];
      items.push(menu);
      childrenByParent.set(parentId, items);
    }

    const sortMenus = (items: MenuResponseDto[]) =>
      items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

    const buildTree = (parentId: string | null): MenuResponseDto[] => {
      const items = sortMenus(childrenByParent.get(parentId) ?? []);
      return items.map(menu => ({
        ...menu,
        children: buildTree(menu.id),
      }));
    };

    return buildTree(null);
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
    const path = normalizeMenuPath(rest.path);
    const menu = this.menuRepository.create({
      ...rest,
      path,
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
    Object.assign(menu, {
      ...rest,
      path: normalizeMenuPath(rest.path),
    });
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
