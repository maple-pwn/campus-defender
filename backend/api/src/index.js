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
  // These are DETECTED BYPASSES — only triggered when the player actively exploits something.
  // Normal gameplay submissions get ZERO bypasses (500 cap / 60s floor).
  //
  // ── Endpoint-based (player must find hidden routes) ──
  { id: 'legacy',    category: 'logic',   desc: '上古版本API',      scoreBonus: 1500, timeBonus: 10, check: (c) => c.viaLegacyAPI },
  { id: 'wildcard',  category: 'logic',   desc: '通配端点发现',     scoreBonus: 1500, timeBonus: 10, check: (c) => c.viaWildcardEndpoint },
  { id: 'batch',     category: 'logic',   desc: '批量提交端点',     scoreBonus: 3000, timeBonus: 20, check: (c) => c.viaBatchEndpoint },
  { id: 'patchend',  category: 'logic',   desc: 'PATCH合并端点',    scoreBonus: 2000, timeBonus: 15, check: (c) => c.viaPatchEndpoint },
  { id: 'hidden',    category: 'logic',   desc: '隐藏游戏入口',     scoreBonus: 2500, timeBonus: 20, check: (c) => c.isHiddenGame },
  // ── Header-based (player must add special headers) ──
  { id: 'cookie',    category: 'network', desc: 'Cookie毒化',       scoreBonus: 1500, timeBonus: 10, check: (c) => c.hasAdminCookie },
  { id: 'comment',   category: 'reverse', desc: 'HTML注释泄露',     scoreBonus: 500,  timeBonus: 3,  check: (c) => c.usedDebugToken },
  { id: 'github',    category: 'social',  desc: 'GitHub泄露利用',   scoreBonus: 3000, timeBonus: 25, check: (c) => c.usedAdminKey },
  { id: 'stego',     category: 'reverse', desc: '隐写头发现',       scoreBonus: 2000, timeBonus: 10, check: (c) => c.hasCorrectUserAgent },
  { id: 'method',    category: 'network', desc: 'HTTP方法篡改',     scoreBonus: 1500, timeBonus: 10, check: (c) => c.usedWrongMethod },
  { id: 'content',   category: 'network', desc: 'Content-Type走私', scoreBonus: 1200, timeBonus: 8,  check: (c) => c.usedWeirdContentType },
  { id: 'referer',   category: 'social',  desc: 'Referer伪造',      scoreBonus: 800,  timeBonus: 5,  check: (c) => c.spoofedReferer },
  { id: 'local-fwd', category: 'network', desc: 'X-Forwarded伪造',  scoreBonus: 1000, timeBonus: 8,  check: (c) => c.spoofedLocalhost },
  // ── Payload-based (player must craft malicious data) ──
  { id: 'overflow',  category: 'reverse', desc: '整数溢出',         scoreBonus: 2000, timeBonus: 20, check: (c) => c.isOverflow },
  { id: 'max-int',   category: 'reverse', desc: 'MAX_SAFE_INT溢出', scoreBonus: 2500, timeBonus: 20, check: (c) => c.isMaxSafeInt },
  { id: 'neg-time',  category: 'reverse', desc: '负数时间',         scoreBonus: 1500, timeBonus: 15, check: (c) => c.isNegativeTime },
  { id: 'score-arr', category: 'logic',   desc: '数组分数取最大值',  scoreBonus: 2000, timeBonus: 12, check: (c) => c.usedScoreArray },
  { id: 'query-jack',category: 'logic',   desc: 'Query参数覆盖',    scoreBonus: 2000, timeBonus: 12, check: (c) => c.usedQueryOverride },
  { id: 'time',      category: 'network', desc: '时间戳操纵',       scoreBonus: 800,  timeBonus: 8,  check: (c) => c.timeSkewed },
  // ── Timing-based (player must race the server) ──
  { id: 'race',      category: 'logic',   desc: '竞态条件',         scoreBonus: 2000, timeBonus: 25, check: (c) => c.isRaceCondition },
  { id: 'replay',    category: 'network', desc: '重放攻击',         scoreBonus: 1000, timeBonus: 10, check: (c) => c.isReplay },
  // ── Network / special context ──
  { id: 'social',    category: 'social',  desc: '社会工程',         scoreBonus: 4000, timeBonus: 40, check: (c) => c.fromCampusIP },
  { id: 'birthday',  category: 'social',  desc: '生日攻击',         scoreBonus: 2000, timeBonus: 15, check: (c) => c.isBirthdayAttack },
  { id: 'python',    category: 'reverse', desc: 'Python调试后门',   scoreBonus: 2500, timeBonus: 20, check: (c) => c.usedDebugEndpoint },
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
// Only ACTIVE exploits are detected. Normal gameplay = 0 bypasses.
function detectBypasses(c, body) {
  const ctx = {
    timeSkewed: false, isReplay: false, hasAdminCookie: false,
    hasCorrectUserAgent: false, usedDebugToken: false, isOverflow: false,
    isRaceCondition: false, viaLegacyAPI: false, isHiddenGame: false,
    viaWildcardEndpoint: false, usedAdminKey: false, fromCampusIP: false,
    isBirthdayAttack: false, usedDebugEndpoint: false,
    usedWrongMethod: false, usedWeirdContentType: false, spoofedReferer: false,
    isMaxSafeInt: false, isNegativeTime: false, usedScoreArray: false,
    usedQueryOverride: false, spoofedLocalhost: false,
    viaBatchEndpoint: false, viaPatchEndpoint: false,
  };

  // time: player deliberately skews X-Client-Time header by >5s
  const clientTime = parseInt(c.req.header('X-Client-Time') || '0');
  if (clientTime > 0) ctx.timeSkewed = Math.abs(clientTime - Date.now()) > 5000;

  // cookie: player adds X-Admin-Secret header
  ctx.hasAdminCookie = c.req.header('X-Admin-Secret') === 'cgp-root-2025';

  // comment: player adds X-Debug-Token header (found in HTML comment)
  ctx.usedDebugToken = c.req.header('X-Debug-Token') === 'debug-t0k3n-1eaked';

  // stego: player sets specific User-Agent (found in logo stego data)
  const ua = c.req.header('User-Agent') || '';
  ctx.hasCorrectUserAgent = ua.includes('CyberGuardian/3.0');

  // github: player uses leaked admin key in header (from wrangler.toml / git history)
  ctx.usedAdminKey = c.req.header('X-Admin-Key') === 'cgp-admin-2025';

  // method: player uses PUT or PATCH instead of c.req.method="POST"
  const m = c.req.method.toUpperCase();
  ctx.usedWrongMethod = (m === 'PUT' || m === 'PATCH');

  // content: player sends non-JSON content-type to bypass JSON schema validation
  const ct = (c.req.header('Content-Type') || '').toLowerCase();
  ctx.usedWeirdContentType = ct.includes('text/plain') || ct.includes('multipart');

  // referer: player spoofs Referer to look like game.oldmaple.top
  const ref = (c.req.header('Referer') || '');
  ctx.spoofedReferer = ref.includes('game.oldmaple.top') || ref.includes('admin.oldmaple.top');

  // local-fwd: player claims to be connecting from localhost
  const fwd = c.req.header('X-Forwarded-For') || '';
  ctx.spoofedLocalhost = /^127\.|^0\.|^::1|localhost/i.test(fwd);

  // overflow: player sends negative score to trigger int clamping edge case
  if (body && typeof body.score === 'number' && body.score < 0) ctx.isOverflow = true;

  // max-int: player sends Number.MAX_SAFE_INTEGER or values near the boundary
  if (body && typeof body.score === 'number' && body.score > 9007199254740000) ctx.isMaxSafeInt = true;

  // neg-time: player sends negative time_seconds
  if (body && typeof body.time_seconds === 'number' && body.time_seconds < 0) ctx.isNegativeTime = true;

  // score-arr: player sends score as an array, server takes max element
  if (body && Array.isArray(body.score)) ctx.usedScoreArray = true;

  // query-jack: player sends score/time as query params that override POST body
  const qScore = c.req.query('score');
  const qTime = c.req.query('time_seconds');
  if (qScore !== undefined || qTime !== undefined) ctx.usedQueryOverride = true;

  // hidden: player submits to hidden game 'admin-panel'
  if (body && body.game === 'admin-panel') ctx.isHiddenGame = true;

  // social: player is on campus network (private IP range)
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
// Works with POST (normal), PUT, PATCH. Accepts JSON _and_ text/plain.
app.on(['POST', 'PUT', 'PATCH'], '/api/scores', async (c) => {
  const user = await authMiddleware(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  // Accept non-JSON body too (content sniff bypass)
  let body = {};
  const rawText = await c.req.text().catch(() => '{}');
  try { body = JSON.parse(rawText); } catch (_) { body = {}; }

  let { game, score, time_seconds, level_id, nonce, state_hash } = body;

  // query-jack: query params override body values
  const qScore = c.req.query('score');
  const qTime = c.req.query('time_seconds');
  if (qScore !== undefined) score = parseFloat(qScore);
  if (qTime !== undefined) time_seconds = parseFloat(qTime);

  // score-arr: if score is an array, take the max element
  if (Array.isArray(score)) {
    const arr = score.map(Number).filter(n => !isNaN(n));
    score = arr.length > 0 ? Math.max(...arr) : 0;
  }

  score = Number(score);
  time_seconds = Number(time_seconds);

  if (!game || isNaN(score) || isNaN(time_seconds)) {
    return c.json({ error: 'Missing required fields: game, score, time_seconds' }, 400);
  }

  const validGames = ['campus-defender', 'cyber-guardian', 'admin-panel'];
  if (!validGames.includes(game)) return c.json({ error: 'Invalid game' }, 400);

  const db = c.env.DB;

  const bypassCtx = detectBypasses(c, body);
  const allBypasses = resolveBypassIds(bypassCtx);

  if (nonce) { allBypasses.push('replay'); }

  const recent = await db.prepare('SELECT COUNT(*) as c FROM scores WHERE user_id = ? AND created_at > datetime("now", "-2 seconds")').bind(user.user_id).first();
  if (recent && recent.c > 0) { allBypasses.push('race'); }

  const crc32 = user.user_id ^ 0xFFFFFFFF;
  if ((crc32 & 0xFF) === 0x42 || (crc32 & 0xFFFF) === 0x1337) { allBypasses.push('birthday'); }

  const finalAllBypasses = [...new Set(allBypasses)];
  const clamped = clampScoreTime(score, time_seconds, finalAllBypasses);

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

// ── Batch Score Endpoint (bypass #batch) ─────────────────────────
app.post('/api/scores/batch', async (c) => {
  const user = await authMiddleware(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let body = {};
  const rawText = await c.req.text().catch(() => '{}');
  try { body = JSON.parse(rawText); } catch (_) { body = {}; }

  const scores = Array.isArray(body.scores) ? body.scores : [];
  if (scores.length === 0) return c.json({ error: 'scores must be a non-empty array' }, 400);

  const db = c.env.DB;
  let totalScore = 0, bestTime = Infinity;

  for (const s of scores) {
    const g = s.game || body.game || 'campus-defender';
    const sc = Number(s.score) || 0;
    const tm = Number(s.time_seconds) || 60;
    totalScore += sc;
    if (tm < bestTime) bestTime = tm;

    await db.prepare(
      'INSERT INTO scores (user_id, game, score, time_seconds, level_id, bypasses) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(user.user_id, g, Math.min(sc, 10000), Math.max(tm, -1), s.level_id || null, 'batch').run();
  }

  return c.json({
    accepted: true,
    batched: scores.length,
    totalScore: Math.min(totalScore, 10000),
    bestTime: Math.max(bestTime, -1),
    bypasses: [...new Set(['batch'])],
    bypassCount: 1,
    via: 'batch',
    note: 'Batch endpoint. Each score stored individually; total clamped to 10000.',
  });
});

// ── PATCH Merge Endpoint (bypass #patchend) ──────────────────────
app.patch('/api/scores/merge', async (c) => {
  const user = await authMiddleware(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let body = {};
  const rawText = await c.req.text().catch(() => '{}');
  try { body = JSON.parse(rawText); } catch (_) { body = {}; }

  const db = c.env.DB;

  // Find existing score record for this user+game and merge fields
  const existing = await db.prepare(
    'SELECT * FROM scores WHERE user_id = ? ORDER BY id DESC LIMIT 1'
  ).bind(user.user_id).first();

  if (!existing) return c.json({ error: 'No existing score to merge into. Submit one first.' }, 404);

  const mergedScore  = Math.min((existing.score || 0) + (Number(body.score) || 0), 10000);
  const mergedTime   = Math.max(Math.min(existing.time_seconds || 60, Number(body.time_seconds) || 60), -1);

  const result = await db.prepare(
    'INSERT INTO scores (user_id, game, score, time_seconds, level_id, bypasses) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.user_id, existing.game, mergedScore, mergedTime, existing.level_id, 'patchend').run();

  return c.json({
    accepted: true,
    merged: { score: mergedScore, time: mergedTime },
    original: { score: existing.score, time: existing.time_seconds },
    patchDelta: { score: Number(body.score) || 0, time: Number(body.time_seconds) || 0 },
    via: 'patch-merge',
    note: 'Patch merged your new data with your existing score.',
    id: result.meta.last_row_id,
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
