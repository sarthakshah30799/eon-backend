import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CountryGroup } from "./country-group.entity";
import { CreateCountryGroupDto } from "./dto/create-country-group.dto";
import { UpdateCountryGroupDto } from "./dto/update-country-group.dto";
import { CountryGroupResponseDto } from "./dto/country-group-response.dto";

@Injectable()
export class CountryGroupService {
  constructor(
    @InjectRepository(CountryGroup)
    private readonly countryGroupRepository: Repository<CountryGroup>,
  ) {}

  private generateCode(name: string): string {
    return name.trim().toUpperCase().replace(/\s+/g, "_");
  }

  async findAll(): Promise<CountryGroupResponseDto[]> {
    const groups = await this.countryGroupRepository.find({
      order: { createdAt: "DESC" },
    });
    return groups.map(CountryGroupResponseDto.fromEntity);
  }

  async findById(id: string): Promise<CountryGroupResponseDto> {
    const group = await this.countryGroupRepository.findOne({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Country Group with id ${id} not found`);
    }
    return CountryGroupResponseDto.fromEntity(group);
  }

  async create(dto: CreateCountryGroupDto, userId: string): Promise<CountryGroupResponseDto> {
    const name = dto.name.trim();
    const code = dto.code ? dto.code.trim().toUpperCase() : this.generateCode(name);

    // Validate uniqueness of code
    const existingCode = await this.countryGroupRepository.findOne({
      where: { code },
    });
    if (existingCode) {
      throw new ConflictException(`Country Group with code "${code}" already exists`);
    }

    // Validate uniqueness of name
    const existingName = await this.countryGroupRepository.findOne({
      where: { name },
    });
    if (existingName) {
      throw new ConflictException(`Country Group with name "${name}" already exists`);
    }

    const group = this.countryGroupRepository.create({
      name,
      code,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.countryGroupRepository.save(group);
    return CountryGroupResponseDto.fromEntity(saved);
  }

  async update(id: string, dto: UpdateCountryGroupDto, userId: string): Promise<CountryGroupResponseDto> {
    const group = await this.countryGroupRepository.findOne({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Country Group with id ${id} not found`);
    }

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name.toLowerCase() !== group.name.toLowerCase()) {
        const existingName = await this.countryGroupRepository.findOne({
          where: { name },
        });
        if (existingName) {
          throw new ConflictException(`Country Group with name "${name}" already exists`);
        }
      }
      group.name = name;
    }

    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();
      if (code !== group.code) {
        const existingCode = await this.countryGroupRepository.findOne({
          where: { code },
        });
        if (existingCode) {
          throw new ConflictException(`Country Group with code "${code}" already exists`);
        }
      }
      group.code = code;
    }

    group.updatedBy = userId;
    const saved = await this.countryGroupRepository.save(group);
    return CountryGroupResponseDto.fromEntity(saved);
  }

  async delete(id: string): Promise<{ message: string }> {
    const group = await this.countryGroupRepository.findOne({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Country Group with id ${id} not found`);
    }

    try {
      await this.countryGroupRepository.remove(group);
      return { message: `Country Group with id ${id} deleted successfully` };
    } catch (error) {
      if (error.code === "23503") {
        throw new ConflictException(
          "Cannot delete Country Group because it is mapped to one or more Countries"
        );
      }
      throw error;
    }
  }
}
