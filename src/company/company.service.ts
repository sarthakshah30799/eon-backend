import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Company } from './company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyResponseDto } from './dto/company-response.dto';
import { CompanyListQueryDto } from './dto/company-list-query.dto';

import { uppercaseFields } from '../utils/uppercase.util';
import { buildEntitySnapshot } from '../common/snapshot/entity-snapshot.util';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  private normalizeDateValue(value?: string | null) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  async getCurrentCompany(
    referenceDate = new Date(),
    excludeCompanyId?: string,
  ): Promise<Company | null> {
    const qb = this.companyRepository
      .createQueryBuilder('company')
      .where('(company.fromDate IS NULL OR company.fromDate <= :referenceDate)', {
        referenceDate,
      })
      .andWhere('(company.toDate IS NULL OR company.toDate > :referenceDate)', {
        referenceDate,
      })
      .orderBy('company.fromDate', 'DESC', 'NULLS LAST')
      .addOrderBy('company.createdAt', 'DESC');

    if (excludeCompanyId) {
      qb.andWhere('company.id <> :excludeCompanyId', { excludeCompanyId });
    }

    return qb.getOne();
  }

  async getCurrentCompanySnapshot(
    referenceDate = new Date(),
    excludeCompanyId?: string,
  ) {
    const company = await this.getCurrentCompany(referenceDate, excludeCompanyId);
    return company
      ? buildEntitySnapshot(company, this.companyRepository)
      : null;
  }

  async findAll(query?: CompanyListQueryDto): Promise<CompanyResponseDto[]> {
    const qb = this.companyRepository
      .createQueryBuilder('company')
      .orderBy('company.createdAt', 'DESC');

    if (query?.search) {
      qb.andWhere(
        new Brackets(searchQb => {
          searchQb
            .where('company.name ILIKE :search', { search: `%${query.search}%` })
            .orWhere('company.shortCode ILIKE :search', { search: `%${query.search}%` })
            .orWhere('company.panNo ILIKE :search', { search: `%${query.search}%` })
            .orWhere('company.cinNo ILIKE :search', { search: `%${query.search}%` })
            .orWhere('company.email ILIKE :search', { search: `%${query.search}%` });
        })
      );
    }

    const companies = await qb.getMany();
    return companies.map(CompanyResponseDto.fromEntity);
  }

  async findById(id: string): Promise<CompanyResponseDto> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }
    return CompanyResponseDto.fromEntity(company);
  }

  async create(dto: CreateCompanyDto, userId: string): Promise<CompanyResponseDto> {
    const normalized = uppercaseFields(dto);
    const fromDate = this.normalizeDateValue(normalized.fromDate);
    const toDate = this.normalizeDateValue(normalized.toDate);

    return this.companyRepository.manager.transaction(async manager => {
      const companyRepository = manager.getRepository(Company);
      const company = companyRepository.create({
        ...normalized,
        fromDate,
        toDate,
        createdBy: userId,
        updatedBy: userId,
      });

      if (fromDate) {
        const previousCompany = await companyRepository
          .createQueryBuilder('company')
          .setLock('pessimistic_write')
          .where('(company.fromDate IS NULL OR company.fromDate < :fromDate)', {
            fromDate,
          })
          .orderBy('company.fromDate', 'DESC', 'NULLS LAST')
          .addOrderBy('company.createdAt', 'DESC')
          .getOne();

        if (previousCompany) {
          previousCompany.toDate = fromDate;
          previousCompany.updatedBy = userId;
          await companyRepository.save(previousCompany);
        }
      }

      const saved = await companyRepository.save(company);
      return CompanyResponseDto.fromEntity(saved);
    });
  }

  async update(id: string, dto: UpdateCompanyDto, userId: string): Promise<CompanyResponseDto> {
    const normalized = uppercaseFields(dto);
    const fromDate =
      normalized.fromDate !== undefined
        ? this.normalizeDateValue(normalized.fromDate)
        : undefined;
    const toDate =
      normalized.toDate !== undefined
        ? this.normalizeDateValue(normalized.toDate)
        : undefined;

    return this.companyRepository.manager.transaction(async manager => {
      const companyRepository = manager.getRepository(Company);
      const company = await companyRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!company) {
        throw new NotFoundException(`Company with id ${id} not found`);
      }

      const previousFromDate = company.fromDate ? new Date(company.fromDate) : null;
      Object.assign(company, {
        ...normalized,
        fromDate: fromDate !== undefined ? fromDate : company.fromDate,
        toDate: toDate !== undefined ? toDate : company.toDate,
      });
      company.updatedBy = userId;

      if (
        fromDate &&
        (!previousFromDate || previousFromDate.getTime() !== fromDate.getTime())
      ) {
        const previousCompany = await companyRepository
          .createQueryBuilder('company')
          .setLock('pessimistic_write')
          .where('company.id <> :id', { id })
          .andWhere('(company.fromDate IS NULL OR company.fromDate < :fromDate)', {
            fromDate,
          })
          .orderBy('company.fromDate', 'DESC', 'NULLS LAST')
          .addOrderBy('company.createdAt', 'DESC')
          .getOne();

        if (previousCompany) {
          previousCompany.toDate = fromDate;
          previousCompany.updatedBy = userId;
          await companyRepository.save(previousCompany);
        }
      }

      const saved = await companyRepository.save(company);
      return CompanyResponseDto.fromEntity(saved);
    });
  }

  async delete(id: string): Promise<{ message: string }> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }
    await this.companyRepository.remove(company);
    return { message: `Company with id ${id} deleted successfully` };
  }
}
