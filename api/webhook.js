const { createBot } = require('../lib/bot');

let bot;
function getBot() {
  if (!bot) bot = createBot();
  return bot;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true, info: 'Telegram webhook is alive.' });
    return;
  }

  // Verify the request really comes from Telegram using the secret token
  // we registered with setWebhook (see /api/set-webhook).
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (expectedSecret) {
    const gotSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (gotSecret !== expectedSecret) {
      res.status(401).json({ ok: false, error: 'invalid secret token' });
      return;
    }
  }

  try {
    await getBot().handleUpdate(req.body);
  } catch (err) {
    console.error('Failed to handle update', err);
  }

  res.status(200).json({ ok: true });
};
