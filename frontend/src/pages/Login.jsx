import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const u = await login(email, password);
      toast.success('Welcome back');
      const next = location.state?.from || (u.role === 'owner' ? '/dashboard/owner' : '/');
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-20" data-testid="login-page">
      <div className="text-[10px] uppercase tracking-[0.4em] text-primary mb-4">[ Auth / Login ]</div>
      <h1 className="font-display font-black uppercase text-3xl tracking-tight mb-2">Sign in</h1>
      <p className="text-sm text-muted-foreground mb-8">Welcome back. Get back to selling/buying ad space.</p>

      <form onSubmit={onSubmit} className="space-y-4 border border-border p-6 bg-card">
        <Field label="Email">
          <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)}
            className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary"
            data-testid="login-email-input" />
        </Field>
        <Field label="Password">
          <input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)}
            className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary"
            data-testid="login-password-input" />
        </Field>

        {error && <div className="text-xs text-primary border border-primary px-3 py-2" data-testid="login-error">{error}</div>}

        <button type="submit" disabled={busy}
          className="w-full bg-primary text-primary-foreground py-3 text-xs uppercase tracking-[0.3em] font-bold hover:bg-acid hover:text-black transition-colors disabled:opacity-60"
          data-testid="login-submit-btn">
          {busy ? 'Signing in…' : 'Sign in →'}
        </button>
      </form>

      <p className="mt-6 text-xs text-muted-foreground text-center uppercase tracking-[0.2em]">
        No account? <Link to="/register" className="text-foreground hover:text-primary" data-testid="login-to-register-link">Create one</Link>
      </p>
    </div>
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
