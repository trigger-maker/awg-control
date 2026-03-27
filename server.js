const express = require('express');
const bodyParser = require('body-parser');
const { execFile } = require('child_process');
const fs = require('fs-extra');
const sanitizeFilename = require('sanitize-filename');
const path = require('path');

const app = express();
app.use(bodyParser.json());

const API_KEY = process.env.API_KEY || 'change_me_please';
const CONF_DIR = process.env.CONF_DIR || '/config';
const SERVER_IFACE = process.env.SERVER_IFACE || 'awg-server';

// API Key middleware
app.use((req, res, next) => {
  if (req.headers['x-api-key'] !== API_KEY)
    return res.status(401).json({ error: 'Invalid API key' });
  next();
});

// Sanitize + validate ID
function sanitizeId(id) {
  if (!id || typeof id !== 'string') throw new Error('Valid ID required');
  const safe = sanitizeFilename(id.replace(/[^a-zA-Z0-9_-]/g, '_'), { replacement: '_' });
  if (safe.length < 3 || safe.length > 32) throw new Error('ID must be 3-32 chars');
  return safe;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) =>
    execFile(cmd, args, opts, (err, stdout, stderr) =>
      err ? reject(new Error(stderr || err.message)) : resolve(stdout)
    )
  );
}

// POST /users - create client
app.post('/users', async (req, res) => {
  try {
    const safeId = sanitizeId(req.body.id);
    const conf = `${CONF_DIR}/${safeId}.conf`;
    if (await fs.pathExists(conf))
      return res.status(409).json({ error: 'User already exists' });

    await fs.ensureDir(CONF_DIR);

    const serverIp = (await run('curl', ['-s', 'ifconfig.me'])).trim();
    const privKey = (await run('awg', ['genkey'])).trim();
    const pubKey = (await run('sh', ['-c', `echo '${privKey}' | awg pubkey`])).trim();

    const confContent = [
      '[Interface]',
      `PrivateKey = ${privKey}`,
      'Address = 10.0.0.2/32',
      'DNS = 1.1.1.1',
      '',
      '[Peer]',
      `PublicKey = REPLACE_WITH_SERVER_PUBKEY`,
      `Endpoint = ${serverIp}:51820`,
      'AllowedIPs = 0.0.0.0/0',
      'S1 = 1',
      'S2 = 1',
    ].join('\n');

    await fs.writeFile(conf, confContent, { mode: 0o600 });
    await run('awg-quick', ['up', conf]);

    res.json({ success: true, id: safeId, pubKey });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /users/:id/config - download .conf file
app.get('/users/:id/config', async (req, res) => {
  try {
    const safeId = sanitizeId(req.params.id);
    const conf = path.resolve(CONF_DIR, `${safeId}.conf`);

    // Path traversal protection: ensure file is inside CONF_DIR
    if (!conf.startsWith(path.resolve(CONF_DIR) + path.sep))
      return res.status(400).json({ error: 'Invalid path' });

    if (!await fs.pathExists(conf))
      return res.status(404).json({ error: 'User not found' });

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${safeId}.conf"`);
    res.sendFile(conf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /users/:id/enable
app.post('/users/:id/enable', async (req, res) => {
  try {
    const safeId = sanitizeId(req.params.id);
    const conf = `${CONF_DIR}/${safeId}.conf`;
    if (!await fs.pathExists(conf))
      return res.status(404).json({ error: 'User not found' });
    await run('awg-quick', ['up', conf]).catch(() => {});
    res.json({ success: true, status: 'enabled' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /users/:id/disable
app.post('/users/:id/disable', async (req, res) => {
  try {
    const safeId = sanitizeId(req.params.id);
    const conf = `${CONF_DIR}/${safeId}.conf`;
    if (!await fs.pathExists(conf))
      return res.status(404).json({ error: 'User not found' });
    await run('awg-quick', ['down', conf]).catch(() => {});
    res.json({ success: true, status: 'disabled' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /users/:id
app.delete('/users/:id', async (req, res) => {
  try {
    const safeId = sanitizeId(req.params.id);
    const conf = `${CONF_DIR}/${safeId}.conf`;
    if (!await fs.pathExists(conf))
      return res.status(404).json({ error: 'User not found' });
    await run('awg-quick', ['down', conf]).catch(() => {});
    await fs.remove(conf);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /users - list
app.get('/users', async (req, res) => {
  try {
    const files = await fs.readdir(CONF_DIR);
    const users = files
      .filter(f => f.endsWith('.conf') && f !== 'server.conf')
      .map(f => f.replace('.conf', ''));
    res.json({ users });
  } catch (e) {
    res.json({ users: [] });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => console.log(`awg-control API listening on :${port}`));
