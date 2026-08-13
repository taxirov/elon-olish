// Admin page: view submitted applications.
//   https://<project>.vercel.app/api/applications?key=ADMIN_KEY
const { listApplications } = require('../lib/store');
const { STATUS_ORDER, STATUS_LABELS, STATUS_COLORS, ASSIGNEES } = require('../lib/statuses');

const ADMIN_KEY = process.env.ADMIN_SECRET || process.env.WEBHOOK_SECRET;
const PAGE_SIZE = 20;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function photoThumbs(fileIds, key) {
  if (!fileIds || !fileIds.length) return '<span class="muted">yo\'q</span>';
  return fileIds
    .map(
      (id) =>
        `<a href="/api/photo?key=${encodeURIComponent(key)}&file_id=${encodeURIComponent(id)}" target="_blank"><img class="thumb" src="/api/photo?key=${encodeURIComponent(key)}&file_id=${encodeURIComponent(id)}" loading="lazy" /></a>`,
    )
    .join('');
}

function statusCell(app, key, page) {
  const current = STATUS_ORDER.includes(app.status) ? app.status : 'yuborilgan';
  const options = STATUS_ORDER.map(
    (s) => `<option value="${s}" ${s === current ? 'selected' : ''}>${escapeHtml(STATUS_LABELS[s])}</option>`,
  ).join('');
  const assigneeOptions = ASSIGNEES.map(
    (name) =>
      `<option value="${escapeHtml(name)}" ${name === app.assignee ? 'selected' : ''}>${escapeHtml(name)}</option>`,
  ).join('');

  const extraInfo = [
    app.assignee ? `<div class="muted">👤 ${escapeHtml(app.assignee)}</div>` : '',
    app.analogId ? `<div class="muted">🔗 Analog ID: ${escapeHtml(app.analogId)}</div>` : '',
    app.rejectionReason ? `<div class="muted">✏️ Sabab: ${escapeHtml(app.rejectionReason)}</div>` : '',
  ].join('');

  return `
    <span class="status-badge" style="background:${STATUS_COLORS[current]}">${escapeHtml(STATUS_LABELS[current])}</span>
    ${extraInfo}
    <form method="POST" action="/api/set-status" class="status-form" onsubmit="return validateStatusForm(this)">
      <input type="hidden" name="key" value="${escapeHtml(key)}" />
      <input type="hidden" name="id" value="${escapeHtml(app.id)}" />
      <input type="hidden" name="page" value="${page}" />
      <select name="status" onchange="toggleStatusFields(this)">${options}</select>
      <div class="extra-field assignee-field">
        <select name="assignee">
          <option value="">— tanlang —</option>
          ${assigneeOptions}
        </select>
      </div>
      <div class="extra-field analog-field">
        <input type="text" name="analogId" placeholder="Analog ID" value="${escapeHtml(app.analogId || '')}" />
      </div>
      <div class="extra-field reason-field">
        <textarea name="rejectionReason" placeholder="Rad etish sababi">${escapeHtml(app.rejectionReason || '')}</textarea>
      </div>
      <button type="submit">Saqlash</button>
    </form>`;
}

function renderRow(app, key, page) {
  return `
    <tr>
      <td>${escapeHtml(app.id)}</td>
      <td>${escapeHtml(new Date(app.createdAt).toLocaleString('uz-UZ'))}</td>
      <td>${escapeHtml(app.regionName)}, ${escapeHtml(app.districtName)}<br/><span class="muted">${escapeHtml(app.address)}</span></td>
      <td>${escapeHtml(app.propertyType)}</td>
      <td>${escapeHtml(app.price)}</td>
      <td>${escapeHtml(app.phone)}</td>
      <td>${escapeHtml(app.fullName || 'Nomaʼlum')}${app.username ? `<br/><span class="muted">@${escapeHtml(app.username)}</span>` : ''}</td>
      <td>${statusCell(app, key, page)}</td>
      <td>${app.documentsVerifiedBadge ? '✅' : '—'}</td>
      <td class="photos">
        <div class="muted">Tashqi (${app.exteriorPhotos.length})</div>
        ${photoThumbs(app.exteriorPhotos, key)}
        <div class="muted">Ichki (${app.interiorPhotos.length})</div>
        ${photoThumbs(app.interiorPhotos, key)}
      </td>
    </tr>`;
}

function renderPage({ applications, total, page, key }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = applications.map((app) => renderRow(app, key, page)).join('');
  const prevLink = page > 0 ? `<a href="?key=${encodeURIComponent(key)}&page=${page - 1}">← Oldingi</a>` : '<span class="muted">← Oldingi</span>';
  const nextLink =
    page + 1 < totalPages
      ? `<a href="?key=${encodeURIComponent(key)}&page=${page + 1}">Keyingi →</a>`
      : '<span class="muted">Keyingi →</span>';

  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Murojaatlar</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; background: #f7f7f8; color: #1a1a1a; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .muted { color: #888; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  th, td { padding: 8px 10px; border-bottom: 1px solid #eee; text-align: left; vertical-align: top; font-size: 13px; }
  th { background: #fafafa; position: sticky; top: 0; }
  .thumb { width: 56px; height: 56px; object-fit: cover; border-radius: 4px; margin: 2px; }
  .photos { min-width: 160px; }
  .pagination { margin-top: 16px; display: flex; gap: 16px; align-items: center; }
  .status-badge { display: inline-block; color: #fff; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
  .status-form { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
  .status-form select { font-size: 12px; }
  .status-form button { font-size: 12px; cursor: pointer; align-self: flex-end; }
  .extra-field { display: none; width: 100%; }
  .extra-field.show { display: block; }
  .extra-field select, .extra-field input, .extra-field textarea { font-size: 12px; width: 150px; font-family: inherit; }
  .extra-field textarea { height: 44px; resize: vertical; }
</style>
</head>
<body>
  <h1>Murojaatlar (${total})</h1>
  <p class="muted">Sahifa ${page + 1} / ${totalPages}</p>
  <div style="overflow-x:auto">
    <table>
      <thead>
        <tr>
          <th>ID</th><th>Sana</th><th>Manzil</th><th>Turi</th><th>Narx</th>
          <th>Telefon</th><th>Mijoz</th><th>Holat</th><th>Hujjat</th><th>Rasmlar</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="10" class="muted">Hozircha murojaatlar yo\'q</td></tr>'}</tbody>
    </table>
  </div>
  <div class="pagination">${prevLink}${nextLink}</div>
  <script>
    function toggleStatusFields(select) {
      const form = select.closest('form');
      form.querySelectorAll('.extra-field').forEach((el) => el.classList.remove('show'));
      const map = {
        korib_chiqilmoqda: '.assignee-field',
        analog_tayyor: '.analog-field',
        rad_etildi: '.reason-field',
      };
      const sel = map[select.value];
      if (sel) form.querySelector(sel).classList.add('show');
    }
    function validateStatusForm(form) {
      const status = form.status.value;
      if (status === 'korib_chiqilmoqda' && !form.assignee.value) {
        alert("Foydalanuvchini tanlang");
        return false;
      }
      if (status === 'analog_tayyor' && !form.analogId.value.trim()) {
        alert('Analog ID kiriting');
        return false;
      }
      if (status === 'rad_etildi' && !form.rejectionReason.value.trim()) {
        alert('Rad etish sababini kiriting');
        return false;
      }
      return true;
    }
    document.querySelectorAll('.status-form select[name="status"]').forEach(toggleStatusFields);
  </script>
</body>
</html>`;
}

module.exports = async (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) {
    res.status(401).send('Unauthorized. Pass ?key=ADMIN_SECRET.');
    return;
  }

  const page = Math.max(0, parseInt(req.query.page, 10) || 0);
  const { applications, total } = await listApplications({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(renderPage({ applications, total, page, key: ADMIN_KEY }));
};
