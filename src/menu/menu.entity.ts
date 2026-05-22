// menu.entity.ts
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { BaseEntity } from "../base/base.entity";

@Entity("menus")
export class Menu extends BaseEntity {
  @Column({ type: "citext" })
  name: string;

  @Column({ type: "text", nullable: true })
  path: string;

  @Column({ type: "text", nullable: true })
  icon: string;

  @Index()
  @ManyToOne(() => Menu, (m) => m.children, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "parent_id" })
  parent: Menu;

  @OneToMany(() => Menu, (m) => m.parent)
  children: Menu[];

  @Column({ type: "int", default: 0 })
  sortOrder: number;

  @Index()
  @Column({ type: "boolean", default: true })
  isActive: boolean;
}
