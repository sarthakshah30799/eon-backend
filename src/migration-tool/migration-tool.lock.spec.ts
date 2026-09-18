import {
  mapMLockBrnUserLinkRow,
  mapMonthLockRow,
  pickFirstMonthLockPerBranch,
} from "./migration-tool.lock";
import {
  SAMPLE_MLOCK_BRN_USER_LINK,
  SAMPLE_MONTH_LOCK,
} from "./fixtures/lock.samples";

describe("migration-tool.lock", () => {
  describe("mapMonthLockRow", () => {
    it("maps soft-deleted monthlock with isDeleted true and logs OPEN*", () => {
      const mapped = mapMonthLockRow(SAMPLE_MONTH_LOCK[0]);
      expect(mapped.oldId).toBe("399");
      expect(mapped.branchCode).toBe("AHMD");
      expect(mapped.fromDate).toBe("2025-03-31");
      expect(mapped.toDate).toBe("2025-03-31");
      expect(mapped.isDeleted).toBe(true);
      expect(mapped.skipReason).toBeNull();
      expect(
        mapped.unmapped.map((field) => field.sourceColumn).sort(),
      ).toEqual(["CASHTXN", "OPENACCOUNT", "OPENTRADING"]);
    });
  });

  describe("pickFirstMonthLockPerBranch", () => {
    it("picks lowest nMonthLockID per branch including soft-deleted", () => {
      const mapped = SAMPLE_MONTH_LOCK.map((row) => mapMonthLockRow(row));
      const { selected, skipped } = pickFirstMonthLockPerBranch(mapped);

      const ahmd = selected.find((row) => row.branchCode === "AHMD");
      expect(ahmd?.oldId).toBe("399");
      expect(ahmd?.isDeleted).toBe(true);

      const bomb = selected.find((row) => row.branchCode === "BOMB");
      expect(bomb?.oldId).toBe("500");
      expect(bomb?.isDeleted).toBe(false);

      expect(selected).toHaveLength(2);
      expect(
        skipped.some(
          (item) =>
            item.row.oldId === "400" &&
            /kept lowest nMonthLockID 399/.test(item.reason),
        ),
      ).toBe(true);
    });
  });

  describe("mapMLockBrnUserLinkRow", () => {
    it("maps branch/user link and notes branch-only join to first lock", () => {
      const mapped = mapMLockBrnUserLinkRow(SAMPLE_MLOCK_BRN_USER_LINK[0]);
      expect(mapped.oldId).toBe("2509");
      expect(mapped.branchId).toBe("1");
      expect(mapped.branchCode).toBe("AHMD");
      expect(mapped.userId).toBe("2038");
      expect(mapped.isActive).toBe(false);
      expect(mapped.isDeleted).toBe(false);
      expect(mapped.note).toMatch(/join by branch only/);
      expect(mapped.skipReason).toBeNull();

      const deleted = mapMLockBrnUserLinkRow(SAMPLE_MLOCK_BRN_USER_LINK[2]);
      expect(deleted.isActive).toBe(true);
      expect(deleted.isDeleted).toBe(true);
    });
  });
});
