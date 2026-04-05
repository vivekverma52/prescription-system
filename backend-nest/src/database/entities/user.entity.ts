import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

export type UserRole   = 'SUPERADMIN' | 'ORG_ADMIN' | 'DOCTOR' | 'PHARMACIST';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INVITED';

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  password_hash: string;

  @Column({ type: 'enum', enum: ['SUPERADMIN', 'ORG_ADMIN', 'DOCTOR', 'PHARMACIST'], default: 'DOCTOR' })
  role: UserRole;

  @Column({ type: 'varchar', length: 255, default: '' })
  name: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  first_name: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  last_name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  org_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  hospital_id: string | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  is_owner: boolean;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  is_org_admin: boolean;

  @Column({ type: 'varchar', length: 36, nullable: true })
  custom_role_id: string | null;

  @Column({ type: 'enum', enum: ['ACTIVE', 'SUSPENDED', 'INVITED'], default: 'ACTIVE' })
  status: UserStatus;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  last_login_at: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
