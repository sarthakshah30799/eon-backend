// user.entity.ts
import { Entity, Column, Index, OneToMany } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { UserRole } from "../user-roles/user-role.entity";

@Entity("users")
export class User extends BaseEntity {
  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles: UserRole[];

  @Column({ type: "citext", unique: true })
  userCode: string;

  @Column({ type: "citext" })
  userName: string;

  @Column({ type: "citext", nullable: true })
  userGroupCode: string;

  @Column({ type: "citext", nullable: true })
  contactNo: string;

  @Index()
  @Column({ type: "citext", unique: true })
  emailId: string;

  @Column({ type: "citext", nullable: true })
  employeeNo: string;

  @Column({ type: "citext", nullable: true })
  designation: string;

  @Column({ type: "citext", nullable: true })
  branchCode: string;

  @Column({ type: "citext", nullable: true })
  userLicNo: string;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "timestamp with time zone", nullable: true })
  lastLoginDate: Date;

  @Column({ type: "boolean", default: false })
  isLocked: boolean;

  @Column({ type: "boolean", default: false })
  isDormant: boolean;

  @Column()
  password: string;
}
