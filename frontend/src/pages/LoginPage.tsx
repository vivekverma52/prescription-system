import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const { register: reg, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm()

  const getRedirectPath = (u: any) => {
    if (u.role === 'ORG_ADMIN' || u.is_org_admin) {
      return u.hospital_id ? '/hospital-admin' : '/admin'
    }
    if (u.role === 'PHARMACIST') return '/pharmacist'
    return '/home'
  }

  const onSubmit = async (data: any) => {
    try {
      if (mode === 'login') {
        await login(data.email, data.password)
        const u = JSON.parse(localStorage.getItem('user') || '{}')
        navigate(getRedirectPath(u))
      } else {
        await register({ ...data, role: data.role || 'DOCTOR' })
        const u = JSON.parse(localStorage.getItem('user') || '{}')
        navigate(getRedirectPath(u))
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Something went wrong')
    }
  }

  const currentRole = watch('role') || 'DOCTOR'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex' }}>
      {/* Left panel — branding */}
      <div style={{
        width: 420, flexShrink: 0, background: 'var(--ink)', display: 'flex', flexDirection: 'column',
        padding: '56px 52px', position: 'relative', overflow: 'hidden',
      }} className="hidden-mobile">
        {/* Dot grid texture */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 60 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: '-.5px' }}>Rx</span>
            </div>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Medscript</span>
          </div>

          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 14 }}>
            Trusted by clinics across India
          </p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: 38, color: '#fff', lineHeight: 1.1, letterSpacing: '-.5px', marginBottom: 20 }}>
            Prescriptions,<br />done right.
          </h2>
          <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.5)', lineHeight: 1.7, maxWidth: 290 }}>
            From handwritten pad to WhatsApp video — in one workflow. For doctors, pharmacists, and clinics.
          </p>
        </div>

        {/* Feature bullets */}
        <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto' }}>
          {[
            'OCR prescription digitization',
            'WhatsApp video delivery',
            'Multi-hospital management',
            'Role-based team access',
          ].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--teal)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.55)' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Mobile logo (hidden on desktop) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36 }} className="show-mobile">
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>Rx</span>
            </div>
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>Medscript</span>
          </div>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-.5px' }}>
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 4 }}>
              {mode === 'login' ? 'Sign in to your Medscript account' : 'Get started — it only takes a minute'}
            </p>
          </div>

          {/* Tab switcher */}
          <div style={{ display: 'flex', background: 'var(--cream-dark)', borderRadius: 9, padding: 3, marginBottom: 24 }}>
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 500, borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  background: mode === m ? 'var(--surface)' : 'none',
                  color: mode === m ? 'var(--ink)' : 'var(--ink-light)',
                  boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                  transition: 'all .15s',
                }}
              >
                {m === 'login' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {mode === 'register' && (
                <>
                  <div>
                    <label className="label">Full name</label>
                    <input
                      className={`input-field${errors.name ? ' error' : ''}`}
                      placeholder="Dr. Ravi Sharma"
                      {...reg('name', { required: true })}
                    />
                    {errors.name && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Name is required</p>}
                  </div>

                  <div>
                    <label className="label">I am a</label>
                    <select className="input-field" {...reg('role')}>
                      <option value="DOCTOR">Doctor</option>
                      <option value="ADMIN">Admin (Organization Owner)</option>
                      <option value="PHARMACIST">Pharmacist</option>
                    </select>
                  </div>

                  {currentRole !== 'PHARMACIST' && (
                    <div>
                      <label className="label">
                        {currentRole === 'ADMIN' ? 'Organization name' : 'Clinic name (optional)'}
                      </label>
                      <input
                        className="input-field"
                        placeholder={currentRole === 'ADMIN' ? 'e.g. Apollo Healthcare' : 'Optional'}
                        {...reg('clinic_name')}
                      />
                      {currentRole === 'ADMIN' && (
                        <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 4 }}>
                          This is your organization's name. You'll add individual hospitals from the admin portal.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="label">Email address</label>
                <input
                  className={`input-field${errors.email ? ' error' : ''}`}
                  type="email"
                  placeholder="you@example.com"
                  {...reg('email', { required: true })}
                />
                {errors.email && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Email is required</p>}
              </div>

              <div>
                <label className="label">Password</label>
                <input
                  className={`input-field${errors.password ? ' error' : ''}`}
                  type="password"
                  placeholder="Min 6 characters"
                  {...reg('password', { required: true, minLength: 6 })}
                />
                {errors.password && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Min 6 characters required</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: 4 }}
              >
                {isSubmitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </div>
          </form>

          {/* Switch mode link */}
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-light)', marginTop: 20 }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal)', fontWeight: 500, fontSize: 12, fontFamily: 'var(--font-sans)' }}
            >
              {mode === 'login' ? 'Register' : 'Sign in'}
            </button>
          </p>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-light)', marginTop: 36 }}>
            © 2024 Askim Technologies Pvt. Ltd.
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
        }
        @media (min-width: 769px) {
          .show-mobile { display: none !important; }
        }
      `}</style>
    </div>
  )
}
