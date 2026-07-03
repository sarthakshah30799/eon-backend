import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { ManualBook } from './manual-book.entity';
import { ManualBookAllocation } from './manual-book-allocation.entity';

@Entity('manual_book_page_tracking')
@Unique('UQ_manual_book_page_tracking_number', ['pageNo'])
@Index('IDX_manual_book_page_tracking_alloc', ['allocationId'])
export class ManualBookPageTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'manual_book_id', type: 'uuid' })
  manualBookId: string;

  @ManyToOne(() => ManualBook, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'manual_book_id' })
  manualBook: ManualBook;

  @Column({ name: 'allocation_id', type: 'uuid' })
  allocationId: string;

  @ManyToOne(() => ManualBookAllocation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'allocation_id' })
  allocation: ManualBookAllocation;

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
