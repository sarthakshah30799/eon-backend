import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from "typeorm";

@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "table_name", type: "varchar" })
  tableName: string;

  @Column({ type: "varchar" })
  action: string;

  @Column({ name: "row_id", type: "uuid" })
  rowId: string;

  @Column({ name: "old_values", type: "jsonb", nullable: true })
  oldValues: any;

  @Column({ name: "new_values", type: "jsonb", nullable: true })
  newValues: any;

  @Column({ name: "changed_by", type: "uuid", nullable: true })
  changedBy: string;

  @CreateDateColumn({ name: "changed_at", type: "timestamptz" })
  changedAt: Date;
}
