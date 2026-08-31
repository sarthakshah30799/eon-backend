import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, In, Repository } from "typeorm";
import { Branch } from "./branch.entity";
import { BranchCounter } from "./entities/branch-counter.entity";
import { Counter } from "../counters/counter.entity";
import { Country } from "../country/country.entity";
import { State } from "../state/state.entity";
import { SelectOption } from "../category-options/category-option.entity";
import { UserRole } from "../user-roles/user-role.entity";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { BranchListQueryDto } from "./dto/branch-list-query.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";
import { BranchResponseDto } from "./dto/branch-response.dto";
import { assertCountersExist } from "./branch-counter.access";
import {
  applyPagination,
  buildPaginatedResponse,
  normalizePagination,
  type PaginatedResponseDto,
} from "../common/pagination";

import { uppercaseFields } from "../utils/uppercase.util";

@Injectable()
export class BranchService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(BranchCounter)
    private readonly branchCounterRepository: Repository<BranchCounter>,
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
    @InjectRepository(State)
    private readonly stateRepository: Repository<State>,
  ) {}

  private async loadBranch(id: string): Promise<Branch> {
    const branch = await this.branchRepository.findOne({
      where: { id },
      relations: [
        "company",
        "counterLinks",
        "country",
        "state",
        "locationType",
      ],
    });
    if (!branch) {
      throw new NotFoundException(`Branch with id ${id} not found`);
    }
    return branch;
  }

  private async syncCounterLinks(
    branchId: string,
    counterIds: string[] | undefined,
    userId: string,
  ): Promise<void> {
    if (counterIds === undefined) {
      return;
    }

    const uniqueCounterIds = [
      ...new Set(counterIds.map((id) => id.trim()).filter(Boolean)),
    ];

    await assertCountersExist(uniqueCounterIds, async (ids) => {
      const existing = await this.counterRepository.find({
        where: { id: In(ids) },
        select: ["id"],
      });
      const existingIds = new Set(existing.map((counter) => counter.id));
      return ids.filter((id) => !existingIds.has(id));
    });

    const existingLinks = await this.branchCounterRepository.find({
      where: { branchId },
    });
    const existingCounterIds = existingLinks.map((link) => link.counterId);
    const toUnlink = existingCounterIds.filter(
      (counterId) => !uniqueCounterIds.includes(counterId),
    );

    if (toUnlink.length > 0) {
      const blockingAssignments = await this.userRoleRepository
        .createQueryBuilder("userRole")
        .leftJoinAndSelect("userRole.user", "user")
        .leftJoinAndSelect("userRole.counter", "counter")
        .where("userRole.branch_id = :branchId", { branchId })
        .andWhere("userRole.counter_id IN (:...counterIds)", {
          counterIds: toUnlink,
        })
        .getMany();

      if (blockingAssignments.length > 0) {
        const first = blockingAssignments[0];
        const userLabel =
          first.user?.email || first.user?.code || first.user?.id || "a user";
        const counterLabel =
          first.counter?.name ||
          (first.counter?.counterNo != null
            ? `Counter ${first.counter.counterNo}`
            : first.counter?.id);
        throw new BadRequestException(
          `Cannot unlink counter "${counterLabel}" from this branch while ${userLabel} is still assigned to that branch and counter. Update the user assignment first.`,
        );
      }

      await this.branchCounterRepository.delete({
        branchId,
        counterId: In(toUnlink),
      });
    }

    const existingSet = new Set(existingCounterIds);
    const toLink = uniqueCounterIds.filter(
      (counterId) => !existingSet.has(counterId),
    );

    if (toLink.length > 0) {
      const links = toLink.map((counterId) =>
        this.branchCounterRepository.create({
          branchId,
          counterId,
          createdBy: userId,
          updatedBy: userId,
        }),
      );
      await this.branchCounterRepository.save(links);
    }
  }

  async findAll(
    query?: BranchListQueryDto,
  ): Promise<PaginatedResponseDto<BranchResponseDto>> {
    const pagination = normalizePagination(query);
    const includeInactive = query?.activeOnly === false;
    const qb = this.branchRepository
      .createQueryBuilder("branch")
      .leftJoinAndSelect("branch.company", "company")
      .leftJoinAndSelect("branch.counterLinks", "counterLinks")
      .leftJoinAndSelect("branch.country", "country")
      .leftJoinAndSelect("branch.state", "state")
      .leftJoinAndSelect("branch.locationType", "locationType")
      .orderBy("branch.createdAt", "DESC");

    if (!includeInactive) {
      qb.andWhere("branch.isActive = :isActive", { isActive: true });
    }

    if (query?.search) {
      qb.andWhere(
        new Brackets((searchQb) => {
          searchQb
            .where("branch.code ILIKE :search", { search: `%${query.search}%` })
            .orWhere("branch.name ILIKE :search", {
              search: `%${query.search}%`,
            })
            .orWhere("branch.city ILIKE :search", {
              search: `%${query.search}%`,
            })
            .orWhere("branch.branch_number::text ILIKE :search", {
              search: `%${query.search}%`,
            })
            .orWhere("branch.contactName ILIKE :search", {
              search: `%${query.search}%`,
            })
            .orWhere("branch.contactNo ILIKE :search", {
              search: `%${query.search}%`,
            })
            .orWhere("branch.branchEmail ILIKE :search", {
              search: `%${query.search}%`,
            })
            .orWhere("country.name ILIKE :search", {
              search: `%${query.search}%`,
            })
            .orWhere("state.name ILIKE :search", {
              search: `%${query.search}%`,
            })
            .orWhere("company.name ILIKE :search", {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    applyPagination(qb, pagination);
    const [branches, total] = await qb.getManyAndCount();
    return buildPaginatedResponse(
      branches.map((branch) => BranchResponseDto.fromEntity(branch)),
      total,
      pagination,
    );
  }

  async findById(id: string): Promise<BranchResponseDto> {
    const branch = await this.loadBranch(id);
    return BranchResponseDto.fromEntity(branch);
  }

  async create(
    dto: CreateBranchDto,
    userId: string,
  ): Promise<BranchResponseDto> {
    const { companyId, countryId, stateId, counterIds, locationType, ...rest } =
      uppercaseFields(dto);

    const country = await this.countryRepository.findOne({
      where: { id: countryId },
    });

    if (!country) {
      throw new NotFoundException(`Country with id ${countryId} not found`);
    }

    const state = await this.stateRepository.findOne({
      where: { id: stateId },
      relations: ["country"],
    });

    if (!state) {
      throw new NotFoundException(`State with id ${stateId} not found`);
    }

    if (state.country?.id !== country.id) {
      throw new NotFoundException(
        "Selected state does not belong to the selected country",
      );
    }

    const branch = this.branchRepository.create({
      ...rest,
      locationType: locationType
        ? ({ id: locationType } as SelectOption)
        : null,
      country,
      state,
      company: companyId ? ({ id: companyId } as any) : null,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.branchRepository.save(branch);

    await this.syncCounterLinks(saved.id, counterIds, userId);

    return this.findById(saved.id);
  }

  async update(
    id: string,
    dto: UpdateBranchDto,
    userId: string,
  ): Promise<BranchResponseDto> {
    const branch = await this.loadBranch(id);

    const {
      code: _code,
      companyId,
      countryId,
      stateId,
      counterIds,
      locationType,
      ...rest
    } = uppercaseFields(dto);

    let country = branch.country;
    let state = branch.state;

    if (countryId !== undefined) {
      const nextCountry = await this.countryRepository.findOne({
        where: { id: countryId },
      });

      if (!nextCountry) {
        throw new NotFoundException(`Country with id ${countryId} not found`);
      }

      country = nextCountry;
    }

    if (stateId !== undefined) {
      const nextState = await this.stateRepository.findOne({
        where: { id: stateId },
        relations: ["country"],
      });

      if (!nextState) {
        throw new NotFoundException(`State with id ${stateId} not found`);
      }

      state = nextState;
    }

    if (!country && state?.country) {
      country = state.country;
    }

    if (country && state && state.country?.id !== country.id) {
      throw new NotFoundException(
        "Selected state does not belong to the selected country",
      );
    }

    Object.assign(branch, rest);
    if (locationType !== undefined) {
      branch.locationType = locationType
        ? ({ id: locationType } as SelectOption)
        : null;
    }
    if (companyId !== undefined) {
      branch.company = companyId ? ({ id: companyId } as any) : null;
    }
    branch.country = country ? ({ id: country.id } as any) : null;
    branch.state = state ? ({ id: state.id } as any) : null;
    branch.updatedBy = userId;
    await this.branchRepository.save(branch);

    await this.syncCounterLinks(id, counterIds, userId);

    return this.findById(id);
  }

  async delete(id: string): Promise<{ message: string }> {
    const branch = await this.branchRepository.findOne({ where: { id } });
    if (!branch) {
      throw new NotFoundException(`Branch with id ${id} not found`);
    }
    await this.branchRepository.remove(branch);
    return { message: `Branch with id ${id} deleted successfully` };
  }
}
