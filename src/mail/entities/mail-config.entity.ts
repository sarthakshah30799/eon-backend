import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('mail_configurations')
export class MailConfig {
  @PrimaryColumn()
  username: string;

  @Column()
  host: string;

  @Column({ type: 'integer' })
  port: number;

  @Column()
  password: string;

  @Column({ name: 'sender_email', nullable: true })
  senderEmail?: string;
}
