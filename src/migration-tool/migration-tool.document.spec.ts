import {
  DOCUMENT_PROFILE_MAX_SIZE_MB_DEFAULT,
  disambiguateDocumentCode,
  mapLegacyScanDocMasterRow,
  mapScanForToSpecificationType,
} from "./migration-tool.document";
import { SAMPLE_SCAN_DOC_MASTER } from "./fixtures/document.samples";

describe("migration-tool.document", () => {
  it("maps M/T to MASTER/TRANSACTION", () => {
    expect(mapScanForToSpecificationType("M")).toBe("MASTER");
    expect(mapScanForToSpecificationType("T")).toBe("TRANSACTION");
    expect(mapScanForToSpecificationType("X")).toBeNull();
  });

  it("maps ScanDocMaster with defaults", () => {
    const mapped = mapLegacyScanDocMasterRow(SAMPLE_SCAN_DOC_MASTER[0]);
    expect(mapped.specificationType).toBe("TRANSACTION");
    expect(mapped.documentCode).toBe("PS");
    expect(mapped.maxSizeMb).toBe(DOCUMENT_PROFILE_MAX_SIZE_MB_DEFAULT);
    expect(mapped.documentType).toEqual(["PNG"]);
    expect(mapped.kycGroup).toBe("AGREEMENT");
    expect(mapped.skipReason).toBeNull();
  });

  it("disambiguates colliding document codes with nUniqCode", () => {
    const existing = new Set(["PS"]);
    const code = disambiguateDocumentCode("PS", "99", existing);
    expect(code).toBe("PS-99");
    expect(code.length).toBeLessThanOrEqual(50);
  });

  it("maps master scan-for row", () => {
    const mapped = mapLegacyScanDocMasterRow(SAMPLE_SCAN_DOC_MASTER[1]);
    expect(mapped.specificationType).toBe("MASTER");
    expect(mapped.documentCode).toBe("AC");
  });
});
