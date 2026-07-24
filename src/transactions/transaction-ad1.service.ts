import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { TransactionAd1 } from './entities/transaction-ad1.entity';
import { Branch } from '../branches/branch.entity';
import { PartyProfile, ClientType } from '../party-profiles/party-profile.entity';
import { Currency } from '../currencies/currency.entity';
import { SelectOption } from '../category-options/category-option.entity';
import { AccountProfile } from '../account-profiles/account-profile.entity';
import { Product } from '../products/product.entity';
import { Purpose } from '../purpose/purpose.entity';
import { TransactionProfileType, TransactionType } from './transactions.enums';

interface Ad1Payload {
  currencyId?: string;
  productId?: string;
  agentId?: string;
  bankNameId?: string;
  marketingId?: string;
  segmentId?: string;
  purposeId?: string;
  relationshipId?: string;
  transactionType?: TransactionType;
  profileType?: TransactionProfileType;
  docNo?: string;
  dealId?: string;
  transactionDate?: string;
  servicedBy?: string;
  remitterName?: string;
  contactNo?: string;
  email?: string;
  address?: string;
  pan?: string;
  dateOfBirth?: string;
  beneficiaryName?: string;
  beniAddress?: string;
  beneAccountNumber?: string;
  beneBankName?: string;
  swiftCode?: string;
  fcVolume?: string | number | null;
  saleRate?: string | number | null;
  totalInrAmt?: string | number | null;
  gst?: string | number | null;
  bankCharges?: string | number | null;
  tcs?: string | number | null;
  otherIncome?: string | number | null;
  finalAmount?: string | number | null;
  settlementRate?: string | number | null;
  grossRevenue?: string | number | null;
  revenueReceivable?: string | number | null;
  agentComm?: string | number | null;
  tds?: string | number | null;
  commissionPayable?: string | number | null;
  netRevenue?: string | number | null;
  rtgsImpsNeftRefNo?: string;
  remarks?: string;
  fxRefAgentId?: string;
  [key: string]: unknown;
}

@Injectable()
export class TransactionAd1Service {
  constructor(
    @InjectRepository(TransactionAd1, 'database2')
    private readonly repo: Repository<TransactionAd1>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(PartyProfile)
    private readonly partyProfileRepository: Repository<PartyProfile>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(SelectOption)
    private readonly selectOptionRepository: Repository<SelectOption>,
    @InjectRepository(Purpose)
    private readonly purposeRepository: Repository<Purpose>,
    @InjectRepository(AccountProfile)
    private readonly accountProfileRepository: Repository<AccountProfile>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async resolveSnapshots(
    payload: Ad1Payload,
    branchId?: string | null,
  ): Promise<Partial<TransactionAd1>> {
    const snapshots: Partial<TransactionAd1> = {};

    if (branchId) {
      const branch = await this.branchRepository.findOne({
        where: { id: branchId },
        relations: ['company'],
      });
      snapshots.branchSnapshot = branch ?? null;
    }

    if (payload.currencyId) {
      const currency = await this.currencyRepository.findOne({ where: { id: payload.currencyId } });
      snapshots.currencySnapshot = currency ?? null;
    }

    if (payload.productId) {
      const product = await this.productRepository.findOne({ where: { id: payload.productId } });
      snapshots.productSnapshot = product ?? null;
    }

    if (payload.agentId) {
      const agent = await this.partyProfileRepository.findOne({
        where: { id: payload.agentId },
        relations: ['commissionRules'],
      });
      snapshots.agentSnapshot = agent ?? null;
    }

    if (payload.bankNameId) {
      const bank = await this.accountProfileRepository.findOne({ where: { id: payload.bankNameId } });
      snapshots.bankSnapshot = bank ?? null;
    }

    if (payload.marketingId) {
      const opt = await this.selectOptionRepository.findOne({ where: { id: payload.marketingId } });
      snapshots.marketingSnapshot = opt ?? null;
    }

    if (payload.segmentId) {
      const opt = await this.selectOptionRepository.findOne({ where: { id: payload.segmentId } });
      snapshots.segmentSnapshot = opt ?? null;
    }

    if (payload.purposeId) {
      const purpose = await this.purposeRepository.findOne({ where: { id: payload.purposeId } });
      if (!purpose) {
        throw new BadRequestException(`Purpose with id ${payload.purposeId} not found`);
      }

      if (
        payload.transactionType === TransactionType.SALE &&
        !purpose.sell
      ) {
        throw new BadRequestException(
          `Purpose ${purpose.code} is not valid for ${payload.transactionType}`,
        );
      }

      if (
        payload.transactionType === TransactionType.PURCHASE &&
        !purpose.purchase
      ) {
        throw new BadRequestException(
          `Purpose ${purpose.code} is not valid for ${payload.transactionType}`,
        );
      }

      snapshots.purposeSnapshot = purpose ?? null;
    }

    if (payload.relationshipId) {
      const opt = await this.selectOptionRepository.findOne({ where: { id: payload.relationshipId } });
      snapshots.relationshipSnapshot = opt ?? null;
    }

    return snapshots;
  }

  private toNullableString(value: unknown): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    return String(value);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async getAgents(params: { branchId?: string; search?: string }): Promise<{ id: string; code: string; name: string }[]> {
    const query = this.partyProfileRepository.createQueryBuilder('pp')
      .select(['pp.id', 'pp.code', 'pp.name'])
      .where('pp.type = :type', { type: ClientType.AGENT })
      .andWhere('pp.active = true');

    if (params.branchId) {
      query.andWhere('pp.branchId = :branchId', { branchId: params.branchId });
    }

    if (params.search?.trim()) {
      query.andWhere('(pp.name ILIKE :search OR pp.code ILIKE :search)', {
        search: `%${params.search.trim()}%`,
      });
    }

    query.orderBy('pp.name', 'ASC').limit(100);
    return query.getMany();
  }

  async create(
    payload: Ad1Payload,
    performedById: string,
    activeBranchId: string | null,
  ): Promise<TransactionAd1> {
    const resolvedBranchId = activeBranchId || '';
    if (!payload.docNo || !resolvedBranchId) {
      throw new BadRequestException('Doc No and branch are required');
    }

    const branch = await this.branchRepository.findOne({
      where: { id: resolvedBranchId },
      relations: ['company'],
    });
    const companyId = branch?.company?.id ?? null;

    const snapshots = await this.resolveSnapshots(payload, resolvedBranchId);

    const ad1Data: DeepPartial<TransactionAd1> = {
        number: String(payload.docNo),
        branchId: String(resolvedBranchId),
        companyId,
        transactionType: payload.transactionType ?? TransactionType.PURCHASE,
        profileType: payload.profileType ?? TransactionProfileType.AD1,
        createdBy: performedById,
        updatedBy: performedById,

        dealId: payload.dealId || null,
        docNo: payload.docNo || null,
        transactionDate: payload.transactionDate || null,
        marketingId: payload.marketingId || null,
        segmentId: payload.segmentId || null,
        servicedBy: payload.servicedBy || null,
        purposeId: payload.purposeId || null,
        remitterName: payload.remitterName || null,
        contactNo: payload.contactNo || null,
        email: payload.email || null,
        address: payload.address || null,
        pan: payload.pan || null,
        dateOfBirth: payload.dateOfBirth || null,
        productId: payload.productId || null,
        beneficiaryName: payload.beneficiaryName || null,
        beniAddress: payload.beniAddress || null,
        beneAccountNumber: payload.beneAccountNumber || null,
        beneBankName: payload.beneBankName || null,
        swiftCode: payload.swiftCode || null,
        relationshipId: payload.relationshipId || null,
        currencyId: payload.currencyId || null,
        fcVolume: this.toNullableString(payload.fcVolume),
        saleRate: this.toNullableString(payload.saleRate),
        totalInrAmt: this.toNullableString(payload.totalInrAmt),
        gst: this.toNullableString(payload.gst),
        bankCharges: this.toNullableString(payload.bankCharges),
        tcs: this.toNullableString(payload.tcs),
        otherIncome: this.toNullableString(payload.otherIncome),
        finalAmount: this.toNullableString(payload.finalAmount),
        settlementRate: this.toNullableString(payload.settlementRate),
        grossRevenue: this.toNullableString(payload.grossRevenue),
        revenueReceivable: this.toNullableString(payload.revenueReceivable),
        agentId: payload.agentId || payload.fxRefAgentId || null,
        agentComm: this.toNullableString(payload.agentComm),
        tds: this.toNullableString(payload.tds),
        commissionPayable: this.toNullableString(payload.commissionPayable),
        netRevenue: this.toNullableString(payload.netRevenue),
        bankNameId: payload.bankNameId || null,
        rtgsImpsNeftRefNo: payload.rtgsImpsNeftRefNo || null,
        remarks: payload.remarks || null,

        ...snapshots,
      };

    const ad1 = await this.repo.save(this.repo.create(ad1Data));

    return this.repo.findOne({ where: { id: ad1.id } });
  }

  async findAll(params?: { branchId?: string; search?: string }): Promise<TransactionAd1[]> {
    const query = this.repo.createQueryBuilder('ad1');

    if (params?.branchId) {
      query.andWhere('ad1.branchId = :branchId', { branchId: params.branchId });
    }

    if (params?.search?.trim()) {
      query.andWhere('ad1.number ILIKE :search', { search: `%${params.search.trim()}%` });
    }

    query.orderBy('ad1.createdAt', 'DESC');
    return query.getMany();
  }

  async findOne(id: string): Promise<TransactionAd1> {
    const ad1 = await this.repo.findOne({ where: { id } });
    if (!ad1) {
      throw new NotFoundException(`AD1 transaction ${id} not found`);
    }
    return ad1;
  }

  async update(
    id: string,
    payload: Ad1Payload,
    performedById: string,
    activeBranchId: string | null,
  ): Promise<TransactionAd1> {
    const ad1 = await this.findOne(id);

    if (payload.docNo) {
      ad1.number = String(payload.docNo);
      ad1.docNo = payload.docNo;
    }

    const fields = [
      'dealId', 'transactionDate', 'marketingId', 'segmentId', 'servicedBy',
      'purposeId', 'remitterName', 'contactNo', 'email', 'address', 'pan',
      'dateOfBirth', 'productId', 'beneficiaryName', 'beniAddress', 'beneAccountNumber',
      'beneBankName', 'swiftCode', 'relationshipId', 'currencyId', 'fcVolume',
      'saleRate', 'totalInrAmt', 'gst', 'bankCharges', 'tcs', 'otherIncome',
      'finalAmount', 'settlementRate', 'grossRevenue', 'revenueReceivable',
      'agentId', 'agentComm', 'tds', 'commissionPayable', 'netRevenue',
      'bankNameId', 'rtgsImpsNeftRefNo', 'remarks',
    ];

    for (const field of fields) {
      if (payload[field] !== undefined) {
        const ad1Record = ad1 as unknown as Record<string, unknown>;
        ad1Record[field] = payload[field] ?? null;
      }
    }

    // Handle legacy fxRefAgentId field name from frontend
    if (payload.fxRefAgentId !== undefined && payload.agentId === undefined) {
      ad1.agentId = payload.fxRefAgentId || null;
    }

    const snapshots = await this.resolveSnapshots(
      {
        ...payload,
        agentId: payload.agentId ?? payload.fxRefAgentId,
      },
      ad1.branchId,
    );
    Object.assign(ad1, snapshots);

    ad1.updatedBy = performedById;
    await this.repo.save(ad1);
    return this.findOne(id);
  }
}
