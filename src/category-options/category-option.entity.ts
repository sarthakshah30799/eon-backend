import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../base/base.entity";

@Index(["code", "value"], { unique: true })
@Index(["code", "isActive"])
@Entity("category_options")
export class SelectOption extends BaseEntity {
  @Column({ type: "citext" })
  code: string;

  @Column({ type: "citext" })
  value: string;

  @Column({ type: "citext" })
  label: string;

  @Column({ type: "int", default: 0 })
  sortOrder: number;

  @Column({ type: "boolean", default: true })
  isActive: boolean;
}
