import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OtherTransaction } from './entities/other-transaction.entity';
import { Branch } from '../branches/branch.entity';
import { PartyProfile, ClientType } from '../party-profiles/party-profile.entity';
import { Currency } from '../currencies/currency.entity';
import { SelectOption } from '../category-options/category-option.entity';
import { AccountProfile } from '../account-profiles/account-profile.entity';
import { Product } from '../products/product.entity';
import { TransactionType } from './transactions.enums';

@Injectable()
export class OtherTransactionService {
  constructor(
    @InjectRepository(OtherTransaction, 'database2')
    private readonly repo: Repository<OtherTransaction>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(PartyProfile)
    private readonly partyProfileRepository: Repository<PartyProfile>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(SelectOption)
    private readonly selectOptionRepository: Repository<SelectOption>,
    @InjectRepository(AccountProfile)
    private readonly accountProfileRepository: Repository<AccountProfile>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async resolveSnapshots(
    payload: Record<string, any>,
    branchId?: string | null,
  ): Promise<Partial<OtherTransaction>> {
    const snapshots: Partial<OtherTransaction> = {};

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
      const opt = await this.selectOptionRepository.findOne({ where: { id: payload.purposeId } });
      snapshots.purposeSnapshot = opt ?? null;
    }

    if (payload.relationshipId) {
      const opt = await this.selectOptionRepository.findOne({ where: { id: payload.relationshipId } });
      snapshots.relationshipSnapshot = opt ?? null;
    }

    return snapshots;
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
    payload: Record<string, any>,
    performedById: string,
    activeBranchId: string | null,
  ): Promise<OtherTransaction> {
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

    const entity = await this.repo.save(
      this.repo.create({
        slug: payload.slug ?? 'AD1',
        number: String(payload.docNo),
        branchId: String(resolvedBranchId),
        companyId,
        transactionType: payload.transactionType ?? TransactionType.PURCHASE,
        profileType: payload.profileType ?? 'AD1',
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
        fcVolume: payload.fcVolume || null,
        saleRate: payload.saleRate || null,
        totalInrAmt: payload.totalInrAmt || null,
        gst: payload.gst || null,
        bankCharges: payload.bankCharges || null,
        tcs: payload.tcs || null,
        otherIncome: payload.otherIncome || null,
        finalAmount: payload.finalAmount || null,
        settlementRate: payload.settlementRate || null,
        grossRevenue: payload.grossRevenue || null,
        revenueReceivable: payload.revenueReceivable || null,
        agentId: payload.agentId || payload.fxRefAgentId || null,
        agentComm: payload.agentComm || null,
        tds: payload.tds || null,
        commissionPayable: payload.commissionPayable || null,
        netRevenue: payload.netRevenue || null,
        bankNameId: payload.bankNameId || null,
        rtgsImpsNeftRefNo: payload.rtgsImpsNeftRefNo || null,
        remarks: payload.remarks || null,

        ...snapshots,
      }),
    );

    return this.repo.findOne({ where: { id: entity.id } });
  }

  async findAll(params?: { branchId?: string; search?: string }): Promise<OtherTransaction[]> {
    const query = this.repo.createQueryBuilder('ot');

    if (params?.branchId) {
      query.andWhere('ot.branchId = :branchId', { branchId: params.branchId });
    }

    if (params?.search?.trim()) {
      query.andWhere('ot.number ILIKE :search', { search: `%${params.search.trim()}%` });
    }

    query.orderBy('ot.createdAt', 'DESC');
    return query.getMany();
  }

  async findOne(id: string): Promise<OtherTransaction> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Other transaction ${id} not found`);
    }
    return entity;
  }

  async update(
    id: string,
    payload: Record<string, any>,
    performedById: string,
    activeBranchId: string | null,
  ): Promise<OtherTransaction> {
    const entity = await this.findOne(id);

    if (payload.docNo) {
      entity.number = String(payload.docNo);
      entity.docNo = payload.docNo;
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
        (entity as any)[field] = payload[field] || null;
      }
    }

    if (payload.fxRefAgentId !== undefined && payload.agentId === undefined) {
      entity.agentId = payload.fxRefAgentId || null;
    }

    const snapshots = await this.resolveSnapshots(
      {
        ...payload,
        agentId: payload.agentId ?? payload.fxRefAgentId,
      },
      entity.branchId,
    );
    Object.assign(entity, snapshots);

    entity.updatedBy = performedById;
    await this.repo.save(entity);
    return this.findOne(id);
  }
}
