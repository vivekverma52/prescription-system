import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('user_roles')
export class UserRole {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  user_id: string;

  @Column({ type: 'varchar', length: 36 })
  role_id: string;

  @Column({ type: 'tinyint', width: 1, default: 0, comment: '1 = loaded into JWT' })
  is_primary: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
