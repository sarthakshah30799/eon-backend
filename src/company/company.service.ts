import {
  ConflictException,
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

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

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
    const company = this.companyRepository.create({
      ...uppercaseFields(dto),
      createdBy: userId,
      updatedBy: userId,
    });
    const existingPan = await this.companyRepository.findOne({
      where: { panNo: company.panNo },
    });
    if (existingPan) {
      throw new ConflictException('Company with this PAN already exists');
    }
    const saved = await this.companyRepository.save(company);
    return CompanyResponseDto.fromEntity(saved);
  }

  async update(id: string, dto: UpdateCompanyDto, userId: string): Promise<CompanyResponseDto> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }
    const uppercased = uppercaseFields(dto);
    if (uppercased.panNo && uppercased.panNo !== company.panNo) {
      const existingPan = await this.companyRepository.findOne({
        where: { panNo: uppercased.panNo },
      });
      if (existingPan) {
        throw new ConflictException('Company with this PAN already exists');
      }
    }
    Object.assign(company, uppercased);
    company.updatedBy = userId;
    const saved = await this.companyRepository.save(company);
    return CompanyResponseDto.fromEntity(saved);
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
