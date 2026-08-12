const { kv } = require('@vercel/kv');

// --- Telegraf session store, backed by Vercel KV -----------------------
// Serverless functions have no memory between invocations, so the wizard
// state (which step the user is on, photos collected so far, etc.) has to
// live in an external store. Vercel KV (Redis) is perfect for this.

const SESSION_TTL_SECONDS = 60 * 60 * 6; // 6 soat harakatsizlikdan keyin sessiya tozalanadi

const kvSessionStore = {
  async get(key) {
    const value = await kv.get(key);
    return value ?? undefined;
  },
  async set(key, value) {
    await kv.set(key, value, { ex: SESSION_TTL_SECONDS });
  },
  async delete(key) {
    await kv.del(key);
  },
};

// --- Application storage -------------------------------------------------
// Each submitted request ("murojaat") gets a sequential, human readable id
// and is stored as its own KV key, plus added to an index list so it can be
// listed/paginated later if needed.

async function nextApplicationId() {
  const n = await kv.incr('mulk:app_counter');
  return `M-${String(n).padStart(6, '0')}`;
}

async function saveApplication(application) {
  await kv.set(`mulk:application:${application.id}`, application);
  await kv.lpush('mulk:application_index', application.id);
  return application;
}

async function getApplication(id) {
  return kv.get(`mulk:application:${id}`);
}

module.exports = {
  kvSessionStore,
  nextApplicationId,
  saveApplication,
  getApplication,
};
