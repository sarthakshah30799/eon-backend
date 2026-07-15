import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionAd1 } from './entities/transaction-ad1.entity';
import { Branch } from '../branches/branch.entity';
import { PartyProfile, ClientType } from '../party-profiles/party-profile.entity';
import { TransactionProfileType, TransactionType } from './transactions.enums';

@Injectable()
export class TransactionAd1Service {
  constructor(
    @InjectRepository(TransactionAd1, 'database2')
    private readonly repo: Repository<TransactionAd1>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(PartyProfile)
    private readonly partyProfileRepository: Repository<PartyProfile>,
  ) {}

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

  async create(payload: Record<string, any>, performedById: string): Promise<TransactionAd1> {
    if (!payload.docNo || !payload.branchId) {
      throw new BadRequestException('Doc No and branch are required');
    }

    const branch = await this.branchRepository.findOne({
      where: { id: payload.branchId },
      relations: ['company'],
    });
    const companyId = branch?.company?.id ?? null;

    const ad1 = await this.repo.save(
      this.repo.create({
        number: String(payload.docNo),
        branchId: String(payload.branchId),
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
        fxRefAgentId: payload.fxRefAgentId || null,
        commGivenId: payload.commGivenId || null,
        commPercentOnFe: payload.commPercentOnFe || null,
        agentComm: payload.agentComm || null,
        tds: payload.tds || null,
        commissionPayable: payload.commissionPayable || null,
        netRevenue: payload.netRevenue || null,
        bankNameId: payload.bankNameId || null,
        rtgsImpsNeftRefNo: payload.rtgsImpsNeftRefNo || null,
        remarks: payload.remarks || null,
      }),
    );

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

  async update(id: string, payload: Record<string, any>, performedById: string): Promise<TransactionAd1> {
    const ad1 = await this.findOne(id);

    if (payload.branchId && payload.branchId !== ad1.branchId) {
      const branch = await this.branchRepository.findOne({
        where: { id: payload.branchId },
        relations: ['company'],
      });
      ad1.companyId = branch?.company?.id ?? null;
      ad1.branchId = payload.branchId;
    }

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
      'fxRefAgentId', 'commGivenId', 'commPercentOnFe', 'agentComm', 'tds',
      'commissionPayable', 'netRevenue', 'bankNameId', 'rtgsImpsNeftRefNo', 'remarks',
    ];

    for (const field of fields) {
      if (payload[field] !== undefined) {
        (ad1 as any)[field] = payload[field] || null;
      }
    }

    ad1.updatedBy = performedById;
    await this.repo.save(ad1);
    return this.findOne(id);
  }
}
