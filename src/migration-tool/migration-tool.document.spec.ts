import { DocumentSpecificationType } from "../document-profiles/document-profile.entity";
import {
  DOCUMENT_PROFILE_DOCUMENT_TYPE_DEFAULT,
  DOCUMENT_PROFILE_MAX_SIZE_MB_DEFAULT,
  disambiguateDocumentCode,
  mapScanDocMasterRow,
} from "./migration-tool.document";
import { SAMPLE_SCAN_DOC_MASTER } from "./fixtures/document.samples";

describe("migration-tool.document", () => {
  describe("mapScanDocMasterRow", () => {
    it("maps master/transaction, defaults, and category refs", () => {
      const txn = mapScanDocMasterRow(SAMPLE_SCAN_DOC_MASTER[0]);
      expect(txn.specificationType).toBe(
        DocumentSpecificationType.TRANSACTION,
      );
      expect(txn.documentCode).toBe("PS");
      expect(txn.description).toBe("PASSPORT FOR PS");
      expect(txn.isRequired).toBe(false);
      expect(txn.sortOrder).toBe(1);
      expect(txn.active).toBe(true);
      expect(txn.isDeleted).toBe(false);
      expect(txn.groupCode).toBe("AGREEMENT");
      expect(txn.entityCode).toBe("PS");
      expect(txn.financialYearCode).toBe("24-25");
      expect(txn.maxSizeMb).toBe(DOCUMENT_PROFILE_MAX_SIZE_MB_DEFAULT);
      expect(txn.maxSizeMb).toBe(5);
      expect(txn.documentType).toEqual([
        ...DOCUMENT_PROFILE_DOCUMENT_TYPE_DEFAULT,
      ]);
      expect(txn.skipReason).toBeNull();

      const master = mapScanDocMasterRow(SAMPLE_SCAN_DOC_MASTER[3]);
      expect(master.specificationType).toBe(DocumentSpecificationType.MASTER);
      expect(master.documentCode).toBe("AC");
      expect(master.groupCode).toBe("NONKYC");
    });

    it("skips unknown vScanFor", () => {
      const skipped = mapScanDocMasterRow(SAMPLE_SCAN_DOC_MASTER[8]);
      expect(skipped.skipReason).toMatch(/vScanFor/);
      expect(skipped.specificationType).toBeNull();
    });
  });

  describe("disambiguateDocumentCode", () => {
    it("suffixes uniqCode on collision and truncates to 50", () => {
      const existing = new Set<string>();
      const first = disambiguateDocumentCode("PS", 1, existing);
      existing.add(first);
      expect(first).toBe("PS");

      const collision = SAMPLE_SCAN_DOC_MASTER[7];
      const second = disambiguateDocumentCode(
        String(collision.vDocumentCode),
        collision.nUniqCode,
        existing,
      );
      expect(second).toBe("PS-99");
      existing.add(second);

      const longBase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMN";
      existing.add(longBase);
      const truncated = disambiguateDocumentCode(longBase, "99999", existing);
      expect(truncated.length).toBeLessThanOrEqual(50);
      expect(truncated.startsWith("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")).toBe(
        true,
      );
    });
  });
});
