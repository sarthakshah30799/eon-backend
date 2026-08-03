import {
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { Counter } from '../counters/counter.entity';
import { Menu } from '../menu/menu.entity';
import { Permission } from '../permissions/permission.entity';

@Entity('counter_menu_restrictions')
@Unique(['counter', 'menu', 'permission'])
export class CounterMenuRestriction extends BaseEntity {
  @Index()
  @ManyToOne(() => Counter, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'counter_id' })
  counter: Counter;

  @Index()
  @ManyToOne(() => Menu, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menu_id' })
  menu: Menu;

  @Index()
  @ManyToOne(() => Permission, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;
}
