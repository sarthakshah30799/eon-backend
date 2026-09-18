import {
  MAIL_PASSWORD_DUMMY_PLAINTEXT,
  PASSWORD_POLICY_MAX_LENGTH_DEFAULT,
  collapseAdvSettingsByDataCode,
  inferAdvSettingValue,
  isPasswordPolicyChildCode,
  mapEodQuestionRow,
  mapMailConfigRow,
  mapPasswordPolicyRow,
  normalizeSettingCategoryCode,
} from "./migration-tool.settings";
import {
  SAMPLE_ADV_SETTINGS,
  SAMPLE_EOD_QUESTION,
  SAMPLE_MAIL_CONFIG,
  SAMPLE_PASSWORD_POLICY,
} from "./fixtures/settings.samples";

describe("migration-tool.settings", () => {
  describe("normalizeSettingCategoryCode", () => {
    it("uppercases and replaces spaces with underscores", () => {
      expect(normalizeSettingCategoryCode("General Options")).toBe(
        "GENERAL_OPTIONS",
      );
      expect(normalizeSettingCategoryCode("PASSWORD POLICY")).toBe(
        "PASSWORD_POLICY",
      );
    });
  });

  describe("inferAdvSettingValue", () => {
    it("maps Yes/No/Y/N to boolean", () => {
      expect(inferAdvSettingValue("YES")).toEqual({
        valueType: "boolean",
        valueBoolean: true,
        looksLikeEntityRef: false,
      });
      expect(inferAdvSettingValue("No")).toMatchObject({
        valueType: "boolean",
        valueBoolean: false,
      });
      expect(inferAdvSettingValue("Y")).toMatchObject({
        valueType: "boolean",
        valueBoolean: true,
      });
      expect(inferAdvSettingValue("N")).toMatchObject({
        valueType: "boolean",
        valueBoolean: false,
      });
    });

    it("maps integer and decimal from text", () => {
      expect(inferAdvSettingValue("100")).toEqual({
        valueType: "number",
        valueNumber: 100,
        looksLikeEntityRef: false,
      });
      expect(inferAdvSettingValue("7.5")).toEqual({
        valueType: "decimal",
        valueDecimal: 7.5,
        looksLikeEntityRef: false,
      });
    });

    it("does not trust DATATYPE=B when value is an account code", () => {
      const inferred = inferAdvSettingValue("DRDEBCTR");
      expect(inferred.valueType).toBe("text");
      expect(inferred.valueText).toBe("DRDEBCTR");
      expect(inferred.looksLikeEntityRef).toBe(true);
      expect(inferred.valueBoolean).toBeUndefined();
    });

    it("flags short alphanumeric product codes as entity refs", () => {
      expect(inferAdvSettingValue("CM").looksLikeEntityRef).toBe(true);
      expect(inferAdvSettingValue("TCS").looksLikeEntityRef).toBe(true);
    });
  });

  describe("collapseAdvSettingsByDataCode", () => {
    it("keeps BULKISSUER first wins CM over CC", () => {
      const { kept, skippedDuplicates } =
        collapseAdvSettingsByDataCode(SAMPLE_ADV_SETTINGS);
      const bulk = kept.find((row) => row.dataCode === "BULKISSUER");
      expect(bulk?.id).toBe(6542);
      expect(bulk?.row.DATAVALUE).toBe("CM");
      expect(
        skippedDuplicates.some(
          (item) =>
            item.dataCode === "BULKISSUER" &&
            item.lostDataValue === "CC" &&
            item.keptId === 6542,
        ),
      ).toBe(true);
      expect(
        skippedDuplicates.filter((item) => item.dataCode === "BULKISSUER"),
      ).toHaveLength(3);
    });

    it("keeps TCSACC with nBranchID 1 (collapse does not filter branch)", () => {
      const { kept } = collapseAdvSettingsByDataCode(SAMPLE_ADV_SETTINGS);
      const tcs = kept.find((row) => row.dataCode === "TCSACC");
      expect(tcs).toBeDefined();
      expect(tcs!.row.nBranchID).toBe(1);
      expect(tcs!.row.DATAVALUE).toBe("TCS");
    });
  });

  describe("isPasswordPolicyChildCode", () => {
    it("is true for PASSWORD_MIN_LENGTH etc., false for PWD*", () => {
      expect(isPasswordPolicyChildCode("PASSWORD_MIN_LENGTH")).toBe(true);
      expect(isPasswordPolicyChildCode("PASSWORD_MAX_LENGTH")).toBe(true);
      expect(isPasswordPolicyChildCode("PASSWORD_MIN_ALPHA_CHAR_COUNT")).toBe(
        true,
      );
      expect(isPasswordPolicyChildCode("PWDLEN")).toBe(false);
      expect(isPasswordPolicyChildCode("PWDALPHA")).toBe(false);
    });
  });

  describe("mapPasswordPolicyRow", () => {
    it("maps min fields and defaults maxLength to 128; logs nExpDate", () => {
      const mapped = mapPasswordPolicyRow(SAMPLE_PASSWORD_POLICY[0]);
      expect(mapped.minLength).toBe(8);
      expect(mapped.minAlpha).toBe(1);
      expect(mapped.minNumeric).toBe(1);
      expect(mapped.minSpecial).toBe(1);
      expect(mapped.maxLength).toBe(PASSWORD_POLICY_MAX_LENGTH_DEFAULT);
      expect(mapped.maxLength).toBe(128);
      expect(mapped.expDate).toBe(30);
      expect(
        mapped.unmapped.some((field) => field.sourceColumn === "nExpDate"),
      ).toBe(true);
    });
  });

  describe("mapMailConfigRow", () => {
    it("never returns source password; uses MIGRATE_RESET dummy", () => {
      const mapped = mapMailConfigRow(SAMPLE_MAIL_CONFIG[0]);
      expect(mapped.passwordPlaintext).toBe(MAIL_PASSWORD_DUMMY_PLAINTEXT);
      expect(mapped.passwordPlaintext).toBe("MIGRATE_RESET");
      expect(mapped.passwordPlaintext).not.toBe("SOURCE_SECRET_DO_NOT_COPY");
      expect(JSON.stringify(mapped)).not.toContain("SOURCE_SECRET_DO_NOT_COPY");
      expect(mapped.username).toBe("bpia.nium@Instarem.co.in");
      expect(mapped.host).toBe("smtp.office365.com");
      expect(mapped.port).toBe(25);
      expect(mapped.senderEmail).toBe("AUTOREPORT");
      expect(
        mapped.unmapped.some((field) => field.sourceColumn === "vSmtpPassword"),
      ).toBe(true);
      expect(
        mapped.unmapped.some((field) => field.sourceColumn === "bEnablessl"),
      ).toBe(true);
    });
  });

  describe("mapEodQuestionRow", () => {
    it("builds EOD_Q_{id} codes for DAY_END_POLICY children", () => {
      const mapped = SAMPLE_EOD_QUESTION.map((row) => mapEodQuestionRow(row));
      expect(mapped[0].code).toBe("EOD_Q_3");
      expect(mapped[0].label).toMatch(/Purchase & Sales/);
      expect(mapped[0].active).toBe(true);
      expect(mapped[2].code).toBe("EOD_Q_6");
      expect(mapped[2].active).toBe(false);
    });
  });
});
