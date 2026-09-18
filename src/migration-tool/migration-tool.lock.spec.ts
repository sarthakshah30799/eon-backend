import {
  mapLegacyMonthLockRow,
  mapLegacyMonthLockUserLink,
  pickFirstMonthLockPerBranch,
} from "./migration-tool.lock";
import {
  SAMPLE_MLOCK_BRN_USER_LINK,
  SAMPLE_MONTHLOCK,
} from "./fixtures/lock.samples";

describe("migration-tool.lock", () => {
  it("maps soft-deleted monthlock with OPEN* unmapped", () => {
    const mapped = mapLegacyMonthLockRow(SAMPLE_MONTHLOCK[0]);
    expect(mapped.isDeleted).toBe(true);
    expect(mapped.branchCode).toBe("AHMD");
    expect(mapped.fromDate).toBe("2025-03-31");
    expect(mapped.unmapped.some((u) => u.sourceColumn === "OPENACCOUNT")).toBe(
      true,
    );
    expect(mapped.skipReason).toBeNull();
  });

  it("picks first lock per branch by lowest id", () => {
    const mapped = SAMPLE_MONTHLOCK.map((row) => mapLegacyMonthLockRow(row));
    const { selected, skipped } = pickFirstMonthLockPerBranch(mapped);
    expect(selected).toHaveLength(1);
    expect(selected[0].oldId).toBe(399);
    expect(skipped.some((row) => row.oldId === 400)).toBe(true);
  });

  it("maps user links without monthlock FK", () => {
    const link = mapLegacyMonthLockUserLink(SAMPLE_MLOCK_BRN_USER_LINK[1]);
    expect(link.userOldId).toBe(2039);
    expect(link.branchCode).toBe("AHMD");
    expect(link.isActive).toBe(true);
    expect(link.skipReason).toBeNull();
  });
});
