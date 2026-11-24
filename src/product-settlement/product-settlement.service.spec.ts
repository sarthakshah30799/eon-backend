import { BadRequestException } from "@nestjs/common";
import { ProductSettlementService } from "./product-settlement.service";
import { ProductSettlement } from "./entities/product-settlement.entity";
import {
  ProductSettlementStatus,
  ProductSettlementType,
} from "./product-settlement.enums";

describe("ProductSettlementService - TP Availability & Issuer Sale", () => {
  let service: ProductSettlementService;

  const mockProductSettlementRepo = {
    find: jest.fn(),
    update: jest.fn(),
    create: jest.fn((entity) => ({ ...entity, id: "created-clone-id" })),
    save: jest.fn((entity) => Promise.resolve({ ...entity, id: entity.id || "saved-id" })),
  };

  const mockQb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  };

  const mockRepoWithQb = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  };

  const mockDatabase2 = {
    getRepository: jest.fn().mockReturnValue(mockRepoWithQb),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductSettlementService(
      mockDatabase2 as never,
      mockProductSettlementRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  describe("getTpAvailability", () => {
    it("should throw BadRequestException if currencyId is missing", async () => {
      await expect(
        service.getTpAvailability({
          currencyId: "",
          hoBranchId: "ho-branch-1",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should query product_settlements for PENDING_ISSUER_SETTLEMENT TP items and return formatted availableQuantity and itemCount", async () => {
      mockQb.getRawOne.mockResolvedValue({
        availableQuantity: "450.0000000",
        itemCount: "3",
      });

      const result = await service.getTpAvailability({
        currencyId: "curr-usd",
        issuerPartyProfileId: "issuer-amex",
        hoBranchId: "ho-branch-1",
      });

      expect(mockDatabase2.getRepository).toHaveBeenCalledWith(ProductSettlement);
      expect(mockQb.select).toHaveBeenCalledWith(
        "COALESCE(SUM(s.denomination), 0)",
        "availableQuantity",
      );
      expect(mockQb.addSelect).toHaveBeenCalledWith("COUNT(s.id)", "itemCount");
      expect(mockQb.where).toHaveBeenCalledWith("s.deleted_at IS NULL");
      expect(mockQb.andWhere).toHaveBeenCalledWith("s.type = :type", {
        type: ProductSettlementType.TP,
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith("s.status = :status", {
        status: ProductSettlementStatus.PENDING_ISSUER_SETTLEMENT,
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        "s.currency_id = :currencyId",
        { currencyId: "curr-usd" },
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        "(s.ho_branch_id = :hoBranchId OR s.branch_id = :hoBranchId)",
        { hoBranchId: "ho-branch-1" },
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        "s.issuer_party_profile_id = :issuerPartyProfileId",
        { issuerPartyProfileId: "issuer-amex" },
      );

      expect(result).toEqual({
        availableQuantity: "450.0000000",
        itemCount: 3,
      });
    });

    it("should return 0.0000000 and count 0 when no rows are found", async () => {
      mockQb.getRawOne.mockResolvedValue(null);

      const result = await service.getTpAvailability({
        currencyId: "curr-eur",
        hoBranchId: "ho-branch-1",
      });

      expect(result).toEqual({
        availableQuantity: "0.0000000",
        itemCount: 0,
      });
    });
  });

  describe("finalizeTpIssuerSale", () => {
    it("should settle exact or smaller open lot without creating clone", async () => {
      const mockManager = {
        getRepository: jest.fn().mockReturnValue(mockProductSettlementRepo),
      };

      const openLot = {
        id: "lot-1",
        denomination: "100.0000000",
        buyRate: "90.0000000",
        series: "TP-001",
        currencyId: "curr-usd",
        issuerPartyProfileId: "issuer-amex",
        status: ProductSettlementStatus.PENDING_ISSUER_SETTLEMENT,
      };

      mockProductSettlementRepo.find.mockResolvedValue([openLot]);

      const transaction = {
        branchId: "ho-branch-1",
        partyProfileId: "issuer-amex",
      };
      const items = [
        {
          currencyId: "curr-usd",
          quantity: "100",
          rate: "95.0000000",
          issuerPartyProfileId: "issuer-amex",
        },
      ];

      await service.finalizeTpIssuerSale(
        mockManager as never,
        transaction as never,
        items as never,
        "actor-1",
      );

      expect(mockProductSettlementRepo.update).toHaveBeenCalledWith(
        "lot-1",
        expect.objectContaining({
          status: ProductSettlementStatus.ISSUER_SETTLED,
          updatedBy: "actor-1",
        }),
      );
      expect(mockProductSettlementRepo.save).not.toHaveBeenCalled();
    });

    it("should split lot when selling a partial amount (e.g. 300 out of 400 lot)", async () => {
      const mockManager = {
        getRepository: jest.fn().mockReturnValue(mockProductSettlementRepo),
      };

      const openLot = {
        id: "lot-large",
        type: ProductSettlementType.TP,
        denomination: "400.0000000",
        buyRate: "90.0000000",
        series: "TP-002",
        currencyId: "curr-usd",
        issuerPartyProfileId: "issuer-amex",
        status: ProductSettlementStatus.PENDING_ISSUER_SETTLEMENT,
        branchId: "branch-a",
        hoBranchId: "ho-branch-1",
        productId: "prod-tp",
        branchDocumentId: "doc-1",
        hoAcceptedAt: new Date("2026-11-20"),
        hoAcceptedById: "actor-ho",
      };

      mockProductSettlementRepo.find.mockResolvedValue([openLot]);

      const transaction = {
        branchId: "ho-branch-1",
        partyProfileId: "issuer-amex",
      };
      // Selling 300 out of 400
      const items = [
        {
          currencyId: "curr-usd",
          quantity: "300",
          rate: "96.0000000",
          issuerPartyProfileId: "issuer-amex",
        },
      ];

      await service.finalizeTpIssuerSale(
        mockManager as never,
        transaction as never,
        items as never,
        "actor-1",
      );

      // Existing row is updated to sold portion (300) with ISSUER_SETTLED
      expect(mockProductSettlementRepo.update).toHaveBeenCalledWith(
        "lot-large",
        expect.objectContaining({
          denomination: "300.00",
          settlementAmount: (300 * 90).toFixed(2),
          status: ProductSettlementStatus.ISSUER_SETTLED,
          updatedBy: "actor-1",
        }),
      );

      // Clone row is created for the remaining 100 with PENDING_ISSUER_SETTLEMENT
      expect(mockProductSettlementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ProductSettlementType.TP,
          denomination: "100.00",
          series: "TP-002-REM",
          status: ProductSettlementStatus.PENDING_ISSUER_SETTLEMENT,
          settlementAmount: (100 * 90).toFixed(2),
          createdBy: "actor-1",
          updatedBy: "actor-1",
        }),
      );
      expect(mockProductSettlementRepo.save).toHaveBeenCalled();
    });
  });
});
