const { neon } = require('@neondatabase/serverless');

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL (yoki POSTGRES_URL) environment variable topilmadi. Neon Postgresni ulang.',
  );
}

const sql = neon(connectionString);

// Jadvallar birinchi so'rovda avtomatik yaratiladi (idempotent), shuning
// uchun qo'lda migration ishga tushirish shart emas.
let schemaReadyPromise = null;
function ensureSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS bot_sessions (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS applications (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE SEQUENCE IF NOT EXISTS application_id_seq START 1`;
    })();
  }
  return schemaReadyPromise;
}

// --- Telegraf session store, backed by Neon Postgres --------------------
// Serverless functions have no memory between invocations, so the wizard
// state (which step the user is on, photos collected so far, etc.) has to
// live in an external store.

const pgSessionStore = {
  async get(key) {
    await ensureSchema();
    const rows = await sql`SELECT value FROM bot_sessions WHERE key = ${key}`;
    return rows[0] ? rows[0].value : undefined;
  },
  async set(key, value) {
    await ensureSchema();
    await sql`
      INSERT INTO bot_sessions (key, value, updated_at)
      VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
  },
  async delete(key) {
    await ensureSchema();
    await sql`DELETE FROM bot_sessions WHERE key = ${key}`;
  },
};

// --- Application storage -------------------------------------------------
// Each submitted request ("murojaat") gets a sequential, human readable id
// and is stored as its own row in the `applications` table.

async function nextApplicationId() {
  await ensureSchema();
  const rows = await sql`SELECT nextval('application_id_seq') AS n`;
  const n = Number(rows[0].n);
  return `M-${String(n).padStart(6, '0')}`;
}

async function saveApplication(application) {
  await ensureSchema();
  await sql`
    INSERT INTO applications (id, data)
    VALUES (${application.id}, ${JSON.stringify(application)}::jsonb)
  `;
  return application;
}

async function getApplication(id) {
  await ensureSchema();
  const rows = await sql`SELECT data FROM applications WHERE id = ${id}`;
  return rows[0] ? rows[0].data : null;
}

async function listApplications({ limit = 20, offset = 0 } = {}) {
  await ensureSchema();
  const rows = await sql`
    SELECT data, created_at FROM applications
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM applications`;
  return { applications: rows.map((r) => r.data), total: count };
}

module.exports = {
  pgSessionStore,
  nextApplicationId,
  saveApplication,
  getApplication,
  listApplications,
};
