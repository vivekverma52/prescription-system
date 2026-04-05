import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import AppShell, { NavItem } from '../components/layout/AppShell'
import { StatusBadge } from '../components/ui/StatusBadge'

interface Prescription {
  id: string
  doctor_name: string
  patient_name: string
  patient_phone: string
  language: string
  image_url?: string
  access_token: string
  status: string
  notes?: string
  created_at: string
}

const STATUS_INFO: Record<string, string> = {
  UPLOADED: 'Your prescription has been uploaded. The pharmacist will add medicines and dispatch it to the patient.',
  RENDERED: 'Prescription rendered. Waiting for pharmacist to send to patient.',
  SENT:     'Prescription has been sent to the patient via WhatsApp.',
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

export default function PrescriptionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [prescription, setPrescription] = useState<Prescription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/prescriptions/${id}`)
      .then(res => setPrescription(res.data.data))
      .catch(() => { toast.error('Failed to load prescription'); navigate(-1) })
      .finally(() => setLoading(false))
  }, [id])

  const TopRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {prescription && <StatusBadge status={prescription.status} />}
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/prescriptions')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Back
      </button>
    </div>
  )

  if (loading) {
    return (
      <AppShell navItems={NAV} topBarRight={TopRight}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ width: 28, height: 28, border: '2px solid var(--teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </AppShell>
    )
  }

  if (!prescription) return null

  return (
    <AppShell navItems={NAV} topBarRight={TopRight}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Prescription image */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 12 }}>
            Prescription Image
          </p>
          {prescription.image_url ? (
            <img src={prescription.image_url} alt="Prescription"
              style={{ width: '100%', borderRadius: 10, objectFit: 'contain', maxHeight: 340, background: 'var(--cell)', border: '1px solid var(--border)' }} />
          ) : (
            <div style={{
              height: 220, background: 'var(--cell)', borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px dashed var(--border)',
            }}>
              <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>No image uploaded</p>
            </div>
          )}
          {prescription.notes && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--warning-bg)', borderRadius: 8, border: '1px solid rgba(217,119,6,.15)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--warning)', marginBottom: 4 }}>Doctor's Notes</p>
              <p style={{ fontSize: 12, color: 'var(--ink)' }}>{prescription.notes}</p>
            </div>
          )}
        </div>

        {/* Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Patient info */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 12 }}>
              Patient Details
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['Doctor', `Dr. ${prescription.doctor_name}`],
                ['Patient', prescription.patient_name],
                ['Mobile', prescription.patient_phone || '—'],
                ['Language', prescription.language],
              ].map(([label, value]) => (
                <div key={label}>
                  <p style={{ fontSize: 10, color: 'var(--ink-light)', marginBottom: 4 }}>{label}</p>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', background: 'var(--cell)', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 10 }}>
              {new Date(prescription.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Status info */}
          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--teal-light)', border: '1px solid rgba(0,184,148,.15)' }}>
            <p style={{ fontSize: 12, color: 'var(--teal-dark)', lineHeight: 1.55 }}>
              {STATUS_INFO[prescription.status] ?? prescription.status}
            </p>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  )
}
