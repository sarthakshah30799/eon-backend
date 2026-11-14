import { ApiClient } from './api-client';
import { TestLogger } from './test-logger';

export interface DiscoveredMasters {
  companyId?: string;
  branchA?: { id: string; name: string; code: string };
  branchB?: { id: string; name: string; code: string };
  counterA1?: { id: string; name: string; branchId: string };
  counterA2?: { id: string; name: string; branchId: string };
  counterB1?: { id: string; name: string; branchId: string };
  currencyUsd?: { id: string; code: string; name: string };
  currencyEur?: { id: string; code: string; name: string };
  currencyGbp?: { id: string; code: string; name: string };
  currencyCmStocking?: { id: string; code: string; name: string };
  productCn?: { id: string; code: string; description: string };
  productCc?: { id: string; code: string; description: string };
  productCm?: { id: string; code: string; description: string };
  productTt?: { id: string; code: string; description: string };
  productTp?: { id: string; code: string; description: string };
  productEm?: { id: string; code: string; description: string };
  cardIssuerPartyId?: string;
  corporatePartyProfile?: { id: string; name: string; entityTypeId?: string };
  cashAccountId?: string;
  bankAccountId?: string;
  advanceControlAccountId?: string;
  voucherAccountTypeCashId?: string;
  voucherAccountTypeBankId?: string;
  voucherItemTypeAccountId?: string;
  fakeReasonId?: string;
  transactionDate?: string;
}

export class MasterDataRegistry {
  private static instance: MasterDataRegistry;
  public masters: DiscoveredMasters = {};

  private constructor() {}

  public static getInstance(): MasterDataRegistry {
    if (!MasterDataRegistry.instance) {
      MasterDataRegistry.instance = new MasterDataRegistry();
    }
    return MasterDataRegistry.instance;
  }

  public async initialize(adminClient: ApiClient): Promise<DiscoveredMasters> {
    TestLogger.subHeader('Discovering Master Entities via API');

    // 1. Branches & Counters
    const branchRes = await adminClient.get('/branches', { limit: 100 });
    const branches = Array.isArray(branchRes.data?.data) ? branchRes.data.data : (Array.isArray(branchRes.data?.items) ? branchRes.data.items : (Array.isArray(branchRes.data) ? branchRes.data : []));

    const counterRes = await adminClient.get('/counters', { limit: 100 });
    const counters = Array.isArray(counterRes.data?.data)
      ? counterRes.data.data
      : (Array.isArray(counterRes.data?.items) ? counterRes.data.items : (Array.isArray(counterRes.data) ? counterRes.data : []));

    // Match counters to branches so counterA1 strictly belongs to branchA
    let matchedBranchA = null;
    let matchedCounterA = null;
    for (const c of counters) {
      const bId = Array.isArray(c.branchIds) && c.branchIds.length > 0 ? c.branchIds[0] : null;
      if (bId) {
        const found = branches.find((b: any) => b.id === bId);
        if (found) {
          matchedBranchA = found;
          matchedCounterA = c;
          break;
        }
      }
    }

    if (matchedBranchA && matchedCounterA) {
      this.masters.branchA = {
        id: matchedBranchA.id,
        name: matchedBranchA.name || matchedBranchA.branchName,
        code: matchedBranchA.code || matchedBranchA.branchCode,
      };
      this.masters.counterA1 = {
        id: matchedCounterA.id,
        name: matchedCounterA.name || matchedCounterA.counterName,
        branchId: matchedBranchA.id,
      };
      this.masters.counterA2 = this.masters.counterA1;

      const remainingBranches = branches.filter((b: any) => b.id !== matchedBranchA.id);
      if (remainingBranches.length > 0) {
        this.masters.branchB = {
          id: remainingBranches[0].id,
          name: remainingBranches[0].name || remainingBranches[0].branchName,
          code: remainingBranches[0].code || remainingBranches[0].branchCode,
        };
        const counterForB = counters.find((c: any) => Array.isArray(c.branchIds) && c.branchIds.includes(remainingBranches[0].id));
        if (counterForB) {
          this.masters.counterB1 = {
            id: counterForB.id,
            name: counterForB.name || counterForB.counterName,
            branchId: remainingBranches[0].id,
          };
        }
      } else {
        this.masters.branchB = this.masters.branchA;
        this.masters.counterB1 = this.masters.counterA1;
      }
    } else if (branches.length > 0) {
      this.masters.branchA = {
        id: branches[0].id,
        name: branches[0].name || branches[0].branchName,
        code: branches[0].code || branches[0].branchCode,
      };
      this.masters.branchB = branches.length > 1
        ? { id: branches[1].id, name: branches[1].name || branches[1].branchName, code: branches[1].code || branches[1].branchCode }
        : this.masters.branchA;
      if (counters.length > 0) {
        this.masters.counterA1 = {
          id: counters[0].id,
          name: counters[0].name || counters[0].counterName,
          branchId: this.masters.branchA.id,
        };
        this.masters.counterA2 = this.masters.counterA1;
      }
    }

    if (this.masters.branchA) {
      TestLogger.info(`Branch A: ${this.masters.branchA.name} (${this.masters.branchA.id})`);
    }
    if (this.masters.branchB) {
      TestLogger.info(`Branch B: ${this.masters.branchB.name} (${this.masters.branchB.id})`);
    }
    if (this.masters.counterA1) {
      TestLogger.info(`Counter A1: ${this.masters.counterA1.name} (${this.masters.counterA1.id}) for Branch A`);
    }
    if (this.masters.counterB1) {
      TestLogger.info(`Counter B1: ${this.masters.counterB1.name} (${this.masters.counterB1.id}) for Branch B`);
    }

    // 2. Currencies (USD, EUR, GBP)
    const currRes = await adminClient.get('/currencies', { limit: 100 });
    const currencies = Array.isArray(currRes.data?.data) ? currRes.data.data : (Array.isArray(currRes.data?.items) ? currRes.data.items : (Array.isArray(currRes.data) ? currRes.data : []));
    for (const c of currencies) {
      const code = String(c.code || c.currencyCode || '').toUpperCase();
      if (code === 'USD' && !this.masters.currencyUsd) {
        this.masters.currencyUsd = { id: c.id, code: 'USD', name: c.name || c.currencyName || 'US Dollar' };
      } else if (code === 'EUR' && !this.masters.currencyEur) {
        this.masters.currencyEur = { id: c.id, code: 'EUR', name: c.name || c.currencyName || 'Euro' };
      } else if (code === 'GBP' && !this.masters.currencyGbp) {
        this.masters.currencyGbp = { id: c.id, code: 'GBP', name: c.name || c.currencyName || 'British Pound' };
      }
    }

    const cmCurrRes = await adminClient.get('/currencies', { includeOnlyStocking: true, productAllowed: 'CM', limit: 10 });
    const cmCurrs = Array.isArray(cmCurrRes.data?.data) ? cmCurrRes.data.data : (Array.isArray(cmCurrRes.data?.items) ? cmCurrRes.data.items : (Array.isArray(cmCurrRes.data) ? cmCurrRes.data : []));
    if (cmCurrs.length > 0) {
      this.masters.currencyCmStocking = {
        id: cmCurrs[0].id,
        code: cmCurrs[0].currencyCode || cmCurrs[0].code || 'CMS',
        name: cmCurrs[0].currencyName || cmCurrs[0].name || 'CM Stocking Currency',
      };
    } else {
      const countryRes = await adminClient.get('/countries', { limit: 1 });
      const countries = Array.isArray(countryRes.data?.data) ? countryRes.data.data : (Array.isArray(countryRes.data?.items) ? countryRes.data.items : (Array.isArray(countryRes.data) ? countryRes.data : []));
      const countryId = countries?.[0]?.id;
      if (countryId) {
        const createCurrRes = await adminClient.post('/currencies', {
          countryId,
          currencyCode: 'CMS',
          currencyName: 'CM Stocking Currency',
          priority: '99',
          ratePer: '1',
          defaultMinRate: '1',
          defaultMaxRate: '1',
          calculationMethod: 'MULTIPLICATION',
          openRatePremium: '0',
          gulfDiscFactor: '0',
          amexMapCode: 'CMS',
          group: 'ASIA',
          active: true,
          onlyStocking: true,
          productAllowed: 'CM',
        });
        if (createCurrRes.ok && createCurrRes.data?.id) {
          this.masters.currencyCmStocking = {
            id: createCurrRes.data.id,
            code: createCurrRes.data.currencyCode || 'CMS',
            name: createCurrRes.data.currencyName || 'CM Stocking Currency',
          };
        }
      }
    }

    TestLogger.info(`Currencies: USD=${this.masters.currencyUsd?.id}, EUR=${this.masters.currencyEur?.id}, CMS=${this.masters.currencyCmStocking?.id}`);

    // 3. Products (CC, CM, CN, TT, TP)
    const prodRes = await adminClient.get('/products', { limit: 100 });
    const products = Array.isArray(prodRes.data?.data) ? prodRes.data.data : (Array.isArray(prodRes.data?.items) ? prodRes.data.items : (Array.isArray(prodRes.data) ? prodRes.data : []));
    for (const p of products) {
      const pCode = String(p.code || p.productCode || '').toUpperCase();
      if (pCode === 'CN' && !this.masters.productCn) {
        this.masters.productCn = { id: p.id, code: 'CN', description: p.description || p.productDescription || 'Currency Notes' };
      } else if (pCode === 'CC' && !this.masters.productCc) {
        this.masters.productCc = { id: p.id, code: 'CC', description: p.description || p.productDescription || 'Single Currency Card' };
      } else if (pCode === 'CM' && !this.masters.productCm) {
        this.masters.productCm = { id: p.id, code: 'CM', description: p.description || p.productDescription || 'Multi Currency Card' };
      } else if (pCode === 'TT' && !this.masters.productTt) {
        this.masters.productTt = { id: p.id, code: 'TT', description: p.description || p.productDescription || 'Telegraphic Transfer' };
      } else if (pCode === 'TP' && !this.masters.productTp) {
        this.masters.productTp = { id: p.id, code: 'TP', description: p.description || p.productDescription || 'Travellers Cheque' };
      } else if (pCode === 'EM' && !this.masters.productEm) {
        this.masters.productEm = { id: p.id, code: 'EM', description: p.description || p.productDescription || 'Encashment / Surrender' };
      }
    }
    TestLogger.info(`Products: CN=${this.masters.productCn?.id}, CC=${this.masters.productCc?.id}, CM=${this.masters.productCm?.id}, TT=${this.masters.productTt?.id}, TP=${this.masters.productTp?.id}, EM=${this.masters.productEm?.id}`);

    // Discover Card Issuer Party Profile
    const issuerRes = await adminClient.get('/party-profiles', { type: 'CARD_ISSUER_PROFILE', limit: 10 });
    const issuers = Array.isArray(issuerRes.data?.data) ? issuerRes.data.data : (Array.isArray(issuerRes.data?.items) ? issuerRes.data.items : (Array.isArray(issuerRes.data) ? issuerRes.data : []));
    if (issuers.length > 0) {
      this.masters.cardIssuerPartyId = issuers[0].id;
      TestLogger.info(`Card Issuer Party Profile: ${issuers[0].name} (${this.masters.cardIssuerPartyId})`);
    } else {
      // Create a test card issuer if none exists
      const createIssuerRes = await adminClient.post('/party-profiles', {
        type: 'CARD_ISSUER_PROFILE',
        code: `ISSUER_${Date.now().toString().slice(-6)}`,
        name: 'Axis Bank Card Issuer',
        address1: 'Axis House, Wadia International Centre',
        city: 'Mumbai',
        pinCode: '400025',
      });
      if (createIssuerRes.ok) {
        this.masters.cardIssuerPartyId = createIssuerRes.data?.id;
        TestLogger.info(`Created Card Issuer Party Profile: (${this.masters.cardIssuerPartyId})`);
      }
    }

    // Ensure Surrender Product (EM) exists and is linked to Card Issuer
    if (this.masters.productEm && this.masters.cardIssuerPartyId) {
      await adminClient.put(`/products/${this.masters.productEm.id}`, {
        issuerProfileIds: [this.masters.cardIssuerPartyId],
        maintainBlankStockOfProduct: false,
        availableInRetailBuying: true,
        availableInBulkSelling: true,
      });
    } else if (!this.masters.productEm && this.masters.cardIssuerPartyId) {
      const createEmRes = await adminClient.post('/products', {
        productCode: 'EM',
        productDescription: 'Encashment / Surrender',
        maintainBlankStockOfProduct: false,
        availableInRetailBuying: true,
        availableInBulkSelling: true,
        retailSale: false,
        issuerProfileIds: [this.masters.cardIssuerPartyId],
      });
      if (createEmRes.ok && createEmRes.data?.id) {
        this.masters.productEm = {
          id: createEmRes.data.id,
          code: 'EM',
          description: 'Encashment / Surrender',
        };
        TestLogger.info(`Created and linked EM Surrender product: ${this.masters.productEm.id}`);
      }
    }

    // Discover Corporate Client Party Profile
    const corpRes = await adminClient.get('/party-profiles', { type: 'CORPORATE_CLIENT', limit: 10 });
    const corps = Array.isArray(corpRes.data?.data) ? corpRes.data.data : (Array.isArray(corpRes.data?.items) ? corpRes.data.items : (Array.isArray(corpRes.data) ? corpRes.data : []));
    if (corps.length > 0) {
      this.masters.corporatePartyProfile = {
        id: corps[0].id,
        name: corps[0].name,
        entityTypeId: corps[0].entityType?.id,
      };
      TestLogger.info(`Corporate Client Party Profile: ${corps[0].name} (${this.masters.corporatePartyProfile.id})`);
    } else {
      const createCorpRes = await adminClient.post('/party-profiles', {
        type: 'CORPORATE_CLIENT',
        code: `CORP_${Date.now().toString().slice(-6)}`,
        name: 'Tata Consultancy Services',
        address1: 'TCS House, Fort',
        city: 'Mumbai',
        pinCode: '400001',
        panNo: 'AAACT1234F',
        permanentCreditLimit: 500000,
        permanentCreditDays: 30,
      });
      if (createCorpRes.ok && createCorpRes.data?.id) {
        this.masters.corporatePartyProfile = {
          id: createCorpRes.data.id,
          name: createCorpRes.data.name,
          entityTypeId: createCorpRes.data.entityType?.id,
        };
        TestLogger.info(`Created Corporate Client Party Profile: (${this.masters.corporatePartyProfile.id})`);
      }
    }

    // Ensure Corporate Party Profile has a valid entityType option assigned
    if (this.masters.corporatePartyProfile && !this.masters.corporatePartyProfile.entityTypeId) {
      const entityTypeRes = await adminClient.get('/select-options/ENTITYTYPE');
      const entityTypes = Array.isArray(entityTypeRes.data)
        ? entityTypeRes.data
        : (Array.isArray(entityTypeRes.data?.data) ? entityTypeRes.data.data : []);
      if (entityTypes.length > 0) {
        const selectedOpt = entityTypes[0];
        await adminClient.put(`/party-profiles/${this.masters.corporatePartyProfile.id}`, {
          entityType: selectedOpt.id,
        });
        this.masters.corporatePartyProfile.entityTypeId = selectedOpt.id;
        TestLogger.info(`Assigned EntityType (${selectedOpt.value || selectedOpt.id}) to Corporate Party Profile`);
      }
    }

    // Ensure Corporate Party Profile is assigned to test branches (Branch A & Branch B)
    if (this.masters.corporatePartyProfile && this.masters.branchA?.id) {
      await adminClient.put(`/party-profiles/${this.masters.corporatePartyProfile.id}/branches`, {
        branchIds: [this.masters.branchA.id, ...(this.masters.branchB?.id ? [this.masters.branchB.id] : [])],
      });
    }

    // 4. Accounts (Cash Ledger, Bank Accounts)
    const accRes = await adminClient.get('/account-profiles', { limit: 100 });
    const accounts = Array.isArray(accRes.data?.data) ? accRes.data.data : (Array.isArray(accRes.data?.items) ? accRes.data.items : (Array.isArray(accRes.data) ? accRes.data : []));
    for (const a of accounts) {
      const name = String(a.accountName || a.name || '').toLowerCase();
      const code = String(a.accountCode || a.code || '').toLowerCase();
      if ((name.includes('cash') || code.includes('cash')) && !this.masters.cashAccountId) {
        this.masters.cashAccountId = a.id;
      } else if ((name.includes('bank') || name.includes('hdfc') || name.includes('sbi')) && !this.masters.bankAccountId) {
        this.masters.bankAccountId = a.id;
      }
    }
    if (!this.masters.bankAccountId && accounts.length > 0) {
      this.masters.bankAccountId = accounts[0].id;
    }
    if (!this.masters.cashAccountId && accounts.length > 0) {
      this.masters.cashAccountId = accounts[0].id;
    }
    TestLogger.info(`Accounts: Cash=${this.masters.cashAccountId}, Bank=${this.masters.bankAccountId}`);

    // Discover / configure ADVANCE_CONTROL_ACCOUNT
    const settingsRes = await adminClient.get('/additional-settings');
    const categories = Array.isArray(settingsRes.data) ? settingsRes.data : (Array.isArray(settingsRes.data?.data) ? settingsRes.data.data : []);
    const txnAccounting = categories.find((c: any) => String(c.code).toUpperCase() === 'TRANSACTION_ACCOUNTING');
    if (txnAccounting) {
      const advSetting = (txnAccounting.subcategories || []).find((s: any) => String(s.code).toUpperCase() === 'ADVANCE_CONTROL_ACCOUNT');
      if (advSetting?.value && advSetting.value.trim() !== '') {
        this.masters.advanceControlAccountId = advSetting.value.trim();
      } else if (this.masters.cashAccountId && advSetting) {
        const targetAccId = this.masters.cashAccountId;
        await adminClient.put(`/additional-settings/${txnAccounting.id}/subcategories/${advSetting.id}`, {
          value: targetAccId,
        });
        this.masters.advanceControlAccountId = targetAccId;
      }
    }
    if (this.masters.advanceControlAccountId) {
      TestLogger.info(`Advance Control Account ID: ${this.masters.advanceControlAccountId}`);
    }

    // Ensure ALLOW_NULL_MANUAL_BOOK settings default to YES so non-manual tests don't require manual books
    const txnSettings = categories.find((c: any) => String(c.code).toUpperCase() === 'TRANSACTION_SETTINGS');
    if (txnSettings) {
      for (const code of ['ALLOW_NULL_MANUAL_BOOK_IN_PURCHASE', 'ALLOW_NULL_MANUAL_BOOK_IN_SELL']) {
        const setting = (txnSettings.subcategories || txnSettings.children || []).find((s: any) => String(s.code).toUpperCase() === code);
        if (setting && setting.value !== 'YES') {
          await adminClient.put(`/additional-settings/${txnSettings.id}/subcategories/${setting.id}`, {
            description: setting.description || code,
            value: 'YES',
          });
        }
      }
    }

    // Discover Voucher Category Options
    const accTypeRes = await adminClient.get('/select-options/VOUCHER_ACCOUNT_TYPE');
    const accTypeList = Array.isArray(accTypeRes.data) ? accTypeRes.data : (Array.isArray(accTypeRes.data?.data) ? accTypeRes.data.data : []);
    for (const opt of accTypeList) {
      const val = String(opt.value || '').toUpperCase();
      if (val === 'CASH') this.masters.voucherAccountTypeCashId = opt.id;
      if (val === 'BANK_CHEQUE') this.masters.voucherAccountTypeBankId = opt.id;
    }

    const itemTypeRes = await adminClient.get('/select-options/VOUCHER_ITEM_TYPE');
    const itemTypeList = Array.isArray(itemTypeRes.data) ? itemTypeRes.data : (Array.isArray(itemTypeRes.data?.data) ? itemTypeRes.data.data : []);
    for (const opt of itemTypeList) {
      const val = String(opt.value || '').toUpperCase();
      if (val === 'ACCOUNT') this.masters.voucherItemTypeAccountId = opt.id;
    }
    TestLogger.info(`Voucher Options: CashType=${this.masters.voucherAccountTypeCashId}, BankType=${this.masters.voucherAccountTypeBankId}, AccountItem=${this.masters.voucherItemTypeAccountId}`);

    // 5. Fake Currency Reason Option
    const fakeReasonRes = await adminClient.get('/category-options/FAKECURRENCYREASON');
    const fakeList = Array.isArray(fakeReasonRes.data?.data) ? fakeReasonRes.data.data : (Array.isArray(fakeReasonRes.data) ? fakeReasonRes.data : []);
    if (fakeList.length > 0) {
      this.masters.fakeReasonId = fakeList[0].id;
      TestLogger.info(`Fake Currency Reason ID: ${this.masters.fakeReasonId}`);
    }

    // 6. Policy Transaction Date
    if (this.masters.branchA?.id) {
      const policyRes = await adminClient.get('/auth/policy-context', {
        branchId: this.masters.branchA.id,
        counterId: this.masters.counterA1?.id,
      });
      if (policyRes.ok && policyRes.data?.transactionDate) {
        this.masters.transactionDate = policyRes.data.transactionDate;
        TestLogger.info(`Policy Transaction Date: ${this.masters.transactionDate}`);
      }
    }

    return this.masters;
  }
}

