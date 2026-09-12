import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  AccountPostingCombinedRow,
  AccountPostingsCombinedQueryInput,
} from "./account-postings-combined.types";

const toText = (value: unknown) => String(value ?? "").trim();

const toJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const mapRow = (row: Record<string, unknown>): AccountPostingCombinedRow => {
  const direction = toText(row.direction).toUpperCase();
  const documentKind = toText(row.documentKind).toUpperCase();
  return {
    documentKind:
      documentKind === "VOUCHER" ? "VOUCHER" : "TRANSACTION",
    postingId: toText(row.postingId),
    documentId: toText(row.documentId),
    documentNumber: toText(row.documentNumber) || null,
    documentType: toText(row.documentType),
    transactionDate: toText(row.transactionDate).slice(0, 10),
    branchId: toText(row.branchId),
    accountId: toText(row.accountId),
    accountSnapshot: toJsonObject(row.accountSnapshot),
    profileId: toText(row.profileId) || null,
    profileSnapshot: toJsonObject(row.profileSnapshot),
    direction: direction === "CREDIT" ? "CREDIT" : "DEBIT",
    amount: toText(row.amount) || "0",
    remarks: toText(row.remarks) || null,
    lineNo: Number(row.lineNo ?? 0) || 0,
    sourceType: toText(row.sourceType),
    sourceId: toText(row.sourceId) || null,
    linkedTransactionId: toText(row.linkedTransactionId) || null,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : toText(row.createdAt),
    partySnapshot: toJsonObject(row.partySnapshot),
    narration: toText(row.narration) || null,
    chequeNumber: toText(row.chequeNumber) || null,
    chequeDate: toText(row.chequeDate).slice(0, 10) || null,
    tradeMode: toText(row.tradeMode) || null,
  };
};

@Injectable()
export class AccountPostingsCombinedQuery {
  constructor(
    @InjectDataSource("database2")
    private readonly dataSource: DataSource,
  ) {}

  async list(
    input: AccountPostingsCombinedQueryInput,
  ): Promise<AccountPostingCombinedRow[]> {
    const qb = this.dataSource
      .createQueryBuilder()
      .select([
        `p.document_kind AS "documentKind"`,
        `p.posting_id AS "postingId"`,
        `p.document_id AS "documentId"`,
        `p.document_number AS "documentNumber"`,
        `p.document_type AS "documentType"`,
        `p.transaction_date AS "transactionDate"`,
        `p.branch_id AS "branchId"`,
        `p.account_id AS "accountId"`,
        `p.account_snapshot AS "accountSnapshot"`,
        `p.profile_id AS "profileId"`,
        `p.profile_snapshot AS "profileSnapshot"`,
        `p.direction AS "direction"`,
        `p.amount AS "amount"`,
        `p.remarks AS "remarks"`,
        `p.line_no AS "lineNo"`,
        `p.source_type AS "sourceType"`,
        `p.source_id AS "sourceId"`,
        `p.linked_transaction_id AS "linkedTransactionId"`,
        `p.created_at AS "createdAt"`,
        `p.party_snapshot AS "partySnapshot"`,
        `p.narration AS "narration"`,
        `p.cheque_number AS "chequeNumber"`,
        `p.cheque_date AS "chequeDate"`,
        `p.trade_mode AS "tradeMode"`,
      ])
      .from("account_postings_combined", "p");

    if (input.branchIds?.length) {
      qb.andWhere("p.branch_id IN (:...branchIds)", {
        branchIds: input.branchIds,
      });
    }
    if (input.accountIds?.length) {
      qb.andWhere("p.account_id IN (:...accountIds)", {
        accountIds: input.accountIds,
      });
    }
    if (input.documentNumbers?.length) {
      qb.andWhere("p.document_number IN (:...documentNumbers)", {
        documentNumbers: input.documentNumbers,
      });
    }
    if (input.beforeDate) {
      qb.andWhere("p.transaction_date < :beforeDate", {
        beforeDate: input.beforeDate,
      });
    } else {
      if (input.startDate) {
        qb.andWhere("p.transaction_date >= :startDate", {
          startDate: input.startDate,
        });
      }
      if (input.endDate) {
        qb.andWhere("p.transaction_date <= :endDate", {
          endDate: input.endDate,
        });
      }
    }

    qb.orderBy("p.transaction_date", "ASC")
      .addOrderBy("p.created_at", "ASC")
      .addOrderBy("p.document_number", "ASC")
      .addOrderBy("p.line_no", "ASC");

    const rows = await qb.getRawMany<Record<string, unknown>>();
    return rows.map(mapRow);
  }
}
