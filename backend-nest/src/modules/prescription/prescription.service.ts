/**
 * PrescriptionService — Level 3 (Medical)
 * Covers: Prescriptions · Medicines · Medicine Library (MongoDB)
 */
import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import * as mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'mysql2/promise';
import { MYSQL_POOL } from '../../database/database.module';
import { AppError } from '../../common/errors/app.error';
import {
  MedicinePrescription,
  MedicinePrescriptionDocument,
} from './schemas/medicine-prescription.schema';

const VALID_STATUSES = ['UPLOADED', 'RENDERED', 'SENT'];

const COMMON_MEDICINES = [
  'Paracetamol 500mg', 'Paracetamol 650mg', 'Amoxicillin 250mg', 'Amoxicillin 500mg',
  'Azithromycin 250mg', 'Azithromycin 500mg', 'Ciprofloxacin 500mg', 'Metronidazole 400mg',
  'Zifi 200', 'Zifi 400', 'Cefixime 200mg', 'Cefpodoxime 200mg', 'Pantoprazole 40mg',
  'Omeprazole 20mg', 'Rabeprazole 20mg', 'Ranitidine 150mg', 'Cetirizine 10mg',
  'Loratadine 10mg', 'Montelukast 10mg', 'Atorvastatin 10mg', 'Atorvastatin 20mg',
  'Rosuvastatin 10mg', 'Metformin 500mg', 'Metformin 1000mg', 'Glimepiride 1mg',
  'Glimepiride 2mg', 'Amlodipine 5mg', 'Amlodipine 10mg', 'Telmisartan 40mg',
  'Enalapril 5mg', 'Losartan 50mg', 'Aspirin 75mg', 'Aspirin 150mg', 'Clopidogrel 75mg',
  'Pantop D', 'Pan 40', 'Dolo 650', 'Combiflam', 'Zerodol P', 'Crocin', 'Allegra 120mg',
  'Montair LC', 'Sinarest', 'Zincovit', 'Becosules', 'Shelcal 500', 'Caldikind',
  'Vitamin D3 60000 IU', 'Vitamin B12', 'Neurobion Forte', 'Becadexamin',
  'Diclofenac 50mg', 'Ibuprofen 400mg', 'Ibuprofen 600mg', 'Naproxen 500mg',
  'Tramadol 50mg', 'Ondansetron 4mg', 'Domperidone 10mg', 'Metoclopramide 10mg',
  'Loperamide 2mg', 'Lactulose', 'Ispaghula Husk', 'Tab Berno', 'Tab Sertima',
  'Sertraline 50mg', 'Escitalopram 10mg', 'Clonazepam 0.5mg', 'Alprazolam 0.25mg',
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class PrescriptionService {
  constructor(
    @Inject(MYSQL_POOL) private readonly pool: Pool,
    @InjectModel(MedicinePrescription.name)
    private readonly medicineLibraryModel: Model<MedicinePrescriptionDocument>,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // PRESCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════

  async assertSubscriptionLimit(orgId: string | null) {
    if (!orgId) return;
    const [orgRows]: any = await this.pool.execute('SELECT * FROM organizations WHERE id = ?', [orgId]);
    const org = orgRows[0];
    if (!org || org.plan === 'ENTERPRISE' || org.plan === 'ENT') return;
    const [[{ count }]]: any = await this.pool.execute(
      `SELECT COUNT(*) AS count FROM prescriptions
       WHERE org_id = ? AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())`,
      [orgId],
    );
    if (count >= org.prescription_limit) {
      const err = new AppError(
        `Monthly limit of ${org.prescription_limit} prescriptions reached on your ${org.plan} plan. Please upgrade.`,
        403, 'LIMIT_EXCEEDED',
      );
      (err as any).current = count;
      (err as any).limit   = org.prescription_limit;
      (err as any).plan    = org.plan;
      throw err;
    }
  }

  async createPrescription(params: {
    userId: string; userName: string; orgId: string | null;
    patient_name: string; patient_phone: string;
    language?: string; notes?: string; imageFile?: any;
  }) {
    const { userId, userName, orgId, patient_name, patient_phone, language, notes, imageFile } = params;
    if (!patient_name || !patient_phone) throw AppError.badRequest('patient_name and patient_phone are required');

    const id           = uuidv4();
    const access_token = crypto.randomBytes(8).toString('hex');
    const image_url    = imageFile?.location ?? null;

    await this.pool.execute(
      `INSERT INTO prescriptions (id, doctor_id, doctor_name, patient_name, patient_phone, language, image_url, access_token, notes, org_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, userName, patient_name.trim(), patient_phone.trim(), language || 'English', image_url, access_token, notes?.trim() || null, orgId || null],
    );

    const [rows]: any = await this.pool.execute('SELECT * FROM prescriptions WHERE id = ?', [id]);
    return rows[0];
  }

  async listPrescriptions(params: { role: string; userId: string; orgId: string | null }) {
    const { role, userId, orgId } = params;
    if (role === 'DOCTOR') {
      const [rows]: any = await this.pool.execute(
        `SELECT * FROM prescriptions WHERE doctor_id = ? ORDER BY created_at DESC`, [userId],
      );
      return rows;
    }
    if (orgId) {
      const [rows]: any = await this.pool.execute(
        `SELECT * FROM prescriptions WHERE org_id = ? ORDER BY created_at DESC`, [orgId],
      );
      return rows;
    }
    const [rows]: any = await this.pool.execute(
      `SELECT * FROM prescriptions ORDER BY created_at DESC`,
    );
    return rows;
  }

  async getPrescriptionById(id: string, params: { role: string; userId: string; orgId: string | null }) {
    if (!id) throw AppError.badRequest('Prescription ID is required');
    const { role, userId, orgId } = params;
    const [rows]: any = await this.pool.execute(
      'SELECT * FROM prescriptions WHERE id = ? OR access_token = ?', [id, id],
    );
    const prescription = rows[0];
    if (!prescription) throw AppError.notFound('Prescription');
    if (role === 'DOCTOR'     && prescription.doctor_id !== userId)         throw AppError.forbidden();
    if (role === 'PHARMACIST' && orgId && prescription.org_id !== orgId)   throw AppError.forbidden();
    // Parse interpreted_data JSON string back to object
    if (prescription.interpreted_data && typeof prescription.interpreted_data === 'string') {
      try { prescription.interpreted_data = JSON.parse(prescription.interpreted_data); } catch { prescription.interpreted_data = null; }
    }
    return prescription;
  }

  async saveInterpretedData(id: string, data: any) {
    const [rows]: any = await this.pool.execute('SELECT id FROM prescriptions WHERE id = ?', [id]);
    if (rows.length === 0) throw AppError.notFound('Prescription');
    await this.pool.execute(
      'UPDATE prescriptions SET interpreted_data = ? WHERE id = ?',
      [JSON.stringify(data), id],
    );
    return { message: 'Interpreted data saved' };
  }

  async updateRender(id: string, _actorId: string, video_url?: string) {
    const [rows]: any = await this.pool.execute('SELECT * FROM prescriptions WHERE id = ? OR access_token = ?', [id, id]);
    const row = rows[0];
    if (!row) throw AppError.notFound('Prescription');
    await this.pool.execute(
      'UPDATE prescriptions SET video_url = ?, status = "RENDERED" WHERE id = ?',
      [video_url?.trim() || null, row.id],
    );
    const [updated]: any = await this.pool.execute('SELECT * FROM prescriptions WHERE id = ?', [row.id]);
    return updated[0];
  }

  async updateStatus(id: string, params: { userId: string; role: string; orgId: string | null; status: string }) {
    const { userId, role, orgId, status } = params;
    if (!status) throw AppError.validation('Status is required');
    const upperStatus = status.toUpperCase();
    if (!VALID_STATUSES.includes(upperStatus)) throw AppError.validation(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
    const [rows]: any = await this.pool.execute('SELECT * FROM prescriptions WHERE id = ? OR access_token = ?', [id, id]);
    const row = rows[0];
    if (!row) throw AppError.notFound('Prescription');
    if (role === 'PHARMACIST') {
      if (upperStatus !== 'SENT') throw AppError.forbidden('Pharmacist can only mark a prescription as SENT');
      if (orgId && row.org_id !== orgId) throw AppError.forbidden();
    } else {
      if (row.doctor_id !== userId) throw AppError.forbidden();
    }
    await this.pool.execute('UPDATE prescriptions SET status = ? WHERE id = ?', [upperStatus, row.id]);
    return { message: 'Status updated' };
  }

  async removePrescription(id: string, doctorId: string) {
    const [rows]: any = await this.pool.execute('SELECT * FROM prescriptions WHERE id = ? OR access_token = ?', [id, id]);
    const row = rows[0];
    if (!row) throw AppError.notFound('Prescription');
    if (row.doctor_id !== doctorId) throw AppError.forbidden();
    await this.pool.execute('DELETE FROM prescriptions WHERE id = ?', [row.id]);
    return { message: 'Prescription deleted' };
  }

  async getPublicPrescription(token: string) {
    if (!token) throw AppError.badRequest('Access token is required');
    const [rows]: any = await this.pool.execute('SELECT * FROM prescriptions WHERE access_token = ?', [token]);
    const p = rows[0];
    if (!p) throw AppError.notFound('Prescription');
    let interpreted_data: any = null;
    if (p.interpreted_data) {
      try { interpreted_data = typeof p.interpreted_data === 'string' ? JSON.parse(p.interpreted_data) : p.interpreted_data; } catch { interpreted_data = null; }
    }
    return { doctor_name: p.doctor_name, patient_name: p.patient_name, language: p.language,
             image_url: p.image_url, video_url: p.video_url, created_at: p.created_at, interpreted_data };
  }

  searchMedicines(query: string): string[] {
    const q = (query || '').toLowerCase().trim();
    if (q.length < 1) return [];
    return COMMON_MEDICINES.filter((m) => m.toLowerCase().includes(q)).slice(0, 15);
  }

  // ── Per-prescription medicines (stored in interpreted_data.medicines) ──

  private async getPrescriptionRaw(id: string) {
    const [rows]: any = await this.pool.execute(
      'SELECT * FROM prescriptions WHERE id = ?', [id],
    );
    const row = rows[0];
    if (!row) throw AppError.notFound('Prescription');
    let data: any = {};
    if (row.interpreted_data) {
      try { data = typeof row.interpreted_data === 'string' ? JSON.parse(row.interpreted_data) : row.interpreted_data; } catch { data = {}; }
    }
    return { row, data };
  }

  async addMedicineToRx(prescriptionId: string, actorId: string, body: { name: string; quantity?: string; frequency: string; course: string; description?: string }) {
    const { row, data } = await this.getPrescriptionRaw(prescriptionId);
    if (row.doctor_id !== actorId && row.org_id !== actorId) {
      // Allow pharmacists: just check prescription exists — no strict ownership
    }
    if (!body.name?.trim() || !body.frequency?.trim() || !body.course?.trim()) {
      throw AppError.badRequest('name, frequency and course are required');
    }
    const medicines: any[] = Array.isArray(data.medicines) ? data.medicines : [];
    const med = {
      id: uuidv4(),
      name: body.name.trim(),
      quantity: body.quantity || '1',
      frequency: body.frequency.trim(),
      course: body.course.trim(),
      description: body.description?.trim() || null,
    };
    medicines.push(med);
    data.medicines = medicines;
    await this.pool.execute('UPDATE prescriptions SET interpreted_data = ? WHERE id = ?', [JSON.stringify(data), prescriptionId]);
    return med;
  }

  async updateMedicineInRx(prescriptionId: string, medicineId: string, body: { name: string; quantity?: string; frequency: string; course: string; description?: string }) {
    const { data } = await this.getPrescriptionRaw(prescriptionId);
    const medicines: any[] = Array.isArray(data.medicines) ? data.medicines : [];
    const idx = medicines.findIndex((m: any) => m.id === medicineId);
    if (idx === -1) throw AppError.notFound('Medicine');
    if (!body.name?.trim() || !body.frequency?.trim() || !body.course?.trim()) {
      throw AppError.badRequest('name, frequency and course are required');
    }
    medicines[idx] = { ...medicines[idx], name: body.name.trim(), quantity: body.quantity || medicines[idx].quantity, frequency: body.frequency.trim(), course: body.course.trim(), description: body.description?.trim() ?? medicines[idx].description };
    data.medicines = medicines;
    await this.pool.execute('UPDATE prescriptions SET interpreted_data = ? WHERE id = ?', [JSON.stringify(data), prescriptionId]);
    return medicines[idx];
  }

  async deleteMedicineFromRx(prescriptionId: string, medicineId: string) {
    const { data } = await this.getPrescriptionRaw(prescriptionId);
    const medicines: any[] = Array.isArray(data.medicines) ? data.medicines : [];
    const idx = medicines.findIndex((m: any) => m.id === medicineId);
    if (idx === -1) throw AppError.notFound('Medicine');
    medicines.splice(idx, 1);
    data.medicines = medicines;
    await this.pool.execute('UPDATE prescriptions SET interpreted_data = ? WHERE id = ?', [JSON.stringify(data), prescriptionId]);
    return { message: 'Medicine removed' };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MEDICINE LIBRARY (MongoDB)
  // ═══════════════════════════════════════════════════════════════════════

  async createMedicineLibraryEntry(data: any) {
    const { medicine_name, dosage_description, common_usage, drug_category } = data;
    if (!medicine_name || !dosage_description || !common_usage || !drug_category) {
      throw AppError.badRequest('medicine_name, dosage_description, common_usage and drug_category are required');
    }
    return this.medicineLibraryModel.create({
      medicine_name:         data.medicine_name.trim(),
      generic_name:          data.generic_name?.trim() || '',
      dosage_description:    data.dosage_description.trim(),
      common_usage:          data.common_usage.trim(),
      drug_category:         data.drug_category.trim(),
      alternative_medicines: Array.isArray(data.alternative_medicines)
        ? data.alternative_medicines.map((s: string) => s.trim()).filter(Boolean) : [],
    });
  }

  async listMedicineLibrary(query: { page?: string; limit?: string; search?: string; drug_category?: string }) {
    const pageNum  = Math.max(1, parseInt(query.page  || '1',  10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10) || 20));
    const filter: any = {};
    if (query.search?.trim()) {
      const safe = escapeRegex(query.search.trim());
      filter.$or = [{ medicine_name: { $regex: safe, $options: 'i' } }, { generic_name: { $regex: safe, $options: 'i' } }];
    }
    if (query.drug_category?.trim()) {
      filter.drug_category = { $regex: escapeRegex(query.drug_category.trim()), $options: 'i' };
    }
    const skip = (pageNum - 1) * limitNum;
    const [docs, total] = await Promise.all([
      this.medicineLibraryModel.find(filter).skip(skip).limit(limitNum).sort({ createdAt: -1 }),
      this.medicineLibraryModel.countDocuments(filter),
    ]);
    return { data: docs, total, page: pageNum, limit: limitNum };
  }

  async getMedicineLibraryById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid Medicine ID format');
    const doc = await this.medicineLibraryModel.findById(id);
    if (!doc) throw AppError.notFound('Medicine');
    return doc;
  }

  async updateMedicineLibraryEntry(id: string, data: any) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid Medicine ID format');
    const allowed = ['medicine_name', 'generic_name', 'dosage_description', 'common_usage', 'drug_category', 'alternative_medicines'];
    const patch: any = {};
    for (const key of allowed) {
      if (data[key] === undefined) continue;
      if (key === 'alternative_medicines') {
        patch[key] = Array.isArray(data[key]) ? data[key].map((s: string) => s.trim()).filter(Boolean) : [];
      } else {
        const trimmed = data[key]?.trim() || null;
        if (trimmed === null && ['medicine_name', 'dosage_description', 'common_usage', 'drug_category'].includes(key)) {
          throw AppError.validation(`${key} cannot be empty`);
        }
        patch[key] = trimmed;
      }
    }
    if (!Object.keys(patch).length) throw AppError.badRequest('No valid fields provided for update');
    const doc = await this.medicineLibraryModel.findByIdAndUpdate(id, patch, { new: true, runValidators: true });
    if (!doc) throw AppError.notFound('Medicine');
    return doc;
  }

  async updateMedicineLibraryImage(id: string, imageUrl: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid Medicine ID format');
    if (!imageUrl) throw AppError.badRequest('Image URL is required');
    const doc = await this.medicineLibraryModel.findByIdAndUpdate(id, { medicine_image: imageUrl }, { new: true });
    if (!doc) throw AppError.notFound('Medicine');
    return doc;
  }

  async removeMedicineLibraryEntry(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid Medicine ID format');
    const doc = await this.medicineLibraryModel.findByIdAndDelete(id);
    if (!doc) throw AppError.notFound('Medicine');
    return { message: 'Medicine deleted' };
  }
}
