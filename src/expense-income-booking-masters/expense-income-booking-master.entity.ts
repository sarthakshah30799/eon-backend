import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { AccountProfile } from '../account-profiles/account-profile.entity';

@Entity('expense_income_booking_masters')
@Index(['type', 'code'], { unique: true })
export class ExpenseIncomeBookingMaster extends BaseEntity {
  @Index()
  @Column({ type: 'citext' })
  type: string; // 'EXPENSE' or 'INCOME'

  @Column({ type: 'boolean', default: false })
  interstateTransaction: boolean;

  @Index()
  @Column({ type: 'citext' })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Applicability flags
  @Column({ type: 'boolean', default: false })
  applicableCustomer: boolean;

  @Column({ type: 'boolean', default: false })
  applicableVendor: boolean;

  @Column({ type: 'boolean', default: false })
  applicableEmployee: boolean;

  @Column({ type: 'boolean', default: false })
  applicableAgent: boolean;

  @Column({ type: 'boolean', default: false })
  applicableCardIssuer: boolean;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'boolean', default: false })
  allowRecPay: boolean;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0.00 })
  totalGst: number;

  @Column({ type: 'boolean', default: false })
  tdsApplicable: boolean;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0.00 })
  tdsValue: number;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tds_account_id' })
  tdsAccount: AccountProfile | null;

  @Column({ type: 'uuid', nullable: true })
  tdsAccountId: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  from: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  to: Date | null;
}
