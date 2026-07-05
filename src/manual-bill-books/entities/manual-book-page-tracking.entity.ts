import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { ManualBook } from './manual-book.entity';

@Entity('manual_book_page_tracking')
@Unique('UQ_manual_book_page_tracking_number', ['pageNo'])
@Index('IDX_manual_book_page_tracking_user', ['assignedToUserId'])
export class ManualBookPageTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'manual_book_id', type: 'uuid' })
  manualBookId: string;

  @ManyToOne(() => ManualBook, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'manual_book_id' })
  manualBook: ManualBook;

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
