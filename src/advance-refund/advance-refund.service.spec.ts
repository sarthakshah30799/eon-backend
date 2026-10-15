import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdvanceRefundService } from './advance-refund.service';
import {
  AdvanceRefundPayoutSource,
  AdvanceRefundStatus,
  AdvanceRefundType,
} from './advance-refund.enums';
import { AdvanceRefund } from './entities/advance-refund.entity';
import { AdvanceRefundItem } from './entities/advance-refund-item.entity';

describe('AdvanceRefundService', () => {
  let service: AdvanceRefundService;

  let mockDatabase1: any;
  let mockDatabase2: any;
  let mockQueryRunner1: any;
  let mockQueryRunner2: any;
  let mockAdvanceRefundRepo: any;
  let mockItemRepo: any;
  let mockAccountRepo: any;
  let mockPartyRepo: any;
  let mockOptionRepo: any;
  let mockBranchRepo: any;
  let mockCounterRepo: any;
  let mockBranchCounterRepo: any;
  let mockAdditionalSettings: any;
  let mockDayPolicy: any;
  let mockPartyProfileService: any;
  let mockVoucherService: any;

  const mockBranch = {
    id: 'branch-1',
    code: 'BR1',
    name: 'Branch 1',
    isHeadOffice: false,
    isActive: true,
  };

  const mockHoBranch = {
    id: 'branch-ho',
    code: 'HO',
    name: 'Head Office',
    isHeadOffice: true,
    isActive: true,
  };

  const mockCounter = {
    id: 'counter-1',
    name: 'Counter 1',
    isActive: true,
  };

  const mockParty = {
    id: 'party-1',
    name: 'Acme Forex Ltd',
    panNo: 'ABCDE1234F',
    isIndividual: false,
  };

  const mockKnockOffAccount = {
    id: 'acc-knock-off',
    name: 'Misc Income',
    code: 'INC01',
    active: true,
    visibleDuringRefund: true,
    refundLimit: '50000.00',
    branchLinks: [{ branchId: 'branch-1' }],
  };

  const mockPayingBankAccount = {
    id: 'acc-bank',
    name: 'HDFC Bank',
    code: 'HDFC01',
    active: true,
  };

  const mockAvailableReceipt = {
    id: 'receipt-1',
    voucherId: 'receipt-1',
    voucherNumber: 'CFR/2026/001',
    voucherDate: '2026-10-10',
    totalAmount: '100000.00',
    consumedAmount: '80000.00',
    availableAmount: '20000.00',
    advanceControlAccountId: 'afc-acc-id',
  };

  const mockSession = {
    userId: 'user-1',
    branchId: 'branch-1',
    counterId: 'counter-1',
    roles: ['OPERATOR'],
  };

  beforeEach(() => {
    mockQueryRunner1 = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {},
    };

    mockQueryRunner2 = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        getRepository: jest.fn().mockImplementation((entity) => {
          if (entity === AdvanceRefund) {
            return {
              create: jest.fn().mockImplementation((d) => ({ id: 'ar-new-id', ...d })),
              save: jest.fn().mockImplementation((e) => Promise.resolve({ id: 'ar-new-id', ...e })),
            };
          }
          if (entity === AdvanceRefundItem) {
            return {
              create: jest.fn().mockImplementation((d) => ({ id: 'item-new-id', ...d })),
              save: jest.fn().mockImplementation((e) => Promise.resolve({ id: 'item-new-id', ...e })),
            };
          }
          return {};
        }),
      },
    };

    mockDatabase1 = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner1),
    };
    mockDatabase2 = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner2),
    };

    mockAdvanceRefundRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
    };

    mockItemRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockAccountRepo = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === mockKnockOffAccount.id) return Promise.resolve(mockKnockOffAccount);
        if (where.id === mockPayingBankAccount.id) return Promise.resolve(mockPayingBankAccount);
        return Promise.resolve(null);
      }),
    };

    mockPartyRepo = {
      findOne: jest.fn().mockResolvedValue(mockParty),
    };

    mockOptionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    mockBranchRepo = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.isHeadOffice) return Promise.resolve(mockHoBranch);
        if (where.id === 'branch-1') return Promise.resolve(mockBranch);
        return Promise.resolve(mockBranch);
      }),
    };

    mockCounterRepo = {
      findOne: jest.fn().mockResolvedValue(mockCounter),
    };

    mockBranchCounterRepo = {
      findOne: jest.fn().mockResolvedValue({ counterId: 'counter-1', branchId: 'branch-1' }),
      find: jest.fn().mockResolvedValue([{ counter: mockCounter }]),
    };

    mockAdditionalSettings = {
      reserveTransactionNumber: jest.fn().mockResolvedValue('AR-2026-0001'),
      getSetting: jest.fn().mockResolvedValue(null),
    };

    mockDayPolicy = {
      assertTransactionDateAllowed: jest.fn().mockResolvedValue(undefined),
    };

    mockPartyProfileService = {
      getPartyProfileById: jest.fn().mockResolvedValue(mockParty),
      findAll: jest.fn().mockResolvedValue({ data: [mockParty], total: 1 }),
    };

    mockVoucherService = {
      getAvailableAdvancesForRefund: jest.fn().mockResolvedValue([mockAvailableReceipt]),
      createAdvanceRefundJournalVoucher: jest.fn().mockResolvedValue({ id: 'voucher-jv-id' }),
      createAdvanceRefundPaymentVoucher: jest.fn().mockResolvedValue({ id: 'voucher-pt-id' }),
      createAdvanceRefundAdviceVoucher: jest.fn().mockResolvedValue({ id: 'voucher-ar-id' }),
      honourAdvanceRefundAdvice: jest.fn().mockResolvedValue({
        id: 'ho-pt-created-id',
      }),
    };

    service = new AdvanceRefundService(
      mockDatabase1,
      mockDatabase2,
      mockAdvanceRefundRepo,
      mockItemRepo,
      mockAccountRepo,
      mockPartyRepo,
      mockOptionRepo,
      mockBranchRepo,
      mockCounterRepo,
      mockBranchCounterRepo,
      mockAdditionalSettings,
      mockDayPolicy,
      mockPartyProfileService,
      mockVoucherService,
    );

    // Mock internal snapshot helper
    (service as any).snapshot = jest.fn().mockResolvedValue({ id: 'snapshot-id' });
  });

  describe('create - Knock Off', () => {
    it('throws error if knockOffAccountId is missing', async () => {
      await expect(
        service.create(
          {
            branchId: 'branch-1',
            counterId: 'counter-1',
            transactionDate: '2026-10-14',
            asOnDate: '2026-10-14',
            partyProfileId: 'party-1',
            refundType: AdvanceRefundType.KNOCK_OFF,
            narration: 'Test Knock Off',
            items: [{ receiptVoucherId: 'receipt-1', refundAmount: '5000.00' }],
          } as any,
          mockSession as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws error if account is not visibleDuringRefund', async () => {
      mockAccountRepo.findOne.mockResolvedValueOnce({
        ...mockKnockOffAccount,
        visibleDuringRefund: false,
      });

      await expect(
        service.create(
          {
            branchId: 'branch-1',
            counterId: 'counter-1',
            transactionDate: '2026-10-14',
            asOnDate: '2026-10-14',
            partyProfileId: 'party-1',
            refundType: AdvanceRefundType.KNOCK_OFF,
            knockOffAccountId: 'acc-knock-off',
            narration: 'Test Knock Off',
            items: [{ receiptVoucherId: 'receipt-1', refundAmount: '5000.00' }],
          } as any,
          mockSession as any,
        ),
      ).rejects.toThrow('Selected account is not configured as visible during refund');
    });

    it('throws error if account is not assigned to current branch', async () => {
      mockAccountRepo.findOne.mockResolvedValueOnce({
        ...mockKnockOffAccount,
        branchLinks: [{ branchId: 'other-branch' }],
      });

      await expect(
        service.create(
          {
            branchId: 'branch-1',
            counterId: 'counter-1',
            transactionDate: '2026-10-14',
            asOnDate: '2026-10-14',
            partyProfileId: 'party-1',
            refundType: AdvanceRefundType.KNOCK_OFF,
            knockOffAccountId: 'acc-knock-off',
            narration: 'Test Knock Off',
            items: [{ receiptVoucherId: 'receipt-1', refundAmount: '5000.00' }],
          } as any,
          mockSession as any,
        ),
      ).rejects.toThrow('Selected knock-off account is not assigned to this branch');
    });

    it('throws error if refund amount exceeds available receipt balance', async () => {
      await expect(
        service.create(
          {
            branchId: 'branch-1',
            counterId: 'counter-1',
            transactionDate: '2026-10-14',
            asOnDate: '2026-10-14',
            partyProfileId: 'party-1',
            refundType: AdvanceRefundType.KNOCK_OFF,
            knockOffAccountId: 'acc-knock-off',
            narration: 'Test Knock Off',
            items: [{ receiptVoucherId: 'receipt-1', refundAmount: '30000.00' }], // available is 20000
          } as any,
          mockSession as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws error if refund amount exceeds account refund limit', async () => {
      mockAccountRepo.findOne.mockResolvedValueOnce({
        ...mockKnockOffAccount,
        refundLimit: '1000.00',
      });

      await expect(
        service.create(
          {
            branchId: 'branch-1',
            counterId: 'counter-1',
            transactionDate: '2026-10-14',
            asOnDate: '2026-10-14',
            partyProfileId: 'party-1',
            refundType: AdvanceRefundType.KNOCK_OFF,
            knockOffAccountId: 'acc-knock-off',
            narration: 'Test Knock Off',
            items: [{ receiptVoucherId: 'receipt-1', refundAmount: '5000.00' }],
          } as any,
          mockSession as any,
        ),
      ).rejects.toThrow('exceeds knock-off account refund limit');
    });

    it('successfully creates Knock Off and generates Journal Voucher', async () => {
      const res = await service.create(
        {
          branchId: 'branch-1',
          counterId: 'counter-1',
          transactionDate: '2026-10-14',
          asOnDate: '2026-10-14',
          partyProfileId: 'party-1',
          refundType: AdvanceRefundType.KNOCK_OFF,
          knockOffAccountId: 'acc-knock-off',
          narration: 'Test Knock Off Success',
          items: [{ receiptVoucherId: 'receipt-1', refundAmount: '15000.00' }],
        } as any,
        mockSession as any,
      );

      expect(res).toBeDefined();
      expect(mockVoucherService.createAdvanceRefundJournalVoucher).toHaveBeenCalled();
      expect(mockQueryRunner1.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner2.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('create - Direct Local Refund', () => {
    it('throws error if payingBankAccountId is missing', async () => {
      await expect(
        service.create(
          {
            branchId: 'branch-1',
            counterId: 'counter-1',
            transactionDate: '2026-10-14',
            asOnDate: '2026-10-14',
            partyProfileId: 'party-1',
            refundType: AdvanceRefundType.REFUND,
            payoutSource: AdvanceRefundPayoutSource.LOCAL_BANK,
            narration: 'Local refund test',
            items: [{ receiptVoucherId: 'receipt-1', refundAmount: '10000.00' }],
          } as any,
          mockSession as any,
        ),
      ).rejects.toThrow('Paying bank account is required for local refund');
    });

    it('successfully creates local refund and generates Payment Voucher', async () => {
      const res = await service.create(
        {
          branchId: 'branch-1',
          counterId: 'counter-1',
          transactionDate: '2026-10-14',
          asOnDate: '2026-10-14',
          partyProfileId: 'party-1',
          refundType: AdvanceRefundType.REFUND,
          payoutSource: AdvanceRefundPayoutSource.LOCAL_BANK,
          payingBankAccountId: 'acc-bank',
          paymentMethod: 'NEFT',
          beneficiaryAccountNumber: '1234567890',
          beneficiaryIfscCode: 'HDFC0001234',
          beneficiaryName: 'Acme Forex Ltd',
          narration: 'Local refund payment',
          items: [{ receiptVoucherId: 'receipt-1', refundAmount: '10000.00' }],
        } as any,
        mockSession as any,
      );

      expect(res).toBeDefined();
      expect(mockVoucherService.createAdvanceRefundPaymentVoucher).toHaveBeenCalled();
    });
  });

  describe('create - HO Payout Request', () => {
    it('throws error if HO branch attempts to request HO payout', async () => {
      mockBranchRepo.findOne.mockResolvedValueOnce(mockHoBranch);

      await expect(
        service.create(
          {
            branchId: 'branch-ho',
            counterId: 'counter-1',
            transactionDate: '2026-10-14',
            asOnDate: '2026-10-14',
            partyProfileId: 'party-1',
            refundType: AdvanceRefundType.REFUND,
            payoutSource: AdvanceRefundPayoutSource.HO_PAYOUT,
            narration: 'HO refund request test',
            items: [{ receiptVoucherId: 'receipt-1', refundAmount: '10000.00' }],
          } as any,
          mockSession as any,
        ),
      ).rejects.toThrow('Head Office cannot select HO Payout');
    });

    it('successfully creates Advance Refund with status PENDING_HO_APPROVAL and creates Advice Voucher', async () => {
      const res = await service.create(
        {
          branchId: 'branch-1',
          counterId: 'counter-1',
          transactionDate: '2026-10-14',
          asOnDate: '2026-10-14',
          partyProfileId: 'party-1',
          refundType: AdvanceRefundType.REFUND,
          payoutSource: AdvanceRefundPayoutSource.HO_PAYOUT,
          paymentMethod: 'RTGS',
          beneficiaryAccountNumber: '987654321',
          beneficiaryIfscCode: 'ICIC0009876',
          beneficiaryName: 'Acme Forex Ltd',
          narration: 'Requesting HO payout',
          items: [{ receiptVoucherId: 'receipt-1', refundAmount: '15000.00' }],
        } as any,
        mockSession as any,
      );

      expect(res).toBeDefined();
      expect(mockVoucherService.createAdvanceRefundAdviceVoucher).toHaveBeenCalled();
    });
  });

  describe('honour', () => {
    const pendingRefund = {
      id: 'ar-pending-1',
      number: 'AR-2026-0001',
      status: AdvanceRefundStatus.PENDING_HO_APPROVAL,
      adviceVoucherId: 'advice-voucher-id',
      transactionDate: '2026-10-14',
      totalRefundAmount: '15000.00',
      branchId: 'branch-1',
      items: [
        {
          id: 'item-1',
          receiptVoucherId: 'receipt-1',
          refundAmount: '15000.00',
        },
      ],
    };

    it('throws ForbiddenException if actor is not HO user', async () => {
      (service as any).isHoApprover = jest.fn().mockResolvedValue(false);

      await expect(
        service.honour(
          'ar-pending-1',
          {
            hoPayingBankAccountId: 'acc-bank',
          },
          mockSession as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws error if refund is not pending HO approval', async () => {
      (service as any).isHoApprover = jest.fn().mockResolvedValue(true);
      mockAdvanceRefundRepo.findOne.mockResolvedValueOnce({
        ...pendingRefund,
        status: AdvanceRefundStatus.COMPLETED,
      });

      await expect(
        service.honour(
          'ar-pending-1',
          {
            hoPayingBankAccountId: 'acc-bank',
          },
          mockSession as any,
        ),
      ).rejects.toThrow('is not pending HO approval');
    });

    it('honours advice and marks advance refund COMPLETED with ho_payment_voucher_id', async () => {
      (service as any).isHoApprover = jest.fn().mockResolvedValue(true);
      mockAdvanceRefundRepo.findOne.mockResolvedValueOnce({ ...pendingRefund });

      const res = await service.honour(
        'ar-pending-1',
        {
          hoPayingBankAccountId: 'acc-bank',
          chequeNumber: 'CHQ001',
          chequeDate: '2026-10-14',
          narration: 'Paid from HO bank',
        },
        mockSession as any,
      );

      expect(res).toBeDefined();
      expect(res.status).toBe(AdvanceRefundStatus.COMPLETED);
      expect(res.hoPaymentVoucherId).toBe('ho-pt-created-id');
      expect(mockVoucherService.honourAdvanceRefundAdvice).toHaveBeenCalled();
      expect(mockQueryRunner1.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner2.commitTransaction).toHaveBeenCalled();
    });
  });
});
