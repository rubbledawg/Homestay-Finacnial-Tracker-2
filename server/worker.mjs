const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const allowedEmail = 'alfonso.locsin@gmail.com';

async function storeImages(value, bucket, owner) {
  if (typeof value === 'string' && value.startsWith('data:image/')) {
    const match = value.match(/^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) throw new Error('Invalid receipt image');
    const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
    if (bytes.length > 10 * 1024 * 1024) throw new Error('Receipt exceeds 10 MB');
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    await bucket.put(`${owner}/${hash}`, bytes, { httpMetadata: { contentType: match[1] } });
    return `/api/files/${hash}`;
  }
  if (Array.isArray(value)) return Promise.all(value.map(v => storeImages(v, bucket, owner)));
  if (value && typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) result[k] = await storeImages(v, bucket, owner);
    return result;
  }
  return value;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const owner = request.headers.get('oai-authenticated-user-id');
    const email = request.headers.get('oai-authenticated-user-email');
    if (!owner || email?.toLowerCase() !== allowedEmail) return reply({ error: 'Sign in with the owner account.' }, 403);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (url.pathname.startsWith('/api/files/') && request.method === 'GET') {
        const hash = url.pathname.split('/').pop();
        if (!/^[a-f0-9]{64}$/.test(hash)) return reply({ error: 'Not found' }, 404);
        const object = await env.BUCKET.get(`${owner}/${hash}`);
        if (!object) return reply({ error: 'Not found' }, 404);
        return new Response(object.body, { headers: { 'Content-Type': object.httpMetadata.contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
      }
      if (url.pathname === '/api/backup' && request.method === 'GET') {
        const row = await env.DB.prepare('SELECT revision, payload, updated FROM ledger WHERE owner = ?').bind(owner).first();
        return reply(row ? { revision: row.revision, values: JSON.parse(row.payload), updated: row.updated } : {revision:0,values:{}});
      }
      if (url.pathname !== '/api/ledger') return reply({ error: 'Not found' }, 404);
      if (request.method === 'GET') {
        const row = await env.DB.prepare('SELECT revision, payload FROM ledger WHERE owner = ?').bind(owner).first();
        return reply(row ? { revision: row.revision, values: JSON.parse(row.payload) } : { revision: 0, values: {} });
      }
      if (request.method !== 'PUT') return reply({ error: 'Method not allowed' }, 405);
      if (request.headers.get('origin') !== url.origin || !request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'Invalid request origin' }, 403);
      const raw = await request.text();
      if (raw.length > 20 * 1024 * 1024) return reply({ error: 'Save is too large. Reduce receipt image sizes.' }, 413);
      const { revision, values } = JSON.parse(raw);
      if (!Number.isSafeInteger(revision) || revision < 0 || !values || Array.isArray(values) || typeof values !== 'object') return reply({ error: 'Invalid ledger' }, 400);
      const previous = await env.DB.prepare('SELECT revision, payload, updated FROM ledger WHERE owner = ?').bind(owner).first();
      if (previous && previous.revision !== revision) return reply({ error: 'Another window saved newer records. Preserve your draft and load latest.' }, 409);
      const previousValues = previous ? JSON.parse(previous.payload) : {};
      if (previousValues.airbnb_accounting_version === '2' && values.airbnb_accounting_version !== '2') return reply({ error: 'This window uses an older accounting version. Reload before saving.' }, 409);
      // Snapshot first; if preservation fails, no original ledger is changed.
      if (previous) await env.DB.prepare('INSERT OR IGNORE INTO ledger_snapshots (owner, revision, payload, updated) VALUES (?, ?, ?, ?)').bind(owner,previous.revision,previous.payload,previous.updated).run();
      const clean = {};
      for (const [key, value] of Object.entries(values)) {
        if (!/^airbnb_[a-zA-Z0-9_-]+$/.test(key) || typeof value !== 'string') return reply({ error: 'Invalid record' }, 400);
        let parsed; try { parsed = JSON.parse(value); } catch { return reply({ error: 'Invalid record data' }, 400); }
        clean[key] = JSON.stringify(await storeImages(parsed, env.BUCKET, owner));
      }
      const payload = JSON.stringify(clean);
      if (payload.length > 1500000) return reply({ error: 'Ledger is too large for this save. Download a backup and contact support.' }, 413);
      const now = new Date().toISOString();
      const result = revision === 0
        ? await env.DB.prepare('INSERT INTO ledger (owner, revision, payload, updated) VALUES (?, 1, ?, ?) ON CONFLICT(owner) DO NOTHING').bind(owner, payload, now).run()
        : await env.DB.prepare('UPDATE ledger SET payload = ?, revision = revision + 1, updated = ? WHERE owner = ? AND revision = ?').bind(payload, now, owner, revision).run();
      if (result.meta.changes !== 1) return reply({ error: 'Another window or computer saved newer changes. Download your draft, then load the latest records.' }, 409);
      return reply({ revision: revision + 1, values: clean });
    } catch (error) {
      console.error('Ledger operation failed', error.message);
      return reply({ error: 'Cloud storage is unavailable. Your current draft is still open; retry saving.' }, 503);
    }
  },
};
