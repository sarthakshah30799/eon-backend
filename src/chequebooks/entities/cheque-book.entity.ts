import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { WorkflowStatus } from '../../common/enums/workflow-status.enum';

@Entity('cheque_books')
export class ChequeBook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'dispatch_date', type: 'date' })
  dispatchDate: string;

  @Column({ type: 'varchar', length: 50 })
  no: string;

  @Column({ name: 'branch_id', type: 'uuid' })
  @Index('IDX_cheque_books_branch_id')
  branchId: string;

  @Column({ name: 'bank_account_code', type: 'uuid', nullable: true })
  bankAccountCode?: string;

  @Column({ name: 'book_no_from', type: 'integer' })
  bookNoFrom: number;

  @Column({ name: 'book_no_to', type: 'integer' })
  bookNoTo: number;

  @Column({ name: 'vouchers_per_book', type: 'integer' })
  vouchersPerBook: number;

  @Column({ name: 'mv_no_from', type: 'integer' })
  mvNoFrom: number;

  @Column({ name: 'mv_no_to', type: 'integer' })
  mvNoTo: number;

  @Column({ name: 'assigned_to', type: 'uuid' })
  assignedTo: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({
    type: 'enum',
    enum: WorkflowStatus,
    enumName: 'cheque_books_status_enum',
    default: WorkflowStatus.PENDING,
  })
  status: WorkflowStatus;

  @Column({ name: 'approval_remarks', type: 'text', nullable: true })
  approvalRemarks?: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt?: Date;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy?: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ name: 'updated_by', type: 'uuid' })
  updatedBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
