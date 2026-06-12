import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { LogOut, Plus, LayoutDashboard, Store } from 'lucide-react';

const linkClass = ({ isActive }) =>
  `text-xs uppercase tracking-[0.2em] font-bold px-3 py-2 transition-colors duration-150 ${
    isActive ? 'text-primary' : 'text-foreground hover:text-primary'
  }`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 bg-black border-b border-border" data-testid="navbar">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
        <Link to="/" className="flex items-center gap-2 group" data-testid="nav-logo">
          <span className="inline-block w-3 h-3 bg-primary group-hover:bg-acid transition-colors duration-150" />
          <span className="font-display font-black tracking-tighter text-xl uppercase">
            Bad<span className="text-primary">Adz</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/" end className={linkClass} data-testid="nav-marketplace">
            <span className="inline-flex items-center gap-2"><Store size={14}/>Marketplace</span>
          </NavLink>
          {user?.role === 'owner' && (
            <>
              <NavLink to="/dashboard/owner" className={linkClass} data-testid="nav-owner-dashboard">
                <span className="inline-flex items-center gap-2"><LayoutDashboard size={14}/>Dashboard</span>
              </NavLink>
              <NavLink to="/listings/new" className={linkClass} data-testid="nav-create-listing">
                <span className="inline-flex items-center gap-2"><Plus size={14}/>New Listing</span>
              </NavLink>
            </>
          )}
          {user?.role === 'advertiser' && (
            <NavLink to="/dashboard/advertiser" className={linkClass} data-testid="nav-advertiser-dashboard">
              <span className="inline-flex items-center gap-2"><LayoutDashboard size={14}/>My Campaigns</span>
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden sm:inline text-xs text-muted-foreground uppercase tracking-widest" data-testid="nav-user-email">
                {user.email} · {user.role}
              </span>
              <button
                onClick={() => { logout(); navigate('/'); }}
                className="border border-border px-3 py-2 text-xs uppercase tracking-[0.2em] font-bold hover:border-primary hover:text-primary transition-colors duration-150 inline-flex items-center gap-2"
                data-testid="nav-logout-btn"
              >
                <LogOut size={14}/> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="px-3 py-2 text-xs uppercase tracking-[0.2em] font-bold hover:text-primary transition-colors" data-testid="nav-login-link">
                Login
              </Link>
              <Link
                to="/register"
                className="bg-primary text-primary-foreground px-4 py-2 text-xs uppercase tracking-[0.2em] font-bold hover:bg-acid hover:text-black transition-colors duration-150"
                data-testid="nav-register-link"
              >
                Get In →
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
