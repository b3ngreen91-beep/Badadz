import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clipboard, Code2, ExternalLink, MonitorSmartphone, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import api, { API_BASE } from '../lib/api';

const AD_SIZES = ['728x90', '300x250', '160x600', '320x50', '970x250'];
const PLATFORMS = [
  {
    id: 'html',
    label: 'HTML',
    icon: '🌐',
    steps: ['Open the page where you want the ad.', 'Paste the script exactly where the banner should appear.', 'Save/publish the page.', 'Return here and click Verify Installation.'],
  },
  {
    id: 'wordpress',
    label: 'WordPress',
    icon: '🟦',
    steps: ['Go to Appearance → Widgets or Site Editor.', 'Add a Custom HTML block/widget.', 'Paste your BadAdz script.', 'Update the page, then verify here.'],
  },
  {
    id: 'react',
    label: 'React',
    icon: '⚛️',
    steps: ['Add the script inside the component where the ad should display.', 'Use dangerouslySetInnerHTML only if your framework needs it.', 'Deploy your site.', 'Verify the public page here.'],
  },
  {
    id: 'next',
    label: 'Next.js',
    icon: '▲',
    steps: ['Paste the script in the page or component where the ad belongs.', 'If needed, use next/script with strategy="afterInteractive".', 'Deploy your site.', 'Verify the public page here.'],
  },
  {
    id: 'shopify',
    label: 'Shopify',
    icon: '🛍️',
    steps: ['Open Online Store → Themes → Customize.', 'Add a Custom Liquid section.', 'Paste the BadAdz script.', 'Save, publish, and verify.'],
  },
  {
    id: 'other',
    label: 'Other',
    icon: '✨',
    steps: ['Find where your website lets you add custom HTML.', 'Paste the BadAdz script.', 'Publish the page.', 'Come back and verify.'],
  },
];

function getBackendBase() {
  return API_BASE.replace(/\/api\/?$/, '') || window.location.origin;
}

function getEmbedCode(listing, size = '728x90') {
  const slotId = listing.ad_slot_id || listing.id;
  return `<script async src="${getBackendBase()}/ads/${slotId}.js?size=${encodeURIComponent(size)}"></script>`;
}

async function copyText(text, message = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch (_err) {
    toast.error('Could not copy. Press and hold the code to copy it manually.');
  }
}

export default function AdInstallWizard({ listing }) {
  const [selectedSize, setSelectedSize] = useState('728x90');
  const [platform, setPlatform] = useState('html');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(Boolean(listing.ad_code_verified));
  const [verifyMessage, setVerifyMessage] = useState(listing.ad_code_verified ? 'Installation verified. This ad slot is connected.' : 'Waiting for installation.');

  const platformInfo = useMemo(() => PLATFORMS.find((p) => p.id === platform) || PLATFORMS[0], [platform]);
  const code = getEmbedCode(listing, selectedSize);
  const previewUrl = `${getBackendBase()}/ads/${listing.ad_slot_id || listing.id}.js?size=${encodeURIComponent(selectedSize)}`;

  const verifyInstall = async () => {
    setVerifying(true);
    try {
      const { data } = await api.post(`/listings/${listing.id}/verify-install`);
      setVerified(Boolean(data.verified));
      setVerifyMessage(data.message || (data.verified ? 'Installation verified.' : 'Could not detect the code yet.'));
      if (data.verified) toast.success('🎉 Installation verified. Your website is ready.');
      else toast.error(data.message || 'Could not detect the code yet.');
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || 'Could not verify yet. Make sure your page is public and try again.';
      setVerified(false);
      setVerifyMessage(message);
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="border border-primary bg-primary/5 p-4 sm:p-5" data-testid="ad-install-wizard">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 border-b border-border pb-4 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold mb-2">Installation Wizard</div>
          <h3 className="font-display font-black uppercase text-2xl tracking-tight">Connect {listing.website_name}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mt-2 max-w-3xl">
            Install this once. When you approve a paid campaign, the ad updates automatically on your website without you editing the code again.
          </p>
        </div>
        <div className={`border px-3 py-2 text-[10px] uppercase tracking-[0.22em] font-bold ${verified ? 'border-acid text-acid bg-acid/10' : 'border-gold text-gold bg-gold/10'}`}>
          {verified ? '● Connected' : '● Not Verified'}
        </div>
      </div>

      {listing.owner_founding_member && (
        <div className="border border-gold bg-gold/10 p-3 mb-4 text-sm">
          <span className="font-bold text-gold">🏆 Founding Seller:</span> this listing is attached to your 15% lifetime platform fee. You keep 85% of every sale.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3"><MonitorSmartphone size={14}/> Step 1 · Website Type</div>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPlatform(item.id)}
                className={`border px-3 py-3 text-left transition-colors ${platform === item.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border hover:border-primary text-muted-foreground'}`}
              >
                <div className="text-lg leading-none">{item.icon}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold mt-2">{item.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3"><Code2 size={14}/> Step 2 · Pick Size + Copy Code</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {AD_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setSelectedSize(size)}
                className={`border px-3 py-2 text-[10px] uppercase tracking-[0.2em] font-bold ${selectedSize === size ? 'border-acid text-acid bg-acid/10' : 'border-border text-muted-foreground hover:border-acid hover:text-acid'}`}
              >
                {size}
              </button>
            ))}
          </div>
          <div className="border border-border bg-black p-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <div className="font-mono text-sm text-acid">{selectedSize} embed code</div>
              <button onClick={() => copyText(code, 'Embed code copied')} className="inline-flex items-center justify-center gap-2 border border-acid text-acid px-3 py-2 text-[10px] uppercase tracking-[0.22em] hover:bg-acid hover:text-black">
                <Clipboard size={12}/> Copy Code
              </button>
            </div>
            <code className="block text-[11px] leading-relaxed font-mono text-muted-foreground break-all">{code}</code>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
        <div className="lg:col-span-7 border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3"><Sparkles size={14}/> Step 3 · Install Instructions for {platformInfo.label}</div>
          <ol className="space-y-2">
            {platformInfo.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm text-muted-foreground leading-relaxed">
                <span className="shrink-0 w-6 h-6 border border-primary text-primary text-xs flex items-center justify-center font-bold">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-4 text-primary text-[10px] uppercase tracking-[0.25em] font-bold hover:text-acid">
            Preview script output <ExternalLink size={12}/>
          </a>
        </div>

        <div className="lg:col-span-5 border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3"><ShieldCheck size={14}/> Step 4 · Verify Installation</div>
          <div className={`border p-4 mb-4 ${verified ? 'border-acid bg-acid/10' : 'border-gold bg-gold/10'}`}>
            <div className="flex items-start gap-3">
              {verified ? <CheckCircle2 className="text-acid shrink-0" size={22}/> : <XCircle className="text-gold shrink-0" size={22}/>} 
              <div>
                <div className="font-display font-black uppercase tracking-tight">{verified ? 'Your website is ready!' : 'Waiting for code'}</div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">{verifyMessage}</p>
              </div>
            </div>
          </div>
          <button onClick={verifyInstall} disabled={verifying} className="w-full bg-primary text-primary-foreground px-5 py-3 text-xs uppercase tracking-[0.25em] font-bold hover:bg-acid hover:text-black transition-colors disabled:opacity-60">
            {verifying ? 'Checking Website...' : verified ? 'Verify Again' : 'Verify Installation'}
          </button>
          {verified && <div className="mt-4 text-center text-sm font-bold text-acid">🎉 Connected — approved ads will appear automatically.</div>}
        </div>
      </div>
    </div>
  );
}
