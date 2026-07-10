import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { Company } from "../company/company.entity";
import { TransactionTypeProfileEnum } from "../transactions/transactions.enums";

export enum NodeType {
  Category = "category",
  Setting = "setting",
}

export enum ValueType {
  Boolean = "boolean",
  Text = "text",
  Number = "number",
  Decimal = "decimal",
  Date = "date",
  Select = "select",
  Json = "json",
}

@Index(["companyId", "code"], { unique: true })
@Index(["companyId", "parentId", "sortOrder"])
@Index(["companyId", "nodeType", "isActive"])
@Check(
  "CHK_advanced_settings_transaction_number_series_length",
  `UPPER("code") NOT IN (${Object.values(TransactionTypeProfileEnum)
    .map(code => `'${code}'`)
    .join(', ')}) OR "value_number" IS NULL OR "value_number" BETWEEN 0 AND 999999999`
)
@Entity("advanced_settings")
export class AdvancedSetting extends BaseEntity {
  @ManyToOne(() => Company, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "company_id" })
  company: Company;

  @Column({ name: "company_id", type: "uuid" })
  companyId: string;

  @ManyToOne(() => AdvancedSetting, (setting) => setting.children, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "parent_id" })
  parent: AdvancedSetting;

  @Column({ name: "parent_id", type: "uuid", nullable: true })
  parentId: string;

  @OneToMany(() => AdvancedSetting, (setting) => setting.parent, {
    cascade: true,
  })
  children: AdvancedSetting[];

  @Column({ type: "citext" })
  code: string;

  @Column({ type: "citext" })
  label: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({
    type: "enum",
    enum: NodeType,
    default: NodeType.Setting,
  })
  nodeType: NodeType;

  @Column({
    type: "enum",
    enum: ValueType,
    nullable: true,
  })
  valueType: ValueType;

  @Column({ type: "boolean", name: "value_boolean", nullable: true })
  valueBoolean: boolean;

  @Column({ type: "citext", name: "value_text", nullable: true })
  valueText: string;

  @Column({ type: "integer", name: "value_number", nullable: true })
  valueNumber: number;

  @Column({ type: "numeric", name: "value_decimal", nullable: true })
  valueDecimal: number;

  @Column({ type: "timestamptz", name: "value_date", nullable: true })
  valueDate: Date;

  @Column({ type: "jsonb", name: "value_json", nullable: true })
  valueJson: any;

  @Column({ type: "integer", name: "sort_order", default: 0 })
  sortOrder: number;

  @Column({ type: "boolean", name: "is_active", default: true })
  isActive: boolean;
}
