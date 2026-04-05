import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import AppShell, { NavItem } from '../components/layout/AppShell'

/* ── Doctor nav ── */
const DOCTOR_NAV: NavItem[] = [
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

/* ── Pharmacist nav ── */
const PHARMACIST_NAV: NavItem[] = [
  {
    id: 'prescriptions', label: 'Prescriptions', path: '/pharmacist',
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

interface Hospital {
  id: string
  name: string
}

interface DoctorProfile {
  id: string
  hospital_id: string | null
  role_id: string | null
  specialization: string | null
  license_number: string | null
  registration_number: string | null
}

interface PharmacistProfile {
  id: string
  hospital_id: string | null
  role_id: string | null
  license_number: string | null
  pharmacy_registration: string | null
}

type DoctorForm = {
  specialization: string
  license_number: string
  registration_number: string
  hospital_id: string
}

type PharmacistForm = {
  license_number: string
  pharmacy_registration: string
  hospital_id: string
}

export default function ProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<DoctorProfile | PharmacistProfile | null>(null)
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const isDoctor = user?.role === 'DOCTOR'
  const isPharmacist = user?.role === 'PHARMACIST'

  const doctorForm = useForm<DoctorForm>()
  const pharmacistForm = useForm<PharmacistForm>()

  useEffect(() => {
    const endpoint = isDoctor
      ? '/profiles/doctors/me'
      : isPharmacist
      ? '/profiles/pharmacists/me'
      : null

    if (!endpoint) {
      setLoading(false)
      return
    }

    Promise.all([
      api.get(endpoint),
      api.get('/organizations/me/hospitals'),
    ])
      .then(([pRes, hRes]) => {
        const p = pRes.data?.data ?? pRes.data
        setProfile(p)
        setHospitals(hRes.data?.data ?? hRes.data ?? [])

        if (isDoctor) {
          const dp = p as DoctorProfile
          doctorForm.reset({
            specialization: dp.specialization || '',
            license_number: dp.license_number || '',
            registration_number: dp.registration_number || '',
            hospital_id: dp.hospital_id || '',
          })
        } else if (isPharmacist) {
          const pp = p as PharmacistProfile
          pharmacistForm.reset({
            license_number: pp.license_number || '',
            pharmacy_registration: pp.pharmacy_registration || '',
            hospital_id: pp.hospital_id || '',
          })
        }
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  const onSaveDoctor = async (data: DoctorForm) => {
    setSaving(true)
    try {
      const payload: Record<string, string | null> = {
        specialization: data.specialization || null,
        license_number: data.license_number || null,
        registration_number: data.registration_number || null,
        hospital_id: data.hospital_id || null,
      }
      await api.put('/profiles/doctors/me', payload)
      toast.success('Profile updated')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const onSavePharmacist = async (data: PharmacistForm) => {
    setSaving(true)
    try {
      const payload: Record<string, string | null> = {
        license_number: data.license_number || null,
        pharmacy_registration: data.pharmacy_registration || null,
        hospital_id: data.hospital_id || null,
      }
      await api.put('/profiles/pharmacists/me', payload)
      toast.success('Profile updated')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const navItems = isPharmacist ? PHARMACIST_NAV : DOCTOR_NAV
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--ink-light)', marginBottom: 5 }

  if (loading) {
    return (
      <AppShell navItems={navItems}>
        <div style={{ color: 'var(--ink-light)', fontSize: 13 }}>Loading…</div>
      </AppShell>
    )
  }

  if (!isDoctor && !isPharmacist) {
    return (
      <AppShell navItems={navItems}>
        <div style={{ color: 'var(--ink-light)', fontSize: 13 }}>Profile management is not available for your role.</div>
      </AppShell>
    )
  }

  return (
    <AppShell navItems={navItems}>
      <div style={{ maxWidth: 520 }}>

        {/* Account info (read-only) */}
        <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Account</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <span style={lbl}>Name</span>
              <input className="input-field" readOnly value={user?.name || ''} style={{ background: 'var(--cell)', color: 'var(--ink-light)' }} />
            </div>
            <div>
              <span style={lbl}>Email</span>
              <input className="input-field" readOnly value={user?.email || ''} style={{ background: 'var(--cell)', color: 'var(--ink-light)' }} />
            </div>
            <div>
              <span style={lbl}>Role</span>
              <input className="input-field" readOnly value={user?.role_display_name || user?.role || ''} style={{ background: 'var(--cell)', color: 'var(--ink-light)' }} />
            </div>
          </div>
        </div>

        {/* Doctor profile form */}
        {isDoctor && (
          <form onSubmit={doctorForm.handleSubmit(onSaveDoctor)}>
            <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Doctor Profile</h2>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Hospital</label>
                <select className="input-field" {...doctorForm.register('hospital_id')}>
                  <option value="">— Not assigned —</option>
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Specialization</label>
                <input className="input-field" placeholder="e.g. Cardiology"
                  {...doctorForm.register('specialization')} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>License Number</label>
                <input className="input-field" placeholder="Medical license number"
                  {...doctorForm.register('license_number')} />
              </div>

              <div>
                <label style={lbl}>Registration Number</label>
                <input className="input-field" placeholder="Medical council registration"
                  {...doctorForm.register('registration_number')} />
              </div>
            </div>

            <button type="submit" disabled={saving} className="btn btn-teal"
              style={{ opacity: saving ? .65 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              {saving ? (
                <>
                  <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                  Saving…
                </>
              ) : 'Save Profile'}
            </button>
          </form>
        )}

        {/* Pharmacist profile form */}
        {isPharmacist && (
          <form onSubmit={pharmacistForm.handleSubmit(onSavePharmacist)}>
            <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Pharmacist Profile</h2>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Hospital</label>
                <select className="input-field" {...pharmacistForm.register('hospital_id')}>
                  <option value="">— Not assigned —</option>
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>License Number</label>
                <input className="input-field" placeholder="Pharmacist license number"
                  {...pharmacistForm.register('license_number')} />
              </div>

              <div>
                <label style={lbl}>Pharmacy Registration</label>
                <input className="input-field" placeholder="Pharmacy registration number"
                  {...pharmacistForm.register('pharmacy_registration')} />
              </div>
            </div>

            <button type="submit" disabled={saving} className="btn btn-teal"
              style={{ opacity: saving ? .65 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              {saving ? (
                <>
                  <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                  Saving…
                </>
              ) : 'Save Profile'}
            </button>
          </form>
        )}

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  )
}
