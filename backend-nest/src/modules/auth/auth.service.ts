import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'mysql2/promise';
import { MYSQL_POOL } from '../../database/database.module';
import { AppError } from '../../common/errors/app.error';

function slugify(str: string): string {
  return (
    str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
    '-' +
    Math.random().toString(36).slice(2, 7)
  );
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly saSecret: string;
  private readonly jwtExpires: string;
  private readonly refreshSecret: string;
  private readonly refreshExpires: string;

  constructor(
    @Inject(MYSQL_POOL) private readonly pool: Pool,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret     = this.configService.get<string>('JWT_SECRET');
    this.saSecret      = this.configService.get<string>('SUPERADMIN_JWT_SECRET');
    this.jwtExpires    = this.configService.get<string>('JWT_EXPIRES_IN', '15m');
    this.refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    this.refreshExpires = this.configService.get<string>('JWT_REFRESH_EXPIRES', '7d');
  }

  // ── Token helpers ──────────────────────────────────────────────────────

  makeAccessToken(user: any, orgId: string | null, isOrgAdmin: boolean): string {
    return jwt.sign(
      {
        type: 'USER',
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        baseRole: user.base_role || user.role,
        orgId: orgId || null,
        hospitalId: user.hospital_id || null,
        isOrgAdmin: !!isOrgAdmin,
        customRoleId: user.custom_role_id || null,
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpires },
    );
  }

  async makeRefreshToken(userId: string): Promise<string> {
    const tokenId = uuidv4();
    const token = jwt.sign(
      { type: 'REFRESH', userId, jti: tokenId },
      this.refreshSecret,
      { expiresIn: this.refreshExpires },
    );
    // Store ONLY the SHA-256 hash — the raw token never touches the database.
    // If the DB is breached, an attacker cannot use hashes to impersonate sessions.
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.pool.execute(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [tokenId, userId, tokenHash, expiresAt],
    );
    return token;
  }

  // ── Superadmin login ───────────────────────────────────────────────────

  async superadminLogin(email: string, password: string) {
    if (!email || !password) throw AppError.badRequest('Email and password are required');

    const [rows]: any = await this.pool.execute(
      'SELECT * FROM superadmins WHERE email = ?',
      [email.trim().toLowerCase()],
    );
    if (rows.length === 0) throw AppError.unauthorized('Invalid credentials');

    const sa = rows[0];
    const valid = await bcrypt.compare(password, sa.password);
    if (!valid) throw AppError.unauthorized('Invalid credentials');

    const token = jwt.sign(
      { type: 'SUPERADMIN', superAdminId: sa.id, name: sa.name, email: sa.email },
      this.saSecret,
      { expiresIn: '1d' },
    );

    return { token, superAdmin: { id: sa.id, name: sa.name, email: sa.email } };
  }

  // ── Register ───────────────────────────────────────────────────────────


  async register(body: any) {
    const { name, email, password, role = 'DOCTOR', clinic_name } = body;

    if (!name || !email || !password) throw AppError.badRequest('Name, email and password are required');
    if (name.trim().length < 2) throw AppError.validation('Name must be at least 2 characters');
    if (password.length < 6)    throw AppError.validation('Password must be at least 6 characters');

    const normalEmail = email.trim().toLowerCase();
    const rawRole     = (role as string).toUpperCase();
    const upperRole   = rawRole === 'ADMIN' ? 'ORG_ADMIN' : rawRole;
    const VALID_ROLES = ['ORG_ADMIN', 'DOCTOR', 'PHARMACIST'];

    if (!VALID_ROLES.includes(upperRole)) {
      throw AppError.validation(`Role must be one of: ADMIN, DOCTOR, PHARMACIST`);
    }

    // Compute the hash before entering the transaction — bcrypt is CPU-heavy
    // and should not hold a DB connection open while it runs.
    const hashed  = await bcrypt.hash(password, 10);
    const userId  = uuidv4();
    const nameParts   = name.trim().split(' ');
    const firstName   = nameParts[0];
    const lastName    = nameParts.slice(1).join(' ') || '';
    const effectiveRole    = upperRole;
    const customRoleId: string | null = null;

    let orgId:     string | null = null;
    let isOwner    = false;
    let isOrgAdmin = false;

    // ── All DB writes in one atomic transaction ───────────────────────────
    // If any step fails (duplicate email, FK violation, etc.) every preceding
    // insert is rolled back, leaving the database in a clean state.
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Duplicate-email check — inside the transaction so the read and the
      //    subsequent insert are serialised, eliminating the race condition.
      const [existingRows]: any = await conn.execute(
        'SELECT id FROM users WHERE email = ? FOR UPDATE',
        [normalEmail],
      );
      if (existingRows.length > 0) throw AppError.conflict('Email already registered');

      // 2. Auto-create personal organisation for ORG_ADMIN and DOCTOR
      if (effectiveRole === 'ORG_ADMIN' || effectiveRole === 'DOCTOR') {
        const orgName  = clinic_name?.trim() ||
          (effectiveRole === 'ORG_ADMIN' ? `${name}'s Clinic` : `Dr. ${name}'s Practice`);
        const newOrgId = uuidv4();
        await conn.execute(
          'INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)',
          [newOrgId, orgName, slugify(orgName)],
        );
        orgId      = newOrgId;
        isOwner    = true;
        isOrgAdmin = true;
      }

      // 3. Insert user
      await conn.execute(
        `INSERT INTO users
           (id, name, email, password_hash, first_name, last_name, role,
            org_id, is_owner, is_org_admin, custom_role_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, name.trim(), normalEmail, hashed, firstName, lastName, effectiveRole,
         orgId, isOwner ? 1 : 0, isOrgAdmin ? 1 : 0, customRoleId],
      );

      // 4. Back-fill owner_id now that the user row exists (circular FK)
      if (isOwner && orgId) {
        await conn.execute(
          'UPDATE organizations SET owner_id = ? WHERE id = ?',
          [userId, orgId],
        );
      }

      // 5. Role-specific profile row
      if (effectiveRole === 'DOCTOR') {
        await conn.execute(
          'INSERT INTO doctor_profiles (id, user_id, role_id) VALUES (?, ?, ?)',
          [uuidv4(), userId, null],
        );
      } else if (effectiveRole === 'PHARMACIST') {
        await conn.execute(
          'INSERT INTO pharmacist_profiles (id, user_id, role_id) VALUES (?, ?, ?)',
          [uuidv4(), userId, null],
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    // Issue tokens after the transaction commits — refresh token is its own
    // atomic write; if it fails the user still exists and can log in normally.
    const accessToken  = this.makeAccessToken(
      { id: userId, name: name.trim(), email: normalEmail, role: effectiveRole, custom_role_id: customRoleId },
      orgId,
      isOrgAdmin,
    );
    const refreshToken = await this.makeRefreshToken(userId);

    return {
      token: accessToken,
      refreshToken,
      user: {
        id: userId, name: name.trim(), email: normalEmail, role: effectiveRole,
        clinic_name: clinic_name?.trim() || null, org_id: orgId,
        is_owner: isOwner, is_org_admin: isOrgAdmin,
      },
    };
  }

  // ── Login ──────────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    if (!email || !password) throw AppError.badRequest('Email and password are required');

    const [rows]: any = await this.pool.execute(
      `SELECT u.*, r.base_role, r.display_name AS role_display_name
       FROM users u
       LEFT JOIN roles r ON u.custom_role_id = r.id
       WHERE u.email = ?`,
      [email.trim().toLowerCase()],
    );
    const user = rows[0];
    if (!user) throw AppError.unauthorized('Invalid email or password');

    const passwordField = user.password_hash || user.password;
    const valid = await bcrypt.compare(password, passwordField);
    if (!valid) throw AppError.unauthorized('Invalid email or password');

    const accessToken  = this.makeAccessToken(user, user.org_id, user.is_org_admin);
    const refreshToken = await this.makeRefreshToken(user.id);

    return {
      token: accessToken,
      refreshToken,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        clinic_name: user.clinic_name, org_id: user.org_id,
        hospital_id: user.hospital_id || null,
        is_owner: !!user.is_owner, is_org_admin: !!user.is_org_admin,
        custom_role_id: user.custom_role_id, role_display_name: user.role_display_name || null,
      },
    };
  }

  // ── Get current user ───────────────────────────────────────────────────

  async getMe(userId: string) {
    if (!userId) throw AppError.unauthorized();
    const [rows]: any = await this.pool.execute(
      `SELECT u.id, u.name, u.email, u.role, u.org_id, u.hospital_id,
              u.first_name, u.last_name, u.phone, u.status,
              u.is_owner, u.is_org_admin, u.custom_role_id, u.created_at,
              r.display_name AS role_display_name, r.base_role, r.color AS role_color, r.permissions
       FROM users u
       LEFT JOIN roles r ON u.custom_role_id = r.id
       WHERE u.id = ?`,
      [userId],
    );
    const user = rows[0];
    if (!user) throw AppError.notFound('User');
    return user;
  }

  // ── Token refresh ──────────────────────────────────────────────────────

  async refresh(refreshToken: string) {
    if (!refreshToken) throw AppError.unauthorized('Refresh token required');

    let payload: any;
    try { payload = jwt.verify(refreshToken, this.refreshSecret); }
    catch { throw AppError.unauthorized('Invalid or expired refresh token'); }

    if (payload.type !== 'REFRESH') throw AppError.unauthorized('Invalid token type');

    // Hash the presented token — we never store the raw token, only its digest.
    const incomingHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const [storedRows]: any = await this.pool.execute(
      'SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW()',
      [incomingHash],
    );
    const stored = storedRows[0];
    if (!stored) throw AppError.unauthorized('Refresh token revoked or expired');

    const [userRows]: any = await this.pool.execute(
      `SELECT u.*, r.base_role, r.display_name AS role_display_name
       FROM users u LEFT JOIN roles r ON u.custom_role_id = r.id WHERE u.id = ?`,
      [stored.user_id],
    );
    const fullUser = userRows[0];
    if (!fullUser) throw AppError.unauthorized('User not found');

    // Rotate: delete old token, issue fresh pair (token rotation limits the
    // window of exposure if a refresh token is ever leaked).
    await this.pool.execute('DELETE FROM refresh_tokens WHERE id = ?', [stored.id]);
    const newAccessToken  = this.makeAccessToken(fullUser, fullUser.org_id, fullUser.is_org_admin);
    const newRefreshToken = await this.makeRefreshToken(fullUser.id);

    return { token: newAccessToken, refreshToken: newRefreshToken };
  }

  // ── Logout ─────────────────────────────────────────────────────────────

  async logout(refreshToken: string) {
    if (!refreshToken) throw AppError.badRequest('Refresh token required');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.pool.execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
  }
}
