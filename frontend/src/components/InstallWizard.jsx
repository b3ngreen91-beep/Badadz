import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clipboard, Code2, MonitorSmartphone, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import api, { API_BASE } from '../lib/api';

const AD_SIZES = ['728x90', '300x250', '160x600', '320x50', '970x250'];

const PLATFORM_HELP = {
  HTML: ['Open the page where you want the banner to appear.', 'Paste the BadAdz code exactly where the ad should show.', 'Save and publish the page, then click Verify Installation.'],
  WordPress: ['Go to Appearance → Widgets or Site Editor.', 'Add a Custom HTML block where the banner should appear.', 'Paste the BadAdz code, save, publish, then verify.'],
  React: ['Place the BadAdz code inside the component where the ad slot should appear.', 'For best results, put it inside a div that matches your layout.', 'Deploy the site and verify after the public page updates.'],
  'Next.js': ['Use the Next.js Script component or paste the code in the page/section.', 'Make sure the page is public and deployed.', 'After deployment finishes, click Verify Installation.'],
  Shopify: ['Open Online Store → Themes → Edit code.', 'Paste the code in the template, section, or custom liquid block where the banner should appear.', 'Save the theme and verify.'],
  Other: ['Paste the code anywhere your website allows custom HTML or custom code.', 'Save and publish the page.', 'Return here and verify installation.'],
};

function backendBase() {
  return API_BASE.replace(/\/api\/?$/, '') || window.location.origin;
}

function embedCode(listing, size) {
  const src = `${backendBase()}/ads/${listing.id}.js?size=${encodeURIComponent(size)}`;
  return `<scr` + `ipt async src="${src}"></scr` + `ipt>`;
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message || 'Copied');
  } catch (_err) {
    toast.error('Could not copy');
  }
}

export default function InstallWizard({ listing, onVerified }) {
  const [platform, setPlatform] = useState('HTML');
  const [size, setSize] = useState('728x90');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(Boolean(listing.ad_code_verified));
  const code = useMemo(() => embedCode(listing, size), [listing, size]);
  const steps = PLATFORM_HELP[platform] || PLATFORM_HELP.Other;

  const verify = async () => {
    setVerifying(true);
    try {
      const { data } = await api.post('/install/verify', { listing_id: listing.id });
      setVerified(Boolean(data.verified));
      if (data.verified) {
        toast.success('Installation verified');
        onVerified?.();
      } else {
        toast.error(data.message || 'Code not detected yet');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not verify installation');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="border border-primary bg-primary/5 p-4 sm:p-5" data-testid={`install-wizard-${listing.id}`}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 border-b border-border pb-4 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold mb-2">Installation Wizard</div>
          <h3 className="font-display font-black uppercase text-2xl tracking-tight">Connect {listing.website_name}</h3>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">Install this once. BadAdz will show a polished available-space placeholder now and automatically swap in approved paid campaigns later.</p>
        </div>
        <div className={`border px-4 py-3 text-center ${verified ? 'border-acid bg-acid/10' : 'border-gold bg-gold/10'}`}>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Status</div>
          <div className={`font-display font-black uppercase text-lg mt-1 ${verified ? 'text-acid' : 'text-gold'}`}>{verified ? 'Connected' : 'Not verified'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3"><MonitorSmartphone size={14}/> Step 1</div>
          <div className="font-display font-black uppercase text-lg mb-3">Choose website type</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(PLATFORM_HELP).map((item) => (
              <button key={item} type="button" onClick={() => setPlatform(item)} className={`border px-3 py-2 text-[10px] uppercase tracking-[0.2em] ${platform === item ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:border-primary hover:text-primary'}`}>{item}</button>
            ))}
          </div>
        </div>

        <div className="border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3"><Code2 size={14}/> Step 2</div>
          <div className="font-display font-black uppercase text-lg mb-3">Pick banner size</div>
          <div className="grid grid-cols-2 gap-2">
            {AD_SIZES.map((item) => (
              <button key={item} type="button" onClick={() => setSize(item)} className={`border px-3 py-2 text-[10px] uppercase tracking-[0.2em] ${size === item ? 'border-acid text-acid bg-acid/10' : 'border-border text-muted-foreground hover:border-acid hover:text-acid'}`}>{item}</button>
            ))}
          </div>
        </div>

        <div className="border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3"><Sparkles size={14}/> Step 3</div>
          <div className="font-display font-black uppercase text-lg mb-3">Install and verify</div>
          <ol className="space-y-2 text-xs text-muted-foreground leading-relaxed list-decimal list-inside">
            {steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
      </div>

      <div className="mt-4 border border-border bg-black p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Copy this code</div>
            <div className="font-mono text-sm text-acid mt-1">{size} ad slot</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button type="button" onClick={() => copyText(code, `${size} ad code copied`)} className="inline-flex items-center justify-center gap-2 border border-acid text-acid px-4 py-2 text-[10px] uppercase tracking-[0.25em] hover:bg-acid hover:text-black"><Clipboard size={13}/> Copy Code</button>
            <button type="button" onClick={verify} disabled={verifying} className="inline-flex items-center justify-center gap-2 border border-primary text-primary px-4 py-2 text-[10px] uppercase tracking-[0.25em] hover:bg-primary hover:text-primary-foreground disabled:opacity-60">{verified ? <CheckCircle2 size={13}/> : <RefreshCw size={13}/>} {verifying ? 'Checking...' : verified ? 'Verified' : 'Verify'}</button>
          </div>
        </div>
        <code className="block text-[11px] leading-relaxed font-mono text-muted-foreground break-all bg-background border border-border p-3">{code}</code>
      </div>

      {verified && (
        <div className="mt-4 border border-acid bg-acid/10 p-4 text-center">
          <div className="font-display font-black uppercase text-2xl text-acid">Your website is ready.</div>
          <p className="text-xs text-muted-foreground mt-2">Keep this code installed. Approved campaigns will appear automatically.</p>
        </div>
      )}
    </div>
  );
}
