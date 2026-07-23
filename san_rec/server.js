const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
// Bind to all network interfaces so other devices on the same trusted LAN can use the portal.
const HOST = process.env.HOST || '0.0.0.0';
const root = __dirname;
const pagePath = path.join(root, 'html file.html');
const logoPath = path.join(root, 'rec-logo.png');
// DATA_DIR can point to a mounted disk when the app is deployed in Docker.
const dataDir = process.env.DATA_DIR || root;
fs.mkdirSync(dataDir, { recursive: true });
const legacyDataPath = path.join(dataDir, 'portal-data.json');
const bundledLegacyDataPath = path.join(root, 'portal-data.json');
const databasePath = path.join(dataDir, 'portal.db');
const maxBodySize = 10 * 1024 * 1024;

const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS portal_snapshots (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const getSnapshot = db.prepare('SELECT payload, revision, updated_at FROM portal_snapshots WHERE id = 1');
const insertSnapshot = db.prepare(
  'INSERT INTO portal_snapshots (id, payload, revision) VALUES (1, ?, 1)'
);
const updateSnapshot = db.prepare(
  "UPDATE portal_snapshots SET payload = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1"
);

// One-time migration keeps data saved by the previous JSON-file backend.
if (!getSnapshot.get() && fs.existsSync(fs.existsSync(legacyDataPath) ? legacyDataPath : bundledLegacyDataPath)) {
  try {
    const migrationSource = fs.existsSync(legacyDataPath) ? legacyDataPath : bundledLegacyDataPath;
    const legacyPayload = fs.readFileSync(migrationSource, 'utf8');
    const parsedPayload = JSON.parse(legacyPayload);
    if (isValidPayload(parsedPayload)) insertSnapshot.run(JSON.stringify(parsedPayload));
  } catch (error) {
    console.error('Legacy portal-data.json could not be migrated:', error.message);
  }
}

function send(res, status, contentType, body) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBodySize) {
        reject(new Error('Request body is too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function isValidPayload(payload) {
  return payload && typeof payload === 'object'
    && payload.portalData && typeof payload.portalData === 'object'
    && !Array.isArray(payload.portalData)
    && payload.dynamicColumns && typeof payload.dynamicColumns === 'object'
    && !Array.isArray(payload.dynamicColumns);
}

function readPortalData() {
  const snapshot = getSnapshot.get();
  if (!snapshot) return null;
  return { ...JSON.parse(snapshot.payload), revision: snapshot.revision, updatedAt: snapshot.updated_at };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health' && req.method === 'GET') {
    return send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ status: 'ok' }));
  }

  if (url.pathname === '/api/portal-data') {
    if (req.method === 'GET') {
      try {
        return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(readPortalData()));
      } catch {
        return send(res, 500, 'application/json; charset=utf-8', JSON.stringify({ error: 'Could not read portal data.' }));
      }
    }

    if (req.method === 'PUT') {
      try {
        const payload = JSON.parse(await readRequestBody(req));
        if (!isValidPayload(payload)) {
          return send(res, 400, 'application/json; charset=utf-8', JSON.stringify({ error: 'Invalid portal data.' }));
        }

        const serialisedPayload = JSON.stringify({
          portalData: payload.portalData,
          dynamicColumns: payload.dynamicColumns
        });
        if (getSnapshot.get()) updateSnapshot.run(serialisedPayload);
        else insertSnapshot.run(serialisedPayload);

        const snapshot = getSnapshot.get();
        return send(res, 200, 'application/json; charset=utf-8', JSON.stringify({
          saved: true,
          revision: snapshot.revision,
          updatedAt: snapshot.updated_at
        }));
      } catch (error) {
        return send(res, 400, 'application/json; charset=utf-8', JSON.stringify({ error: error.message || 'Invalid request.' }));
      }
    }
  }

  if (url.pathname === '/' && req.method === 'GET') {
    try {
      return send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(pagePath, 'utf8'));
    } catch {
      return send(res, 500, 'text/plain; charset=utf-8', 'Portal page could not be loaded.');
    }
  }

  if (url.pathname === '/rec-logo.png' && req.method === 'GET') {
    try {
      return send(res, 200, 'image/png', fs.readFileSync(logoPath));
    } catch {
      return send(res, 404, 'text/plain; charset=utf-8', 'Logo could not be loaded.');
    }
  }

  return send(res, 404, 'application/json; charset=utf-8', JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, HOST, () => {
  console.log(`REC Research Portal is running locally at http://localhost:${PORT}`);
  console.log(`LAN access is enabled on port ${PORT}.`);
});
