import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  TransactionTaxPreviewDto,
  PurchaseRulePreviewDto,
} from "./transaction-preview.dto";

describe("TransactionTaxPreviewDto", () => {
  it("validates tax-preview payload containing taxRatePercent, branchStateName, partyStateName, finalAmount, and applyTax", async () => {
    const rawPayload = {
      transactionType: "PURCHASE",
      branchId: "7cec6c37-e769-499b-9092-460eb67a5815",
      partyProfileId: "4df3d390-c5f7-4ed4-8c7e-71d65c3ce21b",
      partyProfileApplyTax: true,
      taxRatePercent: "18",
      branchStateName: "MAHARASHTRA",
      partyStateName: "GUJARAT",
      items: [
        {
          quantity: "400",
          rate: "94.0000000",
          per: "1",
          finalAmount: "37600.00",
        },
      ],
      additionalCharges: [
        {
          amount: "5.00",
          applyTax: true,
        },
      ],
    };

    const instance = plainToInstance(TransactionTaxPreviewDto, rawPayload);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(0);
    expect(instance.taxRatePercent).toBe("18");
    expect(instance.branchStateName).toBe("MAHARASHTRA");
    expect(instance.partyStateName).toBe("GUJARAT");
    expect(instance.items?.[0]?.finalAmount).toBe("37600.00");
    expect(instance.additionalCharges?.[0]?.applyTax).toBe(true);
  });

  it("validates purchase-rule-preview payload with wrapped transaction object", async () => {
    const rawPayload = {
      transaction: {
        branchId: "7cec6c37-e769-499b-9092-460eb67a5815",
        counterId: "f4a1d4b1-e0ac-430d-8c16-18d8a503ef2a",
        branchSnapshot: {
          id: "7cec6c37-e769-499b-9092-460eb67a5815",
          code: "ANDHI",
          name: "ANDHERI BRANCH",
          label: "ANDHI - ANDHERI BRANCH",
        },
        requiresApproval: false,
        slug: "PURCHASE_CORPORATE_INDIVIDUAL",
        transactionDate: "2026-11-21",
        partyProfileId: "4df3d390-c5f7-4ed4-8c7e-71d65c3ce21b",
        transactionPartyProfileType: "INDIVIDUAL",
        purposeId: null,
        agentProfileId: null,
        loanAmount: null,
        declaredAmount: null,
        preTcsFinalAmount: null,
        tcsRatePercent: null,
        tcsRateType: null,
        tcsAmount: null,
        itrFiled: false,
        tcsDeclarationAccepted: false,
        isProprietorship: false,
        cdfNo: null,
        cdfIssuingAuthority: null,
        cdfApprovedUsd: null,
        cdfArrivalDate: null,
        passenger: {
          entityType: "INDIVIDUAL",
          nationalityType: "INDIAN",
          residentStatus: "RESIDENT",
          countryId: "fe4828db-f0bf-4d04-aa36-553dbade8339",
          stateId: "17d2d314-d93d-44f4-81a6-6db4d80c9052",
          locationId: null,
          city: null,
          address1: null,
          address2: null,
          email: null,
          contactNo: null,
          panNumber: "ITZPS1468G",
          panHolderName: "SARTHAK SHAH",
          panDob: "1999-07-30",
          panHolderRelationType: "SELF",
          paidByPanNumber: "ITZPS1468G",
          paidByPanHolderName: "SARTHAK SHAH",
          paidByPanDob: "1999-07-30",
          gstNumber: null,
          gstStateId: null,
          passportNumber: null,
          passportPassengerName: null,
          passportIssueAt: null,
          passportIssueDate: null,
          passportExpiryDate: null,
          arrivalDate: null,
          isPep: false,
          id: "cbf0feac-08cc-4825-8260-0cc5420dfec0",
          otherDocuments: [],
        },
        passengerTravel: null,
        manualBookPageId: null,
        manualBookPageSnapshot: null,
        transactionType: "PURCHASE",
        tradeMode: "RETAIL",
        remarks: null,
        tourPassengers: [],
        items: [
          {
            currencyId: "44567961-06a4-4b91-869e-3dfbe1eb5ad3",
            productId: "c1fab73b-cadc-44f0-ace2-8ed8d7510f12",
            quantity: "400",
            per: "1",
            rate: "94.0000000",
            commission: null,
            commissionSnapshot: null,
            pricingRuleSnapshot: null,
            remarks: null,
            cardId: null,
            issuerPartyProfileId: "c7118c97-5254-4ef2-93fb-d03df36c2e0c",
            issuerPartyProfileSnapshot: {
              id: "c7118c97-5254-4ef2-93fb-d03df36c2e0c",
              code: "NEWCM",
              name: "NEW MULTI CARD",
            },
            cardSnapshot: null,
            isReload: false,
            autoSurrender: true,
            dealCoverId: null,
            dealCoverSnapshot: null,
          },
        ],
        documents: [],
        additionalCharges: [
          {
            accountId: "421aeca3-87c5-417e-be92-383b70fce16f",
            amount: "5.00",
            gstRate: 18,
            gstAmount: 0.9,
            applyTax: true,
            remarks: null,
          },
        ],
        payments: [
          {
            accountId: "",
            paymentMethod: "CHEQUE",
            amount: "37526.42",
          },
        ],
        ttRemittance: null,
      },
    };

    const instance = plainToInstance(PurchaseRulePreviewDto, rawPayload);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(0);
    expect(instance.transaction).toBeDefined();
  });
});
