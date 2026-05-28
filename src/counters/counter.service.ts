import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Counter } from './counter.entity';
import { CreateCounterDto } from './dto/create-counter.dto';
import { UpdateCounterDto } from './dto/update-counter.dto';
import { CounterResponseDto } from './dto/counter-response.dto';

@Injectable()
export class CounterService {
  constructor(
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
  ) {}

  async findAll(): Promise<CounterResponseDto[]> {
    const counters = await this.counterRepository.find({
      relations: ['branch'],
      order: { createdAt: 'DESC' },
    });
    return counters.map(CounterResponseDto.fromEntity);
  }

  async findById(id: string): Promise<CounterResponseDto> {
    const counter = await this.counterRepository.findOne({
      where: { id },
      relations: ['branch'],
    });
    if (!counter) {
      throw new NotFoundException(`Counter with id ${id} not found`);
    }
    return CounterResponseDto.fromEntity(counter);
  }

  async create(dto: CreateCounterDto, userId: string): Promise<CounterResponseDto> {
    const { branchId, ...rest } = dto;
    const counter = this.counterRepository.create({
      ...rest,
      branch: branchId ? { id: branchId } as any : null,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.counterRepository.save(counter);
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateCounterDto, userId: string): Promise<CounterResponseDto> {
    const counter = await this.counterRepository.findOne({ where: { id } });
    if (!counter) {
      throw new NotFoundException(`Counter with id ${id} not found`);
    }
    const { branchId, ...rest } = dto;
    Object.assign(counter, rest);
    if (branchId !== undefined) {
      counter.branch = branchId ? { id: branchId } as any : null;
    }
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
}
