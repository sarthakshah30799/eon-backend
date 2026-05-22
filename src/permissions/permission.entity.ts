// permission.entity.ts
import { Entity, Column } from "typeorm";
import { BaseEntity } from "../base/base.entity";

@Entity("permissions")
export class Permission extends BaseEntity {
  @Column({ type: "citext" })
  name: string;

  @Column({ type: "citext", unique: true })
  code: string;

  @Column({ type: "text", nullable: true })
  description: string;
}
