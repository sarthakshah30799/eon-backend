import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { ChequeBook } from './cheque-book.entity';

@Entity('check_book_allocations')
@Unique('UQ_check_book_allocations_book', ['checkBookId', 'bookNo'])
@Index('IDX_check_book_allocations_query', ['checkBookId', 'bookNo'])
export class ChequeBookAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'check_book_id', type: 'uuid' })
  checkBookId: string;

  @ManyToOne(() => ChequeBook, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'check_book_id' })
  checkBook: ChequeBook;

  @Column({ name: 'book_no', type: 'integer' })
  bookNo: number;

  @Column({ name: 'cashier_id', type: 'uuid' })
  cashierId: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({ name: 'allocated_by', type: 'uuid' })
  allocatedBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
