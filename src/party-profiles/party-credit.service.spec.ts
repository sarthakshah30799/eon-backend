import { BadRequestException } from "@nestjs/common";
import { PartyCreditService } from "./party-credit.service";
import { TransactionType } from "../transactions/transactions.enums";

describe("PartyCreditService", () => {
  const additionalSettingService = {
    getSettingBooleanValue: jest.fn(),
  };
  const partyProfileRepository = {
    findOne: jest.fn(),
  };
  const transactionRepository = {
    createQueryBuilder: jest.fn(),
  };

  let service: PartyCreditService;

  const buildOutstandingQuery = (
    outstanding: number,
    oldestDate?: string | null,
  ) => {
    const outstandingQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawOne: jest
        .fn()
        .mockResolvedValue({ outstanding: String(outstanding) }),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const oldestQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawOne: jest
        .fn()
        .mockResolvedValue(oldestDate ? { oldestDate } : { oldestDate: null }),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    let callCount = 0;
    transactionRepository.createQueryBuilder.mockImplementation(() => {
      callCount += 1;
      return callCount === 1 ? outstandingQb : oldestQb;
    });

    return { outstandingQb, oldestQb };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PartyCreditService(
      additionalSettingService as never,
      partyProfileRepository as never,
      transactionRepository as never,
    );
  });

  it("skips credit validation when transaction is fully paid", async () => {
    const result = await service.preview({
      partyProfileId: "party-1",
      transactionType: TransactionType.PURCHASE,
      transactionDate: "2026-09-01",
      payableAmount: 1000000,
      payments: [{ amount: 1000000 }],
    });

    expect(result.allowed).toBe(true);
    expect(result.ruleType).toBe("OK");
    expect(result.currentOutstanding).toBe("0.00");
  });

  it("blocks outstanding when additional setting is disabled", async () => {
    additionalSettingService.getSettingBooleanValue.mockResolvedValue(false);

    const result = await service.preview({
      partyProfileId: "party-1",
      transactionType: TransactionType.SALE,
      transactionDate: "2026-09-01",
      payableAmount: 1000000,
      payments: [],
    });

    expect(result.allowed).toBe(false);
    expect(result.ruleType).toBe("OUTSTANDING_NOT_ALLOWED");
  });

  it("treats existing outstanding as zero when passenger id and pan are missing", async () => {
    additionalSettingService.getSettingBooleanValue.mockResolvedValue(true);
    partyProfileRepository.findOne.mockResolvedValue({
      id: "party-1",
      permanentCreditLimit: 1000000,
      permanentCreditDays: 30,
      temporaryCreditLimit: null,
      temporaryCreditDays: null,
    });

    const result = await service.preview({
      partyProfileId: "party-1",
      transactionType: TransactionType.PURCHASE,
      transactionDate: "2026-09-01",
      payableAmount: 250000,
      payments: [],
    });

    expect(result.allowed).toBe(true);
    expect(result.existingOutstanding).toBe("0.00");
    expect(result.totalExposure).toBe("250000.00");
    expect(transactionRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("scopes outstanding by passenger id when present", async () => {
    additionalSettingService.getSettingBooleanValue.mockResolvedValue(true);
    partyProfileRepository.findOne.mockResolvedValue({
      id: "party-1",
      permanentCreditLimit: 1000000,
      permanentCreditDays: null,
      temporaryCreditLimit: null,
      temporaryCreditDays: null,
    });
    const { outstandingQb } = buildOutstandingQuery(50000);

    const result = await service.preview({
      partyProfileId: "party-1",
      transactionType: TransactionType.PURCHASE,
      transactionDate: "2026-09-01",
      payableAmount: 250000,
      payments: [],
      passengerId: "passenger-1",
      panNumber: "ABCDE1234F",
    });

    expect(result.allowed).toBe(true);
    expect(result.ruleType).toBe("CREDIT_NOT_CONFIGURED");
    expect(result.existingOutstanding).toBe("50000.00");
    expect(outstandingQb.andWhere).toHaveBeenCalledWith(
      "transaction.partyProfileId = :partyProfileId",
      { partyProfileId: "party-1" },
    );
    expect(outstandingQb.andWhere).toHaveBeenCalledWith(
      "transaction.transactionType = :transactionType",
      { transactionType: TransactionType.PURCHASE },
    );
    expect(outstandingQb.andWhere).toHaveBeenCalledWith(
      "transaction.passengerId = :passengerId",
      { passengerId: "passenger-1" },
    );
  });

  it("scopes outstanding by pan when passenger id is missing", async () => {
    additionalSettingService.getSettingBooleanValue.mockResolvedValue(true);
    partyProfileRepository.findOne.mockResolvedValue({
      id: "party-1",
      permanentCreditLimit: 1000000,
      permanentCreditDays: null,
      temporaryCreditLimit: null,
      temporaryCreditDays: null,
    });
    const { outstandingQb } = buildOutstandingQuery(75000);

    const result = await service.preview({
      partyProfileId: "party-1",
      transactionType: TransactionType.SALE,
      transactionDate: "2026-09-01",
      payableAmount: 250000,
      payments: [],
      panNumber: "abcde1234f",
    });

    expect(result.existingOutstanding).toBe("75000.00");
    expect(outstandingQb.andWhere).toHaveBeenCalledWith(
      "transaction.partyProfileId = :partyProfileId",
      { partyProfileId: "party-1" },
    );
    expect(outstandingQb.andWhere).toHaveBeenCalledWith(
      "transaction.transactionType = :transactionType",
      { transactionType: TransactionType.SALE },
    );
    expect(outstandingQb.andWhere).toHaveBeenCalledWith(
      `UPPER(COALESCE(transaction.passenger_snapshot->>'panNumber', '')) = :panNumber`,
      { panNumber: "ABCDE1234F" },
    );
  });

  it("allows outstanding when credit is not configured", async () => {
    additionalSettingService.getSettingBooleanValue.mockResolvedValue(true);
    partyProfileRepository.findOne.mockResolvedValue({
      id: "party-1",
      permanentCreditLimit: 1000000,
      permanentCreditDays: null,
      temporaryCreditLimit: null,
      temporaryCreditDays: null,
    });
    buildOutstandingQuery(0);

    const result = await service.preview({
      partyProfileId: "party-1",
      transactionType: TransactionType.PURCHASE,
      transactionDate: "2026-09-01",
      payableAmount: 250000,
      payments: [],
      passengerId: "passenger-1",
    });

    expect(result.allowed).toBe(true);
    expect(result.ruleType).toBe("CREDIT_NOT_CONFIGURED");
  });

  it("blocks when total exposure exceeds applicable permanent and temporary limits", async () => {
    additionalSettingService.getSettingBooleanValue.mockResolvedValue(true);
    partyProfileRepository.findOne.mockResolvedValue({
      id: "party-1",
      permanentCreditLimit: 1000000,
      permanentCreditDays: 30,
      temporaryCreditLimit: 100000,
      temporaryCreditDays: 7,
    });
    buildOutstandingQuery(800000);

    const result = await service.preview({
      partyProfileId: "party-1",
      transactionType: TransactionType.PURCHASE,
      transactionDate: "2026-09-01",
      payableAmount: 350000,
      payments: [],
      passengerId: "passenger-1",
    });

    expect(result.allowed).toBe(false);
    expect(result.ruleType).toBe("CREDIT_LIMIT_EXCEEDED");
  });

  it("allows outstanding within combined permanent and temporary limits", async () => {
    additionalSettingService.getSettingBooleanValue.mockResolvedValue(true);
    partyProfileRepository.findOne.mockResolvedValue({
      id: "party-1",
      permanentCreditLimit: 1000000,
      permanentCreditDays: 30,
      temporaryCreditLimit: 100000,
      temporaryCreditDays: 7,
    });
    buildOutstandingQuery(800000, "2026-08-20");

    const result = await service.preview({
      partyProfileId: "party-1",
      transactionType: TransactionType.PURCHASE,
      transactionDate: "2026-09-01",
      payableAmount: 250000,
      payments: [],
      passengerId: "passenger-1",
    });

    expect(result.allowed).toBe(true);
    expect(result.totalExposure).toBe("1050000.00");
  });

  it("blocks when credit days are over", async () => {
    additionalSettingService.getSettingBooleanValue.mockResolvedValue(true);
    partyProfileRepository.findOne.mockResolvedValue({
      id: "party-1",
      permanentCreditLimit: 2000000,
      permanentCreditDays: 10,
      temporaryCreditLimit: null,
      temporaryCreditDays: null,
    });
    buildOutstandingQuery(100000, "2026-08-01");

    const result = await service.preview({
      partyProfileId: "party-1",
      transactionType: TransactionType.PURCHASE,
      transactionDate: "2026-09-01",
      payableAmount: 50000,
      payments: [],
      panNumber: "ABCDE1234F",
    });

    expect(result.allowed).toBe(false);
    expect(result.ruleType).toBe("CREDIT_DAYS_OVER");
    expect(result.blockingReason).toBe("Credit-days is over.");
  });

  it("validate throws when credit check fails", async () => {
    additionalSettingService.getSettingBooleanValue.mockResolvedValue(false);

    await expect(
      service.validate({
        partyProfileId: "party-1",
        transactionType: TransactionType.PURCHASE,
        transactionDate: "2026-09-01",
        payableAmount: 1000,
        payments: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
