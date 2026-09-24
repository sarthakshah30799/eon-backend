import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Counter } from "./counter.entity";
import { CreateCounterDto } from "./dto/create-counter.dto";
import { CounterListQueryDto } from "./dto/counter-list-query.dto";
import { UpdateCounterDto } from "./dto/update-counter.dto";
import { CounterResponseDto } from "./dto/counter-response.dto";
import { CounterMenuRestriction } from "../counter-menu-restrictions/counter-menu-restriction.entity";
import { Permission } from "../permissions/permission.entity";
import { Menu } from "../menu/menu.entity";
import {
  applyPagination,
  buildPaginatedResponse,
  normalizePagination,
  type PaginatedResponseDto,
} from "../common/pagination";

import { uppercaseFields } from "../utils/uppercase.util";

const EMPTY_PERMISSION_ROW: Record<string, boolean> = {
  add: false,
  modify: false,
  delete: false,
  view: false,
  export: false,
  authorized: false,
  rejected: false,
};

@Injectable()
export class CounterService {
  constructor(
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
    @InjectRepository(CounterMenuRestriction)
    private readonly counterMenuRestrictionRepository: Repository<CounterMenuRestriction>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
  ) {}

  async findAll(
    query?: CounterListQueryDto,
  ): Promise<PaginatedResponseDto<CounterResponseDto>> {
    const pagination = normalizePagination(query);
    const qb = this.counterRepository
      .createQueryBuilder("counter")
      .leftJoinAndSelect("counter.branchLinks", "branchLinks")
      .leftJoinAndSelect("branchLinks.branch", "branch")
      .orderBy("counter.createdAt", "DESC");

    if (query?.activeOnly) {
      qb.andWhere("counter.isActive = :isActive", { isActive: true });
    }

    if (query?.search) {
      qb.andWhere("counter.name ILIKE :search", {
        search: `%${query.search}%`,
      });
    }

    if (query?.branchId?.trim()) {
      qb.andWhere("branchLinks.branchId = :branchId", {
        branchId: query.branchId.trim(),
      });
    }

    applyPagination(qb, pagination);
    const [counters, total] = await qb.getManyAndCount();
    return buildPaginatedResponse(
      counters.map(CounterResponseDto.fromEntity),
      total,
      pagination,
    );
  }

  async findById(id: string): Promise<CounterResponseDto> {
    const counter = await this.counterRepository.findOne({
      where: { id },
      relations: ["branchLinks", "branchLinks.branch"],
    });
    if (!counter) {
      throw new NotFoundException(`Counter with id ${id} not found`);
    }
    return CounterResponseDto.fromEntity(counter);
  }

  async create(
    dto: CreateCounterDto,
    userId: string,
  ): Promise<CounterResponseDto> {
    const rest = uppercaseFields(dto);
    const counter = this.counterRepository.create({
      ...rest,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.counterRepository.save(counter);
    return this.findById(saved.id);
  }

  async update(
    id: string,
    dto: UpdateCounterDto,
    userId: string,
  ): Promise<CounterResponseDto> {
    const counter = await this.counterRepository.findOne({ where: { id } });
    if (!counter) {
      throw new NotFoundException(`Counter with id ${id} not found`);
    }
    const rest = uppercaseFields(dto);
    Object.assign(counter, rest);
    counter.updatedBy = userId;
    await this.counterRepository.save(counter);
    return this.findById(id);
  }

  async delete(id: string): Promise<{ message: string }> {
    const counter = await this.counterRepository.findOne({ where: { id } });
    if (!counter) {
      throw new NotFoundException(`Counter with id ${id} not found`);
    }
    await this.counterRepository.remove(counter);
    return { message: `Counter with id ${id} deleted successfully` };
  }

  async getCounterPermissions(
    counterId: string,
  ): Promise<Record<string, Record<string, boolean>>> {
    await this.findById(counterId);

    const relations = await this.counterMenuRestrictionRepository.find({
      where: { counter: { id: counterId } as CounterMenuRestriction["counter"] },
      relations: ["menu", "permission"],
      relationLoadStrategy: "query",
    });

    const grid: Record<string, Record<string, boolean>> = {};
    for (const item of relations) {
      if (!item.menu || !item.permission) continue;
      const menuId = item.menu.id;
      const permCode = item.permission.code;
      if (!grid[menuId]) {
        grid[menuId] = { ...EMPTY_PERMISSION_ROW };
      }
      grid[menuId][permCode] = true;
    }

    return grid;
  }

  async updateCounterPermissions(
    counterId: string,
    grid: Record<string, Record<string, boolean>>,
    userId: string,
  ): Promise<{ message: string }> {
    await this.findById(counterId);

    await this.counterMenuRestrictionRepository.delete({
      counter: { id: counterId } as CounterMenuRestriction["counter"],
    });

    const allPermissions = await this.permissionRepository.find();
    const permissionMap = new Map(allPermissions.map((p) => [p.code, p]));

    const menuIds = Object.keys(grid);
    const existingMenus =
      menuIds.length > 0
        ? await this.menuRepository.find({
            where: { id: In(menuIds) },
            select: { id: true },
          })
        : [];
    const validMenuIds = new Set(existingMenus.map((menu) => menu.id));

    const entitiesToSave: CounterMenuRestriction[] = [];

    for (const [menuId, perms] of Object.entries(grid)) {
      if (!validMenuIds.has(menuId)) {
        continue;
      }

      for (const [permCode, isEnabled] of Object.entries(perms)) {
        if (!isEnabled) continue;
        const permission = permissionMap.get(permCode);
        if (!permission) continue;

        const row = this.counterMenuRestrictionRepository.create({
          counter: { id: counterId } as Counter,
          menu: { id: menuId } as Menu,
          permission: { id: permission.id } as Permission,
          createdBy: userId,
          updatedBy: userId,
        });
        entitiesToSave.push(row);
      }
    }

    if (entitiesToSave.length > 0) {
      await this.counterMenuRestrictionRepository.save(entitiesToSave);
    }

    return { message: "Permissions updated successfully" };
  }
}
