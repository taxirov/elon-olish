// Admin page: view submitted applications.
//   https://<project>.vercel.app/api/applications?key=ADMIN_KEY
const { listApplications, getStatusCounts } = require('../lib/store');
const {
  STATUS_ORDER,
  STATUS_LABELS,
  STATUS_ICONS,
  STATUS_COLORS,
  ASSIGNEE_REQUIRED_STATUSES,
  ASSIGNEES,
  ASSIGNEE_COLORS,
} = require('../lib/statuses');
const { icon } = require('../lib/icons');

const ADMIN_KEY = process.env.ADMIN_SECRET || process.env.WEBHOOK_SECRET;
const PAGE_SIZE = 20;
const ACCENT = '#4f46e5';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function currentStatusOf(app) {
  return STATUS_ORDER.includes(app.status) ? app.status : 'yuborilgan';
}

function photoThumbs(fileIds, key) {
  if (!fileIds || !fileIds.length) return '<span class="muted">yo\'q</span>';
  return fileIds
    .map((id) => {
      const url = `/api/photo?key=${encodeURIComponent(key)}&file_id=${encodeURIComponent(id)}`;
      return `<img class="thumb" src="${url}" loading="lazy" onclick="openLightbox(this.src)" />`;
    })
    .join('');
}

function assigneeCell(app) {
  if (!app.assignee) return '<span class="muted">—</span>';
  const color = ASSIGNEE_COLORS[app.assignee] || '#6b7280';
  const initials = app.assignee.slice(0, 2).toUpperCase();
  return `<span class="avatar"><span class="dot" style="background:${color}">${escapeHtml(initials)}</span>${escapeHtml(app.assignee)}</span>`;
}

function statusCell(app) {
  const current = currentStatusOf(app);
  const reason = app.rejectionReason
    ? `<div class="muted note">${icon('pencil', 12)}Sabab: ${escapeHtml(app.rejectionReason)}</div>`
    : '';
  return `
    <span class="status-badge" style="background:${STATUS_COLORS[current]}">${icon(STATUS_ICONS[current])}${escapeHtml(STATUS_LABELS[current])}</span>
    ${reason}`;
}

function actionsCell(app, key, page) {
  const current = currentStatusOf(app);
  const options = STATUS_ORDER.map(
    (s) => `<option value="${s}" ${s === current ? 'selected' : ''}>${escapeHtml(STATUS_LABELS[s])}</option>`,
  ).join('');
  const assigneeOptions = ASSIGNEES.map(
    (name) =>
      `<option value="${escapeHtml(name)}" ${name === app.assignee ? 'selected' : ''}>${escapeHtml(name)}</option>`,
  ).join('');

  return `
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
  const current = currentStatusOf(app);
  return `
    <tr data-status="${current}">
      <td><span class="id-chip">${escapeHtml(app.id)}</span></td>
      <td>${app.analogId ? escapeHtml(app.analogId) : '<span class="muted">—</span>'}</td>
      <td>${escapeHtml(new Date(app.createdAt).toLocaleString('uz-UZ'))}</td>
      <td>${escapeHtml(app.regionName)}, ${escapeHtml(app.districtName)}<br/><span class="muted">${escapeHtml(app.address)}</span>${
        app.location
          ? `<br/><a class="map-link" href="https://maps.google.com/?q=${app.location.latitude},${app.location.longitude}" target="_blank">${icon('mapPin', 12)}Xaritada ko'rish</a>`
          : ''
      }</td>
      <td>${escapeHtml(app.propertyType)}</td>
      <td>${escapeHtml(app.price)}</td>
      <td>${escapeHtml(app.phone)}</td>
      <td>${escapeHtml(app.fullName || 'Nomaʼlum')}${app.username ? `<br/><span class="muted">@${escapeHtml(app.username)}</span>` : ''}</td>
      <td>${assigneeCell(app)}</td>
      <td>${statusCell(app)}</td>
      <td>${
        app.documentsVerifiedBadge
          ? `<span class="doc-badge yes">${icon('fileCheck', 13)}Hujjatlar</span>`
          : `<span class="doc-badge no">${icon('xCircle', 13)}Hujjatlar</span>`
      }</td>
      <td class="photos">
        <div class="muted">Tashqi (${app.exteriorPhotos.length})</div>
        ${photoThumbs(app.exteriorPhotos, key)}
        <div class="muted">Ichki (${app.interiorPhotos.length})</div>
        ${photoThumbs(app.interiorPhotos, key)}
      </td>
      <td>${actionsCell(app, key, page)}</td>
    </tr>`;
}

function renderStatCards(statusCounts, total) {
  const allCard = `
    <div class="stat-card active" data-filter="all" onclick="setFilter('all')" style="--accent-color:${ACCENT}">
      <div class="num">${total}</div>
      <div class="label">${icon('layers', 13)}Barchasi</div>
    </div>`;
  const cards = STATUS_ORDER.map(
    (s) => `
    <div class="stat-card" data-filter="${s}" onclick="setFilter('${s}')" style="--accent-color:${STATUS_COLORS[s]}">
      <div class="num">${statusCounts[s] || 0}</div>
      <div class="label">${icon(STATUS_ICONS[s], 13)}${escapeHtml(STATUS_LABELS[s])}</div>
    </div>`,
  ).join('');
  return allCard + cards;
}

function renderPage({ applications, total, statusCounts, page, key }) {
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
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  :root {
    --bg: #f3f4f8;
    --card-bg: #ffffff;
    --border: #e5e7eb;
    --text: #111827;
    --muted: #6b7280;
    --accent: ${ACCENT};
    --radius: 14px;
    --shadow: 0 1px 2px rgba(16,24,40,.04), 0 6px 16px rgba(16,24,40,.06);
  }
  * { box-sizing: border-box; }
  body {
    background: var(--bg);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--text);
    margin: 0;
    padding: 32px clamp(16px, 4vw, 48px);
  }
  .topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .topbar h1 { font-size: 24px; margin: 0; font-weight: 700; display: flex; align-items: center; gap: 8px; }
  .brand-icon { color: var(--accent); display: inline-flex; }
  .topbar .count-badge { background: var(--accent); color: #fff; font-size: 13px; padding: 2px 10px; border-radius: 999px; font-weight: 600; }
  .topbar p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
  .search-box input {
    border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px;
    font-size: 14px; width: 260px; max-width: 60vw; background: #fff; font-family: inherit;
  }
  .search-box input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }

  .stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
  .stat-card {
    background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px 20px; min-width: 118px; cursor: pointer; box-shadow: var(--shadow);
    border-top: 3px solid var(--accent-color, var(--accent));
    transition: transform .12s ease, box-shadow .12s ease;
  }
  .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(16,24,40,.1); }
  .stat-card.active { outline: 2px solid var(--accent-color, var(--accent)); outline-offset: -1px; }
  .stat-card .num { font-size: 22px; font-weight: 700; line-height: 1.2; }
  .stat-card .label { font-size: 12px; color: var(--muted); margin-top: 4px; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
  .stat-card .label .icon { color: var(--accent-color, var(--accent)); }

  .card { background: var(--card-bg); border-radius: var(--radius); box-shadow: var(--shadow); border: 1px solid var(--border); overflow: hidden; }
  .table-scroll { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 12px 14px; text-align: left; vertical-align: top; font-size: 13px; border-bottom: 1px solid var(--border); }
  thead th { background: #fafbfc; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); position: sticky; top: 0; white-space: nowrap; }
  tbody tr:hover { background: #f9fafb; }
  tbody tr:last-child td { border-bottom: none; }
  .muted { color: var(--muted); font-size: 12px; }

  .id-chip { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; background: #eef2ff; color: #4338ca; padding: 3px 8px; border-radius: 6px; }

  .avatar { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
  .avatar .dot { width: 22px; height: 22px; min-width: 22px; border-radius: 50%; color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }

  .status-badge { display: inline-flex; align-items: center; gap: 5px; color: #fff; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
  .icon { vertical-align: middle; flex-shrink: 0; }
  .note { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
  .doc-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
  .doc-badge.yes { background: #dcfce7; color: #15803d; }
  .doc-badge.no { background: #fee2e2; color: #b91c1c; }
  .map-link { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--accent); text-decoration: none; margin-top: 4px; }
  .map-link:hover { text-decoration: underline; }

  .photos { min-width: 170px; }
  .thumb { width: 52px; height: 52px; object-fit: cover; border-radius: 8px; margin: 2px; cursor: zoom-in; border: 1px solid var(--border); transition: transform .15s ease; }
  .thumb:hover { transform: scale(1.08); }

  .status-form { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; min-width: 150px; }
  .status-form select, .status-form input, .status-form textarea {
    font-size: 12px; border-radius: 8px; border: 1px solid var(--border); padding: 6px 8px; font-family: inherit; width: 100%;
  }
  .status-form button {
    background: var(--accent); color: #fff; border: none; cursor: pointer;
    align-self: flex-end; padding: 7px 14px; font-weight: 600; border-radius: 8px; font-size: 12px;
  }
  .status-form button:hover { background: #4338ca; }
  .extra-field { display: none; width: 100%; }
  .extra-field.show { display: block; }
  .extra-field textarea { height: 44px; resize: vertical; }

  .pagination { margin-top: 20px; display: flex; gap: 20px; align-items: center; justify-content: center; }
  .pagination a { color: var(--accent); text-decoration: none; font-weight: 600; font-size: 13px; }
  .pagination a:hover { text-decoration: underline; }

  .lightbox { display: none; position: fixed; inset: 0; background: rgba(15,17,23,.9); z-index: 1000; align-items: center; justify-content: center; cursor: zoom-out; padding: 24px; }
  .lightbox.show { display: flex; }
  .lightbox img { max-width: 90vw; max-height: 90vh; border-radius: 10px; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
</style>
</head>
<body>
  <div class="topbar">
    <div>
      <h1><span class="brand-icon">${icon('home', 20)}</span>Murojaatlar <span class="count-badge">${total}</span></h1>
      <p>Barcha kelib tushgan e'lon arizalari bitta joyda</p>
    </div>
    <div class="search-box">
      <input id="search" type="text" placeholder="Qidirish: ism, manzil, telefon, ID..." oninput="applyFilters()" />
    </div>
  </div>

  <div class="stats">${renderStatCards(statusCounts, total)}</div>

  <div class="card">
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Murojaat ID</th><th>Analog ID</th><th>Sana</th><th>Manzil</th><th>Turi</th><th>Narx</th>
            <th>Telefon</th><th>Mijoz</th><th>Tekshiruvchi</th><th>Holat</th><th>Hujjat</th><th>Rasmlar</th><th>Amallar</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="13" class="muted">Hozircha murojaatlar yo\'q</td></tr>'}</tbody>
      </table>
    </div>
  </div>

  <div class="pagination">${prevLink}<span class="muted">Sahifa ${page + 1} / ${totalPages}</span>${nextLink}</div>

  <div id="lightbox" class="lightbox" onclick="closeLightbox()">
    <img id="lightbox-img" src="" alt="" />
  </div>

  <script>
    let currentFilter = 'all';

    function setFilter(status) {
      currentFilter = status;
      document.querySelectorAll('.stat-card').forEach((c) => c.classList.toggle('active', c.dataset.filter === status));
      applyFilters();
    }

    function applyFilters() {
      const q = document.getElementById('search').value.trim().toLowerCase();
      document.querySelectorAll('tbody tr[data-status]').forEach((tr) => {
        const matchesStatus = currentFilter === 'all' || tr.dataset.status === currentFilter;
        const matchesSearch = !q || tr.textContent.toLowerCase().includes(q);
        tr.style.display = matchesStatus && matchesSearch ? '' : 'none';
      });
    }

    function openLightbox(src) {
      document.getElementById('lightbox-img').src = src;
      document.getElementById('lightbox').classList.add('show');
    }
    function closeLightbox() {
      document.getElementById('lightbox').classList.remove('show');
      document.getElementById('lightbox-img').src = '';
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });

    const assigneeRequiredStatuses = ${JSON.stringify(ASSIGNEE_REQUIRED_STATUSES)};

    function toggleStatusFields(select) {
      const form = select.closest('form');
      form.querySelectorAll('.extra-field').forEach((el) => el.classList.remove('show'));
      if (assigneeRequiredStatuses.includes(select.value)) {
        form.querySelector('.assignee-field').classList.add('show');
      } else if (select.value === 'analog_tayyor') {
        form.querySelector('.analog-field').classList.add('show');
      } else if (select.value === 'rad_etildi') {
        form.querySelector('.reason-field').classList.add('show');
      }
    }
    function validateStatusForm(form) {
      const status = form.status.value;
      if (assigneeRequiredStatuses.includes(status) && !form.assignee.value) {
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
  const [{ applications, total }, statusCounts] = await Promise.all([
    listApplications({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    getStatusCounts(),
  ]);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(renderPage({ applications, total, statusCounts, page, key: ADMIN_KEY }));
};
