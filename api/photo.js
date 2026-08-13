// Streams a Telegram-hosted photo/document by file_id, so the admin list
// page (see api/applications.js) can show images without exposing the bot
// token to the browser.
//   https://<project>.vercel.app/api/photo?key=ADMIN_KEY&file_id=...
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_KEY = process.env.ADMIN_SECRET || process.env.WEBHOOK_SECRET;

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
};

function guessContentType(filePath, fallback) {
  const ext = (filePath.split('.').pop() || '').toLowerCase();
  return MIME_BY_EXT[ext] || fallback || 'application/octet-stream';
}

module.exports = async (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  const fileId = req.query.file_id;
  if (!fileId) {
    res.status(400).json({ ok: false, error: 'file_id is required' });
    return;
  }

  try {
    const infoResp = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
    );
    const info = await infoResp.json();
    if (!info.ok) {
      res.status(404).json({ ok: false, error: 'File not found' });
      return;
    }

    const filePath = info.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    const fileResp = await fetch(fileUrl);
    const rawType = fileResp.headers.get('content-type');
    const contentType =
      rawType && rawType !== 'application/octet-stream' ? rawType : guessContentType(filePath, rawType);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    const buffer = Buffer.from(await fileResp.arrayBuffer());
    res.status(200).send(buffer);
  } catch (err) {
    console.error('Failed to fetch photo', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch photo' });
  }
};
