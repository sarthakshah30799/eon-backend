// user.entity.ts
import { Entity, Column, Index } from "typeorm";
import { BaseEntity } from "../base/base.entity";

export enum UserStatus {
  PENDING = "pending",
  ACTIVE = "active",
  INACTIVE = "inactive",
}

@Entity("users")
export class User extends BaseEntity {
  @Column({ type: "citext", unique: true })
  userCode: string;

  @Column()
  password: string;

  @Column({ type: "citext" })
  firstName: string;
  
  @Column({ type: "citext" })
  lastName: string;

  @Index()
  @Column({ type: "citext", unique: true })
  email: string;

  @Column({ type: "char", length: 2, default: "IN" })
  countryCode: string;

  @Column({ type: "text" })
  phoneNumber: string;

  @Index()
  @Column({ type: "enum", enum: UserStatus, default: UserStatus.PENDING })
  status: UserStatus;

  @Index()
  @Column({ type: "boolean", default: false })
  isHo: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;
}
