// One-off setup helper. After deploying to Vercel, visit:
//   https://<your-project>.vercel.app/api/set-webhook?setup=YOUR_WEBHOOK_SECRET
// This registers the bot's webhook URL with Telegram. You only need to do
// this once per deployment domain (or again if you change WEBHOOK_SECRET).
const { Telegraf } = require('telegraf');

module.exports = async (req, res) => {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || req.query.setup !== secret) {
    res.status(401).json({ ok: false, error: 'Unauthorized. Pass ?setup=WEBHOOK_SECRET.' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    res.status(500).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not set' });
    return;
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const url = `https://${host}/api/webhook`;

  const bot = new Telegraf(token);
  await bot.telegram.setWebhook(url, { secret_token: secret });
  const info = await bot.telegram.getWebhookInfo();

  res.status(200).json({ ok: true, url, webhookInfo: info });
};
