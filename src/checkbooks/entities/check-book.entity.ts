import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('check_books')
export class CheckBook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'dispatch_date', type: 'date' })
  dispatchDate: string;

  @Column({ type: 'varchar', length: 50 })
  no: string;

  @Column({ name: 'branch_id', type: 'uuid' })
  branchId: string;

  @Column({ name: 'transaction_type', type: 'varchar', length: 100 })
  transactionType: string;

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

  @Column({ name: 'assigned_to', type: 'varchar', length: 100 })
  assignedTo: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({ type: 'varchar', length: 50, default: 'Pending' })
  status: string; // 'Pending' | 'Approved' | 'Rejected'

  @Column({ name: 'from_date', type: 'date', nullable: true })
  fromDate?: string;

  @Column({ name: 'to_date', type: 'date', nullable: true })
  toDate?: string;

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
