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
  SAMPLE_ADVSETTINGS,
  SAMPLE_EOD_QUESTIONS,
  SAMPLE_MAIL_CONFIG,
  SAMPLE_PASSWORD_POLICY,
} from "./fixtures/settings.samples";

describe("migration-tool.settings", () => {
  describe("inferAdvSettingValue", () => {
    it("maps Yes/No to boolean", () => {
      const v = inferAdvSettingValue("YES");
      expect(v.valueType).toBe("boolean");
      expect(v.valueBoolean).toBe(true);
      expect(v.looksLikeEntityRef).toBe(false);
    });

    it("does not treat DATATYPE=B account codes as boolean", () => {
      const v = inferAdvSettingValue("DRDEBCTR");
      expect(v.valueType).toBe("text");
      expect(v.valueBoolean).toBeNull();
      expect(v.looksLikeEntityRef).toBe(true);
      expect(v.valueText).toBe("DRDEBCTR");
    });

    it("maps decimals and integers", () => {
      expect(inferAdvSettingValue("0.8125").valueType).toBe("decimal");
      expect(inferAdvSettingValue("100").valueType).toBe("number");
    });
  });

  describe("collapseAdvSettingsByDataCode", () => {
    it("keeps first BULKISSUER=CM and skips CC", () => {
      const { kept, skippedDuplicates } =
        collapseAdvSettingsByDataCode(SAMPLE_ADVSETTINGS);
      const bulk = kept.find((row) => row.dataCode === "BULKISSUER");
      expect(bulk?.dataValueRaw).toBe("CM");
      expect(
        skippedDuplicates.some(
          (row) =>
            row.dataCode === "BULKISSUER" && row.lostValue === "CC",
        ),
      ).toBe(true);
    });

    it("keeps TCSACC with nBranchID=1", () => {
      const { kept } = collapseAdvSettingsByDataCode(SAMPLE_ADVSETTINGS);
      const tcs = kept.find((row) => row.dataCode === "TCSACC");
      expect(tcs).toBeDefined();
      expect(tcs?.nBranchId).toBe("1");
      expect(tcs?.dataValueRaw).toBe("TCS");
    });

    it("infers DIRREMSLAC as entity ref not boolean", () => {
      const { kept } = collapseAdvSettingsByDataCode(SAMPLE_ADVSETTINGS);
      const row = kept.find((item) => item.dataCode === "DIRREMSLAC");
      expect(row?.inferred.valueType).toBe("text");
      expect(row?.inferred.looksLikeEntityRef).toBe(true);
    });
  });

  describe("password / mail / eod", () => {
    it("maps password policy with maxLength default 128 and logs nExpDate", () => {
      const mapped = mapPasswordPolicyRow(SAMPLE_PASSWORD_POLICY[0]);
      expect(mapped.minLength).toBe(8);
      expect(mapped.maxLength).toBe(PASSWORD_POLICY_MAX_LENGTH_DEFAULT);
      expect(mapped.maxLength).toBe(128);
      expect(mapped.unmapped.some((u) => u.sourceColumn === "nExpDate")).toBe(
        true,
      );
    });

    it("never returns source SMTP password", () => {
      const mapped = mapMailConfigRow(SAMPLE_MAIL_CONFIG[0]);
      expect(mapped.passwordPlaintext).toBe(MAIL_PASSWORD_DUMMY_PLAINTEXT);
      expect(mapped.passwordPlaintext).not.toBe("SOURCE_SECRET_DO_NOT_COPY");
      expect(mapped.sourcePasswordPresent).toBe(true);
      expect(mapped.username).toBe("bpia.nium@example.com");
    });

    it("maps EOD questions to EOD_Q_{id}", () => {
      const mapped = mapEodQuestionRow(SAMPLE_EOD_QUESTIONS[0]);
      expect(mapped.code).toBe("EOD_Q_3");
      expect(mapped.skipReason).toBeNull();
    });

    it("treats PASSWORD_* as reserved child codes", () => {
      expect(isPasswordPolicyChildCode("PASSWORD_MIN_LENGTH")).toBe(true);
      expect(isPasswordPolicyChildCode("PWDALPHA")).toBe(false);
    });

    it("normalizes messy category labels", () => {
      expect(normalizeSettingCategoryCode("GENRAL OPTIONS")).toBe(
        "GENRAL_OPTIONS",
      );
      expect(normalizeSettingCategoryCode("")).toBe("GENERAL_OPTIONS");
    });
  });
});
