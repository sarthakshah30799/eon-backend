import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  private async getAllMenuDtos(): Promise<MenuResponseDto[]> {
    const menus = await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoinAndSelect('menu.parent', 'parent')
      .orderBy('menu.sortOrder IS NULL', 'ASC')
      .addOrderBy('menu.sortOrder', 'ASC')
      .addOrderBy('menu.name', 'ASC')
      .getMany();
    return menus.map(menu => MenuResponseDto.fromEntity(menu, false));
  }

  private buildVisibleMenuDtos(
    menus: MenuResponseDto[],
    includeAdminMenus: boolean
  ): MenuResponseDto[] {
    if (includeAdminMenus) {
      return menus;
    }

    const menusById = new Map(menus.map(menu => [menu.id, menu]));
    const visibleCache = new Map<string, boolean>();

    const isVisible = (menu: MenuResponseDto): boolean => {
      const cached = visibleCache.get(menu.id);
      if (cached !== undefined) {
        return cached;
      }

      const parent = menu.parentId ? menusById.get(menu.parentId) : undefined;
      const visible = !menu.isAdmin && (
        !parent
          ? true
          : isVisible(parent)
      );

      visibleCache.set(menu.id, visible);
      return visible;
    };

    return menus.filter(menu => isVisible(menu));
  }

  private buildTree(menus: MenuResponseDto[]): MenuResponseDto[] {
    const childrenByParent = new Map<string | null, MenuResponseDto[]>();

    for (const menu of menus) {
      const parentId = menu.parentId ?? null;
      const items = childrenByParent.get(parentId) ?? [];
      items.push(menu);
      childrenByParent.set(parentId, items);
    }

    const build = (parentId: string | null): MenuResponseDto[] => {
      const items = childrenByParent.get(parentId) ?? [];
      return items.map(menu => ({
        ...menu,
        children: build(menu.id),
      }));
    };

    return build(null);
  }

  private canAccessMenuPath(
    permissions: Record<string, string[]> | undefined,
    path?: string | null,
  ): boolean {
    if (!path) {
      return false;
    }

    const normalizedPath = normalizeMenuPath(path);
    if (!normalizedPath) {
      return false;
    }

    if (
      normalizedPath === '/manual-bill-books' ||
      normalizedPath.startsWith('/manual-bill-books/') ||
      normalizedPath === 'manual-bill-books' ||
      normalizedPath.startsWith('manual-bill-books/') ||
      normalizedPath === '/checkbooks' ||
      normalizedPath.startsWith('/checkbooks/') ||
      normalizedPath === 'checkbooks' ||
      normalizedPath.startsWith('checkbooks/')
    ) {
      return true;
    }

    const grantedPermissions = permissions?.[normalizedPath];
    return Boolean(grantedPermissions?.length);
  }

  private pruneTreeByPermissions(
    menus: MenuResponseDto[],
    permissions: Record<string, string[]> | undefined,
    includeAdminMenus: boolean,
  ): MenuResponseDto[] {
    return menus
      .map(menu => {
        if (menu.isAdmin && !includeAdminMenus) {
          return null;
        }

        const visibleChildren = this.pruneTreeByPermissions(
          menu.children ?? [],
          permissions,
          includeAdminMenus,
        );

        const canViewSelf = this.canAccessMenuPath(permissions, menu.path);

        if (!canViewSelf && visibleChildren.length === 0) {
          return null;
        }

        return {
          ...menu,
          children: visibleChildren,
        };
      })
      .filter(Boolean) as MenuResponseDto[];
  }

  private findMenuNodeById(
    menus: MenuResponseDto[],
    id: string
  ): MenuResponseDto | null {
    for (const menu of menus) {
      if (menu.id === id) {
        return menu;
      }

      const found = menu.children
        ? this.findMenuNodeById(menu.children, id)
        : null;
      if (found) {
        return found;
      }
    }

    return null;
  }

  async findTree(
    includeAdminMenus = false,
    isAdminUser = false,
    permissions?: Record<string, string[]>,
  ): Promise<MenuResponseDto[]> {
    const menus = await this.getAllMenuDtos();
    const visibleMenus = this.buildVisibleMenuDtos(
      menus,
      includeAdminMenus && isAdminUser,
    ).filter(menu => menu.isActive);

    const tree = this.buildTree(visibleMenus);
    if (includeAdminMenus && isAdminUser) {
      return tree;
    }

    return this.pruneTreeByPermissions(tree, permissions, includeAdminMenus && isAdminUser);
  }

  async findAll(
    includeAdminMenus = false,
    isAdminUser = false,
  ): Promise<MenuResponseDto[]> {
    const menus = await this.getAllMenuDtos();
    return this.buildVisibleMenuDtos(menus, includeAdminMenus && isAdminUser);
  }

  async findById(
    id: string,
    includeAdminMenus = false,
    isAdminUser = false,
  ): Promise<MenuResponseDto> {
    const menus = await this.getAllMenuDtos();
    const visibleMenus = this.buildVisibleMenuDtos(
      menus,
      includeAdminMenus && isAdminUser,
    );
    const tree = this.buildTree(visibleMenus);
    const menu = this.findMenuNodeById(tree, id);

    if (!menu) {
      throw new NotFoundException(`Menu with id ${id} not found`);
    }
    return menu;
  }

  async create(
    dto: CreateMenuDto,
    userId: string,
    includeAdminMenus = false,
    isAdminUser = false,
  ): Promise<MenuResponseDto> {
    const { parentId, ...rest } = dto;
    if (rest.isAdmin && !isAdminUser) {
      throw new ForbiddenException('Only admin users can create admin menus');
    }
    if (parentId) {
      await this.findById(parentId, includeAdminMenus, isAdminUser);
    }
    const path = normalizeMenuPath(rest.path);
    const menu = this.menuRepository.create({
      ...rest,
      path,
      parent: parentId ? { id: parentId } as any : null,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.menuRepository.save(menu);
    return this.findById(saved.id, includeAdminMenus, isAdminUser);
  }

  async update(
    id: string,
    dto: UpdateMenuDto,
    userId: string,
    includeAdminMenus = false,
    isAdminUser = false,
  ): Promise<MenuResponseDto> {
    await this.findById(id, includeAdminMenus, isAdminUser);

    const menu = await this.menuRepository.findOne({ where: { id } });
    if (!menu) {
      throw new NotFoundException(`Menu with id ${id} not found`);
    }
    const { parentId, ...rest } = dto;
    if (rest.isAdmin && !isAdminUser) {
      throw new ForbiddenException('Only admin users can update admin menus');
    }
    if (parentId) {
      await this.findById(parentId, includeAdminMenus, isAdminUser);
    }
    Object.assign(menu, {
      ...rest,
      path: normalizeMenuPath(rest.path),
    });
    if (parentId !== undefined) {
      menu.parent = parentId ? { id: parentId } as any : null;
    }
    menu.updatedBy = userId;
    await this.menuRepository.save(menu);
    return this.findById(id, includeAdminMenus, isAdminUser);
  }

  async delete(
    id: string,
    includeAdminMenus = false,
    isAdminUser = false,
  ): Promise<{ message: string }> {
    await this.findById(id, includeAdminMenus, isAdminUser);

    const menu = await this.menuRepository.findOne({ where: { id } });
    if (!menu) {
      throw new NotFoundException(`Menu with id ${id} not found`);
    }
    await this.menuRepository.remove(menu);
    return { message: `Menu with id ${id} deleted successfully` };
  }
}
