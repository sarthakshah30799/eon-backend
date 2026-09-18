import {
  buildPurposeCodeFromDescription,
  collapseMstPurposesByDescription,
  mapLegacyMstPurposeRow,
} from "./migration-tool.purpose";
import { SAMPLE_MST_PURPOSE } from "./fixtures/purpose.samples";

describe("migration-tool.purpose", () => {
  describe("buildPurposeCodeFromDescription", () => {
    it("uses first two letters for a single token", () => {
      expect(buildPurposeCodeFromDescription("FILMSHOOT")).toBe("FI");
      expect(buildPurposeCodeFromDescription("ENCASHMENT")).toBe("EN");
      expect(buildPurposeCodeFromDescription("REMTOUROPS")).toBe("RE");
    });

    it("uses initials of first two significant tokens", () => {
      expect(buildPurposeCodeFromDescription("FAMILY MAINTENANCE")).toBe("FM");
      expect(buildPurposeCodeFromDescription("EDUCATION-WITH LOAN")).toBe("EL");
      expect(buildPurposeCodeFromDescription("REMTOUROPS-T")).toBe("RT");
      expect(buildPurposeCodeFromDescription("REMTOUROPS-M")).toBe("RM");
    });

    it("always returns exactly two letters when description is usable", () => {
      const codes = [
        "FILMSHOOT",
        "PRIVVISIT",
        "HAJ SALES",
        "PRIZE MONEY",
        "A",
      ].map((d) => buildPurposeCodeFromDescription(d));
      for (const code of codes) {
        expect(code).toMatch(/^[A-Z]{2}$/);
      }
    });
  });

  describe("mapLegacyMstPurposeRow", () => {
    it("maps sell/purchase and corporate/individual from trn flags", () => {
      const saleCorp = mapLegacyMstPurposeRow(SAMPLE_MST_PURPOSE[0]);
      expect(saleCorp.sell).toBe(true);
      expect(saleCorp.purchase).toBe(false);
      expect(saleCorp.corporate).toBe(true);
      expect(saleCorp.individual).toBe(false);

      const buyIndiv = mapLegacyMstPurposeRow(SAMPLE_MST_PURPOSE[2]);
      expect(buyIndiv.sell).toBe(false);
      expect(buyIndiv.purchase).toBe(true);
      expect(buyIndiv.individual).toBe(true);
    });

    it("logs old PurposeCode and statutory fields as unmapped", () => {
      const mapped = mapLegacyMstPurposeRow(SAMPLE_MST_PURPOSE[0]);
      expect(
        mapped.unmapped.some((field) => field.sourceColumn === "PurposeCode"),
      ).toBe(true);
      expect(
        mapped.unmapped.some((field) => field.sourceColumn === "StatutoryCode"),
      ).toBe(true);
    });
  });

  describe("collapseMstPurposesByDescription", () => {
    it("collapses FILMSHOOT sale corp+indiv into one purpose with both flags", () => {
      const collapsed = collapseMstPurposesByDescription(
        SAMPLE_MST_PURPOSE.map((row) => mapLegacyMstPurposeRow(row)),
      );
      const film = collapsed.find((row) => row.descriptionKey === "FILMSHOOT");
      expect(film).toBeDefined();
      expect(film!.code).toBe("FI");
      expect(film!.sell).toBe(true);
      expect(film!.corporate).toBe(true);
      expect(film!.individual).toBe(true);
      expect(film!.legacyIds).toEqual(expect.arrayContaining(["1", "12"]));
    });

    it("keeps REMTOUROPS variants as separate 2-letter codes", () => {
      const collapsed = collapseMstPurposesByDescription(
        SAMPLE_MST_PURPOSE.map((row) => mapLegacyMstPurposeRow(row)),
      );
      const codes = collapsed
        .filter((row) => row.descriptionKey.startsWith("REMTOUROPS"))
        .map((row) => ({ description: row.description, code: row.code }));
      expect(codes).toEqual(
        expect.arrayContaining([
          { description: "REMTOUROPS", code: "RE" },
          { description: "REMTOUROPS-T", code: "RT" },
          { description: "REMTOUROPS-M", code: "RM" },
        ]),
      );
      const unique = new Set(codes.map((row) => row.code));
      expect(unique.size).toBe(codes.length);
    });

    it("merges ENCASHMENT buy corp+indiv into purchase+corporate+individual", () => {
      const collapsed = collapseMstPurposesByDescription(
        SAMPLE_MST_PURPOSE.map((row) => mapLegacyMstPurposeRow(row)),
      );
      const encash = collapsed.find(
        (row) => row.descriptionKey === "ENCASHMENT",
      );
      expect(encash!.purchase).toBe(true);
      expect(encash!.corporate).toBe(true);
      expect(encash!.individual).toBe(true);
      expect(encash!.code).toBe("EN");
    });

    it("never emits a code longer or shorter than 2 letters", () => {
      const collapsed = collapseMstPurposesByDescription(
        SAMPLE_MST_PURPOSE.map((row) => mapLegacyMstPurposeRow(row)),
      );
      for (const row of collapsed) {
        expect(row.code).toMatch(/^[A-Z]{2}$/);
      }
    });
  });
});
