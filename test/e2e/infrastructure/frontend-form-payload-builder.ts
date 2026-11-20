/**
 * FrontendFormPayloadBuilder
 * Centralized, schema-driven test fixture builder.
 *
 * Strictly executes the semantics of frontend form schemas (purchaseSchema.ts,
 * ad1Schema.ts, cardStockSchema.ts, transferRequestSchema.ts) and mappers
 * (mapPurchaseFormValuesToSubmitPayload, normalizeTtRemittanceFormValues) so that
 * all E2E test suites construct and fire payloads identical to what the UI forms submit.
 */

export interface PurchaseItemBuilderInput {
  productId: string;
  currencyId: string;
  quantity: number;
  rate: number;
  per?: number;
  cardKitNumber?: string;
  cardNumber?: string;
  cardId?: string;
  issuerPartyProfileId?: string;
  isReload?: boolean;
  autoSurrender?: boolean;
  dealCoverId?: string;
}

export interface PurchasePaymentBuilderInput {
  paymentMethod: string;
  amount: number;
  accountId: string;
  paymentDirection?: string;
  referenceNumber?: string;
  referenceDate?: string;
  drawnOn?: string;
  chequePageId?: string;
  advanceVoucherId?: string;
}

export interface PurchasePassengerBuilderInput {
  entityType?: string;
  nationalityType?: string;
  residentStatus?: string;
  countryId?: string;
  stateId?: string;
  city?: string;
  address1?: string;
  panNumber?: string;
  panHolderName?: string;
  panDob?: string;
  panHolderRelationType?: string;
  paidByPanNumber?: string;
  paidByPanHolderName?: string;
  paidByPanDob?: string;
  gstNumber?: string;
  gstStateId?: string;
  passportNumber?: string;
  passportPassengerName?: string;
  passportIssueAt?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  arrivalDate?: string;
  isPep?: boolean;
  id?: string;
  otherDocuments?: Array<{
    documentType: string;
    documentNumber: string;
    validTill?: string | null;
    issueAt?: string | null;
    issueDate?: string | null;
    expiryDate?: string | null;
  }>;
}

export interface PurchaseTravelBuilderInput {
  airlineTtId?: string;
  ticketNo?: string;
  route?: string;
  travellingCountryId?: string;
  noOfDays?: number;
  noOfPax?: number;
  departureDate?: string;
  travelPnr?: string;
  visa?: string;
  isCisCountry?: boolean;
}

export interface TourPassengerBuilderInput {
  lineNo?: string;
  passengerName: string;
  passportNumber: string;
  currencyId: string;
  amount: number;
  isLeader?: boolean;
}

export interface PurchaseAdditionalChargeBuilderInput {
  accountId: string;
  amount: number;
  gstRate?: string | null;
  gstAmount?: string | null;
  applyTax?: boolean;
}

export interface PurchaseTtRemittanceBuilderInput {
  remitterName: string;
  remitterAddress?: string;
  remitterCity?: string;
  remitterCountryId?: string;
  remitterEntityType?: string;
  beneficiaryName: string;
  beneficiaryAddress?: string;
  beneficiaryCountryId?: string;
  bankName: string;
  bankAddress?: string;
  accountNumber?: string;
  iban?: string;
  swiftCode?: string;
  bsbCode?: string;
  sortCode?: string;
  routingNumber?: string;
  transitNumber?: string;
  educationDetails?: string;
  fbBearerOptionId?: string;
  dealCoverId?: string;
}

export interface PurchasePayloadBuilderOptions {
  slug: string;
  transactionType?: 'PURCHASE' | 'SALE';
  tradeMode?: 'RETAIL' | 'WHOLESALE';
  branchId: string;
  counterId?: string;
  transactionDate?: string;
  partyProfileId?: string;
  transactionPartyProfileType?: string;
  purposeId?: string;
  agentProfileId?: string;
  passenger?: PurchasePassengerBuilderInput | null;
  passengerTravel?: PurchaseTravelBuilderInput | null;
  items: PurchaseItemBuilderInput[];
  payments: PurchasePaymentBuilderInput[];
  tourPassengers?: TourPassengerBuilderInput[];
  additionalCharges?: PurchaseAdditionalChargeBuilderInput[];
  ttRemittance?: PurchaseTtRemittanceBuilderInput | null;
  requiresApproval?: boolean;
  manualBookPageId?: string | null;
  cdfNo?: string | null;
  cdfIssuingAuthority?: string | null;
  cdfApprovedUsd?: number | null;
  cdfArrivalDate?: string | null;
  loanAmount?: number | null;
  declaredAmount?: number | null;
  tcsRatePercent?: number | null;
  tcsAmount?: number | null;
  itrFiled?: boolean;
  tcsDeclarationAccepted?: boolean;
  isProprietorship?: boolean;
}

export interface Ad1PayloadBuilderOptions {
  transactionType: 'PURCHASE' | 'SALE';
  profileType: string;
  branchId: string;
  counterId: string;
  docNo: string;
  transactionDate: string;
  servicedBy: string;
  purposeId: string;
  remitterName: string;
  pan: string;
  dateOfBirth: string;
  beneficiaryName: string;
  beneficiaryCountryId: string;
  beneficiaryAccountNumber: string;
  beneficiaryBankName: string;
  beneficiaryBankSwift: string;
  currencyId: string;
  fcyAmount: string | number;
  rate: string | number;
  inrAmount: string | number;
  netInrAmount: string | number;
  paymentMode: string;
  contactNo?: string;
  email?: string;
  address?: string;
  servicedById?: string;
  marketingId?: string;
  segmentId?: string;
  beneficiaryAddress?: string;
  beneficiaryBankAddress?: string;
  beneficiaryIban?: string;
  beneficiarySortCode?: string;
  beneficiaryRoutingNumber?: string;
  beneficiaryTransitNumber?: string;
  beneficiaryBsbCode?: string;
  serviceCharge?: string | number;
  gst?: string | number;
  tcs?: string | number;
  paymentBankId?: string;
  chequeRefNo?: string;
  chequeDate?: string;
  partyProfileId?: string;
  agentProfileId?: string;
}

export interface CardStockReceiptCardInput {
  kitNumber: string;
  cardNumber: string;
}

export interface CardStockReceiptItemInput {
  currencyId: string;
  productId: string;
  denomination?: number;
  feAmount?: string | number;
  series?: string;
  expirationDate?: string;
  cards?: CardStockReceiptCardInput[];
  cardKitNumber?: string;
  cardNumber?: string;
}

export interface CardStockReceiptBuilderOptions {
  receiptDate: string;
  issuerPartyProfileId: string;
  branchId: string;
  totalFeAmount?: string | number;
  items: CardStockReceiptItemInput[];
}

export interface TransferRequestItemInput {
  currencyId: string;
  productId: string;
  quantity: string | number;
  rate: string | number;
  per?: string | number;
}

export interface TransferRequestBuilderOptions {
  transferType: 'COUNTER' | 'BRANCH';
  sourceBranchId: string;
  sourceCounterId: string;
  destinationBranchId: string;
  destinationCounterId: string;
  billReference: string;
  transactionDate?: string;
  items: TransferRequestItemInput[];
}

export class FrontendFormPayloadBuilder {
  /**
   * Builds a transaction draft payload strictly matching `purchaseSchema.ts` & `mapPurchaseFormValuesToSubmitPayload`.
   * The returned payload is shaped as `{ transaction: { ... } }` and also provides top-level fields for direct access.
   */
  public static buildPurchaseTransactionPayload(
    options: PurchasePayloadBuilderOptions,
  ): Record<string, any> {
    const slugUpper = String(options.slug ?? '').toUpperCase();
    const isSale =
      options.transactionType === 'SALE' ||
      slugUpper.startsWith('SALE') ||
      slugUpper.includes('_SALE') ||
      slugUpper.includes('SALE_') ||
      slugUpper.includes('SELL');

    const transactionType = options.transactionType ?? (isSale ? 'SALE' : 'PURCHASE');
    const tradeMode = options.tradeMode ?? (slugUpper.includes('WHOLESALE') ? 'WHOLESALE' : 'RETAIL');

    const mappedItems = options.items.map((item) => ({
      productId: item.productId,
      currencyId: item.currencyId,
      quantity: Number(item.quantity),
      rate: Number(item.rate),
      per: item.per ? Number(item.per) : 1,
      commission: null,
      cardId: item.cardId || null,
      cardKitNumber: item.cardKitNumber || null,
      cardNumber: item.cardNumber || null,
      issuerPartyProfileId: item.issuerPartyProfileId || null,
      isReload: Boolean(item.isReload),
      autoSurrender: item.autoSurrender !== false,
      dealCoverId: item.dealCoverId || null,
      remarks: null,
    }));

    const mappedPayments = options.payments.map((p) => ({
      paymentMethod: p.paymentMethod,
      amount: Number(p.amount),
      accountId: p.accountId || null,
      paymentDirection: p.paymentDirection || (transactionType === 'SALE' ? 'RECEIPT' : 'PAYMENT'),
      referenceNumber: p.referenceNumber || null,
      referenceDate: p.referenceDate || null,
      drawnOn: p.drawnOn || null,
      chequePageId: p.chequePageId || null,
      advanceVoucherId: p.advanceVoucherId || null,
      remarks: null,
    }));

    let mappedPassenger: Record<string, any> | null = null;
    if (options.passenger) {
      const p = options.passenger;
      const isIndian = !p.nationalityType || p.nationalityType === 'INDIAN';
      mappedPassenger = {
        entityType: p.entityType || 'INDIVIDUAL',
        nationalityType: p.nationalityType || 'INDIAN',
        residentStatus: p.residentStatus || 'RESIDENT',
        countryId: p.countryId || null,
        stateId: p.stateId || null,
        city: p.city || 'Mumbai',
        address1: p.address1 || '123 Business Way',
        panNumber: p.panNumber || (isIndian ? 'ABCDE1234F' : null),
        panHolderName: p.panHolderName || 'Amit Patel',
        panDob: p.panDob || '1990-01-01',
        panHolderRelationType: p.panHolderRelationType || null,
        paidByPanNumber: p.paidByPanNumber || null,
        paidByPanHolderName: p.paidByPanHolderName || null,
        paidByPanDob: p.paidByPanDob || null,
        gstNumber: p.gstNumber || null,
        gstStateId: p.gstStateId || null,
        passportNumber: p.passportNumber || (!isIndian ? 'Z1234567' : 'Z1234567'),
        passportPassengerName: p.passportPassengerName || p.panHolderName || 'Amit Patel',
        passportIssueAt: p.passportIssueAt || 'Mumbai',
        passportIssueDate: p.passportIssueDate || '2020-01-01',
        passportExpiryDate: p.passportExpiryDate || '2030-01-01',
        arrivalDate: p.arrivalDate || null,
        isPep: Boolean(p.isPep),
        id: p.id || null,
        otherDocuments: (p.otherDocuments || []).map((doc) => ({
          documentType: doc.documentType,
          documentNumber: doc.documentNumber,
          validTill: doc.validTill || null,
          issueAt: doc.issueAt || null,
          issueDate: doc.issueDate || null,
          expiryDate: doc.expiryDate || null,
          remarks: null,
        })),
      };
    }

    let mappedTravel: Record<string, any> | null = null;
    if (options.passengerTravel) {
      const t = options.passengerTravel;
      mappedTravel = {
        airlineTtId: t.airlineTtId || null,
        ticketNo: t.ticketNo || 'AI-101',
        route: t.route || 'BOM-DXB',
        travellingCountryId: t.travellingCountryId || null,
        noOfDays: t.noOfDays ? Number(t.noOfDays) : 7,
        noOfPax: t.noOfPax ? Number(t.noOfPax) : 1,
        departureDate: t.departureDate || options.transactionDate || '2026-11-20',
        travelPnr: t.travelPnr || null,
        visa: t.visa || 'TOURIST',
        isCisCountry: Boolean(t.isCisCountry),
      };
    }

    const mappedTourPassengers = (options.tourPassengers || []).map((tp, idx) => ({
      lineNo: tp.lineNo || String(idx + 1),
      passengerName: tp.passengerName,
      passportNumber: tp.passportNumber,
      currencyId: tp.currencyId,
      amount: Number(tp.amount),
      isLeader: Boolean(tp.isLeader ?? idx === 0),
    }));

    const mappedCharges = (options.additionalCharges || []).map((c) => ({
      accountId: c.accountId,
      amount: Number(c.amount),
      gstRate: c.gstRate || null,
      gstAmount: c.gstAmount || null,
      applyTax: Boolean(c.applyTax ?? true),
      remarks: null,
    }));

    let mappedTtRemittance: Record<string, any> | null = null;
    if (options.ttRemittance) {
      const tt = options.ttRemittance;
      mappedTtRemittance = {
        remitterName: tt.remitterName,
        remitterAddress: tt.remitterAddress || '101 Marine Lines',
        remitterCity: tt.remitterCity || 'Mumbai',
        remitterCountryId: tt.remitterCountryId || null,
        remitterEntityType: tt.remitterEntityType || 'INDIVIDUAL',
        beneficiaryName: tt.beneficiaryName,
        beneficiaryAddress: tt.beneficiaryAddress || '202 Wall Street, NY',
        beneficiaryCountryId: tt.beneficiaryCountryId || null,
        bankName: tt.bankName,
        bankAddress: tt.bankAddress || 'JPMorgan Chase, NY',
        accountNumber: tt.accountNumber || '1234567890',
        iban: tt.iban || null,
        swiftCode: tt.swiftCode || 'CHASUS33XXX',
        bsbCode: tt.bsbCode || null,
        sortCode: tt.sortCode || null,
        routingNumber: tt.routingNumber || null,
        transitNumber: tt.transitNumber || null,
        educationDetails: tt.educationDetails || null,
        fbBearerOptionId: tt.fbBearerOptionId || null,
        dealCoverId: tt.dealCoverId || null,
      };
    }

    const txData: Record<string, any> = {
      slug: options.slug,
      transactionType,
      tradeMode,
      transactionDate: options.transactionDate || new Date().toISOString().slice(0, 10),
      branchId: options.branchId,
      counterId: options.counterId || null,
      partyProfileId: options.partyProfileId || null,
      transactionPartyProfileType: options.transactionPartyProfileType || null,
      purposeId: options.purposeId || null,
      agentProfileId: options.agentProfileId || null,
      requiresApproval: Boolean(options.requiresApproval),
      manualBookPageId: options.manualBookPageId || null,
      cdfNo: options.cdfNo || null,
      cdfIssuingAuthority: options.cdfIssuingAuthority || null,
      cdfApprovedUsd: options.cdfApprovedUsd ? Number(options.cdfApprovedUsd) : null,
      cdfArrivalDate: options.cdfArrivalDate || null,
      loanAmount: options.loanAmount ? Number(options.loanAmount) : null,
      declaredAmount: options.declaredAmount ? Number(options.declaredAmount) : null,
      tcsRatePercent: options.tcsRatePercent ? Number(options.tcsRatePercent) : null,
      tcsAmount: options.tcsAmount ? Number(options.tcsAmount) : null,
      itrFiled: Boolean(options.itrFiled),
      tcsDeclarationAccepted: Boolean(options.tcsDeclarationAccepted),
      isProprietorship: Boolean(options.isProprietorship),
      passenger: mappedPassenger,
      passengerTravel: mappedTravel,
      items: mappedItems,
      payments: mappedPayments,
      tourPassengers: mappedTourPassengers,
      additionalCharges: mappedCharges,
      ttRemittance: mappedTtRemittance,
      documents: [],
      remarks: null,
    };

    // Both wrapped as `{ transaction: txData }` and flat for dual compatibility
    return {
      ...txData,
      transaction: txData,
    };
  }

  /**
   * Builds an AD1 Outward Remittance payload strictly matching `ad1Schema.ts`.
   */
  public static buildAd1TransactionPayload(
    options: Ad1PayloadBuilderOptions,
  ): Record<string, any> {
    return {
      transactionType: options.transactionType,
      profileType: options.profileType,
      branchId: options.branchId,
      counterId: options.counterId,
      docNo: options.docNo,
      transactionDate: options.transactionDate,
      servicedBy: options.servicedBy,
      purposeId: options.purposeId,
      remitterName: options.remitterName,
      pan: options.pan,
      dateOfBirth: options.dateOfBirth,
      beneficiaryName: options.beneficiaryName,
      beneficiaryCountryId: options.beneficiaryCountryId,
      beneficiaryAccountNumber: options.beneficiaryAccountNumber,
      beneficiaryBankName: options.beneficiaryBankName,
      beneficiaryBankSwift: options.beneficiaryBankSwift,
      currencyId: options.currencyId,
      fcyAmount: String(options.fcyAmount),
      rate: String(options.rate),
      inrAmount: String(options.inrAmount),
      netInrAmount: String(options.netInrAmount),
      paymentMode: options.paymentMode,
      contactNo: options.contactNo || '',
      email: options.email || '',
      address: options.address || '',
      servicedById: options.servicedById || '',
      marketingId: options.marketingId || '',
      segmentId: options.segmentId || '',
      beneficiaryAddress: options.beneficiaryAddress || '',
      beneficiaryBankAddress: options.beneficiaryBankAddress || '',
      beneficiaryIban: options.beneficiaryIban || '',
      beneficiarySortCode: options.beneficiarySortCode || '',
      beneficiaryRoutingNumber: options.beneficiaryRoutingNumber || '',
      beneficiaryTransitNumber: options.beneficiaryTransitNumber || '',
      beneficiaryBsbCode: options.beneficiaryBsbCode || '',
      serviceCharge: options.serviceCharge ? String(options.serviceCharge) : '0',
      gst: options.gst ? String(options.gst) : '0',
      tcs: options.tcs ? String(options.tcs) : '0',
      paymentBankId: options.paymentBankId || '',
      chequeRefNo: options.chequeRefNo || '',
      chequeDate: options.chequeDate || '',
      partyProfileId: options.partyProfileId || undefined,
      agentProfileId: options.agentProfileId || undefined,
    };
  }

  /**
   * Builds a Card Stock Receipt payload strictly matching `cardStockSchema.ts`.
   */
  public static buildCardStockReceiptPayload(
    options: CardStockReceiptBuilderOptions,
  ): Record<string, any> {
    const totalFe = options.totalFeAmount ?? options.items.length;
    return {
      receiptDate: options.receiptDate,
      issuerPartyProfileId: options.issuerPartyProfileId,
      branchId: options.branchId,
      totalFeAmount: String(totalFe),
      items: options.items.map((item) => {
        const cards =
          item.cards && item.cards.length > 0
            ? item.cards
            : item.cardKitNumber && item.cardNumber
              ? [{ kitNumber: item.cardKitNumber, cardNumber: item.cardNumber }]
              : [];
        return {
          currencyId: item.currencyId,
          productId: item.productId,
          denomination: item.denomination ?? 1,
          feAmount: item.feAmount !== undefined ? String(item.feAmount) : '1',
          series: item.series || 'SER1',
          expirationDate: item.expirationDate || '2030-12-31',
          cards,
        };
      }),
    };
  }

  /**
   * Builds a Stock Transfer Request payload strictly matching `transferRequestSchema.ts`.
   */
  public static buildTransferRequestPayload(
    options: TransferRequestBuilderOptions,
  ): Record<string, any> {
    return {
      transferType: options.transferType,
      sourceBranchId: options.sourceBranchId,
      sourceCounterId: options.sourceCounterId,
      destinationBranchId: options.destinationBranchId,
      destinationCounterId: options.destinationCounterId,
      billReference: options.billReference,
      transactionDate: options.transactionDate || new Date().toISOString().slice(0, 10),
      items: options.items.map((it) => ({
        currencyId: it.currencyId,
        productId: it.productId,
        quantity: String(it.quantity),
        rate: String(it.rate),
        per: it.per !== undefined ? String(it.per) : '1',
      })),
    };
  }
}
