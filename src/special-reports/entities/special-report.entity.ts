import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../base/base.entity";

@Index("UQ_special_reports_report_type", ["reportType"], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Entity("special_reports")
export class SpecialReport extends BaseEntity {
  @Column({ type: "citext", name: "report_type" })
  reportType: string;

  @Column({ type: "citext", name: "report_name" })
  reportName: string;

  @Column({ type: "text", name: "report_query" })
  reportQuery: string;

  @Column({ type: "boolean", default: true })
  active: boolean;
}
