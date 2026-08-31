import { BadRequestException } from "@nestjs/common";
import { Company } from "../../company/company.entity";
import { CompanyService } from "../../company/company.service";
import { toUtcDateOnly } from "../date/date.util";

export async function requireCompanyForDate(
  companyService: CompanyService,
  date: Date | string | null | undefined,
): Promise<{ company: Company; snapshot: Company }> {
  const referenceDate = toUtcDateOnly(date);
  const company = await companyService.getCurrentCompany(referenceDate);
  if (!company) {
    throw new BadRequestException("Current company not found");
  }
  const snapshot =
    await companyService.getCurrentCompanySnapshot(referenceDate);
  if (!snapshot) {
    throw new BadRequestException("Current company snapshot not found");
  }
  return { company, snapshot };
}
