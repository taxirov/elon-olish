// Updates an application's status from the admin page (api/applications.js).
const { updateApplicationStatus } = require('../lib/store');
const { STATUS_ORDER } = require('../lib/statuses');

const ADMIN_KEY = process.env.ADMIN_SECRET || process.env.WEBHOOK_SECRET;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const { key, id, status, page } = req.body || {};

  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    res.status(401).send('Unauthorized');
    return;
  }
  if (!id || !STATUS_ORDER.includes(status)) {
    res.status(400).send('Invalid id/status');
    return;
  }

  await updateApplicationStatus(id, status);

  const pageParam = page ? `&page=${encodeURIComponent(page)}` : '';
  res.writeHead(302, { Location: `/?key=${encodeURIComponent(key)}${pageParam}` });
  res.end();
};
