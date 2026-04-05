import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('pharmacist_profiles')
export class PharmacistProfile {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36, unique: true })
  user_id: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  hospital_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  role_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  license_number: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  pharmacy_registration: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
