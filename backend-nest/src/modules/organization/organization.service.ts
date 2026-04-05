/**
 * OrganizationService — Level 1
 * Covers: Organizations · Roles · Usage Counters
 */
import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { MYSQL_POOL } from '../../database/database.module';
import { AppError } from '../../common/errors/app.error';


const VALID_BASE_ROLES  = ['DOCTOR', 'PHARMACIST', 'VIEWER', 'ADMIN'];
const BASE_ROLE_MAP: Record<string, string> = {
  DOCTOR: 'DOCTOR', PHARMACIST: 'PHARMACIST', VIEWER: 'PHARMACIST', ADMIN: 'DOCTOR',
};

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(MYSQL_POOL) private readonly pool: Pool,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────

  private async assertOrgExists(orgId: string) {
    if (!orgId) throw AppError.notFound('Organization');
    const [rows]: any = await this.pool.execute('SELECT id FROM organizations WHERE id = ?', [orgId]);
    if (rows.length === 0) throw AppError.notFound('Organization');
  }

  private async assertOwner(userId: string, orgId: string) {
    const [rows]: any = await this.pool.execute(
      'SELECT id FROM users WHERE id = ? AND org_id = ? AND is_owner = 1',
      [userId, orgId],
    );
    if (rows.length === 0) throw AppError.forbidden('Only org owner can perform this action', 'NOT_OWNER');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ORGANIZATION — core
  // ═══════════════════════════════════════════════════════════════════════

  async getOrg(orgId: string) {
    await this.assertOrgExists(orgId);
    const [orgRows]: any = await this.pool.execute('SELECT * FROM organizations WHERE id = ?', [orgId]);
    const org = orgRows[0];

    const [[{ count: usage_this_month }]]: any = await this.pool.execute(
      `SELECT COUNT(*) AS count FROM prescriptions
       WHERE org_id = ? AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())`,
      [orgId],
    );
    const [[{ count: team_count }]]: any = await this.pool.execute(
      'SELECT COUNT(*) AS count FROM users WHERE org_id = ?', [orgId],
    );
    return { ...org, usage_this_month, team_count };
  }

  async updateOrg(userId: string, orgId: string, body: any) {
    const { name, address, phone, website } = body;
    await this.assertOrgExists(orgId);
    await this.assertOwner(userId, orgId);

    if (!name?.trim())          throw AppError.validation('Organization name is required');
    if (name.length > 255)      throw AppError.validation('Organization name too long');
    if (address && address.length > 500) throw AppError.validation('Address too long');
    if (phone && phone.length > 20)      throw AppError.validation('Phone too long');
    if (website && website.length > 255) throw AppError.validation('Website too long');

    await this.pool.execute(
      'UPDATE organizations SET name = ?, address = ?, phone = ?, website = ? WHERE id = ?',
      [name.trim(), address?.trim() || null, phone?.trim() || null, website?.trim() || null, orgId],
    );
    const [rows]: any = await this.pool.execute('SELECT * FROM organizations WHERE id = ?', [orgId]);
    return rows[0];
  }

  async changePlan(userId: string, orgId: string, planName: string) {
    await this.assertOrgExists(orgId);
    await this.assertOwner(userId, orgId);

    if (!planName) throw AppError.validation('Plan name is required');
    const upperPlan = planName.toUpperCase();

    // Look up plan by name (slug)
    const [planRows]: any = await this.pool.execute(
      'SELECT id, name FROM plans WHERE UPPER(name) = ? AND is_active = 1',
      [upperPlan],
    );
    if (planRows.length === 0) throw AppError.validation(`Plan not found: ${upperPlan}`);

    await this.pool.execute(
      'UPDATE organizations SET plan_id = ? WHERE id = ?',
      [planRows[0].id, orgId],
    );
    return { message: `Upgraded to ${planRows[0].name}`, plan: planRows[0].name };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TEAM — members
  // ═══════════════════════════════════════════════════════════════════════

  async getTeam(orgId: string) {
    await this.assertOrgExists(orgId);
    const [members]: any = await this.pool.execute(
      `SELECT u.id, u.name, u.email, u.role, u.is_owner, u.is_org_admin, u.created_at,
              r.display_name AS role_display_name, r.color AS role_color
       FROM users u LEFT JOIN roles r ON u.custom_role_id = r.id
       WHERE u.org_id = ? ORDER BY u.is_owner DESC, u.created_at ASC`,
      [orgId],
    );
    return { members };
  }

  async createMember(userId: string, orgId: string, body: any) {
    const { name, email, password, role } = body;
    await this.assertOrgExists(orgId);
    await this.assertOwner(userId, orgId);

    if (!name || !email || !password || !role) throw AppError.badRequest('name, email, password and role are required');
    const upperRole = role.toUpperCase();
    if (!['DOCTOR', 'PHARMACIST'].includes(upperRole)) throw AppError.validation('Role must be DOCTOR or PHARMACIST');
    if (password.length < 6)          throw AppError.validation('Password must be at least 6 characters');
    if (name.trim().length < 2)       throw AppError.validation('Name must be at least 2 characters');

    const [orgRows]: any = await this.pool.execute(
      `SELECT o.id, p.max_staff_per_hospital FROM organizations o LEFT JOIN plans p ON p.id = o.plan_id WHERE o.id = ?`,
      [orgId],
    );
    const org = orgRows[0];
    const [[{ count }]]: any = await this.pool.execute('SELECT COUNT(*) AS count FROM users WHERE org_id = ?', [orgId]);
    const staffLimit = org?.max_staff_per_hospital ?? 0;
    if (staffLimit > 0 && count >= staffLimit) {
      throw new AppError(`Team limit reached (${staffLimit} members). Please upgrade your plan.`, 403, 'TEAM_LIMIT_EXCEEDED');
    }

    const normalEmail = email.trim().toLowerCase();
    // Bcrypt before the transaction — don't hold a connection during CPU work
    const hashed    = await bcrypt.hash(password, 10);
    const memberId  = uuidv4();
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName  = nameParts.slice(1).join(' ') || '';

    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      // Email uniqueness — FOR UPDATE serialises concurrent registrations
      const [existing]: any = await conn.execute(
        'SELECT id FROM users WHERE email = ? FOR UPDATE', [normalEmail],
      );
      if (existing.length > 0) throw AppError.conflict('A user with this email already exists');

      await conn.execute(
        `INSERT INTO users
           (id, name, email, password_hash, first_name, last_name,
            role, org_id, is_owner, is_org_admin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [memberId, name.trim(), normalEmail, hashed, firstName, lastName, upperRole, orgId],
      );

      if (upperRole === 'DOCTOR') {
        await conn.execute(
          'INSERT INTO doctor_profiles (id, user_id) VALUES (?, ?)', [uuidv4(), memberId],
        );
      } else if (upperRole === 'PHARMACIST') {
        await conn.execute(
          'INSERT INTO pharmacist_profiles (id, user_id) VALUES (?, ?)', [uuidv4(), memberId],
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return { id: memberId, name: name.trim(), email: normalEmail, role: upperRole };
  }

  async removeMember(userId: string, orgId: string, memberId: string) {
    await this.assertOrgExists(orgId);
    await this.assertOwner(userId, orgId);
    if (!memberId) throw AppError.badRequest('Member ID is required');
    if (memberId === userId) throw AppError.badRequest('You cannot remove yourself from the organization');

    const [memberRows]: any = await this.pool.execute('SELECT id, is_owner FROM users WHERE id = ? AND org_id = ?', [memberId, orgId]);
    const member = memberRows[0];
    if (!member) throw AppError.notFound('Member');
    if (member.is_owner) throw AppError.forbidden('Cannot remove the organization owner');

    await this.pool.execute('UPDATE users SET org_id = NULL, is_owner = 0, is_org_admin = 0, custom_role_id = NULL WHERE id = ?', [memberId]);
    return { message: 'Member removed' };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ROLES
  // ═══════════════════════════════════════════════════════════════════════

  async listRoles(orgId: string) {
    if (!orgId) throw AppError.notFound('Organization');
    const [rows]: any = await this.pool.execute('SELECT * FROM roles WHERE org_id = ? ORDER BY created_at ASC', [orgId]);
    return rows;
  }

  async createRole(orgId: string, body: any) {
    if (!orgId) throw AppError.forbidden('Organization context required');
    const { name, display_name, base_role = 'DOCTOR', permissions = {}, color = '#1D9E75', is_default = false } = body;
    if (!name || !display_name) throw AppError.badRequest('name and display_name are required');
    if (name.length > 100)         throw AppError.validation('Role name too long');
    if (display_name.length > 100) throw AppError.validation('Display name too long');

    const upperBaseRole = base_role.toUpperCase();
    if (!VALID_BASE_ROLES.includes(upperBaseRole)) throw AppError.validation(`Base role must be one of: ${VALID_BASE_ROLES.join(', ')}`);

    const [existing]: any = await this.pool.execute('SELECT id FROM roles WHERE org_id = ? AND name = ?', [orgId, name.trim()]);
    if (existing.length > 0) throw AppError.conflict('A role with this name already exists');

    const id = uuidv4();
    await this.pool.execute(
      `INSERT INTO roles (id, org_id, name, display_name, base_role, permissions, color, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orgId, name.trim(), display_name.trim(), upperBaseRole, JSON.stringify(permissions), color, is_default ? 1 : 0],
    );
    const [rows]: any = await this.pool.execute('SELECT * FROM roles WHERE id = ?', [id]);
    return rows[0];
  }

  async updateRole(id: string, orgId: string, body: any) {
    if (!id) throw AppError.badRequest('Role ID is required');
    const { display_name, base_role, permissions, color, is_default } = body;
    const [currentRows]: any = await this.pool.execute('SELECT * FROM roles WHERE id = ? AND org_id = ?', [id, orgId]);
    const current = currentRows[0];
    if (!current) throw AppError.notFound('Role');

    const newDisplayName = display_name !== undefined ? display_name.trim() : current.display_name;
    const newBaseRole    = base_role    !== undefined ? base_role.toUpperCase() : current.base_role;
    const newPermissions = permissions  !== undefined ? permissions : JSON.parse(current.permissions || '{}');
    const newColor       = color        !== undefined ? color : current.color;
    const newIsDefault   = is_default   !== undefined ? is_default : !!current.is_default;

    if (base_role !== undefined && !VALID_BASE_ROLES.includes(newBaseRole)) {
      throw AppError.validation(`Base role must be one of: ${VALID_BASE_ROLES.join(', ')}`);
    }

    await this.pool.execute(
      `UPDATE roles SET display_name = ?, base_role = ?, permissions = ?, color = ?, is_default = ? WHERE id = ?`,
      [newDisplayName, newBaseRole, JSON.stringify(newPermissions), newColor, newIsDefault ? 1 : 0, id],
    );
    const [rows]: any = await this.pool.execute('SELECT * FROM roles WHERE id = ?', [id]);
    return rows[0];
  }

  async removeRole(id: string, orgId: string) {
    if (!id) throw AppError.badRequest('Role ID is required');
    const [existing]: any = await this.pool.execute(
      'SELECT id FROM roles WHERE id = ? AND org_id = ?', [id, orgId],
    );
    if (existing.length === 0) throw AppError.notFound('Role');

    // Must be atomic: if the DELETE succeeds but the UPDATE doesn't, users
    // retain a foreign key pointing at a deleted role.
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('UPDATE users SET custom_role_id = NULL WHERE custom_role_id = ?', [id]);
      await conn.execute('DELETE FROM roles WHERE id = ?', [id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return { message: 'Role deleted' };
  }

  async assignRole(orgId: string, body: any) {
    const { user_id, role_id } = body;
    if (!user_id || !role_id) throw AppError.badRequest('user_id and role_id are required');

    const [roleRows]: any = await this.pool.execute('SELECT * FROM roles WHERE id = ? AND org_id = ?', [role_id, orgId]);
    const role = roleRows[0];
    if (!role) throw AppError.notFound('Role');

    const [userRows]: any = await this.pool.execute('SELECT id FROM users WHERE id = ? AND org_id = ?', [user_id, orgId]);
    if (userRows.length === 0) throw AppError.notFound('User');

    const baseRole = BASE_ROLE_MAP[role.base_role] || 'DOCTOR';
    await this.pool.execute('UPDATE users SET custom_role_id = ?, role = ? WHERE id = ?', [role_id, baseRole, user_id]);
    return { message: 'Role assigned', role };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // USAGE COUNTERS
  // ═══════════════════════════════════════════════════════════════════════

  async getUsageCounter(orgId: string, rx_month: number, rx_year: number) {
    const [rows]: any = await this.pool.execute(
      'SELECT * FROM org_usage_counters WHERE org_id = ? AND rx_month = ? AND rx_year = ?',
      [orgId, rx_month, rx_year],
    );
    return rows[0] ?? { org_id: orgId, rx_count: 0, rx_month, rx_year };
  }

  async incrementUsageCounter(orgId: string) {
    const now     = new Date();
    const rx_month = now.getMonth() + 1;
    const rx_year  = now.getFullYear();

    await this.pool.execute(
      `INSERT INTO org_usage_counters (id, org_id, rx_month, rx_year, rx_count)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE rx_count = rx_count + 1`,
      [uuidv4(), orgId, rx_month, rx_year],
    );
  }

  async getUsageHistory(orgId: string) {
    const [rows]: any = await this.pool.execute(
      'SELECT * FROM org_usage_counters WHERE org_id = ? ORDER BY rx_year DESC, rx_month DESC LIMIT 12',
      [orgId],
    );
    return rows;
  }
}
