import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ManualBook } from './manual-book.entity';

@Entity('manual_book_allocations')
export class ManualBookAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'manual_book_id', type: 'uuid' })
  manualBookId: string;

  @ManyToOne(() => ManualBook, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'manual_book_id' })
  manualBook: ManualBook;

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
