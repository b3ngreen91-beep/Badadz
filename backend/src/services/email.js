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
    const result = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject,
      html,
      text,
    });

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
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

async function sendCampaignPurchaseEmails(order) {
  const frontend = getFrontendUrl();

  const buyerSubject = `BadAdz purchase confirmed: ${order.website_name}`;
  const sellerSubject = `Your BadAdz listing sold: ${order.website_name}`;

  const buyerText = [
    `Your BadAdz purchase is confirmed.`,
    `Website: ${order.website_name}`,
    `URL: ${order.website_url}`,
    `Price paid: ${money(order.price_paid)}`,
    `Campaign start: ${date(order.campaign_starts_at)}`,
    `Campaign end: ${date(order.campaign_ends_at)}`,
    `Seller contact: ${order.seller_email || 'Not available'}`,
    `View your campaigns: ${frontend}`,
  ].join('\n');

  const sellerText = [
    `Your BadAdz listing sold.`,
    `Website: ${order.website_name}`,
    `Buyer: ${order.advertiser_name || 'Advertiser'}`,
    `Buyer email: ${order.advertiser_email || 'Not available'}`,
    `Price paid: ${money(order.price_paid)}`,
    `Your earnings: ${money(order.seller_earnings)}`,
    `Platform fee: ${money(order.platform_fee)}`,
    `Campaign start: ${date(order.campaign_starts_at)}`,
    `Campaign end: ${date(order.campaign_ends_at)}`,
    `View your sales: ${frontend}`,
  ].join('\n');

  const buyerHtml = `
    <h2>Your BadAdz purchase is confirmed</h2>
    <p>Your 30-day banner placement has been paid for and activated.</p>
    <ul>
      <li><strong>Website:</strong> ${order.website_name}</li>
      <li><strong>URL:</strong> ${order.website_url}</li>
      <li><strong>Price paid:</strong> ${money(order.price_paid)}</li>
      <li><strong>Campaign start:</strong> ${date(order.campaign_starts_at)}</li>
      <li><strong>Campaign end:</strong> ${date(order.campaign_ends_at)}</li>
      <li><strong>Seller contact:</strong> ${order.seller_email || 'Not available'}</li>
    </ul>
    <p><a href="${frontend}">Open BadAdz</a></p>
  `;

  const sellerHtml = `
    <h2>Your BadAdz listing sold</h2>
    <p>A buyer purchased a 30-day banner placement from your listing.</p>
    <ul>
      <li><strong>Website:</strong> ${order.website_name}</li>
      <li><strong>Buyer:</strong> ${order.advertiser_name || 'Advertiser'}</li>
      <li><strong>Buyer email:</strong> ${order.advertiser_email || 'Not available'}</li>
      <li><strong>Price paid:</strong> ${money(order.price_paid)}</li>
      <li><strong>Your earnings:</strong> ${money(order.seller_earnings)}</li>
      <li><strong>Platform fee:</strong> ${money(order.platform_fee)}</li>
      <li><strong>Campaign start:</strong> ${date(order.campaign_starts_at)}</li>
      <li><strong>Campaign end:</strong> ${date(order.campaign_ends_at)}</li>
    </ul>
    <p><a href="${frontend}">Open BadAdz</a></p>
  `;

  await Promise.allSettled([
    sendEmail({
      to: order.advertiser_email,
      subject: buyerSubject,
      html: buyerHtml,
      text: buyerText,
    }),
    sendEmail({
      to: order.seller_email,
      subject: sellerSubject,
      html: sellerHtml,
      text: sellerText,
    }),
  ]);
}

module.exports = {
  sendCampaignPurchaseEmails,
};
