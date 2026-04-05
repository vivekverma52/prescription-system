import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('doctor_profiles')
export class DoctorProfile {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36, unique: true })
  user_id: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  hospital_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  role_id: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  specialization: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  license_number: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'MCI / state council number' })
  registration_number: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: 'S3 key for digital signature image' })
  signature_key: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
