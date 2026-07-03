import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { ChequeBook } from './cheque-book.entity';
import { ChequeBookAllocation } from './cheque-book-allocation.entity';

@Entity('cheque_book_page_tracking')
@Unique('UQ_cheque_book_page_tracking_number', ['pageNo'])
@Index('IDX_cheque_book_page_tracking_alloc', ['allocationId'])
export class ChequeBookPageTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'check_book_id', type: 'uuid' })
  checkBookId: string;

  @ManyToOne(() => ChequeBook, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'check_book_id' })
  checkBook: ChequeBook;

  @Column({ name: 'allocation_id', type: 'uuid' })
  allocationId: string;

  @ManyToOne(() => ChequeBookAllocation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'allocation_id' })
  allocation: ChequeBookAllocation;

  @Column({ name: 'page_no', type: 'integer' })
  pageNo: number;

  @Column({
    type: 'enum',
    enum: ['Allocated', 'Used', 'Void', 'Lost'],
    default: 'Allocated',
  })
  status: 'Allocated' | 'Used' | 'Void' | 'Lost';

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
