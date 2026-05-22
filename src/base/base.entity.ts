import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
} from "typeorm";

export class BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;

  @Column({ type: "uuid" })
  createdBy: string;

  @Column({ type: "uuid" })
  updatedBy: string;
}
