import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'advertiser' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const u = await register(form);
      toast.success('Account created');
      navigate(u.role === 'owner' ? '/dashboard/owner' : '/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="max-w-2xl mx-auto px-6 py-20" data-testid="register-page">
      <div className="text-[10px] uppercase tracking-[0.4em] text-primary mb-4">[ Auth / Register ]</div>
      <h1 className="font-display font-black uppercase text-3xl tracking-tight mb-2">Create account</h1>
      <p className="text-sm text-muted-foreground mb-8">Pick your side. You can&apos;t have both — yet.</p>

      <form onSubmit={onSubmit} className="space-y-5 border border-border p-6 bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="radiogroup">
          <RoleBox
            active={form.role==='advertiser'}
            onClick={()=>setForm(f=>({...f, role:'advertiser'}))}
            title="I'm an Advertiser"
            desc="Buy ad placements on independent sites."
            testid="role-advertiser-btn"
          />
          <RoleBox
            active={form.role==='owner'}
            onClick={()=>setForm(f=>({...f, role:'owner'}))}
            title="I'm a Site Owner"
            desc="List banner inventory and earn 80%."
            testid="role-owner-btn"
          />
        </div>

        <Field label="Name">
          <input required value={form.name} onChange={set('name')}
            className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary"
            data-testid="register-name-input" />
        </Field>
        <Field label="Email">
          <input type="email" required value={form.email} onChange={set('email')}
            className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary"
            data-testid="register-email-input" />
        </Field>
        <Field label="Password (min 8 chars)">
          <input type="password" required minLength={8} value={form.password} onChange={set('password')}
            className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary"
            data-testid="register-password-input" />
        </Field>

        {error && <div className="text-xs text-primary border border-primary px-3 py-2" data-testid="register-error">{error}</div>}

        <button type="submit" disabled={busy}
          className="w-full bg-primary text-primary-foreground py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors disabled:opacity-60"
          data-testid="register-submit-btn">
          {busy ? 'Creating…' : 'Create Account →'}
        </button>
      </form>

      <p className="mt-6 text-xs text-muted-foreground text-center uppercase tracking-[0.2em]">
        Already have one? <Link to="/login" className="text-foreground hover:text-primary" data-testid="register-to-login-link">Sign in</Link>
      </p>
    </div>
  );
}

function RoleBox({ active, onClick, title, desc, testid }) {
  return (
    <button type="button" onClick={onClick}
      className={`text-left p-4 border transition-colors ${active ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-foreground'}`}
      data-testid={testid}>
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{active ? 'Selected' : 'Tap to select'}</div>
      <div className="font-display font-black uppercase mt-1">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground block mb-2">{label}</span>
      {children}
    </label>
  );
}
