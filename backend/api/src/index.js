/**
 * Campus Defender API — Cloudflare Worker
 *
 * Open-arena auth + leaderboard with 26 bypass vectors.
 * Players are ENCOURAGED to find and exploit every hole.
 *
 * Dependencies: hono (routing), D1 (sqlite)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// ── Init ──────────────────────────────────────────────────────────
const app = new Hono();

app.use('*', cors({
  origin: ['https://game.oldmaple.top', 'https://oldmaple.top', 'http://localhost:8080', 'http://localhost:*'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Signature', 'X-Magic', 'X-Admin-Secret', 'X-Debug-Token', 'User-Agent'],
  maxAge: 86400,
}));

// ── JWT Helpers ───────────────────────────────────────────────────
const JWT_SECRET = 'cgp-jwt-secret-change-in-production';

async function jwtSign(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 2592000 }));
  const sig = await hmacSHA256(`${header}.${body}`, JWT_SECRET);
  return `${header}.${body}.${sig}`;
}

async function jwtVerify(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const expectedSig = await hmacSHA256(`${parts[0]}.${parts[1]}`, JWT_SECRET);
    if (expectedSig !== parts[2]) return null;
    const payload = JSON.parse(atoburl(parts[1]));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) { return null; }
}

function b64url(str)  { return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function atoburl(str) { return atob(str.replace(/-/g, '+').replace(/_/g, '/')); }

async function hmacSHA256(msg, key) {
  const enc = new TextEncoder();
  const keyData = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', keyData, enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(msg) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Auth Middleware ───────────────────────────────────────────────
async function authMiddleware(c) {
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return await jwtVerify(auth.slice(7));
}

// ── Custom Hash (Bypass #3 — players must reverse this) ──────────
// A deliberately weird custom hash. Not SHA256. Players calling the
// real SHA256 for PoW will be detected.
function customHash(input) {
  // Custom S-box based hash with deliberately different behavior
  let h = new Uint8Array(32);
  const data = new TextEncoder().encode(input);

  // Initialization vector — deliberately different from SHA256
  h[0] = 0x6a; h[1] = 0x09; h[2] = 0xe6; h[3] = 0x67;
  h[4] = 0xbb; h[5] = 0x67; h[6] = 0xae; h[7] = 0x85;

  for (let i = 0; i < data.length; i++) {
    const idx = i % 32;
    // Custom mixing: rotate + S-box lookup
    const sbox = [0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76];
    const t = (h[idx] ^ data[i] ^ (i * 0x9e3779b9 >>> 0) & 0xff) >>> 0;
    h[idx] = (sbox[t & 0xf] ^ sbox[(t >> 4) & 0xf] ^ (h[(idx + 7) % 32] * 0x01000193 >>> 0)) & 0xff;
    h[(idx + 1) % 32] = (h[(idx + 1) % 32] + data[i]) & 0xff;
  }

  // Finalization — different from SHA256 padding
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < 32; i++) {
      h[i] = (h[i] ^ h[(i + 11) % 32] ^ 0xa5) & 0xff;
    }
  }

  return Array.from(h).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Bypass Detection Matrix (26 vectors) ──────────────────────────

const BYPASS_DEFS = [
  // Cryptography
  { id: 'sig',     category: 'crypto',  desc: 'HMAC签名绕过',     scoreBonus: 1500, timeBonus: 20, check: (c) => !c.hasValidHMAC },
  { id: 'xor',     category: 'crypto',  desc: 'XOR编码壳绕过',    scoreBonus: 1000, timeBonus: 15, check: (c) => !c.isXOREncoded },
  { id: 'hash',    category: 'crypto',  desc: '自定义哈希逆向',   scoreBonus: 3000, timeBonus: 25, check: (c) => c.usedStandardHash },
  { id: 'magic',   category: 'crypto',  desc: '魔数校验绕过',     scoreBonus: 500,  timeBonus: 5,  check: (c) => !c.hasValidMagic },
  { id: 'salt',    category: 'crypto',  desc: '盐值注入',         scoreBonus: 1500, timeBonus: 10, check: (c) => c.hasBypassSalt },
  { id: 'rsa',     category: 'crypto',  desc: 'RSA挑战绕过',      scoreBonus: 2500, timeBonus: 20, check: (c) => !c.solvedRSAChallenge },
  // Network
  { id: 'ghost',   category: 'network', desc: '幽灵验证绕过',     scoreBonus: 2000, timeBonus: 15, check: (c) => !c.completedGhostVerification },
  { id: 'time',    category: 'network', desc: '时间戳操纵',       scoreBonus: 800,  timeBonus: 8,  check: (c) => c.timeSkewed },
  { id: 'replay',  category: 'network', desc: '重放攻击',         scoreBonus: 1000, timeBonus: 10, check: (c) => c.isReplay },
  { id: 'dns',     category: 'network', desc: 'DNS隧道',          scoreBonus: 3000, timeBonus: 30, check: (c) => c.viaDNSTunnel },
  { id: 'ws',      category: 'network', desc: 'WebSocket劫持',    scoreBonus: 2000, timeBonus: 15, check: (c) => c.viaWebSocket },
  { id: 'cookie',  category: 'network', desc: 'Cookie毒化',       scoreBonus: 1500, timeBonus: 10, check: (c) => c.hasAdminCookie },
  // Reversing
  { id: 'wasm',    category: 'reverse', desc: 'WASM虚拟机逆向',   scoreBonus: 3500, timeBonus: 30, check: (c) => !c.computedWASMPoW },
  { id: 'python',  category: 'reverse', desc: 'Python调试后门',   scoreBonus: 2500, timeBonus: 20, check: (c) => c.usedDebugEndpoint },
  { id: 'stego',   category: 'reverse', desc: '隐写头发现',       scoreBonus: 2000, timeBonus: 10, check: (c) => !c.hasCorrectUserAgent },
  { id: 'comment', category: 'reverse', desc: 'HTML注释泄露',     scoreBonus: 500,  timeBonus: 3,  check: (c) => c.usedDebugToken },
  { id: 'overflow',category: 'reverse', desc: '整数溢出',         scoreBonus: 2000, timeBonus: 20, check: (c) => c.isOverflow },
  // Logic
  { id: 'chain',   category: 'logic',   desc: '状态链绕过',       scoreBonus: 2000, timeBonus: 20, check: (c) => !c.hasValidStateChain },
  { id: 'cross',   category: 'logic',   desc: '跨用户引用',       scoreBonus: 1000, timeBonus: 8,  check: (c) => c.crossUserRef },
  { id: 'race',    category: 'logic',   desc: '竞态条件',         scoreBonus: 2000, timeBonus: 25, check: (c) => c.isRaceCondition },
  { id: 'legacy',  category: 'logic',   desc: '上古版本API',      scoreBonus: 1500, timeBonus: 10, check: (c) => c.viaLegacyAPI },
  { id: 'hidden',  category: 'logic',   desc: '隐藏游戏入口',     scoreBonus: 2500, timeBonus: 20, check: (c) => c.isHiddenGame },
  { id: 'wildcard',category: 'logic',   desc: '通配端点发现',     scoreBonus: 1500, timeBonus: 10, check: (c) => c.viaWildcardEndpoint },
  // Environment
  { id: 'github',  category: 'social',  desc: 'GitHub泄露利用',   scoreBonus: 3000, timeBonus: 25, check: (c) => c.usedAdminKey },
  { id: 'social',  category: 'social',  desc: '社会工程',         scoreBonus: 4000, timeBonus: 40, check: (c) => c.fromCampusIP },
  { id: 'birthday',category: 'social',  desc: '生日攻击',         scoreBonus: 2000, timeBonus: 15, check: (c) => c.isBirthdayAttack },
];

// ── Score Clamping ────────────────────────────────────────────────
function clampScoreTime(submittedScore, submittedTime, bypassIds) {
  const BASE_SCORE = 500, BASE_TIME = 60;
  let totalScoreBonus = 0, totalTimeBonus = 0;

  for (const bId of bypassIds) {
    const def = BYPASS_DEFS.find(d => d.id === bId);
    if (def) { totalScoreBonus += def.scoreBonus; totalTimeBonus += def.timeBonus; }
  }

  const maxScore = Math.min(BASE_SCORE + totalScoreBonus, 10000);
  const minTime  = Math.max(BASE_TIME - totalTimeBonus, -1);

  return {
    score: Math.min(submittedScore, maxScore),
    time:  Math.max(submittedTime, minTime),
    maxScorePossible: maxScore,
    minTimePossible: minTime,
  };
}

// ── Detect Bypasses from Request ──────────────────────────────────
function detectBypasses(c) {
  const ctx = {
    // Defaults — bypasses that need positive detection (already bypassed = false)
    hasValidHMAC: false, isXOREncoded: false, usedStandardHash: false,
    hasValidMagic: false, hasBypassSalt: false, solvedRSAChallenge: false,
    completedGhostVerification: false, timeSkewed: false, isReplay: false,
    viaDNSTunnel: false, viaWebSocket: false, hasAdminCookie: false,
    computedWASMPoW: false, usedDebugEndpoint: false, hasCorrectUserAgent: false,
    usedDebugToken: false, isOverflow: false,
    hasValidStateChain: false, crossUserRef: false, isRaceCondition: false,
    viaLegacyAPI: false, isHiddenGame: false, viaWildcardEndpoint: false,
    usedAdminKey: false, fromCampusIP: false, isBirthdayAttack: false,
  };

  // Check HMAC signature (bypass #1)
  const sig = c.req.header('X-Signature');
  const magic = c.req.header('X-Magic');

  // Check magic number (bypass #4)
  // Valid magic: SHA256(body + "cgp-magic-salt") first 4 bytes as hex
  // Players find "cgp-magic-salt" in CSS comments
  ctx.hasValidMagic = false; // Will be set if magic matches

  // Check XOR encoding (bypass #2) — data should be XOR'd with key
  // Key found in console.log
  ctx.isXOREncoded = false;

  // Check time skew (bypass #8)
  const clientTime = parseInt(c.req.header('X-Client-Time') || '0');
  ctx.timeSkewed = Math.abs(clientTime - Date.now()) > 5000;

  // Check admin cookie (bypass #12)
  ctx.hasAdminCookie = c.req.header('X-Admin-Secret') === 'cgp-root-2025';

  // Check debug token (bypass #16)
  ctx.usedDebugToken = c.req.header('X-Debug-Token') === 'debug-t0k3n-1eaked';

  // Check user agent (bypass #15) — stego data in logo
  const ua = c.req.header('User-Agent') || '';
  ctx.hasCorrectUserAgent = ua.includes('CyberGuardian/3.0');

  // Check admin key (bypass #24) — leaked in old .env commit
  const adminKey = c.req.header('X-Admin-Key');
  ctx.usedAdminKey = adminKey === 'cgp-admin-2025';

  // Check campus IP (bypass #25)
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '';
  ctx.fromCampusIP = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)/.test(ip);

  return ctx;
}

// Taken from bypass definitions: which ones are actively detected as bypassed
function resolveBypassIds(ctx) {
  return BYPASS_DEFS.filter(d => d.check(ctx)).map(d => d.id);
}

// ── Routes ────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (c) => c.json({ ok: true, time: Date.now() }));

// ── Auth ──────────────────────────────────────────────────────────
app.post('/api/auth/register', async (c) => {
  const { username, password } = await c.req.json().catch(() => ({}));
  if (!username || !password) return c.json({ error: 'Missing username or password' }, 400);
  if (username.length < 2 || username.length > 30) return c.json({ error: 'Username must be 2-30 chars' }, 400);
  if (password.length < 3) return c.json({ error: 'Password too short' }, 400);

  const db = c.env.DB;
  const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (existing) return c.json({ error: 'Username taken' }, 409);

  const hash = await sha256(password + 'cgp-salt');
  const result = await db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').bind(username, hash).run();
  const token = await jwtSign({ user_id: result.meta.last_row_id, username });

  return c.json({ token, user: { id: result.meta.last_row_id, username } });
});

app.post('/api/auth/login', async (c) => {
  const { username, password } = await c.req.json().catch(() => ({}));
  if (!username || !password) return c.json({ error: 'Missing username or password' }, 400);

  const db = c.env.DB;
  const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);

  const hash = await sha256(password + 'cgp-salt');
  if (hash !== user.password_hash) return c.json({ error: 'Invalid credentials' }, 401);

  const token = await jwtSign({ user_id: user.id, username: user.username });
  return c.json({ token, user: { id: user.id, username: user.username } });
});

// ── Score Submission ──────────────────────────────────────────────
app.post('/api/scores', async (c) => {
  const user = await authMiddleware(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json().catch(() => ({}));
  const { game, score, time_seconds, level_id, bypasses: clientBypasses, nonce, state_hash } = body;

  if (!game || typeof score !== 'number' || typeof time_seconds !== 'number') {
    return c.json({ error: 'Missing required fields: game, score, time_seconds' }, 400);
  }

  const validGames = ['campus-defender', 'cyber-guardian', 'admin-panel'];
  if (!validGames.includes(game)) return c.json({ error: 'Invalid game' }, 400);

  const db = c.env.DB;

  // Detect bypasses server-side
  const bypassCtx = detectBypasses(c);
  const serverBypasses = resolveBypassIds(bypassCtx);

  // Merge client-declared bypasses (client tells us which ones they found)
  // But client declaration alone doesn't count — must match server detection
  const allBypasses = [...new Set([...serverBypasses])];

  // Additional checks from body data
  if (nonce) {
    // Check for replay (bypass #9)
    const exists = await db.prepare('SELECT id FROM scores WHERE user_id = ? AND id = (SELECT MAX(id) FROM scores WHERE user_id = ?)').bind(user.user_id, user.user_id).first();
    // Simplified: if nonce already used
  }

  if (score < 0) { bypassCtx.isOverflow = true; allBypasses.push('overflow'); }
  if (game === 'admin-panel') { bypassCtx.isHiddenGame = true; allBypasses.push('hidden'); }
  if (!state_hash) { bypassCtx.hasValidStateChain = false; allBypasses.push('chain'); }

  // Check for race condition (bypass #20) — rapid concurrent submits
  // Simplified: check if there's a very recent submission (<1s ago)
  const recent = await db.prepare('SELECT COUNT(*) as c FROM scores WHERE user_id = ? AND created_at > datetime("now", "-2 seconds")').bind(user.user_id).first();
  if (recent && recent.c > 0) { bypassCtx.isRaceCondition = true; allBypasses.push('race'); }

  // Check birthday attack (bypass #26)
  const crc32 = user.user_id ^ 0xFFFFFFFF;
  if ((crc32 & 0xFF) === 0x42 || (crc32 & 0xFFFF) === 0x1337) {
    bypassCtx.isBirthdayAttack = true; allBypasses.push('birthday');
  }

  // Clamp score/time based on detected bypasses
  const finalAllBypasses = [...new Set([...allBypasses])];
  const clamped = clampScoreTime(score, time_seconds, finalAllBypasses);

  // Store
  const bypassesStr = finalAllBypasses.join(',');
  const result = await db.prepare(
    'INSERT INTO scores (user_id, game, score, time_seconds, level_id, bypasses) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.user_id, game, clamped.score, clamped.time, level_id || null, bypassesStr).run();

  return c.json({
    accepted:    true,
    submitted:   { score, time: time_seconds },
    actual:      { score: clamped.score, time: clamped.time },
    maxPossible: { score: clamped.maxScorePossible, time: clamped.minTimePossible },
    bypasses:    finalAllBypasses,
    bypassCount: finalAllBypasses.length,
    rank:        await getRank(db, user.user_id, game),
    id:          result.meta.last_row_id,
  });
});

// ── Leaderboard ───────────────────────────────────────────────────
app.get('/api/leaderboard/:game', async (c) => {
  const game = c.req.param('game');
  const valid = ['campus-defender', 'cyber-guardian', 'total', 'admin-panel'];
  if (!valid.includes(game)) return c.json({ error: 'Invalid leaderboard' }, 404);

  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500);

  let rows;
  if (game === 'total') {
    rows = await db.prepare(`
      SELECT u.username,
             COALESCE(MAX(CASE WHEN s.game='campus-defender' THEN s.score END), 0) as campus_best,
             COALESCE(MAX(CASE WHEN s.game='cyber-guardian' THEN s.score END), 0) as cyber_best,
             COALESCE(MAX(CASE WHEN s.game='campus-defender' THEN s.score END), 0) +
               CAST(COALESCE(MAX(CASE WHEN s.game='cyber-guardian' THEN s.score END), 0) * 2.933 AS INTEGER) as total,
             GROUP_CONCAT(DISTINCT s.bypasses) as all_bypasses
      FROM scores s JOIN users u ON s.user_id = u.id
      WHERE s.game IN ('campus-defender','cyber-guardian')
      GROUP BY u.id, u.username
      ORDER BY total DESC
      LIMIT ?
    `).bind(limit).all();
  } else {
    rows = await db.prepare(`
      SELECT u.username, s.score, s.time_seconds, s.bypasses, s.created_at
      FROM scores s JOIN users u ON s.user_id = u.id
      WHERE s.game = ? AND s.id IN (
        SELECT id FROM scores s2 WHERE s2.game = ?
        AND s2.id = (SELECT id FROM scores WHERE user_id = s2.user_id AND game = s2.game ORDER BY score DESC, time_seconds ASC LIMIT 1)
      )
      ORDER BY s.score DESC, s.time_seconds ASC
      LIMIT ?
    `).bind(game, game, limit).all();
  }

  return c.json({
    game,
    leaderboard: (rows.results || rows).map((r, i) => ({
      rank: i + 1,
      username: r.username,
      score: r.score ?? r.total,
      time_seconds: r.time_seconds,
      bypasses: (r.bypasses || (r.all_bypasses || '')).split(',').filter(Boolean),
      bypassCount: (r.bypasses || (r.all_bypasses || '')).split(',').filter(Boolean).length,
    })),
  });
});

// ── My Scores ─────────────────────────────────────────────────────
app.get('/api/scores/mine', async (c) => {
  const user = await authMiddleware(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const db = c.env.DB;
  const rows = await db.prepare(
    'SELECT * FROM scores WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(user.user_id).all();
  return c.json({ scores: rows.results || rows });
});

// ── User Info ─────────────────────────────────────────────────────
app.get('/api/auth/me', async (c) => {
  const user = await authMiddleware(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ user });
});

// ── Legacy API v1 (bypass #21) — looser validation ───────────────
app.post('/api/v1/scores', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { game, score, time_seconds } = body;
  const db = c.env.DB;

  // v1: no auth required, no bypass detection, higher defaults
  const clampedScore = Math.min(score || 0, 3000);  // v1 allows higher default
  const clampedTime  = Math.max(time_seconds || 0, -1);

  const user = await authMiddleware(c); // optional auth
  const userId = user ? user.user_id : 1; // fallback to uid=1

  const result = await db.prepare(
    'INSERT INTO scores (user_id, game, score, time_seconds, bypasses) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, game || 'campus-defender', clampedScore, clampedTime, 'legacy').run();

  return c.json({
    accepted: true,
    score: clampedScore,
    time: clampedTime,
    via: 'legacy-v1',
    note: 'Legacy API v1 has looser validation. This is intentional.',
    id: result.meta.last_row_id,
  });
});

// ── Debug Exec (bypass #14) — Python-like restricted exec ────────
app.post('/api/debug/exec', async (c) => {
  const { cmd } = await c.req.json().catch(() => ({}));
  if (!cmd) return c.json({ error: 'Missing cmd' }, 400);

  // Restricted "Python-like" execution — actually JS eval with limits
  const allowed = ['set_score', 'get_flag', 'help', 'whoami'];
  const parts = cmd.trim().split(/\s+/);
  const fn = parts[0];

  if (!allowed.includes(fn)) return c.json({ error: `Unknown command: ${fn}. Try: ${allowed.join(', ')}` }, 400);

  if (fn === 'set_score') {
    const val = parseInt(parts[1]) || 0;
    return c.json({
      result: 'score_set',
      score: Math.min(val, 5000), // Debug exec has its own cap
      note: 'Debug endpoint score cap: 5000. Find the real bypass for 10000.',
    });
  }
  if (fn === 'get_flag') return c.json({ result: 'CTF-2025{debug_endpoint_discovered}' });
  if (fn === 'help') return c.json({ result: `Available: ${allowed.join(', ')}` });
  if (fn === 'whoami') return c.json({ result: 'debug_user', uid: 1337 });

  return c.json({ result: 'ok' });
});

// ── Wildcard (/api/scores/import — bypass #23) ───────────────────
app.post('/api/scores/import', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { game, scores: scoreList } = body;
  const db = c.env.DB;

  const user = await authMiddleware(c);
  const userId = user ? user.user_id : 1;

  if (!Array.isArray(scoreList)) return c.json({ error: 'scores must be array' }, 400);

  let inserted = 0;
  for (const s of scoreList) {
    await db.prepare(
      'INSERT INTO scores (user_id, game, score, time_seconds, bypasses) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, game || 'campus-defender', Math.min(s.score || 0, 8000), Math.max(s.time || 0, -1), 'wildcard').run();
    inserted++;
  }

  return c.json({ accepted: true, imported: inserted, via: 'wildcard-import', note: 'This endpoint was found via fuzzing.' });
});

// ── Admin Panel Score (bypass #22) — hidden game ──────────────────
app.post('/api/scores/admin-panel', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const db = c.env.DB;
  const user = await authMiddleware(c);
  const userId = user ? user.user_id : 1;
  const score = Math.min(body.score || 0, 10000);
  const time  = Math.max(body.time_seconds || 0, -1);

  await db.prepare(
    'INSERT INTO scores (user_id, game, score, time_seconds, bypasses) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, 'admin-panel', score, time, 'hidden,wildcard').run();

  return c.json({ accepted: true, score, time, game: 'admin-panel', note: 'Hidden game endpoint. Well found.' });
});

// ── PoW Verification (bypass #3 helper) ───────────────────────────
app.post('/api/pow/verify', async (c) => {
  const { prefix, nonce, data } = await c.req.json().catch(() => ({}));
  if (!nonce || !data) return c.json({ error: 'Missing nonce or data' }, 400);
  const targetPrefix = prefix || '0000';
  const hash = customHash(data + nonce);
  const valid = hash.startsWith(targetPrefix);
  return c.json({ valid, hash, prefix: targetPrefix });
});

// ── Ghost Challenge (bypass #7 helper) ────────────────────────────
app.post('/api/ghost/challenge', async (c) => {
  const challenge = crypto.randomUUID();
  // Store challenge in memory (or D1) with 5s expiry
  return c.json({ challenge, expires_in: 5, note: 'Submit response to /api/ghost/verify within 5s' });
});

app.post('/api/ghost/verify', async (c) => {
  const { challenge, response } = await c.req.json().catch(() => ({}));
  // Valid response: SHA256(challenge + "ghost-secret-2025")
  const expected = await sha256(challenge + 'ghost-secret-2025');
  const valid = response === expected;
  return c.json({ valid, note: valid ? 'Ghost verification passed' : 'Invalid response' });
});

// ── Catch-all for unhandled routes ────────────────────────────────
app.all('*', (c) => c.json({ error: 'Not found. Try fuzzing more endpoints.', hint: 'There are hidden routes.' }, 404));

export default app;

// ── Helper: Get Rank ──────────────────────────────────────────────
async function getRank(db, userId, game) {
  try {
    const row = await db.prepare(`
      SELECT COUNT(*) + 1 as rank FROM scores s1
      WHERE s1.game = ? AND s1.id IN (
        SELECT id FROM scores s2 WHERE s2.game = ?
        AND s2.id = (SELECT id FROM scores WHERE user_id = s2.user_id AND game = s2.game ORDER BY score DESC, time_seconds ASC LIMIT 1)
      )
      AND s1.score > (SELECT COALESCE(MAX(score), 0) FROM scores WHERE user_id = ? AND game = ?)
    `).bind(game, game, userId, game).first();
    return row ? row.rank : null;
  } catch (_) { return null; }
}
