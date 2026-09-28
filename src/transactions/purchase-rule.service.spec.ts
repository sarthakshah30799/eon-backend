import { BadRequestException } from "@nestjs/common";
import { PurchaseRuleService } from "./purchase-rule.service";
import {
  TransactionPaymentMethod,
  TransactionType,
} from "./transactions.enums";
import {
  PassengerEntityType,
  PassengerNationalityType,
} from "../passengers/passenger.entity";

type MockRepo = {
  findOne: jest.Mock;
  find?: jest.Mock;
  createQueryBuilder?: jest.Mock;
};

describe("PurchaseRuleService passenger + rule coverage", () => {
  const additionalSettingService = {
    getSettingTextValue: jest.fn(),
  };
  const currencyRatesService = {
    findLatestRates: jest.fn(),
  };
  const currencyRepository: MockRepo = {
    findOne: jest.fn(),
  };
  const productRepository: MockRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const passengerRepository: MockRepo = {
    findOne: jest.fn(),
  };
  const transactionRepository: MockRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  let service: PurchaseRuleService;
  let queryBuilder: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
  };

  const usdCurrency = {
    id: "currency-usd",
    currencyCode: "USD",
  };

  const cnProduct = {
    id: "product-cn",
    productCode: "CN",
  };

  const latestUsdRate = {
    id: "rate-usd-1",
    currencyId: usdCurrency.id,
    provider: "MANUAL",
    baseRate: "1",
    baseBuyRate: "1",
    baseSaleRate: "1",
  };

  const baseIndianPassenger = {
    entityType: PassengerEntityType.INDIVIDUAL,
    nationalityType: PassengerNationalityType.INDIAN,
    panNumber: "ABCDE1234F",
    panHolderName: "Test Passenger",
    panDob: "1990-01-01",
    contactNo: "9999999999",
    address1: "12 Test Street",
  };

  const baseNriPassenger = {
    entityType: PassengerEntityType.INDIVIDUAL,
    nationalityType: PassengerNationalityType.NRI,
    passportNumber: "P1234567",
    passportPassengerName: "John Smith",
    contactNo: "9999999999",
    address1: "12 Test Street",
  };

  const cnItem = {
    currencyId: usdCurrency.id,
    productId: cnProduct.id,
    productCode: "CN",
    quantity: 12,
    rate: 90,
    per: 1,
  };

  const purchaseBody = (overrides: Record<string, unknown> = {}) => ({
    transaction: {
      transactionType: TransactionType.PURCHASE,
      transactionDate: "2026-08-26",
      slug: "PURCHASE_CORPORATE_INDIVIDUAL",
      passenger: baseIndianPassenger,
      items: [cnItem],
      additionalCharges: [],
      payments: [
        {
          paymentMethod: TransactionPaymentMethod.CHEQUE,
          amount: 1080,
        },
      ],
      ...overrides,
    },
  });

  const mockHistoryQueries = (
    cdfItemHistory: unknown[] = [],
    cnItemHistory: unknown[] = [],
    cashHistory: unknown[] = [],
  ) => {
    queryBuilder.getMany
      .mockResolvedValueOnce(cdfItemHistory)
      .mockResolvedValueOnce(cnItemHistory)
      .mockResolvedValueOnce(cashHistory);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    additionalSettingService.getSettingTextValue.mockImplementation(
      async (_category: string, key: string) => {
        switch (key) {
          case "PURCHASE_PASSENGER_RULE_REFERENCE_CURRENCY_CODE":
            return "USD";
          case "PURCHASE_PASSENGER_RULE_CDF_THRESHOLD_AMOUNT":
            return "1000000";
          case "PURCHASE_PASSENGER_RULE_INDIAN_CASH_LIMIT_AMOUNT":
            return "1000";
          case "PURCHASE_PASSENGER_RULE_NRI_CASH_LIMIT_AMOUNT":
            return "3000";
          case "PURCHASE_PASSENGER_RULE_WINDOW_DAYS":
            return "30";
          default:
            return null;
        }
      },
    );

    currencyRepository.findOne.mockResolvedValue(usdCurrency);
    productRepository.find.mockResolvedValue([cnProduct]);
    currencyRatesService.findLatestRates.mockResolvedValue([latestUsdRate]);
    passengerRepository.findOne.mockResolvedValue(null);

    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    transactionRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    service = new PurchaseRuleService(
      additionalSettingService as never,
      currencyRatesService as never,
      currencyRepository as never,
      productRepository as never,
      passengerRepository as never,
      transactionRepository as never,
    );
  });

  it("allows purchase with a brand-new Indian PAN (no passenger DB match)", async () => {
    const result = await service.preview(purchaseBody());

    expect(result.allowed).toBe(true);
    expect(result.ruleType).toBe("OK");
    expect(result.blockingReasons).toEqual([]);
    expect(result.passengerId).toBeNull();
    expect(result.cumulativeAmountInReferenceCurrency).toBe("0.00");
    expect(result.cumulativeCashAmountInReferenceCurrency).toBe("0.00");
    await expect(service.validate(purchaseBody())).resolves.toBeUndefined();
  });

  it("sale skips purchase-rule passenger matching and always allows preview/validate", async () => {
    const body = purchaseBody({
      transactionType: TransactionType.SALE,
      passenger: {
        ...baseIndianPassenger,
        panNumber: "NEWSALE123A",
      },
    });

    const result = await service.preview(body);

    expect(result.allowed).toBe(true);
    expect(result.ruleType).toBe("OK");
    expect(passengerRepository.findOne).not.toHaveBeenCalled();
    await expect(service.validate(body)).resolves.toBeUndefined();
  });

  it("still blocks when passenger payload is missing on corporate/individual purchase", async () => {
    const body = purchaseBody({ passenger: null });
    const result = await service.preview(body);

    expect(result.allowed).toBe(false);
    expect(result.ruleType).toBe("MISSING_PASSENGER");
    await expect(service.validate(body)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("allows FFMC/other purchase without passenger payload", async () => {
    const body = purchaseBody({
      slug: "PURCHASE_FFMC",
      passenger: null,
    });
    const result = await service.preview(body);

    expect(result.allowed).toBe(true);
    expect(result.ruleType).toBe("OK");
    expect(result.blockingReasons).toEqual([]);
    await expect(service.validate(body)).resolves.toBeUndefined();
  });

  it("still blocks Indian cash above configured limit for a new PAN", async () => {
    const body = purchaseBody({
      payments: [
        {
          paymentMethod: TransactionPaymentMethod.CASH,
          amount: 1500,
        },
      ],
    });

    const result = await service.preview(body);

    expect(result.allowed).toBe(false);
    expect(result.ruleType).toBe("CASH_LIMIT_EXCEEDED");
  });

  it("allows when converted amount plus cash is strictly below the Indian limit", async () => {
    const body = purchaseBody({
      payments: [
        {
          paymentMethod: TransactionPaymentMethod.CASH,
          amount: 900,
        },
      ],
    });

    const result = await service.preview(body);

    // Converted amount is 12 USD (CN USD face qty) + cash 900 = 912 < 1000
    expect(result.allowed).toBe(true);
    expect(result.ruleType).toBe("OK");
    expect(result.transactionAmountInReferenceCurrency).toBe("12.00");
    expect(result.cashTotalAmount).toBe("900.00");
  });

  it("blocks when converted amount plus cash equals the Indian limit", async () => {
    const body = purchaseBody({
      items: [
        {
          ...cnItem,
          quantity: 100,
        },
      ],
      payments: [
        {
          paymentMethod: TransactionPaymentMethod.CASH,
          amount: 900,
        },
      ],
    });

    const result = await service.preview(body);

    // Converted 100 + cash 900 = 1000, not strictly less than 1000
    expect(result.allowed).toBe(false);
    expect(result.ruleType).toBe("CASH_LIMIT_EXCEEDED");
  });

  it("matches existing passenger with normalized PAN and uses history amount", async () => {
    passengerRepository.findOne.mockResolvedValue({
      id: "passenger-1",
      panNumber: "ABCDE1234F",
    });

    mockHistoryQueries(
      [
        {
          items: [
            {
              currencyId: usdCurrency.id,
              productId: cnProduct.id,
              productCode: "CN",
              quantity: "25",
              rate: "90",
              per: "1",
            },
          ],
          additionalCharges: [],
        },
      ],
      [
        {
          items: [
            {
              currencyId: usdCurrency.id,
              productId: cnProduct.id,
              productCode: "CN",
              quantity: "25",
              rate: "90",
              per: "1",
            },
          ],
          additionalCharges: [],
        },
      ],
      [],
    );

    const body = purchaseBody({
      passenger: {
        ...baseIndianPassenger,
        panNumber: "abcde 1234 f",
      },
    });

    const result = await service.preview(body);

    expect(passengerRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { panNumber: "ABCDE1234F" },
      }),
    );
    expect(result.allowed).toBe(true);
    expect(result.passengerId).toBe("passenger-1");
    expect(result.cumulativeAmountInReferenceCurrency).toBe("25.00");
    // Converted amount for limit = current CN 12 + history CN 25
    expect(result.transactionAmountInReferenceCurrency).toBe("37.00");
    expect(result.cumulativeCashAmountInReferenceCurrency).toBe("0.00");
  });

  it("ignores non-CN products in the cash-limit converted amount", async () => {
    const body = purchaseBody({
      items: [
        {
          currencyId: usdCurrency.id,
          productId: "product-tt",
          productCode: "TT",
          quantity: 5000,
          rate: 90,
          per: 1,
        },
      ],
      payments: [
        {
          paymentMethod: TransactionPaymentMethod.CASH,
          amount: 100,
        },
      ],
    });

    const result = await service.preview(body);

    expect(result.transactionAmountInReferenceCurrency).toBe("0.00");
    expect(result.cashTotalAmount).toBe("100.00");
    expect(result.allowed).toBe(true);
  });

  it("blocks Indian when current cash plus historical approved cash exceeds limit", async () => {
    passengerRepository.findOne.mockResolvedValue({
      id: "passenger-1",
      panNumber: "ABCDE1234F",
    });

    mockHistoryQueries(
      [],
      [],
      [
        {
          id: "history-tx-1",
          payments: [
            {
              paymentMethod: TransactionPaymentMethod.CASH,
              amount: "700",
            },
          ],
        },
      ],
    );

    const body = purchaseBody({
      payments: [
        {
          paymentMethod: TransactionPaymentMethod.CASH,
          amount: 400,
        },
      ],
    });

    const result = await service.preview(body);

    expect(result.allowed).toBe(false);
    expect(result.ruleType).toBe("CASH_LIMIT_EXCEEDED");
    expect(result.cumulativeCashAmountInReferenceCurrency).toBe("700.00");
    expect(result.cashTotalAmount).toBe("1100.00");
  });

  it("blocks NRI when current cash plus historical approved cash exceeds limit", async () => {
    passengerRepository.findOne.mockResolvedValue({
      id: "passenger-nri-1",
      passportNumber: "P1234567",
    });

    mockHistoryQueries(
      [],
      [],
      [
        {
          id: "history-tx-nri-1",
          payments: [
            {
              paymentMethod: TransactionPaymentMethod.CASH,
              amount: "2500",
            },
          ],
        },
      ],
    );

    const body = purchaseBody({
      passenger: baseNriPassenger,
      payments: [
        {
          paymentMethod: TransactionPaymentMethod.CASH,
          amount: 600,
        },
      ],
    });

    const result = await service.preview(body);

    expect(result.allowed).toBe(false);
    expect(result.ruleType).toBe("CASH_LIMIT_EXCEEDED");
    expect(result.cumulativeCashAmountInReferenceCurrency).toBe("2500.00");
    expect(result.cashTotalAmount).toBe("3100.00");
  });

  it("ignores non-cash historical payment rows when summing cash history", async () => {
    passengerRepository.findOne.mockResolvedValue({
      id: "passenger-1",
      panNumber: "ABCDE1234F",
    });

    mockHistoryQueries(
      [],
      [],
      [
        {
          id: "history-tx-1",
          payments: [
            {
              paymentMethod: TransactionPaymentMethod.CHEQUE,
              amount: "900",
            },
            {
              paymentMethod: TransactionPaymentMethod.CASH,
              amount: "200",
            },
          ],
        },
      ],
    );

    const body = purchaseBody({
      payments: [
        {
          paymentMethod: TransactionPaymentMethod.CASH,
          amount: 700,
        },
      ],
    });

    const result = await service.preview(body);

    expect(result.allowed).toBe(true);
    expect(result.cumulativeCashAmountInReferenceCurrency).toBe("200.00");
    expect(result.cashTotalAmount).toBe("900.00");
  });

  it("excludes the current transaction id from historical cash totals", async () => {
    passengerRepository.findOne.mockResolvedValue({
      id: "passenger-1",
      panNumber: "ABCDE1234F",
    });

    mockHistoryQueries([], [], []);

    const body = purchaseBody({
      id: "current-tx-1",
      payments: [
        {
          paymentMethod: TransactionPaymentMethod.CASH,
          amount: 500,
        },
      ],
    });

    const result = await service.preview(body);

    expect(result.allowed).toBe(true);
    expect(result.cashTotalAmount).toBe("500.00");
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "transaction.id != :excludeTransactionId",
      { excludeTransactionId: "current-tx-1" },
    );
  });

  it("matches NRI passenger by passport number and passport passenger name", async () => {
    passengerRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "passenger-nri-1",
        passportNumber: "P1234567",
        passportPassengerName: "John Smith",
      });

    const body = purchaseBody({
      passenger: baseNriPassenger,
      payments: [
        {
          paymentMethod: TransactionPaymentMethod.CASH,
          amount: 500,
        },
      ],
    });

    const result = await service.preview(body);

    expect(passengerRepository.findOne).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: {
          passportNumber: "P1234567",
          passportPassengerName: "John Smith",
        },
      }),
    );
    expect(result.passengerId).toBe("passenger-nri-1");
    expect(result.passengerMatchTier).toBe(3);
  });

  it("matches NRI passenger by passport number alone within the 30-day window", async () => {
    passengerRepository.findOne.mockResolvedValue({
      id: "passenger-nri-2",
      passportNumber: "P1234567",
      passportPassengerName: "John Smith",
    });

    const body = purchaseBody({
      passenger: {
        entityType: PassengerEntityType.INDIVIDUAL,
        nationalityType: PassengerNationalityType.NRI,
        passportNumber: "P1234567",
        passportPassengerName: "John Smith",
        contactNo: "9999999999",
      },
      payments: [
        {
          paymentMethod: TransactionPaymentMethod.CASH,
          amount: 500,
        },
      ],
    });

    const result = await service.preview(body);

    expect(passengerRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { passportNumber: "P1234567" },
      }),
    );
    expect(result.passengerId).toBe("passenger-nri-2");
    expect(result.passengerMatchTier).toBe(1);
  });

  it("converts cash using latest currency-rates baseRate not currency.ratePer", async () => {
    currencyRatesService.findLatestRates.mockResolvedValue([
      {
        ...latestUsdRate,
        baseRate: "83",
        baseBuyRate: "83",
        baseSaleRate: "83",
      },
    ]);

    const body = purchaseBody({
      payments: [
        {
          paymentMethod: TransactionPaymentMethod.CASH,
          amount: 8300,
        },
      ],
    });

    const result = await service.preview(body);

    expect(currencyRatesService.findLatestRates).toHaveBeenCalledWith(
      usdCurrency.id,
    );
    expect(result.allowed).toBe(true);
    expect(result.cashTotalAmount).toBe("100.00");
    expect(result.cashLimitAmount).toBe("1000.00");
  });

  it("blocks NRI purchases settled by UPI", async () => {
    const body = purchaseBody({
      passenger: baseNriPassenger,
      payments: [
        {
          paymentMethod: TransactionPaymentMethod.UPI,
          amount: 500,
        },
      ],
    });

    const result = await service.preview(body);

    expect(result.allowed).toBe(false);
    expect(result.ruleType).toBe("CHEQUE_NOT_ALLOWED");
  });
});
