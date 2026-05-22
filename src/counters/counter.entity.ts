// counter.entity.ts
import { Entity, Column, Index } from "typeorm";
import { BaseEntity } from "../base/base.entity";

export enum CounterStatus {
  PENDING = "pending",
  ACTIVE = "active",
  INACTIVE = "inactive",
}

@Entity("counters")
export class Counter extends BaseEntity {
  @Column({ type: "citext", unique: true })
  counterCode: string;

  @Column({ type: "citext" })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "text", nullable: true })
  remark: string;

  @Index()
  @Column({ type: "enum", enum: CounterStatus, default: CounterStatus.PENDING })
  status: CounterStatus;
}
