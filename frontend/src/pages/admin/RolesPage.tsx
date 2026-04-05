import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import AppShell, { NavItem } from '../../components/layout/AppShell'

interface Role {
  id: string
  name: string
  display_name: string
  base_role: 'DOCTOR' | 'PHARMACIST' | 'VIEWER' | 'ADMIN'
  permissions: Record<string, boolean>
  color: string
  is_default: boolean
  created_at: string
}

const BASE_ROLES = ['DOCTOR', 'PHARMACIST', 'VIEWER', 'ADMIN']
const PERMISSION_LABELS: Record<string, string> = {
  create_prescription:    'Create Prescriptions',
  view_all_prescriptions: 'View All Prescriptions',
  delete_prescription:    'Delete Prescriptions',
  manage_medicines:       'Manage Medicines',
  render_prescription:    'Render Videos',
  send_whatsapp:          'Send via WhatsApp',
  manage_team:            'Manage Team',
}
const COLORS = ['#1D9E75', '#7C3AED', '#2563EB', '#D97706', '#DC2626', '#0891B2', '#4F46E5', '#059669']

const NAV: NavItem[] = [
  {
    id: 'dashboard', label: 'Dashboard', path: '/admin',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  },
  {
    id: 'hospitals', label: 'Hospitals', path: '/admin/hospitals',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><line x1="12" y1="3" x2="12" y2="22"/><line x1="3" y1="12" x2="21" y2="12"/></svg>,
  },
  {
    id: 'team', label: 'Team', path: '/admin/team',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    id: 'roles', label: 'Roles', path: '/admin/roles',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>,
  },
  {
    id: 'settings', label: 'Settings', path: '/settings',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  },
]

// ── Role Modal ────────────────────────────────────────────────────────────────
function RoleModal({ role, onClose, onSaved }: { role?: Role; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name:         role?.name         || '',
    display_name: role?.display_name || '',
    base_role:    role?.base_role    || 'DOCTOR',
    permissions:  role?.permissions  || {} as Record<string, boolean>,
    color:        role?.color        || COLORS[0],
    is_default:   role?.is_default   || false,
  })
  const [loading, setLoading] = useState(false)

  const togglePerm = (key: string) => {
    setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (role) {
        await api.put(`/roles/${role.id}`, form)
        toast.success('Role updated')
      } else {
        await api.post('/roles', form)
        toast.success('Role created')
      }
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', background: 'var(--cream)', border: '1px solid var(--border)', color: 'var(--ink)',
    padding: '9px 12px', borderRadius: 10, fontSize: 13, outline: 'none',
    fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--ink-light)', marginBottom: 5 }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="modal-title" style={{ margin: 0 }}>{role ? 'Edit Role' : 'Create Role'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-light)', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Role Slug *</label>
              <input style={inp} placeholder="e.g. senior_doctor"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                disabled={!!role} required />
            </div>
            <div>
              <label style={lbl}>Display Name *</label>
              <input style={inp} placeholder="e.g. Senior Doctor"
                value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} required />
            </div>
            <div>
              <label style={lbl}>Base Role</label>
              <select style={inp} value={form.base_role} onChange={e => setForm(f => ({ ...f, base_role: e.target.value as any }))}>
                {BASE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Color</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                    style={{
                      width: 24, height: 24, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                      transform: form.color === c ? 'scale(1.25)' : 'scale(1)',
                      outline: form.color === c ? `2px solid ${c}` : 'none',
                      outlineOffset: 2, transition: 'transform .1s',
                    }} />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={lbl}>Permissions</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form.permissions[key]} onChange={() => togglePerm(key)}
                    style={{ width: 14, height: 14, accentColor: 'var(--teal)', cursor: 'pointer' }} />
                  <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_default}
              onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
              style={{ width: 14, height: 14, accentColor: 'var(--teal)', cursor: 'pointer' }} />
            <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>Set as default role for new members</span>
          </label>

          <div style={{ display: 'flex', gap: 10, paddingTop: 2 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-teal" style={{ flex: 1, opacity: loading ? .6 : 1 }}>
              {loading ? 'Saving…' : role ? 'Save Changes' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [editRole, setEditRole] = useState<Role | undefined>()
  const [showCreate, setShowCreate] = useState(false)

  const fetchRoles = async () => {
    try {
      const res = await api.get('/roles')
      setRoles(res.data.data.map((r: any) => ({
        ...r,
        permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions,
      })))
    } catch { toast.error('Failed to load roles') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchRoles() }, [])

  const deleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Delete role "${roleName}"? Users with this role will lose it.`)) return
    try {
      await api.delete(`/roles/${roleId}`)
      toast.success('Role deleted')
      fetchRoles()
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed') }
  }

  const NewRoleBtn = (
    <button className="btn btn-teal btn-sm" onClick={() => setShowCreate(true)}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      New Role
    </button>
  )

  return (
    <AppShell navItems={NAV} sectionLabel="Admin" topBarRight={NewRoleBtn}>
      <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 18 }}>
        Define custom roles for your organization. Each role controls what a team member can do.
      </p>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 26, height: 26, border: '2px solid var(--teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        </div>
      ) : roles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🎭</p>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>No roles defined yet</p>
          <button onClick={() => setShowCreate(true)} style={{ fontSize: 13, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            Create your first role →
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 680 }}>
          {roles.map(role => (
            <div key={role.id} className="card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: role.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: role.color }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{role.display_name}</h3>
                      {role.is_default && (
                        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: 'var(--teal-light)', color: 'var(--teal-dark)', fontWeight: 600 }}>Default</span>
                      )}
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: 'var(--cell)', color: 'var(--ink-light)' }}>{role.base_role}</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--ink-light)' }}>slug: {role.name}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditRole(role)} className="btn btn-ghost btn-sm">Edit</button>
                  <button onClick={() => deleteRole(role.id, role.display_name)} className="btn btn-danger btn-sm">Delete</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(role.permissions || {}).filter(([, v]) => v).map(([key]) => (
                  <span key={key} style={{
                    fontSize: 11, padding: '3px 9px', borderRadius: 999,
                    background: 'var(--cell)', color: 'var(--ink-light)', border: '1px solid var(--border)',
                  }}>
                    {PERMISSION_LABELS[key] || key.replace(/_/g, ' ')}
                  </span>
                ))}
                {Object.values(role.permissions || {}).every(v => !v) && (
                  <span style={{ fontSize: 12, color: 'var(--ink-light)', fontStyle: 'italic' }}>No permissions assigned</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(showCreate || editRole) && (
        <RoleModal
          role={editRole}
          onClose={() => { setShowCreate(false); setEditRole(undefined) }}
          onSaved={fetchRoles}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  )
}
