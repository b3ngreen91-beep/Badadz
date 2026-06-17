const { Resend } = require('resend');

function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:3000';
}

function getFromEmail() {
  return process.env.EMAIL_FROM || 'BadAdz <onboarding@resend.dev>';
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

async function sendEmail({ to, subject, html, text }) {
  const resend = getResendClient();

  if (!resend) {
    console.log(`[email] skipped "${subject}" because RESEND_API_KEY is not configured`);
    return { skipped: true };
  }

  if (!to) {
    console.log(`[email] skipped "${subject}" because recipient is missing`);
    return { skipped: true };
  }

  try {
    const result = await resend.emails.send({ from: getFromEmail(), to, subject, html, text });
    console.log(`[email] sent "${subject}" to ${to}`);
    return result;
  } catch (err) {
    console.error(`[email] failed to send "${subject}" to ${to}:`, err);
    return { error: err.message || 'Email failed' };
  }
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function date(value) {
  if (!value) return 'Not available yet';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function sendCampaignPurchaseEmails(order) {
  const frontend = getFrontendUrl();
  const howItWorksUrl = `${frontend}/how-it-works`;
  const advertiserDashboardUrl = `${frontend}/dashboard/advertiser`;
  const ownerDashboardUrl = `${frontend}/dashboard/owner`;

  const buyerSubject = `BadAdz purchase confirmed: ${order.website_name}`;
  const sellerSubject = `New BadAdz ad awaiting review: ${order.website_name}`;

  const buyerText = [
    `Your BadAdz purchase is confirmed.`,
    `Website: ${order.website_name}`,
    `URL: ${order.website_url}`,
    `Price paid: ${money(order.price_paid)}`,
    `Campaign start: ${date(order.campaign_starts_at)}`,
    `Campaign end: ${date(order.campaign_ends_at)}`,
    `Website owner: ${order.seller_email || 'Not available'}`,
    ``,
    `Next steps:`,
    `1. Your payment, destination URL, and uploaded ad creative were received by BadAdz.`,
    `2. The website owner will review your banner previews.`,
    `3. Once approved, your campaign automatically appears where the owner installed their BadAdz ad slot code.`,
    `4. Track views, clicks, CTR, and status from My Campaigns.`,
    ``,
    `My Campaigns: ${advertiserDashboardUrl}`,
    `Learn more: ${howItWorksUrl}`,
  ].join('\n');

  const sellerText = [
    `A BadAdz advertiser paid for your listing and is awaiting review.`,
    `Website: ${order.website_name}`,
    `Advertiser: ${order.advertiser_name || 'Advertiser'}`,
    `Advertiser email: ${order.advertiser_email || 'Not available'}`,
    `Price paid: ${money(order.price_paid)}`,
    `Your earnings: ${money(order.seller_earnings)}`,
    `Platform fee: ${money(order.platform_fee)}`,
    ``,
    `Next steps:`,
    `1. Open your Owner Dashboard.`,
    `2. Review the advertiser's uploaded banner previews and destination URL.`,
    `3. Approve the ad if it is acceptable.`,
    `4. Make sure your size-specific BadAdz ad slot code is installed on your website.`,
    `5. Once approved, BadAdz automatically serves the matching banner in that slot and tracks views/clicks.`,
    ``,
    `Owner Dashboard: ${ownerDashboardUrl}`,
    `Learn more: ${howItWorksUrl}`,
  ].join('\n');

  const buyerHtml = `
    <h2>Your BadAdz purchase is confirmed</h2>
    <p>Your payment, destination URL, and uploaded ad creative were received by BadAdz.</p>
    <ul>
      <li><strong>Website:</strong> ${order.website_name}</li>
      <li><strong>URL:</strong> ${order.website_url}</li>
      <li><strong>Price paid:</strong> ${money(order.price_paid)}</li>
      <li><strong>Campaign start:</strong> ${date(order.campaign_starts_at)}</li>
      <li><strong>Campaign end:</strong> ${date(order.campaign_ends_at)}</li>
      <li><strong>Website owner:</strong> ${order.seller_email || 'Not available'}</li>
    </ul>
    <h3>Next steps</h3>
    <ol>
      <li>The website owner will review your banner previews and destination URL.</li>
      <li>If approved, your campaign automatically appears where the owner installed their BadAdz ad slot code.</li>
      <li>Track views, clicks, CTR, and status from My Campaigns.</li>
    </ol>
    <p><a href="${advertiserDashboardUrl}">View My Campaigns</a></p>
    <p><a href="${howItWorksUrl}">Read how BadAdz works</a></p>
  `;

  const sellerHtml = `
    <h2>New BadAdz ad awaiting review</h2>
    <p>An advertiser paid for your listing and submitted ad creative through BadAdz.</p>
    <ul>
      <li><strong>Website:</strong> ${order.website_name}</li>
      <li><strong>Advertiser:</strong> ${order.advertiser_name || 'Advertiser'}</li>
      <li><strong>Advertiser email:</strong> ${order.advertiser_email || 'Not available'}</li>
      <li><strong>Price paid:</strong> ${money(order.price_paid)}</li>
      <li><strong>Your earnings:</strong> ${money(order.seller_earnings)}</li>
      <li><strong>Platform fee:</strong> ${money(order.platform_fee)}</li>
    </ul>
    <h3>Next steps</h3>
    <ol>
      <li>Open your Owner Dashboard.</li>
      <li>Review the advertiser's banner previews and destination URL.</li>
      <li>Approve the ad if it is acceptable.</li>
      <li>Make sure your size-specific BadAdz ad slot code is installed on your website.</li>
      <li>Once approved, BadAdz automatically serves the matching banner in that slot and tracks views/clicks.</li>
    </ol>
    <p><a href="${ownerDashboardUrl}">Open Owner Dashboard</a></p>
    <p><a href="${howItWorksUrl}">Read how BadAdz works</a></p>
  `;

  await Promise.allSettled([
    sendEmail({ to: order.advertiser_email, subject: buyerSubject, html: buyerHtml, text: buyerText }),
    sendEmail({ to: order.seller_email, subject: sellerSubject, html: sellerHtml, text: sellerText }),
  ]);
}

module.exports = { sendCampaignPurchaseEmails };
