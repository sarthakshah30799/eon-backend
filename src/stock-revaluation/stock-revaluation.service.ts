import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Branch } from '../branches/branch.entity';
import { Currency } from '../currencies/currency.entity';
import { Counter } from '../counters/counter.entity';
import { AdditionalSettingService } from '../additional-settings/additional-setting.service';
import { StockRevaluation } from './entities/stock-revaluation.entity';
import { StockRevaluationItem } from './entities/stock-revaluation-item.entity';
import { ProcessStockRevaluationDto } from './dto/stock-revaluation.dto';
import { StockRevaluationFrequency } from './stock-revaluation.enums';

type UploadedRate = { date: string; currencyCode: string; rate: string };
type StockRevaluationTarget = { branchId: string; counterId: string };

const toDateKey = (value: string) => {
  const match = /^([0-3]\d)\/([01]\d)\/([12]\d{3})$/.exec(value.trim());
  if (match) {
    const [, day, month, year] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
      throw new BadRequestException(`Invalid date: ${value}`);
    }
    return `${year}-${month}-${day}`;
  }

  // XLSX returns formatted Excel dates as serial numbers when cellDates is false.
  if (/^\d+(\.\d+)?$/.test(value.trim())) {
    const serial = Number(value);
    const excelDate = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
    if (!Number.isNaN(excelDate.getTime())) {
      return `${excelDate.getUTCFullYear()}-${String(excelDate.getUTCMonth() + 1).padStart(2, '0')}-${String(excelDate.getUTCDate()).padStart(2, '0')}`;
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid date: ${value}`);
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const lastDay = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const getFinancialYearStart = (year: number, month: number) => month >= 3 ? year : year - 1;

const getPeriodEnd = (dateKey: string, frequency: StockRevaluationFrequency) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const monthIndex = month - 1;
  const financialYearStart = getFinancialYearStart(year, monthIndex);
  const financialMonth = ((year - financialYearStart) * 12) + monthIndex - 3;
  let endYear = year;
  let endMonth = monthIndex;

  if (frequency === StockRevaluationFrequency.QUARTERLY) {
    const quarterEndFinancialMonth = Math.floor(financialMonth / 3) * 3 + 2;
    endYear = financialYearStart + Math.floor((quarterEndFinancialMonth + 3) / 12);
    endMonth = (quarterEndFinancialMonth + 3) % 12;
  } else if (frequency === StockRevaluationFrequency.HALF_YEARLY) {
    const halfEndFinancialMonth = financialMonth < 6 ? 5 : 11;
    endYear = financialYearStart + Math.floor((halfEndFinancialMonth + 3) / 12);
    endMonth = (halfEndFinancialMonth + 3) % 12;
  } else if (frequency === StockRevaluationFrequency.YEARLY) {
    endYear = financialYearStart + 1;
    endMonth = 2;
  }

  return `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(lastDay(endYear, endMonth)).padStart(2, '0')}`;
};

const todayKey = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).split('-');
  return parts.join('-');
};

const latestCompletedPeriodEnd = (frequency: StockRevaluationFrequency) => {
  const current = todayKey().split('-').map(Number);
  const date = new Date(current[0], current[1] - 1, current[2] - 1);
  for (let index = 0; index < 400; index += 1) {
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const periodEnd = getPeriodEnd(dateKey, frequency);
    if (periodEnd <= todayKey()) return periodEnd;
    date.setDate(date.getDate() - 1);
  }
  throw new BadRequestException('Unable to determine the current stock revaluation period');
};

@Injectable()
export class StockRevaluationService {
  constructor(
    @InjectRepository(StockRevaluation, 'database2')
    private readonly revaluationRepository: Repository<StockRevaluation>,
    @InjectRepository(StockRevaluationItem, 'database2')
    private readonly itemRepository: Repository<StockRevaluationItem>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
    private readonly additionalSettingService: AdditionalSettingService,
  ) {}

  parseWorkbook(file: { buffer: Buffer }): UploadedRate[] {
    const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new BadRequestException('The uploaded template has no worksheet');
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    if (!rows.length) throw new BadRequestException('The uploaded template is empty');

    const read = (row: Record<string, unknown>, key: string) => {
      const found = Object.entries(row).find(([name]) => name.trim().toLowerCase() === key);
      return String(found?.[1] ?? '').trim();
    };

    const rates = rows.map((row, index) => {
      const date = read(row, 'date');
      const currencyCode = read(row, 'currency');
      const rate = read(row, 'rate');
      if (!date || !currencyCode || !rate) throw new BadRequestException(`Row ${index + 2}: date, currency, and rate are required`);
      const numericRate = Number(rate);
      if (!Number.isFinite(numericRate) || numericRate <= 0) throw new BadRequestException(`Row ${index + 2}: rate must be greater than zero`);
      return { date: toDateKey(date), currencyCode: currencyCode.toUpperCase(), rate: numericRate.toFixed(7) };
    });

    const date = rates[0].date;
    if (rates.some((rate) => rate.date !== date)) throw new BadRequestException('All rows must use the same date');
    const duplicates = rates.filter((rate, index) => rates.findIndex((candidate) => candidate.currencyCode === rate.currencyCode) !== index);
    if (duplicates.length) throw new BadRequestException(`Duplicate currency rows found: ${[...new Set(duplicates.map((rate) => rate.currencyCode))].join(', ')}`);
    return rates;
  }

  async getTemplate() {
    const worksheet = XLSX.utils.aoa_to_sheet([['Date', 'Currency', 'Rate'], ['DD/MM/YYYY', 'USD', '94.0000000']]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Revaluation');
    return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  }

  private async getConfiguredFrequency() {
    const configured = await this.additionalSettingService.getSettingTextValue('STOCK_REVALUATION_SETTINGS', 'STOCK_REVALUATION_FREQUENCY');
    const normalized = configured?.trim().toUpperCase() as StockRevaluationFrequency | undefined;
    return normalized && Object.values(StockRevaluationFrequency).includes(normalized) ? normalized : undefined;
  }

  private async processTarget(target: StockRevaluationTarget, dto: ProcessStockRevaluationDto, rates: UploadedRate[], userId: string) {
    const { branchId, counterId } = target;
    const branch = await this.branchRepository.findOne({ where: { id: branchId, isActive: true } });
    if (!branch) throw new NotFoundException(`Active branch ${branchId} was not found`);
    const counter = await this.counterRepository.findOne({ where: { id: counterId, branch: { id: branchId }, isActive: true } });
    if (!counter) throw new NotFoundException(`Active counter ${counterId} was not found on branch ${branchId}`);

    const configuredFrequency = await this.getConfiguredFrequency();
    if (!configuredFrequency) {
      throw new BadRequestException('Stock revaluation frequency is not configured in Additional Settings');
    }
    if (configuredFrequency && configuredFrequency !== dto.frequency) {
      throw new BadRequestException(`Stock revaluation frequency must be ${configuredFrequency}`);
    }

    // The uploaded date identifies the upload event; valuation always targets
    // the latest completed financial-year period, never a future period.
    const periodEnd = latestCompletedPeriodEnd(dto.frequency);

    const currencies = await this.currencyRepository.find({ where: rates.map((rate) => ({ currencyCode: rate.currencyCode, active: true })) });
    const currencyMap = new Map(currencies.map((currency) => [currency.currencyCode.toUpperCase(), currency]));
    const missing = rates.filter((rate) => !currencyMap.has(rate.currencyCode)).map((rate) => rate.currencyCode);
    if (missing.length) throw new BadRequestException(`Unknown or inactive currency codes: ${missing.join(', ')}`);

    const requested = rates.map((rate) => {
      const currency = currencyMap.get(rate.currencyCode)!;
      return { currencyId: currency.id, currencyCode: currency.currencyCode, currencyName: currency.currencyName, rate: rate.rate };
    });
    const rows = await this.revaluationRepository.query(
      `SELECT public.calculate_stock_revaluation($1::uuid, $2::uuid, $3::date, $4::jsonb) AS rows`,
      [branchId, counterId, periodEnd, JSON.stringify(requested)],
    );
    const calculated = typeof rows?.[0]?.rows === 'string' ? JSON.parse(rows[0].rows) : rows?.[0]?.rows ?? [];
    const branchSnapshot = { id: branch.id, code: branch.code, name: branch.name, label: `${branch.code} - ${branch.name}` };
    const counterSnapshot = { id: counter.id, counterNo: counter.counterNo, name: counter.name, label: `${counter.counterNo} - ${counter.name}` };

    return this.revaluationRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(StockRevaluation);
      const itemRepository = manager.getRepository(StockRevaluationItem);
      const existing = await repository.findOne({ where: { branchId, counterId, frequency: dto.frequency, valuationDate: periodEnd } });
      if (existing) throw new BadRequestException(`Stock revaluation already exists for ${periodEnd}. Delete the existing upload before uploading again.`);
      let revaluation = repository.create({ branchId, counterId, branchSnapshot, counterSnapshot, frequency: dto.frequency, valuationDate: periodEnd, uploadedDate: rates[0].date, createdBy: userId, updatedBy: userId });
      revaluation = await repository.save(revaluation);
      const items = calculated.map((row: Record<string, unknown>, index: number) => itemRepository.create({
        revaluationId: revaluation!.id,
        lineNo: index + 1,
        currencyId: String(row.currencyId),
        currencySnapshot: { id: row.currencyId, currencyCode: row.currencyCode, currencyName: row.currencyName },
        closingQuantity: String(row.closingQuantity ?? 0),
        awp: String(row.awp ?? 0),
        closingInrAmount: String(row.closingInrAmount ?? 0),
        newRate: String(row.newRate ?? 0),
        newInrAmount: String(row.newInrAmount ?? 0),
        differenceInr: String(row.differenceInr ?? 0),
        createdBy: userId,
        updatedBy: userId,
      }));
      revaluation.items = await itemRepository.save(items);
      return revaluation;
    });
  }

  async process(dto: ProcessStockRevaluationDto, file: { buffer: Buffer }, userId: string, targets: StockRevaluationTarget[]) {
    const rates = this.parseWorkbook(file);
    const results = [];
    for (const target of targets) results.push(await this.processTarget(target, dto, rates, userId));
    return results;
  }

  async current(targets: StockRevaluationTarget[], frequency: StockRevaluationFrequency) {
    const valuationDate = latestCompletedPeriodEnd(frequency);
    return this.revaluationRepository.find({ where: targets.map(({ branchId, counterId }) => ({ branchId, counterId, frequency, valuationDate })), relations: ['items'], order: { valuationDate: 'DESC', createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const revaluation = await this.revaluationRepository.findOne({ where: { id }, relations: ['items'] });
    if (!revaluation) throw new NotFoundException('Stock revaluation was not found');
    return revaluation;
  }

  async delete(id: string, userId: string) {
    const result = await this.revaluationRepository.delete(id);
    if (!result.affected) throw new NotFoundException('Stock revaluation was not found');
    return { message: 'Stock revaluation deleted successfully' };
  }
}
