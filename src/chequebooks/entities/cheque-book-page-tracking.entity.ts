import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { ChequeBook } from './cheque-book.entity';

@Entity('cheque_book_page_tracking')
@Unique('UQ_cheque_book_page_tracking_number', ['pageNo'])
@Index('IDX_cheque_book_page_tracking_user', ['assignedToUserId'])
export class ChequeBookPageTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'check_book_id', type: 'uuid' })
  checkBookId: string;

  @ManyToOne(() => ChequeBook, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'check_book_id' })
  checkBook: ChequeBook;

  @Column({ name: 'assigned_to_user_id', type: 'uuid' })
  assignedToUserId: string;

  @Column({ name: 'page_no', type: 'integer' })
  pageNo: number;

  @Column({
    type: 'enum',
    enum: ['ALLOCATED', 'USED', 'VOID'],
    default: 'ALLOCATED',
  })
  status: 'ALLOCATED' | 'USED' | 'VOID';

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
