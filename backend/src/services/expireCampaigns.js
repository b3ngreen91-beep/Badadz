const db = require('../db');

/**
 * Expire paid campaigns whose end date has passed and make the listing available again.
 *
 * This lets one ad listing be sold again after its fixed 30-day placement ends.
 * The query only touches paid orders that have not already been marked expired,
 * so it is safe to run repeatedly on server startup or from a future cron job.
 */
async function expireEndedCampaigns() {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const expiredOrders = await client.query(
      `
      UPDATE orders
         SET campaign_status = 'expired'
       WHERE payment_status = 'paid'
         AND campaign_status <> 'expired'
         AND campaign_ends_at IS NOT NULL
         AND campaign_ends_at <= NOW()
       RETURNING id, listing_id
      `
    );

    if (expiredOrders.rowCount > 0) {
      const listingIds = [...new Set(expiredOrders.rows.map((row) => row.listing_id))];

      await client.query(
        `
        UPDATE listings
           SET status = 'active'
         WHERE id = ANY($1::uuid[])
           AND status = 'sold'
        `,
        [listingIds]
      );
    }

    await client.query('COMMIT');

    if (expiredOrders.rowCount > 0) {
      console.log(`[campaigns] Expired ${expiredOrders.rowCount} campaign(s) and relisted available ad space.`);
    }

    return expiredOrders.rowCount;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[campaigns] Failed to expire ended campaigns:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  expireEndedCampaigns,
};
