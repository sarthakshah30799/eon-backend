import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyResponseDto } from './dto/company-response.dto';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  async findAll(): Promise<CompanyResponseDto[]> {
    const companies = await this.companyRepository.find({
      order: { createdAt: 'DESC' },
    });
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
      ...dto,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.companyRepository.save(company);
    return CompanyResponseDto.fromEntity(saved);
  }

  async update(id: string, dto: UpdateCompanyDto, userId: string): Promise<CompanyResponseDto> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }
    Object.assign(company, dto);
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
