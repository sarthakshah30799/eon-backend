import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base/base.entity';

@Entity('tds_profiles')
export class TdsProfile extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'citext' })
  code: string;

  @Column({ type: 'citext' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Index()
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  from: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  to: Date | null;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  value: number;
}
