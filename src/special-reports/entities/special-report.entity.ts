import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../base/base.entity";

@Index("UQ_special_reports_type", ["type"], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Entity("special_reports")
export class SpecialReport extends BaseEntity {
  @Column({ type: "citext" })
  type: string;

  @Column({ type: "citext" })
  name: string;

  @Column({ type: "text" })
  query: string;

  @Column({ type: "boolean", default: true })
  active: boolean;
}
