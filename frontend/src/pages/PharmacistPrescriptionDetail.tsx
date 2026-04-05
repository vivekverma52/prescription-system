import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'
import api from '../services/api'
import AppShell, { NavItem } from '../components/layout/AppShell'
import { StatusBadge } from '../components/ui/StatusBadge'

interface Medicine {
  id: string
  name: string
  quantity: string
  frequency: string
  course: string
  description?: string
}

interface ExtractedMedicine {
  medicine_name: string
  dosage?: string
  duration?: string
  instructions?: string
}

interface InterpretedData {
  medicines?: Medicine[]
  interpreted_data?: {
    medicines?: ExtractedMedicine[]
    doctor_details?: { name?: string; qualifications?: string; contact?: string }
    hospital_details?: { name?: string; address?: string }
    patient_details?: { name?: string; phone?: string; date?: string }
  }
  metadata?: { language?: string; processed_at?: string }
  status?: string
}

interface Prescription {
  id: string
  doctor_name: string
  patient_name: string
  patient_phone: string
  language: string
  image_url?: string
  video_url?: string
  access_token: string
  status: string
  notes?: string
  created_at: string
  interpreted_data?: InterpretedData
}

const FREQ_OPTIONS = ['Morning', 'Afternoon', 'Night']
const EMPTY_FORM = { name: '', quantity: '1', frequency: [] as string[], course: '', description: '' }

const NAV: NavItem[] = [
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

// ── Shared field styles ──────────────────────────────────────────────────────
const field: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)',
  padding: '8px 11px', borderRadius: 9, fontSize: 13, outline: 'none',
  fontFamily: 'var(--font-sans)', width: '100%', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }

// ── Inline Medicine Form (add OR edit) ────────────────────────────────────────
function MedicineForm({
  prescriptionId, initial, submitLabel, onDone, onCancel,
}: {
  prescriptionId: string
  initial: typeof EMPTY_FORM & { id?: string }
  submitLabel: string
  onDone: () => void
  onCancel?: () => void
}) {
  const [form, setForm] = useState(initial)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSug, setShowSug] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const sugRef = useRef<HTMLDivElement>(null)

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sugRef.current && !sugRef.current.contains(e.target as Node) && e.target !== nameRef.current) {
        setShowSug(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const searchMedicines = async (q: string) => {
    setForm(f => ({ ...f, name: q }))
    if (q.length < 1) { setSuggestions([]); setShowSug(false); return }
    try {
      const res = await api.get(`/prescriptions/medicines/search?q=${encodeURIComponent(q)}`)
      const data: string[] = res.data.data ?? []
      setSuggestions(data)
      setShowSug(data.length > 0)
    } catch { setSuggestions([]) }
  }

  const toggleFreq = (f: string) => {
    setForm(prev => ({
      ...prev,
      frequency: prev.frequency.includes(f)
        ? prev.frequency.filter(x => x !== f)
        : [...prev.frequency, f],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Medicine name is required')
    if (form.frequency.length === 0) return toast.error('Select at least one frequency')
    if (!form.course.trim()) return toast.error('Duration / course is required')

    setSubmitting(true)
    try {
      const body: any = {
        name: form.name.trim(),
        quantity: form.quantity || '1',
        frequency: form.frequency.join(', '),
        course: form.course.trim(),
      }
      if (form.description.trim()) body.description = form.description.trim()

      if (initial.id) {
        await api.put(`/prescriptions/${prescriptionId}/medicines/${initial.id}`, body)
        toast.success('Medicine updated')
      } else {
        await api.post(`/prescriptions/${prescriptionId}/medicines`, body)
        toast.success(`${form.name.trim()} added`)
      }
      onDone()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save medicine')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Medicine name + autocomplete */}
      <div style={{ position: 'relative' }}>
        <label style={lbl}>Medicine Name *</label>
        <input
          ref={nameRef}
          style={field}
          placeholder="Type medicine name (e.g. Zifi 200)"
          value={form.name}
          autoFocus={!initial.id}
          onChange={e => searchMedicines(e.target.value)}
          onFocus={() => form.name && suggestions.length > 0 && setShowSug(true)}
          autoComplete="off"
        />
        {showSug && suggestions.length > 0 && (
          <div ref={sugRef} style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 2,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,.1)', maxHeight: 180, overflowY: 'auto',
          }}>
            {suggestions.map(s => (
              <button key={s} type="button"
                onClick={() => { setForm(f => ({ ...f, name: s })); setShowSug(false) }}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none',
                  border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink)',
                  fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--teal-light)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quantity + Course */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={lbl}>Quantity per Day *</label>
          <input style={field} type="number" min="1" max="10" value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
        </div>
        <div>
          <label style={lbl}>Duration / Course *</label>
          <input style={field} placeholder="e.g. 5 Days" value={form.course}
            onChange={e => setForm(f => ({ ...f, course: e.target.value }))} />
        </div>
      </div>

      {/* Frequency checkboxes */}
      <div>
        <label style={lbl}>Frequency *</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {FREQ_OPTIONS.map(opt => {
            const checked = form.frequency.includes(opt)
            return (
              <button key={opt} type="button" onClick={() => toggleFreq(opt)} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px',
                borderRadius: 9, border: `1.5px solid ${checked ? 'var(--teal)' : 'var(--border)'}`,
                background: checked ? 'var(--teal-light)' : 'var(--surface)',
                cursor: 'pointer', fontSize: 12, fontWeight: 500,
                color: checked ? 'var(--teal-dark)' : 'var(--ink-light)',
                fontFamily: 'var(--font-sans)', transition: 'all .12s',
              }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 4, border: `2px solid ${checked ? 'var(--teal)' : 'var(--border)'}`,
                  background: checked ? 'var(--teal)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {checked && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  )}
                </span>
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      {/* Description */}
      <div>
        <label style={lbl}>Instructions (optional)</label>
        <textarea style={{ ...field, resize: 'none', lineHeight: 1.5 }} rows={2}
          placeholder="e.g. After food, before sleep…"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={submitting} className="btn btn-teal" style={{ flex: 1, justifyContent: 'center', opacity: submitting ? .65 : 1 }}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} style={{ flex: 'none', padding: '0 18px' }}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PharmacistPrescriptionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [prescription, setPrescription] = useState<Prescription | null>(null)
  const [loading, setLoading] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [sending, setSending] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [importingIdx, setImportingIdx] = useState<number | null>(null)
  const [importedIdxs, setImportedIdxs] = useState<Set<number>>(new Set())

  const publicUrl = `${window.location.origin}/public/${prescription?.access_token}`

  const fetchPrescription = async () => {
    try {
      const res = await api.get(`/prescriptions/${id}`)
      setPrescription(res.data.data)
    } catch {
      toast.error('Failed to load prescription')
      navigate('/pharmacist')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPrescription() }, [id])

  const handleImportMedicine = async (med: ExtractedMedicine, idx: number) => {
    setImportingIdx(idx)
    try {
      const body: any = {
        name: med.medicine_name,
        quantity: '1',
        frequency: 'Morning',
        course: med.duration || 'As needed',
      }
      const desc = [med.dosage, med.instructions].filter(Boolean).join(' — ')
      if (desc) body.description = desc
      await api.post(`/prescriptions/${id}/medicines`, body)
      toast.success(`${med.medicine_name} imported`)
      setImportedIdxs(prev => new Set(prev).add(idx))
      fetchPrescription()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Import failed')
    } finally {
      setImportingIdx(null)
    }
  }

  const handleImportAll = async (medicines: ExtractedMedicine[]) => {
    for (let i = 0; i < medicines.length; i++) {
      if (!importedIdxs.has(i)) {
        await handleImportMedicine(medicines[i], i)
      }
    }
  }

  const handleDelete = async (medicineId: string, name: string) => {
    if (!confirm(`Remove "${name}"?`)) return
    try {
      await api.delete(`/prescriptions/${id}/medicines/${medicineId}`)
      toast.success('Medicine removed')
      if (editId === medicineId) setEditId(null)
      fetchPrescription()
    } catch {
      toast.error('Failed to remove medicine')
    }
  }

  const handleRender = async () => {
    if (!prescription?.interpreted_data?.medicines?.length) return toast.error('Add at least one medicine before rendering')
    setRendering(true)
    try {
      await api.put(`/prescriptions/${prescription.id}/render`, { video_url: null })
      toast.success('Prescription rendered!')
      fetchPrescription()
    } catch {
      toast.error('Render failed')
    } finally {
      setRendering(false)
    }
  }

  const handleSend = async () => {
    if (!prescription) return
    const msg = encodeURIComponent(
      `Hello ${prescription.patient_name},\n\nYour prescription from Dr. ${prescription.doctor_name} is ready.\n\nView here: ${publicUrl}\n\n- Askim Technologies`
    )
    window.open(`https://wa.me/91${prescription.patient_phone}?text=${msg}`, '_blank')
    setSending(true)
    try {
      await api.put(`/prescriptions/${prescription.id}/status`, { status: 'SENT' })
      toast.success('Sent to patient!')
      fetchPrescription()
    } catch {
      toast.error('Could not update status')
    } finally {
      setSending(false)
    }
  }

  const BackBtn = (
    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/pharmacist')}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5M12 5l-7 7 7 7"/>
      </svg>
      Back
    </button>
  )

  if (loading) return (
    <AppShell navItems={NAV} sectionLabel="Pharmacist" topBarRight={BackBtn}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <div style={{ width: 28, height: 28, border: '2px solid var(--teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      </div>
    </AppShell>
  )

  if (!prescription) return null

  const alreadySent = prescription.status === 'SENT'

  const TopRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <StatusBadge status={prescription.status} />
      {BackBtn}
    </div>
  )

  return (
    <AppShell navItems={NAV} sectionLabel="Pharmacist" topBarRight={TopRight}>

      {/* ── Patient banner ── */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--teal-dark)' }}>
              {prescription.patient_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: 0, marginBottom: 2 }}>{prescription.patient_name}</h2>
            <p style={{ fontSize: 12, color: 'var(--ink-light)' }}>{prescription.patient_phone}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, color: 'var(--ink-light)', marginBottom: 2 }}>Prescribed by</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Dr. {prescription.doctor_name}</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            ['Language', prescription.language],
            ['Date', new Date(prescription.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
            ['Medicines', `${prescription.interpreted_data?.medicines?.length ?? 0} added`],
          ].map(([label, value]) => (
            <div key={label} style={{ background: 'var(--cell)', borderRadius: 9, padding: '7px 12px' }}>
              <p style={{ fontSize: 10, color: 'var(--ink-light)', marginBottom: 2 }}>{label}</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* LEFT col: image + actions + qr */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Prescription image */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 10 }}>
              Prescription Image
            </p>
            {prescription.image_url ? (
              <img src={prescription.image_url} alt="Prescription"
                style={{ width: '100%', borderRadius: 10, objectFit: 'contain', maxHeight: 320, background: 'var(--cell)', border: '1px solid var(--border)' }} />
            ) : (
              <div style={{ height: 160, background: 'var(--cell)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--border)' }}>
                <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>No image uploaded</p>
              </div>
            )}
            {prescription.notes && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--warning-bg)', borderRadius: 8, border: '1px solid rgba(217,119,6,.15)' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--warning)', marginBottom: 3 }}>Doctor's Notes</p>
                <p style={{ fontSize: 12, color: 'var(--ink)' }}>{prescription.notes}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 12 }}>Actions</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <button onClick={handleRender} disabled={rendering} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                padding: '14px 8px', borderRadius: 10, border: 'none', cursor: rendering ? 'not-allowed' : 'pointer',
                background: 'var(--teal)', color: '#fff', fontSize: 10, fontWeight: 700,
                letterSpacing: '.4px', textTransform: 'uppercase', fontFamily: 'var(--font-sans)',
                opacity: rendering ? .65 : 1,
              }}>
                {rendering
                  ? <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                }
                {rendering ? 'Rendering…' : 'Render'}
              </button>

              <button onClick={() => {
                if (prescription.video_url) {
                  const a = document.createElement('a'); a.href = prescription.video_url
                  a.download = `rx-${prescription.patient_name}.mp4`; a.click()
                } else toast.error('Render the prescription first')
              }} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                padding: '14px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'var(--teal)', color: '#fff', fontSize: 10, fontWeight: 700,
                letterSpacing: '.4px', textTransform: 'uppercase', fontFamily: 'var(--font-sans)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
              </button>

              <button onClick={handleSend} disabled={sending || alreadySent} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                padding: '14px 8px', borderRadius: 10, border: 'none', cursor: alreadySent ? 'default' : 'pointer',
                background: alreadySent ? '#16a34a' : '#25D366', color: '#fff', fontSize: 10, fontWeight: 700,
                letterSpacing: '.4px', textTransform: 'uppercase', fontFamily: 'var(--font-sans)',
                opacity: sending ? .65 : 1,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
                {alreadySent ? 'Sent ✓' : 'Send to Patient'}
              </button>
            </div>
          </div>

          {/* QR Code */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 12 }}>Patient QR Code</p>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ background: 'var(--teal-light)', padding: 10, borderRadius: 10, border: '1px solid rgba(0,184,148,.2)', flexShrink: 0 }}>
                <QRCodeSVG value={publicUrl} size={82} fgColor="var(--teal-dark)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, color: 'var(--ink-light)', marginBottom: 7 }}>Patient scans to view prescription on phone</p>
                <p style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--teal)', wordBreak: 'break-all', background: 'var(--teal-light)', padding: '6px 8px', borderRadius: 7, marginBottom: 8 }}>
                  {publicUrl}
                </p>
                <button onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success('Link copied!') }}
                  style={{ fontSize: 11, fontWeight: 500, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 }}>
                  Copy link
                </button>
              </div>
            </div>
          </div>

          {prescription.video_url && (
            <div className="card" style={{ padding: '16px 18px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 10 }}>Rendered Video</p>
              <video src={prescription.video_url} controls style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)' }} />
            </div>
          )}
        </div>

        {/* RIGHT col: extracted data + medicines list + inline add/edit */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── AI Extracted Data Panel ── */}
          {(() => {
            const ai = prescription.interpreted_data
            if (!ai) return null
            const extracted = ai.interpreted_data
            const extractedMeds = extracted?.medicines ?? []
            const hospital = extracted?.hospital_details
            const doctor = extracted?.doctor_details
            return (
              <div className="card" style={{ padding: '16px 18px', border: '1.5px solid rgba(0,184,148,.3)', background: 'linear-gradient(135deg, rgba(0,184,148,.04) 0%, var(--surface) 100%)' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
                        <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>AI Extracted Data</p>
                      {ai.metadata?.processed_at && (
                        <p style={{ fontSize: 10, color: 'var(--ink-light)', margin: 0 }}>
                          Processed {new Date(ai.metadata.processed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'var(--teal-light)', color: 'var(--teal-dark)' }}>
                    {ai.status === 'success' ? 'Success' : ai.status}
                  </span>
                </div>

                {/* Hospital + Doctor */}
                {(hospital?.name || doctor?.name) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    {hospital?.name && (
                      <div style={{ background: 'var(--cell)', borderRadius: 8, padding: '8px 10px' }}>
                        <p style={{ fontSize: 10, color: 'var(--ink-light)', marginBottom: 2 }}>Hospital</p>
                        <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.4 }}>{hospital.name}</p>
                        {hospital.address && <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>{hospital.address}</p>}
                      </div>
                    )}
                    {doctor?.name && (
                      <div style={{ background: 'var(--cell)', borderRadius: 8, padding: '8px 10px' }}>
                        <p style={{ fontSize: 10, color: 'var(--ink-light)', marginBottom: 2 }}>Doctor</p>
                        <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>{doctor.name}</p>
                        {doctor.qualifications && <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>{doctor.qualifications}</p>}
                      </div>
                    )}
                  </div>
                )}

                {/* Extracted medicines */}
                {extractedMeds.length > 0 && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>
                        Extracted Medicines ({extractedMeds.length})
                      </p>
                      {extractedMeds.some((_, i) => !importedIdxs.has(i)) && (
                        <button
                          onClick={() => handleImportAll(extractedMeds)}
                          className="btn btn-teal btn-sm"
                          disabled={importingIdx !== null}
                          style={{ fontSize: 11, opacity: importingIdx !== null ? .6 : 1 }}>
                          Import All
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {extractedMeds.map((m, i) => {
                        const imported = importedIdxs.has(i)
                        return (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px',
                            borderRadius: 9, background: imported ? 'rgba(16,185,129,.06)' : 'var(--cell)',
                            border: `1px solid ${imported ? 'rgba(16,185,129,.25)' : 'var(--border)'}`,
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{m.medicine_name}</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1px 12px' }}>
                                {m.dosage && <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>Dosage: <span style={{ color: 'var(--ink)' }}>{m.dosage}</span></span>}
                                {m.duration && <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>Duration: <span style={{ color: 'var(--ink)' }}>{m.duration}</span></span>}
                                {m.instructions && <span style={{ fontSize: 11, color: 'var(--ink-light)', width: '100%' }}>Instructions: <span style={{ color: 'var(--ink)' }}>{m.instructions}</span></span>}
                              </div>
                            </div>
                            {imported ? (
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#10B981', flexShrink: 0, marginTop: 1 }}>
                                ✓ Added
                              </span>
                            ) : (
                              <button
                                onClick={() => handleImportMedicine(m, i)}
                                disabled={importingIdx !== null}
                                className="btn btn-ghost btn-sm"
                                style={{ flexShrink: 0, fontSize: 11, opacity: importingIdx === i ? .6 : 1 }}>
                                {importingIdx === i ? '…' : 'Import'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {extractedMeds.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--ink-light)', fontStyle: 'italic' }}>No medicines extracted from this prescription.</p>
                )}
              </div>
            )
          })()}

          {/* Medicines list */}
          {(prescription.interpreted_data?.medicines?.length ?? 0) > 0 && (
            <div className="card" style={{ padding: '16px 18px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 12 }}>
                Medicines
                <span style={{ marginLeft: 6, background: 'var(--teal-light)', color: 'var(--teal-dark)', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
                  {prescription.interpreted_data!.medicines!.length}
                </span>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {prescription.interpreted_data!.medicines!.map((med, i) => (
                  editId === med.id ? (
                    // ── Inline edit ──
                    <div key={med.id} style={{ padding: '14px', borderRadius: 12, background: 'var(--teal-light)', border: '1.5px solid rgba(0,184,148,.25)' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal-dark)', marginBottom: 12 }}>Edit medicine #{i + 1}</p>
                      <MedicineForm
                        prescriptionId={prescription.id}
                        initial={{
                          id: med.id,
                          name: med.name,
                          quantity: med.quantity,
                          frequency: med.frequency.split(',').map(f => f.trim()).filter(Boolean),
                          course: med.course,
                          description: med.description ?? '',
                        }}
                        submitLabel="Save Changes"
                        onDone={() => { setEditId(null); fetchPrescription() }}
                        onCancel={() => setEditId(null)}
                      />
                    </div>
                  ) : (
                    // ── Display row ──
                    <div key={med.id} style={{ display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 10, background: 'var(--cell)', border: '1px solid var(--border)' }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal-dark)' }}>{i + 1}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{med.name}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
                          {[['Qty', med.quantity], ['Freq', med.frequency], ['Course', med.course]].map(([k, v]) => (
                            <span key={k} style={{ fontSize: 11, color: 'var(--ink-light)' }}>
                              {k}: <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{v}</span>
                            </span>
                          ))}
                          {med.description && (
                            <span style={{ fontSize: 11, color: 'var(--ink-light)', width: '100%', marginTop: 1 }}>
                              Note: <span style={{ color: 'var(--ink)' }}>{med.description}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignSelf: 'flex-start' }}>
                        <button title="Edit" onClick={() => setEditId(med.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 6, color: 'var(--ink-light)', display: 'flex' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream-dark)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button title="Remove" onClick={() => handleDelete(med.id, med.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 6, color: 'var(--ink-light)', display: 'flex' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,.08)'; e.currentTarget.style.color = '#EF4444' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--ink-light)' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Add medicine form */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 14 }}>
              {(prescription.interpreted_data?.medicines?.length ?? 0) === 0 ? 'Add First Medicine' : 'Add Another Medicine'}
            </p>
            <MedicineForm
              prescriptionId={prescription.id}
              initial={EMPTY_FORM}
              submitLabel="Add Medicine"
              onDone={fetchPrescription}
            />
          </div>

        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  )
}
