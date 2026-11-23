import { ApiClient } from './api-client';
import { TestLogger } from './test-logger';
import { envConfig } from '../config/env.config';
import { TRANSACTION_SLUGS } from '../config/test-constants';

export interface DiscoveredMasters {
  companyId?: string;
  branchA?: { id: string; name: string; code: string };
  branchB?: { id: string; name: string; code: string };
  hoBranch?: { id: string; name: string; code: string; isHeadOffice?: boolean };
  /** Non-HO selling branch for Branch→HO surrender flows (TP/EM/CARD). */
  nonHoBranch?: { id: string; name: string; code: string };
  counterA1?: { id: string; name: string; branchId: string };
  counterA2?: { id: string; name: string; branchId: string };
  counterB1?: { id: string; name: string; branchId: string };
  nonHoCounter?: { id: string; name: string; branchId: string };
  currencyUsd?: { id: string; code: string; name: string };
  currencyEur?: { id: string; code: string; name: string };
  currencyGbp?: { id: string; code: string; name: string };
  currencyInr?: { id: string; code: string; name: string };
  currencyCmStocking?: { id: string; code: string; name: string };
  productCn?: { id: string; code: string; description: string };
  productCc?: { id: string; code: string; description: string };
  productCm?: { id: string; code: string; description: string };
  productTt?: { id: string; code: string; description: string };
  productTp?: { id: string; code: string; description: string };
  productEm?: { id: string; code: string; description: string };
  cardIssuerPartyId?: string;
  corporatePartyProfile?: { id: string; name: string; entityTypeId?: string; panNo?: string };
  cashAccountId?: string;
  bankAccountId?: string;
  paymentItemAccountId?: string;
  receiptItemAccountId?: string;
  journalDebitAccountId?: string;
  journalCreditAccountId?: string;
  advanceControlAccountId?: string;
  voucherAccountTypeCashId?: string;
  voucherAccountTypeBankId?: string;
  voucherItemTypeAccountId?: string;
  fakeReasonId?: string;
  relationSelfOptionId?: string;
  transactionDate?: string;
  purposeId?: string;
  countryId?: string;
  ttMaturityOptionId?: string;
  fbChargeBearerOptionId?: string;
}

export class MasterDataRegistry {
  private static instance: MasterDataRegistry;
  public masters: DiscoveredMasters = {};
  private initialized = false;

  private constructor() {}

  public static getInstance(): MasterDataRegistry {
    if (!MasterDataRegistry.instance) {
      MasterDataRegistry.instance = new MasterDataRegistry();
    }
    return MasterDataRegistry.instance;
  }

  private async ensureNonHoBranch(adminClient: ApiClient): Promise<void> {
    if (this.masters.nonHoBranch?.id) return;
    try {
      const branchRes = await adminClient.get('/branches', { limit: 100 });
      const branches = Array.isArray(branchRes.data?.data)
        ? branchRes.data.data
        : Array.isArray(branchRes.data?.items)
          ? branchRes.data.items
          : Array.isArray(branchRes.data)
            ? branchRes.data
            : [];
      const counterRes = await adminClient.get('/counters', { limit: 100 });
      const counters = Array.isArray(counterRes.data?.data)
        ? counterRes.data.data
        : Array.isArray(counterRes.data?.items)
          ? counterRes.data.items
          : Array.isArray(counterRes.data)
            ? counterRes.data
            : [];
      const hoIds = new Set(
        branches.filter((b: any) => b.isHeadOffice).map((b: any) => String(b.id)),
      );
      const withCounter = (branch?: { id: string; name: string; code: string }) => {
        if (!branch?.id || hoIds.has(branch.id)) return null;
        const found = counters.find(
          (c: any) =>
            Array.isArray(c.branchIds) && c.branchIds.includes(branch.id),
        );
        if (!found) return null;
        return {
          branch,
          counter: {
            id: found.id,
            name: found.name || found.counterName,
            branchId: branch.id,
          },
        };
      };
      const preferred =
        withCounter(this.masters.branchB) ||
        withCounter(this.masters.branchA) ||
        (() => {
          for (const other of branches.filter((b: any) => !b.isHeadOffice)) {
            const hit = withCounter({
              id: other.id,
              name: other.name || other.branchName,
              code: other.code || other.branchCode,
            });
            if (hit) return hit;
          }
          return null;
        })();
      if (!preferred) return;
      this.masters.nonHoBranch = preferred.branch;
      this.masters.nonHoCounter = preferred.counter;
    } catch {}
  }

  private async ensureFbChargeBearerOption(adminClient: ApiClient): Promise<void> {
    if (this.masters.fbChargeBearerOptionId) return;
    try {
      const fbRes = await adminClient.get('/select-options/FBCHARGEBEARER');
      const fbList = Array.isArray(fbRes.data)
        ? fbRes.data
        : Array.isArray(fbRes.data?.data)
          ? fbRes.data.data
          : [];
      if (fbList.length > 0) {
        this.masters.fbChargeBearerOptionId = fbList[0].id;
        TestLogger.info(`Discovered FB Charge Bearer Option ID: ${this.masters.fbChargeBearerOptionId}`);
        return;
      }
      const createFbRes = await adminClient.post('/select-options', {
        code: 'FBCHARGEBEARER',
        value: 'OUR',
        label: 'OUR',
        isActive: true,
      });
      if (createFbRes.ok && createFbRes.data?.id) {
        this.masters.fbChargeBearerOptionId = createFbRes.data.id;
        TestLogger.info(`Created FB Charge Bearer Option ID: ${this.masters.fbChargeBearerOptionId}`);
      }
    } catch {}
  }

  public async initialize(adminClient: ApiClient): Promise<DiscoveredMasters> {
    if (this.initialized) {
      await this.ensureNonHoBranch(adminClient);
      await this.ensureFbChargeBearerOption(adminClient);
      if (this.masters.branchA?.id) {
        try {
          const policyRes = await adminClient.get('/auth/policy-context', {
            branchId: this.masters.branchA.id,
            counterId: this.masters.counterA1?.id,
          });
          if (policyRes.ok && policyRes.data) {
            this.masters.transactionDate =
              policyRes.data.transactionDate || policyRes.data.openBusinessDate || this.masters.transactionDate;
          }
        } catch {}
      }
      return this.masters;
    }

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

      const secondCounterForA = counters.find(
        (c: any) =>
          Array.isArray(c.branchIds) &&
          c.branchIds.includes(matchedBranchA.id) &&
          c.id !== matchedCounterA.id
      );
      this.masters.counterA2 = secondCounterForA
        ? {
            id: secondCounterForA.id,
            name: secondCounterForA.name || secondCounterForA.counterName,
            branchId: matchedBranchA.id,
          }
        : this.masters.counterA1;

      const remainingBranches = branches.filter((b: any) => b.id !== matchedBranchA.id);
      const branchWithCounter = remainingBranches.find((b: any) =>
        counters.some((c: any) => Array.isArray(c.branchIds) && c.branchIds.includes(b.id))
      );

      if (branchWithCounter) {
        const counterForB = counters.find((c: any) => Array.isArray(c.branchIds) && c.branchIds.includes(branchWithCounter.id));
        this.masters.branchB = {
          id: branchWithCounter.id,
          name: branchWithCounter.name || branchWithCounter.branchName,
          code: branchWithCounter.code || branchWithCounter.branchCode,
        };
        this.masters.counterB1 = {
          id: counterForB.id,
          name: counterForB.name || counterForB.counterName,
          branchId: branchWithCounter.id,
        };
      } else if (remainingBranches.length > 0) {
        const targetBranch = remainingBranches[0];
        let counterToLink = counters.find((c: any) => c.id !== matchedCounterA.id);
        if (!counterToLink) {
          const createCounterRes = await adminClient.post('/counters', {
            counterNo: Math.floor(Math.random() * 8000) + 1000,
            name: `Wholesale Counter B`,
            isRetail: true,
            isBulk: true,
            isActive: true,
          });
          if (createCounterRes.ok && createCounterRes.data?.id) {
            counterToLink = createCounterRes.data;
          }
        }
        if (counterToLink) {
          try {
            await adminClient.put(`/branches/${targetBranch.id}`, {
              counterIds: [counterToLink.id],
            });
          } catch {}
          this.masters.branchB = {
            id: targetBranch.id,
            name: targetBranch.name || targetBranch.branchName,
            code: targetBranch.code || targetBranch.branchCode,
          };
          this.masters.counterB1 = {
            id: counterToLink.id,
            name: counterToLink.name || counterToLink.counterName,
            branchId: targetBranch.id,
          };
        } else {
          this.masters.branchB = this.masters.branchA;
          this.masters.counterB1 = this.masters.counterA1;
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

    const foundHo = branches.find((b: any) => b.isHeadOffice);
    if (foundHo) {
      this.masters.hoBranch = {
        id: foundHo.id,
        name: foundHo.name || foundHo.branchName,
        code: foundHo.code || foundHo.branchCode,
        isHeadOffice: true,
      };
    } else if (this.masters.branchA) {
      this.masters.hoBranch = this.masters.branchA;
    }

    const hoIds = new Set(
      branches.filter((b: any) => b.isHeadOffice).map((b: any) => String(b.id)),
    );
    const counterForBranch = (branchId: string) =>
      counters.find(
        (c: any) => Array.isArray(c.branchIds) && c.branchIds.includes(branchId),
      );
    const nonHoCandidates: Array<{
      branch: { id: string; name: string; code: string };
      counter?: { id: string; name: string; branchId: string };
    }> = [];
    const pushCandidate = (
      branch?: { id: string; name: string; code: string },
      counter?: { id: string; name: string; branchId: string },
    ) => {
      if (!branch?.id || hoIds.has(branch.id)) return;
      const resolvedCounter =
        counter ||
        (() => {
          const found = counterForBranch(branch.id);
          return found
            ? {
                id: found.id,
                name: found.name || found.counterName,
                branchId: branch.id,
              }
            : undefined;
        })();
      // Prefer branches that already have a counter (transaction drafts require one).
      if (!resolvedCounter) return;
      nonHoCandidates.push({ branch, counter: resolvedCounter });
    };
    pushCandidate(this.masters.branchB, this.masters.counterB1);
    pushCandidate(this.masters.branchA, this.masters.counterA1);
    if (!nonHoCandidates.length) {
      for (const otherNonHo of branches.filter((b: any) => !b.isHeadOffice)) {
        pushCandidate({
          id: otherNonHo.id,
          name: otherNonHo.name || otherNonHo.branchName,
          code: otherNonHo.code || otherNonHo.branchCode,
        });
        if (nonHoCandidates.length) break;
      }
    }
    if (nonHoCandidates[0]) {
      this.masters.nonHoBranch = nonHoCandidates[0].branch;
      this.masters.nonHoCounter = nonHoCandidates[0].counter;
    }

    if (this.masters.branchA) {
      TestLogger.info(`Branch A: ${this.masters.branchA.name} (${this.masters.branchA.id})`);
    }
    if (this.masters.branchB) {
      TestLogger.info(`Branch B: ${this.masters.branchB.name} (${this.masters.branchB.id})`);
    }
    if (this.masters.nonHoBranch) {
      TestLogger.info(
        `Non-HO Branch: ${this.masters.nonHoBranch.name} (${this.masters.nonHoBranch.id})`,
      );
    }
    if (this.masters.counterA1) {
      TestLogger.info(`Counter A1: ${this.masters.counterA1.name} (${this.masters.counterA1.id}) for Branch A`);
    }
    if (this.masters.counterB1) {
      TestLogger.info(`Counter B1: ${this.masters.counterB1.name} (${this.masters.counterB1.id}) for Branch B`);
    }

    // Discover country
    try {
      const countryRes = await adminClient.get('/countries', { limit: 1 });
      const countries = Array.isArray(countryRes.data?.data) ? countryRes.data.data : (Array.isArray(countryRes.data?.items) ? countryRes.data.items : (Array.isArray(countryRes.data) ? countryRes.data : []));
      if (countries?.[0]?.id) {
        this.masters.countryId = countries[0].id;
      }
    } catch {}

    // 2. Currencies (USD, EUR, GBP, INR)
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
      } else if (code === 'INR' && !this.masters.currencyInr) {
        this.masters.currencyInr = { id: c.id, code: 'INR', name: c.name || c.currencyName || 'Indian Rupee' };
      }
    }

    // Ensure EUR currency exists and is active
    if (!this.masters.currencyEur) {
      const eurSearchRes = await adminClient.get('/currencies', { search: 'EUR', limit: 10 });
      const eurList = Array.isArray(eurSearchRes.data?.data) ? eurSearchRes.data.data : (Array.isArray(eurSearchRes.data?.items) ? eurSearchRes.data.items : (Array.isArray(eurSearchRes.data) ? eurSearchRes.data : []));
      const foundEur = eurList.find((c: any) => String(c.code || c.currencyCode || '').toUpperCase() === 'EUR');
      if (foundEur) {
        this.masters.currencyEur = { id: foundEur.id, code: 'EUR', name: foundEur.name || foundEur.currencyName || 'Euro' };
      } else {
        const countryRes = await adminClient.get('/countries', { limit: 1 });
        const countries = Array.isArray(countryRes.data?.data) ? countryRes.data.data : (Array.isArray(countryRes.data?.items) ? countryRes.data.items : (Array.isArray(countryRes.data) ? countryRes.data : []));
        const countryId = countries?.[0]?.id;
        if (countryId) {
          const createEurRes = await adminClient.post('/currencies', {
            countryId,
            currencyCode: 'EUR',
            currencyName: 'Euro',
            priority: '2',
            ratePer: '1',
            defaultMinRate: '80',
            defaultMaxRate: '100',
            calculationMethod: 'MULTIPLICATION',
            openRatePremium: '0',
            gulfDiscFactor: '0',
            amexMapCode: 'EUR',
            group: 'EUROPE',
            active: true,
          });
          if (createEurRes.ok && createEurRes.data?.id) {
            this.masters.currencyEur = {
              id: createEurRes.data.id,
              code: createEurRes.data.currencyCode || 'EUR',
              name: createEurRes.data.currencyName || 'Euro',
            };
          }
        }
      }
    }

    // Ensure INR currency exists and is active
    if (!this.masters.currencyInr) {
      const inrSearchRes = await adminClient.get('/currencies', { search: 'INR', limit: 10 });
      const inrList = Array.isArray(inrSearchRes.data?.data) ? inrSearchRes.data.data : (Array.isArray(inrSearchRes.data?.items) ? inrSearchRes.data.items : (Array.isArray(inrSearchRes.data) ? inrSearchRes.data : []));
      const foundInr = inrList.find((c: any) => String(c.code || c.currencyCode || '').toUpperCase() === 'INR');
      if (foundInr) {
        this.masters.currencyInr = { id: foundInr.id, code: 'INR', name: foundInr.name || foundInr.currencyName || 'Indian Rupee' };
      } else {
        const countryRes = await adminClient.get('/countries', { limit: 1 });
        const countries = Array.isArray(countryRes.data?.data) ? countryRes.data.data : (Array.isArray(countryRes.data?.items) ? countryRes.data.items : (Array.isArray(countryRes.data) ? countryRes.data : []));
        const countryId = countries?.[0]?.id;
        if (countryId) {
          const createInrRes = await adminClient.post('/currencies', {
            countryId,
            currencyCode: 'INR',
            currencyName: 'Indian Rupee',
            priority: '1',
            ratePer: '1',
            defaultMinRate: '1',
            defaultMaxRate: '1',
            calculationMethod: 'MULTIPLICATION',
            openRatePremium: '0',
            gulfDiscFactor: '0',
            amexMapCode: 'INR',
            group: 'ASIA',
            active: true,
          });
          if (createInrRes.ok && createInrRes.data?.id) {
            this.masters.currencyInr = {
              id: createInrRes.data.id,
              code: createInrRes.data.currencyCode || 'INR',
              name: createInrRes.data.currencyName || 'Indian Rupee',
            };
          }
        }
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

    TestLogger.info(`Currencies: USD=${this.masters.currencyUsd?.id}, EUR=${this.masters.currencyEur?.id}, INR=${this.masters.currencyInr?.id}, CMS=${this.masters.currencyCmStocking?.id}`);

    // Ensure active currency rates exist for USD and EUR
    if (this.masters.currencyUsd?.id) {
      try {
        const rates = await adminClient.get('/currency-rates/rates/latest', { currencyId: this.masters.currencyUsd.id });
        const rateList = Array.isArray(rates.data) ? rates.data : [];
        if (rateList.length === 0 || !rateList[0]?.baseSaleRate) {
          await adminClient.post('/currency-rates/rates', {
            currencyId: this.masters.currencyUsd.id,
            provider: 'MANUAL',
            baseBuyRate: '88.00',
            baseSaleRate: '88.50',
            isActive: true,
          });
          TestLogger.info('Created active currency rate for USD');
        }
      } catch {}
    }
    if (this.masters.currencyEur?.id) {
      try {
        const rates = await adminClient.get('/currency-rates/rates/latest', { currencyId: this.masters.currencyEur.id });
        const rateList = Array.isArray(rates.data) ? rates.data : [];
        if (rateList.length === 0 || !rateList[0]?.baseSaleRate) {
          await adminClient.post('/currency-rates/rates', {
            currencyId: this.masters.currencyEur.id,
            provider: 'MANUAL',
            baseBuyRate: '94.00',
            baseSaleRate: '95.00',
            isActive: true,
          });
          TestLogger.info('Created active currency rate for EUR');
        }
      } catch {}
    }

    // 3. Products (CC, CM, CN, TT, TP, EM)
    const prodRes = await adminClient.get('/products', { limit: 100, activeOnly: false });
    const products = Array.isArray(prodRes.data?.data) ? prodRes.data.data : (Array.isArray(prodRes.data?.items) ? prodRes.data.items : (Array.isArray(prodRes.data) ? prodRes.data : []));
    for (const p of products) {
      const pCode = String(p.code || p.productCode || '').toUpperCase();
      const pDesc = String(p.description || p.productDescription || '').toLowerCase();
      if (pCode === 'CN' && !this.masters.productCn) {
        this.masters.productCn = { id: p.id, code: 'CN', description: p.productDescription || p.description || 'Currency Notes' };
      } else if (pCode === 'CC' && !this.masters.productCc) {
        this.masters.productCc = { id: p.id, code: 'CC', description: p.productDescription || p.description || 'Single Currency Card' };
      } else if (pCode === 'CM' && !this.masters.productCm) {
        this.masters.productCm = { id: p.id, code: 'CM', description: p.productDescription || p.description || 'Multi Currency Card' };
      } else if (pCode === 'TT' && !this.masters.productTt) {
        this.masters.productTt = { id: p.id, code: 'TT', description: p.productDescription || p.description || 'Telegraphic Transfer' };
      } else if ((pCode === 'TP' || pCode === 'TC' || pDesc.includes('traveller') || pDesc.includes('cheque')) && !this.masters.productTp) {
        this.masters.productTp = { id: p.id, code: p.productCode || p.code || 'TP', description: p.productDescription || p.description || 'Travellers Cheque' };
      } else if (pCode === 'EM' && !this.masters.productEm) {
        this.masters.productEm = { id: p.id, code: 'EM', description: p.productDescription || p.description || 'Encashment / Surrender' };
      }
    }

    if (!this.masters.productTp) {
      try {
        const tpSearchRes = await adminClient.get('/products', { search: 'TP', activeOnly: false, limit: 10 });
        const tpList = Array.isArray(tpSearchRes.data?.data)
          ? tpSearchRes.data.data
          : (Array.isArray(tpSearchRes.data?.items) ? tpSearchRes.data.items : (Array.isArray(tpSearchRes.data) ? tpSearchRes.data : []));
        const foundTp = tpList.find((p: any) => {
          const c = String(p.code || p.productCode || '').toUpperCase();
          const d = String(p.description || p.productDescription || '').toLowerCase();
          return c === 'TP' || c === 'TC' || d.includes('traveller') || d.includes('cheque');
        });
        if (foundTp) {
          this.masters.productTp = {
            id: foundTp.id,
            code: foundTp.productCode || foundTp.code || 'TP',
            description: foundTp.productDescription || foundTp.description || 'Travellers Cheque',
          };
          TestLogger.info(`Discovered existing TP Travellers Cheque product: ${this.masters.productTp.id}`);
        }
      } catch {}
    }

    if (!this.masters.productTp) {
      const createTpRes = await adminClient.post('/products', {
        productCode: 'TP',
        productDescription: 'Travellers Cheque',
        availableInRetailBuying: true,
        availableInRetailSelling: true,
        availableInBulkBuying: true,
        availableInBulkSelling: true,
        isActiveProduct: true,
      });
      if (createTpRes.ok && createTpRes.data?.id) {
        this.masters.productTp = {
          id: createTpRes.data.id,
          code: createTpRes.data.productCode || 'TP',
          description: createTpRes.data.productDescription || 'Travellers Cheque',
        };
        TestLogger.info(`Created TP Travellers Cheque product: ${this.masters.productTp.id}`);
      }
    }

    // Ensure all discovered products are active and configured with required availability
    for (const prod of [this.masters.productCn, this.masters.productCc, this.masters.productCm, this.masters.productTt, this.masters.productTp, this.masters.productEm]) {
      if (prod?.id) {
        try {
          const isTp = prod.id === this.masters.productTp?.id;
          await adminClient.patch(`/products/${prod.id}`, {
            isActiveProduct: true,
            availableInRetailBuying: true,
            availableInRetailSelling: !isTp,
            availableInBulkBuying: true,
            availableInBulkSelling: true,
          });
        } catch {}
      }
    }

    TestLogger.info(`Products: CN=${this.masters.productCn?.id}, CC=${this.masters.productCc?.id}, CM=${this.masters.productCm?.id}, TT=${this.masters.productTt?.id}, TP=${this.masters.productTp?.id}, EM=${this.masters.productEm?.id}`);

    // Discover Card Issuer Party Profile
    const issuerRes = await adminClient.get('/party-profiles', { type: 'CARD_ISSUER_PROFILE', limit: 10 });
    const issuers = Array.isArray(issuerRes.data?.data) ? issuerRes.data.data : (Array.isArray(issuerRes.data?.items) ? issuerRes.data.items : (Array.isArray(issuerRes.data) ? issuerRes.data : []));
    if (issuers.length > 0) {
      const approvedIssuer = issuers.find((i: any) => (i.status === 'APPROVE' || i.status === 'APPROVED') && i.active);
      const chosen = approvedIssuer || issuers[0];
      this.masters.cardIssuerPartyId = chosen.id;
      if (chosen.status !== 'APPROVE') {
        try {
          await adminClient.post(`/party-profiles/${chosen.id}/review`, {
            status: 'APPROVE',
            active: true,
          });
        } catch {}
      }
      TestLogger.info(`Card Issuer Party Profile: ${chosen.name} (${this.masters.cardIssuerPartyId})`);
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
        try {
          await adminClient.post(`/party-profiles/${this.masters.cardIssuerPartyId}/review`, {
            status: 'APPROVE',
            active: true,
          });
        } catch {}
        TestLogger.info(`Created Card Issuer Party Profile: (${this.masters.cardIssuerPartyId})`);
      }
    }

    // Ensure Card Issuer is assigned to branches and linked to products CC, CM, TT, and EM
    if (this.masters.cardIssuerPartyId && this.masters.branchA?.id) {
      try {
        const issuerBranchIds = [
          this.masters.branchA.id,
          this.masters.branchB?.id,
          this.masters.nonHoBranch?.id,
        ].filter(
          (id, idx, arr): id is string => Boolean(id) && arr.indexOf(id) === idx,
        );
        await adminClient.put(`/party-profiles/${this.masters.cardIssuerPartyId}/branches`, {
          branchIds: issuerBranchIds,
        });
      } catch {}
    }

    // Ensure Card Issuer is linked to products CC, CM, TT, and EM
    if (this.masters.cardIssuerPartyId) {
      if (this.masters.productCc) {
        await adminClient.put(`/products/${this.masters.productCc.id}`, {
          issuerProfileIds: [this.masters.cardIssuerPartyId],
        });
      }
      if (this.masters.productCm) {
        await adminClient.put(`/products/${this.masters.productCm.id}`, {
          issuerProfileIds: [this.masters.cardIssuerPartyId],
        });
      }
      if (this.masters.productTt) {
        await adminClient.put(`/products/${this.masters.productTt.id}`, {
          issuerProfileIds: [this.masters.cardIssuerPartyId],
          availableInDealCover: true,
          availableInOtherTransaction: true,
        });

        // Ensure product currency rule exists for TT + USD so resolveDealRate succeeds
        if (this.masters.currencyUsd?.id) {
          try {
            const rulesRes = await adminClient.get('/currency-rates/product-rules', {
              productId: this.masters.productTt.id,
              currencyId: this.masters.currencyUsd.id,
            });
            const rules = Array.isArray(rulesRes.data) ? rulesRes.data : (Array.isArray(rulesRes.data?.data) ? rulesRes.data.data : []);
            if (rules.length === 0) {
              await adminClient.post('/currency-rates/product-rules', {
                productId: this.masters.productTt.id,
                currencyId: this.masters.currencyUsd.id,
                buyMarginType: 'FIXED',
                buyMarginValue: '0.00',
                saleMarginType: 'FIXED',
                saleMarginValue: '0.00',
                isActive: true,
              });
              TestLogger.info('Created product currency rule for TT + USD');
            }
          } catch (err: any) {
            TestLogger.info(`Product-rule creation check note: ${err?.message || err}`);
          }
        }
      }
      if (this.masters.productTp) {
        await adminClient.put(`/products/${this.masters.productTp.id}`, {
          issuerProfileIds: [this.masters.cardIssuerPartyId],
          availableInRetailBuying: true,
          availableInRetailSelling: false,
          availableInBulkBuying: true,
          availableInBulkSelling: true,
        });
      }
      if (this.masters.productEm) {
        await adminClient.put(`/products/${this.masters.productEm.id}`, {
          issuerProfileIds: [this.masters.cardIssuerPartyId],
          maintainBlankStockOfProduct: false,
          availableInRetailBuying: true,
          availableInBulkSelling: true,
        });
      }
    }

    // Discover Corporate Client Party Profile
    const corpRes = await adminClient.get('/party-profiles', { type: 'CORPORATE_CLIENT', limit: 10 });
    const corps = Array.isArray(corpRes.data?.data) ? corpRes.data.data : (Array.isArray(corpRes.data?.items) ? corpRes.data.items : (Array.isArray(corpRes.data) ? corpRes.data : []));
    if (corps.length > 0) {
      const approvedCorp = corps.find((c: any) => (c.status === 'APPROVE' || c.status === 'APPROVED') && c.active);
      const chosen = approvedCorp || corps[0];
      const panNo = chosen.panNo || 'AAACT1234F';
      try {
        await adminClient.put(`/party-profiles/${chosen.id}`, {
          panNo,
          permanentCreditLimit: 50000000,
          permanentCreditDays: 90,
        });
      } catch {}
      this.masters.corporatePartyProfile = {
        id: chosen.id,
        name: chosen.name,
        entityTypeId: chosen.entityType?.id,
        panNo,
      };
      if (chosen.status !== 'APPROVE') {
        try {
          await adminClient.post(`/party-profiles/${chosen.id}/review`, {
            status: 'APPROVE',
            active: true,
          });
        } catch {}
      }
      TestLogger.info(`Corporate Client Party Profile: ${chosen.name} (${this.masters.corporatePartyProfile.id}, PAN: ${panNo})`);
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
          panNo: 'AAACT1234F',
        };
        try {
          await adminClient.post(`/party-profiles/${createCorpRes.data.id}/review`, {
            status: 'APPROVE',
            active: true,
          });
        } catch {}
        TestLogger.info(`Created Corporate Client Party Profile: (${this.masters.corporatePartyProfile.id})`);
      }
    }

    // Ensure Corporate Party Profile has a valid entityType option assigned
    if (this.masters.corporatePartyProfile) {
      const entityTypeRes = await adminClient.get('/select-options/ENTITYTYPE');
      const entityTypes = Array.isArray(entityTypeRes.data)
        ? entityTypeRes.data
        : (Array.isArray(entityTypeRes.data?.data) ? entityTypeRes.data.data : []);
      if (entityTypes.length > 0) {
        const selectedOpt = entityTypes.find((opt: any) => {
          const val = String(opt.value || opt.code || opt.label || '').toUpperCase();
          return val.includes('CORP') || (!val.includes('INDIV') && val !== 'INDIVIDUAL');
        }) || entityTypes[0];
        if (!this.masters.corporatePartyProfile.entityTypeId) {
          await adminClient.put(`/party-profiles/${this.masters.corporatePartyProfile.id}`, {
            entityType: selectedOpt.id,
          });
          this.masters.corporatePartyProfile.entityTypeId = selectedOpt.id;
          TestLogger.info(`Assigned EntityType (${selectedOpt.value || selectedOpt.id}) to Corporate Party Profile`);
        }
      }
    }

    // Ensure Corporate Party Profile is assigned to test branches (Branch A & Branch B) and has credit limits configured
    if (this.masters.corporatePartyProfile && this.masters.branchA?.id) {
      const corporateBranchIds = [
        this.masters.branchA.id,
        this.masters.branchB?.id,
        this.masters.nonHoBranch?.id,
      ].filter(
        (id, idx, arr): id is string => Boolean(id) && arr.indexOf(id) === idx,
      );
      await adminClient.put(`/party-profiles/${this.masters.corporatePartyProfile.id}/branches`, {
        branchIds: corporateBranchIds,
      });
      try {
        await adminClient.put(`/party-profiles/${this.masters.corporatePartyProfile.id}`, {
          entityType: this.masters.corporatePartyProfile.entityTypeId,
        });
        await adminClient.post(`/party-profiles/${this.masters.corporatePartyProfile.id}/credit-policy`, {
          permanentCreditLimit: 1000000,
          permanentCreditDays: 30,
        });
      } catch {}
    }

    // 4. Accounts (Cash Ledger, Bank Accounts, INR Accounts)
    let cashLedgerOptionId: string | undefined;
    let bankLedgerOptionId: string | undefined;
    try {
      const accTypeOptRes = await adminClient.get('/select-options/ACCOUNTTYPE');
      const accTypeOpts = Array.isArray(accTypeOptRes.data)
        ? accTypeOptRes.data
        : (Array.isArray(accTypeOptRes.data?.data) ? accTypeOptRes.data.data : []);
      for (const opt of accTypeOpts) {
        const val = String(opt.value || opt.label || '').toUpperCase().replace(/[\s-]+/g, '_');
        if (val === 'CASH_LEDGER') cashLedgerOptionId = opt.id;
        if (val === 'BANK_LEDGER') bankLedgerOptionId = opt.id;
      }
    } catch {}

    const accRes = await adminClient.get('/account-profiles', { limit: 100 });
    const accounts = Array.isArray(accRes.data?.data) ? accRes.data.data : (Array.isArray(accRes.data?.items) ? accRes.data.items : (Array.isArray(accRes.data) ? accRes.data : []));
    for (const a of accounts) {
      const typeVal = String(a.accountType?.value || a.accountType?.label || '').toUpperCase().replace(/[\s-]+/g, '_');
      const name = String(a.accountName || a.name || '').toLowerCase();
      const code = String(a.accountCode || a.code || '').toLowerCase();

      if (typeVal === 'CASH_LEDGER' && !this.masters.cashAccountId) {
        this.masters.cashAccountId = a.id;
      } else if (typeVal === 'BANK_LEDGER' && !this.masters.bankAccountId) {
        this.masters.bankAccountId = a.id;
      } else if ((name.includes('cash') || code.includes('cash')) && !this.masters.cashAccountId) {
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

    // Ensure Cash and Bank accounts have INR currency, correct account type, and voucher usage flags enabled
    const inrCurrencyId = this.masters.currencyInr?.id;
    if (inrCurrencyId) {
      if (this.masters.cashAccountId) {
        await adminClient.put(`/account-profiles/${this.masters.cashAccountId}`, {
          currencyId: inrCurrencyId,
          ...(cashLedgerOptionId ? { accountType: cashLedgerOptionId } : {}),
          receipt: true,
          payment: true,
          journalVoucher: true,
          active: true,
        });
      }
      if (this.masters.bankAccountId && this.masters.bankAccountId !== this.masters.cashAccountId) {
        await adminClient.put(`/account-profiles/${this.masters.bankAccountId}`, {
          currencyId: inrCurrencyId,
          ...(bankLedgerOptionId ? { accountType: bankLedgerOptionId } : {}),
          receipt: true,
          payment: true,
          journalVoucher: true,
          active: true,
        });
      }
    }
    this.masters.paymentItemAccountId = this.masters.cashAccountId;
    this.masters.receiptItemAccountId = this.masters.cashAccountId;
    this.masters.journalDebitAccountId = this.masters.cashAccountId;
    this.masters.journalCreditAccountId = this.masters.bankAccountId;
    TestLogger.info(`Accounts: Cash=${this.masters.cashAccountId}, Bank=${this.masters.bankAccountId}`);

    // Ensure productTp has valid purchase and sale accounts configured
    if (this.masters.productTp?.id) {
      try {
        const tpDetailRes = await adminClient.get(`/products/${this.masters.productTp.id}`);
        const tpData = tpDetailRes.data;
        if (!tpData?.purchaseAc && !tpData?.bulkPurAc) {
          const accountIdToUse = this.masters.cashAccountId || accounts[0]?.id;
          if (accountIdToUse) {
            await adminClient.put(`/products/${this.masters.productTp.id}`, {
              purchaseAc: accountIdToUse,
              bulkPurAc: accountIdToUse,
              saleAc: accountIdToUse,
              bulkSaleAc: accountIdToUse,
              profitAc: accountIdToUse,
              bulkProficAc: accountIdToUse,
              availableInRetailBuying: true,
              availableInRetailSelling: false,
              availableInBulkBuying: true,
              availableInBulkSelling: true,
              ...(this.masters.cardIssuerPartyId ? { issuerProfileIds: [this.masters.cardIssuerPartyId] } : {}),
            });
            TestLogger.info(`Configured accounting accounts on Product TP: ${accountIdToUse}`);
          }
        }
      } catch (err: any) {
        TestLogger.info(`Product TP accounts configuration note: ${err?.message || err}`);
      }
    }

    // Ensure productEm has valid purchase and sale accounts configured
    if (this.masters.productEm?.id) {
      try {
        const emDetailRes = await adminClient.get(`/products/${this.masters.productEm.id}`);
        const emData = emDetailRes.data;
        if (!emData?.purchaseAc && !emData?.bulkPurAc) {
          const accountIdToUse = this.masters.cashAccountId || accounts[0]?.id;
          if (accountIdToUse) {
            await adminClient.put(`/products/${this.masters.productEm.id}`, {
              purchaseAc: accountIdToUse,
              bulkPurAc: accountIdToUse,
              saleAc: accountIdToUse,
              bulkSaleAc: accountIdToUse,
              profitAc: accountIdToUse,
              bulkProficAc: accountIdToUse,
              availableInRetailBuying: true,
              availableInBulkSelling: true,
              maintainBlankStockOfProduct: false,
              ...(this.masters.cardIssuerPartyId ? { issuerProfileIds: [this.masters.cardIssuerPartyId] } : {}),
            });
            TestLogger.info(`Configured accounting accounts on Product EM: ${accountIdToUse}`);
          }
        }
      } catch (err: any) {
        TestLogger.info(`Product EM accounts configuration note: ${err?.message || err}`);
      }
    }

    // Discover / configure ADVANCE_CONTROL_ACCOUNT
    const settingsRes = await adminClient.get('/additional-settings');
    const categories = Array.isArray(settingsRes.data) ? settingsRes.data : (Array.isArray(settingsRes.data?.data) ? settingsRes.data.data : []);
    const txnAccounting = categories.find((c: any) => String(c.code).toUpperCase() === 'TRANSACTION_ACCOUNTING');
    if (txnAccounting) {
      const advSetting = (txnAccounting.subcategories || []).find((s: any) => String(s.code).toUpperCase() === 'ADVANCE_CONTROL_ACCOUNT');
      let targetAccId = this.masters.cashAccountId;
      if (advSetting?.value && advSetting.value.trim() !== '') {
        const rawVal = advSetting.value.trim();
        const matched = accounts.find((a: any) => a.id === rawVal || a.accountCode === rawVal);
        if (matched) {
          targetAccId = matched.id;
          if (inrCurrencyId) {
            await adminClient.put(`/account-profiles/${matched.id}`, {
              currencyId: inrCurrencyId,
              receipt: true,
              payment: true,
              journalVoucher: true,
              active: true,
            });
          }
        }
      }
      if (targetAccId && advSetting && advSetting.value !== targetAccId) {
        await adminClient.put(`/additional-settings/${txnAccounting.id}/subcategories/${advSetting.id}`, {
          value: targetAccId,
        });
      }
      this.masters.advanceControlAccountId = targetAccId;
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

    // Ensure TRANSACTION_CREDIT_POLICY allows outstanding on sale and purchase
    try {
      let creditPolicyCat = categories.find((c: any) => String(c.code).toUpperCase() === 'TRANSACTION_CREDIT_POLICY');
      if (!creditPolicyCat) {
        const createRes = await adminClient.post('/additional-settings', {
          title: 'Transaction Credit Policy',
          code: 'TRANSACTION_CREDIT_POLICY',
          subcategories: [
            { title: 'Allow Outstanding On Sale', code: 'ALLOW_OUTSTANDING_ON_SALE', valueType: 'BOOLEAN', value: 'YES' },
            { title: 'Allow Outstanding On Purchase', code: 'ALLOW_OUTSTANDING_ON_PURCHASE', valueType: 'BOOLEAN', value: 'YES' },
          ],
        });
        if (createRes.ok) creditPolicyCat = createRes.data;
      } else {
        const subs = creditPolicyCat.subcategories || creditPolicyCat.children || [];
        for (const code of ['ALLOW_OUTSTANDING_ON_SALE', 'ALLOW_OUTSTANDING_ON_PURCHASE']) {
          const sub = subs.find((s: any) => String(s.code).toUpperCase() === code);
          if (sub && sub.value !== 'YES' && sub.value !== 'true') {
            await adminClient.put(`/additional-settings/${creditPolicyCat.id}/subcategories/${sub.id}`, {
              description: sub.description || code,
              value: 'YES',
            });
          }
        }
      }
    } catch (err: any) {
      TestLogger.info(`Credit policy setting initialization note: ${err?.message || err}`);
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

    const relRes = await adminClient.get('/select-options/RELATION');
    const relList = Array.isArray(relRes.data) ? relRes.data : (Array.isArray(relRes.data?.data) ? relRes.data.data : []);
    const selfOpt = relList.find((opt: any) => String(opt.value || opt.label || '').toUpperCase() === 'SELF') || relList[0];
    if (selfOpt) {
      this.masters.relationSelfOptionId = selfOpt.id;
    }

    TestLogger.info(`Voucher Options: CashType=${this.masters.voucherAccountTypeCashId}, BankType=${this.masters.voucherAccountTypeBankId}, AccountItem=${this.masters.voucherItemTypeAccountId}`);

    // 5. Fake Currency Reason Option
    const fakeReasonRes = await adminClient.get('/select-options/FAKE_CURRENCY_REASON');
    const fakeList = Array.isArray(fakeReasonRes.data)
      ? fakeReasonRes.data
      : (Array.isArray(fakeReasonRes.data?.data) ? fakeReasonRes.data.data : (Array.isArray(fakeReasonRes.data?.items) ? fakeReasonRes.data.items : []));
    if (fakeList.length > 0) {
      this.masters.fakeReasonId = fakeList[0].id;
      TestLogger.info(`Fake Currency Reason ID: ${this.masters.fakeReasonId}`);
    }

    // 5B. Ensure productCn has fakeAccount and lossAccount configured
    if (this.masters.productCn && this.masters.cashAccountId) {
      try {
        await adminClient.put(`/products/${this.masters.productCn.id}`, {
          fakeAccount: this.masters.cashAccountId,
          lossAccount: this.masters.cashAccountId,
        });
      } catch {}
    }

    // 6. Synchronize BOD/EOD and Policy Transaction Date across branches
    const today = new Date().toISOString().slice(0, 10);
    const branchesToSync = [
      this.masters.branchA?.id,
      this.masters.branchB?.id,
      this.masters.nonHoBranch?.id,
    ].filter(
      (id, idx, arr): id is string => Boolean(id) && arr.indexOf(id) === idx
    );

    for (const bId of branchesToSync) {
      try {
        const pol = await adminClient.get('/auth/policy-context', { branchId: bId });
        if (pol.ok && pol.data) {
          if (pol.data.workflowState === 'PENDING_EOD' && pol.data.openBusinessDate && pol.data.openBusinessDate < today) {
            try {
              await adminClient.post('/day-end-start-process/complete', {
                branchId: bId,
                answers: { ratesVerified: true, cashVerified: true },
              });
            } catch {}
          }
          try {
            await adminClient.post('/day-end-start-process/start', {
              branchId: bId,
              answers: { ratesVerified: true, cashVerified: true },
            });
          } catch {}
        }
      } catch {}
    }

    if (this.masters.branchA?.id) {
      const policyRes = await adminClient.get('/auth/policy-context', {
        branchId: this.masters.branchA.id,
        counterId: this.masters.counterA1?.id,
      });
      if (policyRes.ok && policyRes.data) {
        this.masters.transactionDate =
          policyRes.data.transactionDate || policyRes.data.openBusinessDate || today;
        TestLogger.info(`Policy Transaction Date: ${this.masters.transactionDate}`);
      }
    }

    // 6C. Discover Purpose Master
    try {
      const purpRes = await adminClient.get('/purposes', { limit: 10 });
      const purposes = Array.isArray(purpRes.data?.data) ? purpRes.data.data : (Array.isArray(purpRes.data?.items) ? purpRes.data.items : (Array.isArray(purpRes.data) ? purpRes.data : []));
      if (purposes.length > 0) {
        this.masters.purposeId = purposes[0].id;
        TestLogger.info(`Discovered Purpose ID: ${this.masters.purposeId}`);
      } else {
        const createPurpRes = await adminClient.post('/purposes', {
          code: 'TR',
          description: 'Travel / Remittance',
          sell: true,
          purchase: true,
          active: true,
        });
        if (createPurpRes.ok && createPurpRes.data?.id) {
          this.masters.purposeId = createPurpRes.data.id;
          TestLogger.info(`Created Purpose ID: ${this.masters.purposeId}`);
        }
      }
    } catch {}

    // 6D. Discover TT Maturity Option
    try {
      const matRes = await adminClient.get('/select-options/TTMATURITY');
      const matList = Array.isArray(matRes.data) ? matRes.data : (Array.isArray(matRes.data?.data) ? matRes.data.data : []);
      if (matList.length > 0) {
        this.masters.ttMaturityOptionId = matList[0].id;
        TestLogger.info(`Discovered TT Maturity Option ID: ${this.masters.ttMaturityOptionId}`);
      } else {
        const createMatRes = await adminClient.post('/select-options', {
          code: 'TTMATURITY',
          value: '2',
          label: '2 Days (Spot)',
          isActive: true,
        });
        if (createMatRes.ok && createMatRes.data?.id) {
          this.masters.ttMaturityOptionId = createMatRes.data.id;
          TestLogger.info(`Created TT Maturity Option ID: ${this.masters.ttMaturityOptionId}`);
        }
      }
    } catch {}

    // 6E. Discover FB Charge Bearer Option (required on TT remittance)
    await this.ensureFbChargeBearerOption(adminClient);

    // 7. Ensure Counter A1 has baseline USD currency notes stock for sales testing
    if (
      this.masters.branchA?.id &&
      this.masters.counterA1?.id &&
      this.masters.currencyUsd?.id &&
      this.masters.productCn?.id
    ) {
      try {
        const availRes = await adminClient.get('/transactions/quantity-availability', {
          branchId: this.masters.branchA.id,
          counterId: this.masters.counterA1.id,
          currencyId: this.masters.currencyUsd.id,
          productId: this.masters.productCn.id,
        });
        const currentAvail = Number(availRes.data?.availableQuantity ?? 0);
        if (currentAvail < 50000) {
          const purchaseQty = 100000;
          const purchaseRate = 87.0;
          const partyProfileId = this.masters.corporatePartyProfile?.id || this.masters.cardIssuerPartyId;
          const pDraftRes = await adminClient.post('/transactions/drafts', {
            slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
            transactionDate: this.masters.transactionDate,
            branchId: this.masters.branchA.id,
            counterId: this.masters.counterA1.id,
            partyProfileId,
            tradeMode: 'RETAIL',
            passenger: {
              firstName: 'Stock',
              lastName: 'Provisioner',
              nationalityType: 'INDIAN',
              panNumber: 'ABCDE1234F',
              panHolderName: 'Stock Provisioner',
              panDob: '1985-05-15',
            },
            items: [
              {
                productId: this.masters.productCn.id,
                currencyId: this.masters.currencyUsd.id,
                quantity: purchaseQty,
                rate: purchaseRate,
              },
            ],
            payments: [
              {
                paymentMethod: 'NEFT',
                amount: purchaseQty * purchaseRate,
                referenceDate: this.masters.transactionDate || new Date().toISOString().slice(0, 10),
                accountId: this.masters.bankAccountId,
              },
            ],
          });
          const draftId = pDraftRes.data?.id;
          if (draftId) {
            const approveRes = await adminClient.post(`/transactions/${draftId}/approve`, {});
            if (approveRes.ok || approveRes.status === 200 || approveRes.status === 201) {
              TestLogger.info(`Provisioned ${purchaseQty} USD CN approved stock on Counter A1`);
            } else {
              TestLogger.warn(`Baseline stock approval returned ${approveRes.status}: ${JSON.stringify(approveRes.data)}`);
            }
          } else {
            TestLogger.warn(`Baseline stock draft creation returned ${pDraftRes.status}: ${JSON.stringify(pDraftRes.data)}`);
          }
        }
      } catch (err: any) {
        TestLogger.info(`Counter stock provisioning note: ${err?.message}`);
      }
    }

    // Ensure Counter A1 has baseline EUR currency notes stock for transfers and sales
    if (
      this.masters.branchA?.id &&
      this.masters.counterA1?.id &&
      this.masters.currencyEur?.id &&
      this.masters.productCn?.id
    ) {
      try {
        const availRes = await adminClient.get('/transactions/quantity-availability', {
          branchId: this.masters.branchA.id,
          counterId: this.masters.counterA1.id,
          currencyId: this.masters.currencyEur.id,
          productId: this.masters.productCn.id,
        });
        const currentAvail = Number(availRes.data?.availableQuantity ?? 0);
        if (currentAvail < 10000) {
          const purchaseQty = 50000;
          const purchaseRate = 95.0;
          const partyProfileId = this.masters.corporatePartyProfile?.id || this.masters.cardIssuerPartyId;
          const pDraftRes = await adminClient.post('/transactions/drafts', {
            slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
            transactionDate: this.masters.transactionDate,
            branchId: this.masters.branchA.id,
            counterId: this.masters.counterA1.id,
            partyProfileId,
            tradeMode: 'RETAIL',
            passenger: {
              firstName: 'Stock',
              lastName: 'EURProvisioner',
              nationalityType: 'INDIAN',
              panNumber: 'ABCDE1234F',
              panHolderName: 'Stock Provisioner',
              panDob: '1985-05-15',
            },
            items: [
              {
                productId: this.masters.productCn.id,
                currencyId: this.masters.currencyEur.id,
                quantity: purchaseQty,
                rate: purchaseRate,
              },
            ],
            payments: [
              {
                paymentMethod: 'NEFT',
                amount: purchaseQty * purchaseRate,
                referenceDate: this.masters.transactionDate || new Date().toISOString().slice(0, 10),
                accountId: this.masters.bankAccountId,
              },
            ],
          });
          const draftId = pDraftRes.data?.id;
          if (draftId) {
            const approveRes = await adminClient.post(`/transactions/${draftId}/approve`, {});
            if (approveRes.ok || approveRes.status === 200 || approveRes.status === 201) {
              TestLogger.info(`Provisioned ${purchaseQty} EUR CN approved stock on Counter A1`);
            }
          }
        }
      } catch (err: any) {
        TestLogger.info(`EUR counter stock provisioning note: ${err?.message}`);
      }
    }

    this.initialized = true;
    return this.masters;
  }
}

