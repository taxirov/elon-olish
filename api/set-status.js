// Updates an application's status from the admin page (api/applications.js).
// Some statuses require extra data:
//   korib_chiqilmoqda / qayta_korilmoqda -> assignee (who's handling it)
//   analog_tayyor                         -> analogId (id of the matching analog listing)
//   rad_etildi                            -> rejectionReason (also sent to the applicant via the bot)
const { updateApplicationStatus } = require('../lib/store');
const { STATUS_ORDER, ASSIGNEE_REQUIRED_STATUSES, ASSIGNEES } = require('../lib/statuses');

const ADMIN_KEY = process.env.ADMIN_SECRET || process.env.WEBHOOK_SECRET;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function notifyRejection(chatId, applicationId, reason) {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `❌ Sizning <b>${applicationId}</b> raqamli murojaatingiz rad etildi.\n\n📝 Sabab: ${reason}`,
        parse_mode: 'HTML',
      }),
    });
    const json = await resp.json();
    if (!json.ok) console.error('Telegram sendMessage failed', json);
  } catch (err) {
    console.error('Failed to notify user about rejection', err);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const { key, id, status, page, assignee, analogId, rejectionReason } = req.body || {};

  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    res.status(401).send('Unauthorized');
    return;
  }
  if (!id || !STATUS_ORDER.includes(status)) {
    res.status(400).send('Invalid id/status');
    return;
  }

  const updates = { status };

  if (ASSIGNEE_REQUIRED_STATUSES.includes(status)) {
    if (!assignee || !ASSIGNEES.includes(assignee)) {
      res.status(400).send("Foydalanuvchini tanlang");
      return;
    }
    updates.assignee = assignee;
  }

  if (status === 'analog_tayyor') {
    if (!analogId || !analogId.trim()) {
      res.status(400).send('Analog ID kiritilmagan');
      return;
    }
    updates.analogId = analogId.trim();
  }

  if (status === 'rad_etildi') {
    if (!rejectionReason || !rejectionReason.trim()) {
      res.status(400).send('Rad etish sababi kiritilmagan');
      return;
    }
    updates.rejectionReason = rejectionReason.trim();
  }

  const app = await updateApplicationStatus(id, updates);

  if (status === 'rad_etildi' && app && app.telegramUserId) {
    await notifyRejection(app.telegramUserId, id, updates.rejectionReason);
  }

  const pageParam = page ? `&page=${encodeURIComponent(page)}` : '';
  res.writeHead(302, { Location: `/?key=${encodeURIComponent(key)}${pageParam}` });
  res.end();
};
