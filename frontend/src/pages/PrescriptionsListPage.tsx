import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import AppShell, { NavItem } from '../components/layout/AppShell'
import { StatusBadge } from '../components/ui/StatusBadge'
import StatCard from '../components/ui/StatCard'

interface Prescription {
  id: string
  access_token: string
  patient_name: string
  patient_phone: string
  language: string
  status: string
  medicine_count: number
  created_at: string
}

const NAV: NavItem[] = [
  {
    id: 'home', label: 'Home', path: '/home',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    id: 'prescriptions', label: 'Prescriptions', path: '/prescriptions',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  },
  {
    id: 'medicines', label: 'Medicine DB', path: '/medicine-prescriptions',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>,
  },
  {
    id: 'profile', label: 'Profile', path: '/profile',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  },
  {
    id: 'settings', label: 'Settings', path: '/settings',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  },
]

export default function PrescriptionsListPage() {
  const navigate = useNavigate()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    api.get('/prescriptions')
      .then(r => setPrescriptions(r.data.data ?? []))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = prescriptions.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = p.patient_name.toLowerCase().includes(q) || (p.patient_phone || '').includes(q)
    const matchStatus = !statusFilter || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const NewBtn = (
    <button className="btn btn-teal btn-sm" onClick={() => navigate('/prescriptions/new')}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      New prescription
    </button>
  )

  return (
    <AppShell navItems={NAV} topBarRight={NewBtn}>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
        <StatCard label="Total" value={prescriptions.length} />
        <StatCard label="Rendered" value={prescriptions.filter(p => p.status === 'RENDERED').length} />
        <StatCard label="Sent" value={prescriptions.filter(p => p.status === 'SENT').length} />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-light)', pointerEvents: 'none' }}
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="input-field"
            style={{ paddingLeft: 34 }}
            placeholder="Search by patient or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter */}
        <select
          className="input-field"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="UPLOADED">Uploaded</option>
          <option value="RENDERED">Rendered</option>
          <option value="SENT">Sent</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Phone</th>
              <th>Language</th>
              <th>Medicines</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0' }}>
                  <div style={{ width: 28, height: 28, border: '2px solid var(--teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ink-light)' }}>
                  <svg style={{ margin: '0 auto 12px', opacity: .3 }} width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <p style={{ fontSize: 13 }}>{search ? 'No results found' : 'No prescriptions yet'}</p>
                  {!search && (
                    <button onClick={() => navigate('/prescriptions/new')}
                      style={{ fontSize: 12, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 6, fontFamily: 'var(--font-sans)' }}>
                      Create your first prescription →
                    </button>
                  )}
                </td>
              </tr>
            ) : filtered.map(p => (
              <tr key={p.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/prescriptions/${p.access_token}`)}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal-dark)' }}>{p.patient_name.charAt(0)}</span>
                    </div>
                    <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{p.patient_name}</span>
                  </div>
                </td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{p.patient_phone || '—'}</td>
                <td>{p.language}</td>
                <td>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: Number(p.medicine_count) > 0 ? 'var(--teal-light)' : 'var(--cell)', color: Number(p.medicine_count) > 0 ? 'var(--teal-dark)' : 'var(--ink-light)' }}>
                    {p.medicine_count}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--ink-light)' }}>
                  {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td>
                  <StatusBadge status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && (
        <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 10, textAlign: 'right' }}>
          {filtered.length} prescription{filtered.length !== 1 ? 's' : ''}
          {statusFilter && ` · ${statusFilter}`}
        </p>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  )
}
