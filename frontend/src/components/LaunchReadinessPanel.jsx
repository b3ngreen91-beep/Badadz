import React from 'react';
import { CheckCircle2, CircleAlert, CreditCard, ListPlus, Megaphone, ShieldCheck, Wand2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LaunchReadinessPanel({ stripeConnected, activeCount, verifiedCount, totalListings, needsInstallCount, pendingOrders }) {
  const checklist = [
    {
      key: 'stripe',
      title: 'Connect Stripe',
      complete: stripeConnected,
      description: stripeConnected ? 'Payouts are ready.' : 'Connect Stripe so seller earnings can be paid out.',
      actionLabel: 'Connect Stripe',
      actionHref: null,
      icon: CreditCard,
    },
    {
      key: 'listing',
      title: 'Create a listing',
      complete: activeCount > 0,
      description: activeCount > 0 ? `${activeCount} active listing${activeCount === 1 ? '' : 's'} live.` : 'Add at least one website banner placement.',
      actionLabel: 'Add Listing',
      actionHref: '/listings/new',
      icon: ListPlus,
    },
    {
      key: 'install',
      title: 'Install ad code',
      complete: totalListings > 0 && needsInstallCount === 0,
      description: totalListings === 0 ? 'Create a listing first.' : needsInstallCount > 0 ? `${needsInstallCount} listing${needsInstallCount === 1 ? '' : 's'} still need verification.` : `${verifiedCount}/${totalListings} ad slots verified.`,
      actionLabel: 'Open Install Wizard',
      actionHref: '#owner-listings',
      icon: Wand2,
    },
    {
      key: 'review',
      title: 'Review ad requests',
      complete: pendingOrders === 0,
      description: pendingOrders > 0 ? `${pendingOrders} paid ad request${pendingOrders === 1 ? '' : 's'} waiting.` : 'No ad requests need attention.',
      actionLabel: 'Review Requests',
      actionHref: '#ad-requests',
      icon: ShieldCheck,
    },
  ];

  const completed = checklist.filter((item) => item.complete).length;
  const percent = Math.round((completed / checklist.length) * 100);
  const ready = percent === 100;

  return (
    <section className={`border p-5 sm:p-6 mb-8 ${ready ? 'border-acid bg-acid/10' : 'border-primary bg-primary/10'}`} data-testid="launch-readiness">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-5">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-primary font-bold mb-2">
            <Megaphone size={14}/> Soft Launch Readiness
          </div>
          <h2 className="font-display font-black uppercase text-3xl sm:text-4xl tracking-tight">
            {ready ? 'Ready to invite users.' : `${percent}% ready to launch.`}
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-3xl leading-relaxed">
            Finish these setup steps before pushing hard for website owners and advertisers. This helps make sure new users land on a working, professional marketplace.
          </p>
        </div>
        <div className="border border-border bg-background p-4 min-w-[180px] text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Progress</div>
          <div className="font-display font-black text-5xl text-primary mt-1">{percent}%</div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">{completed} of {checklist.length} complete</div>
        </div>
      </div>

      <div className="h-3 bg-background border border-border mb-5 overflow-hidden">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-px bg-border border border-border">
        {checklist.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.key} className="bg-background p-4 flex flex-col min-h-[210px]">
              <div className="flex items-start justify-between gap-3 mb-3">
                <Icon size={20} className={item.complete ? 'text-acid' : 'text-primary'} />
                {item.complete ? <CheckCircle2 size={20} className="text-acid" /> : <CircleAlert size={20} className="text-gold" />}
              </div>
              <div className={`text-[10px] uppercase tracking-[0.25em] font-bold ${item.complete ? 'text-acid' : 'text-gold'}`}>
                {item.complete ? 'Complete' : 'Next Step'}
              </div>
              <h3 className="font-display font-black uppercase text-xl tracking-tight mt-2">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mt-2 flex-1">{item.description}</p>
              {!item.complete && item.actionHref && (
                <a href={item.actionHref} className="mt-4 border border-primary text-primary px-3 py-2 text-center text-[10px] uppercase tracking-[0.22em] font-bold hover:bg-primary hover:text-primary-foreground transition-colors">
                  {item.actionLabel}
                </a>
              )}
              {!item.complete && !item.actionHref && (
                <span className="mt-4 border border-border text-muted-foreground px-3 py-2 text-center text-[10px] uppercase tracking-[0.22em] font-bold">
                  Use button above
                </span>
              )}
            </div>
          );
        })}
      </div>

      {ready ? (
        <div className="mt-5 border border-acid bg-background p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-acid font-bold">Launch mode unlocked</div>
            <p className="text-sm text-muted-foreground mt-1">Start recruiting your first website owners and advertisers.</p>
          </div>
          <Link to="/" className="bg-acid text-black px-4 py-3 text-center text-[10px] uppercase tracking-[0.25em] font-bold">View Marketplace</Link>
        </div>
      ) : null}
    </section>
  );
}
