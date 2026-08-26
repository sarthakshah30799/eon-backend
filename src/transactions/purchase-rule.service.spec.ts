import { BadRequestException } from '@nestjs/common';
import { PurchaseRuleService } from './purchase-rule.service';
import { TransactionPaymentMethod, TransactionType } from './transactions.enums';
import {
  PassengerEntityType,
  PassengerNationalityType,
} from '../passengers/passenger.entity';

type MockRepo = {
  findOne: jest.Mock;
  createQueryBuilder?: jest.Mock;
};

describe('PurchaseRuleService passenger + rule coverage', () => {
  const additionalSettingService = {
    getSettingTextValue: jest.fn(),
  };
  const currencyRepository: MockRepo = {
    findOne: jest.fn(),
  };
  const passengerRepository: MockRepo = {
    findOne: jest.fn(),
  };
  const transactionRepository: MockRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  let service: PurchaseRuleService;

  const usdCurrency = {
    id: 'currency-usd',
    currencyCode: 'USD',
    ratePer: '1',
  };

  const baseIndianPassenger = {
    entityType: PassengerEntityType.INDIVIDUAL,
    nationalityType: PassengerNationalityType.INDIAN,
    panNumber: 'ABCDE1234F',
    panHolderName: 'Test Passenger',
    panDob: '1990-01-01',
    contactNo: '9999999999',
    address1: '12 Test Street',
  };

  const purchaseBody = (overrides: Record<string, unknown> = {}) => ({
    transaction: {
      transactionType: TransactionType.PURCHASE,
      transactionDate: '2026-08-26',
      slug: 'PURCHASE_CORPORATE_INDIVIDUAL',
      passenger: baseIndianPassenger,
      items: [
        {
          currencyId: usdCurrency.id,
          quantity: 12,
          rate: 90,
          per: 1,
        },
      ],
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

  beforeEach(() => {
    jest.clearAllMocks();

    additionalSettingService.getSettingTextValue.mockImplementation(
      async (_category: string, key: string) => {
        switch (key) {
          case 'PURCHASE_PASSENGER_RULE_REFERENCE_CURRENCY_CODE':
            return 'USD';
          case 'PURCHASE_PASSENGER_RULE_CDF_THRESHOLD_AMOUNT':
            return '1000000';
          case 'PURCHASE_PASSENGER_RULE_INDIAN_CASH_LIMIT_AMOUNT':
            return '1000';
          case 'PURCHASE_PASSENGER_RULE_NRI_CASH_LIMIT_AMOUNT':
            return '3000';
          case 'PURCHASE_PASSENGER_RULE_WINDOW_DAYS':
            return '30';
          default:
            return null;
        }
      },
    );

    currencyRepository.findOne.mockResolvedValue(usdCurrency);
    passengerRepository.findOne.mockResolvedValue(null);
    transactionRepository.createQueryBuilder.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });

    service = new PurchaseRuleService(
      additionalSettingService as never,
      currencyRepository as never,
      passengerRepository as never,
      transactionRepository as never,
    );
  });

  it('allows purchase with a brand-new Indian PAN (no passenger DB match)', async () => {
    const result = await service.preview(purchaseBody());

    expect(result.allowed).toBe(true);
    expect(result.ruleType).toBe('OK');
    expect(result.blockingReasons).toEqual([]);
    expect(result.passengerId).toBeNull();
    expect(result.cumulativeAmountInReferenceCurrency).toBe('0.00');
    await expect(service.validate(purchaseBody())).resolves.toBeUndefined();
  });

  it('sale skips purchase-rule passenger matching and always allows preview/validate', async () => {
    const body = purchaseBody({
      transactionType: TransactionType.SALE,
      passenger: {
        ...baseIndianPassenger,
        panNumber: 'NEWSALE123A',
      },
    });

    const result = await service.preview(body);

    expect(result.allowed).toBe(true);
    expect(result.ruleType).toBe('OK');
    expect(passengerRepository.findOne).not.toHaveBeenCalled();
    await expect(service.validate(body)).resolves.toBeUndefined();
  });

  it('still blocks when passenger payload is missing on corporate/individual purchase', async () => {
    const body = purchaseBody({ passenger: null });
    const result = await service.preview(body);

    expect(result.allowed).toBe(false);
    expect(result.ruleType).toBe('MISSING_PASSENGER');
    await expect(service.validate(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows FFMC/other purchase without passenger payload', async () => {
    const body = purchaseBody({
      slug: 'PURCHASE_FFMC',
      passenger: null,
    });
    const result = await service.preview(body);

    expect(result.allowed).toBe(true);
    expect(result.ruleType).toBe('OK');
    expect(result.blockingReasons).toEqual([]);
    await expect(service.validate(body)).resolves.toBeUndefined();
  });

  it('still blocks Indian cash above configured limit for a new PAN', async () => {
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
    expect(result.ruleType).toBe('CASH_LIMIT_EXCEEDED');
  });

  it('matches existing passenger with normalized PAN and uses history amount', async () => {
    passengerRepository.findOne.mockResolvedValue({
      id: 'passenger-1',
      panNumber: 'ABCDE1234F',
    });

    transactionRepository.createQueryBuilder.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          items: [
            {
              currencyId: usdCurrency.id,
              quantity: '25',
              rate: '90',
              per: '1',
            },
          ],
          additionalCharges: [],
        },
      ]),
    });

    const body = purchaseBody({
      passenger: {
        ...baseIndianPassenger,
        panNumber: 'abcde 1234 f',
      },
    });

    const result = await service.preview(body);

    expect(passengerRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { panNumber: 'ABCDE1234F' },
      }),
    );
    expect(result.allowed).toBe(true);
    expect(result.passengerId).toBe('passenger-1');
    expect(result.cumulativeAmountInReferenceCurrency).toBe('25.00');
  });
});
