import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AppShell, { NavItem } from '../components/layout/AppShell'
import StatCard from '../components/ui/StatCard'
import UsageBar from '../components/ui/UsageBar'
import { PlanBadge } from '../components/ui/StatusBadge'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const NAV: NavItem[] = [
  {
    id: 'home', label: 'Home', path: '/home',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    id: 'prescriptions', label: 'Prescriptions', path: '/prescriptions',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
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

export default function HomePage() {
  const { user, org, refreshOrg } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { refreshOrg() }, [])

  const used  = org?.usage_this_month ?? 0
  const limit = org?.prescription_limit ?? 99999
  const nearLimit = limit < 99999 && used >= limit * 0.8

  const NewPrescriptionBtn = (
    <button
      className="btn btn-teal btn-sm"
      onClick={() => navigate('/prescriptions/new')}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      New Prescription
    </button>
  )

  return (
    <AppShell navItems={NAV} topBarRight={NewPrescriptionBtn}>

      {/* Greeting */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-.4px' }}>
            {getGreeting()},{' '}
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400 }}>
              {user?.name?.split(' ')[0]}
            </span>
          </h2>
          {org?.plan && <PlanBadge plan={org.plan} />}
        </div>
        {org && <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>{org.name}</p>}
      </div>

      {/* Limit warning */}
      {nearLimit && (
        <div style={{
          background: 'var(--warning-bg)', border: '1px solid rgba(217,119,6,.2)',
          borderRadius: 10, padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span style={{ fontSize: 12, color: 'var(--warning)' }}>
              {used >= limit ? `Monthly limit reached (${limit} Rx)` : `${used}/${limit} prescriptions used this month`}
            </span>
          </div>
          <button
            onClick={() => navigate('/settings')}
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}
          >
            Upgrade →
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard
          label="This month"
          value={used}
          sub={limit < 99999 ? `of ${limit} Rx limit` : 'unlimited'}
        />
        <StatCard
          label="Plan"
          value={org?.plan || '—'}
          sub={limit < 99999 ? `${limit} Rx / mo` : 'Unlimited Rx'}
        />
        <StatCard
          label="Team members"
          value={org?.team_count ?? '—'}
          sub={org?.team_limit ? `of ${org.team_limit} seats` : undefined}
        />
      </div>

      {/* Usage bar */}
      {org && limit < 99999 && (
        <div className="card" style={{ marginBottom: 28, padding: '18px 20px' }}>
          <UsageBar used={used} limit={limit} label="Monthly prescription usage" />
        </div>
      )}

      {/* Main CTA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <button
          className="card"
          onClick={() => navigate('/prescriptions/new')}
          style={{
            textAlign: 'left', cursor: 'pointer', border: 'none',
            background: 'var(--ink)', borderRadius: 14, padding: '24px 22px',
            transition: 'opacity .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>New Prescription</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Add patient + medicines</p>
        </button>

        <button
          className="card"
          onClick={() => navigate('/prescriptions')}
          style={{ textAlign: 'left', cursor: 'pointer', transition: 'background .15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--cell)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
        >
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>All Prescriptions</p>
          <p style={{ fontSize: 12, color: 'var(--ink-light)' }}>View & manage history</p>
        </button>
      </div>
    </AppShell>
  )
}
