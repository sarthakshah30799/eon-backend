import { Column, Entity } from "typeorm";
import { BaseEntity } from "../base/base.entity";

@Entity("states")
export class State extends BaseEntity {
  @Column({ type: "citext", unique: true })
  code: string;

  @Column({ type: "citext" })
  name: string;

  @Column({ type: "citext", nullable: true })
  gstCode: string;

  @Column({ type: "citext", nullable: true })
  ctrCode: string;
}
