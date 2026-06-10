# Auth + Leaderboard System Design

## Overview

Add user registration/login and a competitive leaderboard to game.oldmaple.top. The system is designed as an "open arena" — players are encouraged to find and bypass security measures, with each bypass unlocking higher score caps and lower time floors.

## Architecture

```
game.oldmaple.top (GitHub Pages)  ──fetch()──▶  api.oldmaple.top (Cloudflare Workers)
  ├── index.html (Hub + login/register UI)         ├── Hono router
  ├── campus-defender.html                          ├── /api/auth/*
  ├── cyber-guardian.html                           ├── /api/scores/*
  └── js/api.js (shared API client)                 ├── /api/leaderboard/*
                                                     └── Cloudflare D1 (SQLite)
```

- **Frontend**: GitHub Pages, vanilla JS
- **Backend**: Cloudflare Workers (Hono), Cloudflare D1 (SQLite)
- **Domain**: API on `api.oldmaple.top` (CNAME to Worker)

## Database Schema (D1)

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  game TEXT NOT NULL,           -- 'campus-defender' | 'cyber-guardian'
  score INTEGER NOT NULL,       -- clamped to [-1, 10000]
  time_seconds REAL NOT NULL,   -- clamped to [-1, ∞)
  level_id TEXT,                -- optional, e.g. 'ch2-1'
  bypasses TEXT DEFAULT '',     -- comma-separated bypass tags
  client_ip TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_scores_game ON scores(game, score DESC);
CREATE INDEX idx_scores_user ON scores(user_id);
```

## API Endpoints

All endpoints return JSON. Auth via `Authorization: Bearer <token>`.

### Auth

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/auth/register` | `{username, password}` | `{token, user:{id,username}}` |
| POST | `/api/auth/login` | `{username, password}` | `{token, user:{id,username}}` |

Token: JWT signed with HS256, 30-day expiry. Contains `{user_id, username}`.

### Scores

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|-------|
| POST | `/api/scores` | Yes | `{game, score, time_seconds, level_id?, bypasses, nonce, magic, state_hash, ...}` | Server validates bypass count, clamps score/time accordingly |
| GET | `/api/scores/mine` | Yes | — | User's own submissions |

**Score/time clamping logic:**

```
base_max_score = 500
base_min_time  = 60
detected_bypasses = server-side detection of which protections were bypassed

final_max_score = min(base_max_score + sum(bypass_score_bonuses), 10000)
final_min_time  = max(base_min_time - sum(bypass_time_bonuses), -1)

clamped_score = min(submitted_score, final_max_score)
clamped_time  = max(submitted_time, final_min_time)
```

### Leaderboard

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/leaderboard/campus-defender` | Top 100, best score per user |
| GET | `/api/leaderboard/cyber-guardian` | Top 100, best score per user |
| GET | `/api/leaderboard/total` | Combined ranking, score formula: campus + cyber_normalized |

**Total ranking formula:**
```
total_score = campus_best + (cyber_best * 880/300)
```
Normalizes both games to max 880 points base.

## 26-Point Bypass Matrix

### Cryptography (6)

| # | ID | Bypass | Score Bonus | Time Bonus | Detection |
|---|-----|--------|-------------|------------|-----------|
| 1 | `sig` | HMAC signature bypass | +1500 | -20s | Missing/invalid HMAC header |
| 2 | `xor` | XOR encoding bypass | +1000 | -15s | Data not XOR-encoded |
| 3 | `hash` | Custom hash PoW bypass | +3000 | -25s | PoW used standard SHA256 |
| 4 | `magic` | Magic number bypass | +500 | -5s | Missing/invalid magic header |
| 5 | `salt` | Salt injection | +1500 | -10s | Valid bypass salt provided |
| 6 | `rsa` | RSA challenge bypass | +2500 | -20s | RSA challenge not solved |

### Network (6)

| # | ID | Bypass | Score Bonus | Time Bonus | Detection |
|---|-----|--------|-------------|------------|-----------|
| 7 | `ghost` | Ghost verification bypass | +2000 | -15s | Challenge-response not completed |
| 8 | `time` | Timestamp manipulation | +800 | -8s | |client_time - server_time| > 5s |
| 9 | `replay` | Replay attack | +1000 | -10s | Nonce already used in DB |
| 10 | `dns` | DNS tunneling | +3000 | -30s | Score submitted via DNS query |
| 11 | `ws` | WebSocket hijack | +2000 | -15s | Score via WS without HTTP auth |
| 12 | `cookie` | Cookie poisoning | +1500 | -10s | Valid X-Admin-Secret cookie |

### Reversing (5)

| # | ID | Bypass | Score Bonus | Time Bonus | Detection |
|---|-----|--------|-------------|------------|-----------|
| 13 | `wasm` | WASM VM reverse | +3500 | -30s | PoW not computed properly |
| 14 | `python` | Python debug exec | +2500 | -20s | Score via /api/debug/exec |
| 15 | `stego` | Steganography header | +2000 | -10s | Missing proper User-Agent |
| 16 | `comment` | HTML comment leak | +500 | -3s | Using leaked debug token |
| 17 | `overflow` | Integer overflow | +2000 | -20s | Score submitted as negative triggers overflow |

### Logic/Flow (6)

| # | ID | Bypass | Score Bonus | Time Bonus | Detection |
|---|-----|--------|-------------|------------|-----------|
| 18 | `chain` | State chain bypass | +2000 | -20s | Missing state hash chain |
| 19 | `cross` | Cross-user reference | +1000 | -8s | Referencing another user's state |
| 20 | `race` | Race condition | +2000 | -25s | Concurrent submissions detected |
| 21 | `legacy` | Legacy API v1 | +1500 | -10s | Using deprecated /api/v1/scores |
| 22 | `hidden` | Hidden game admin-panel | +2500 | -20s | Score for game="admin-panel" |
| 23 | `wildcard` | Fuzzed endpoint | +1500 | -10s | Using /api/scores/import |

### Environment/Social (3)

| # | ID | Bypass | Score Bonus | Time Bonus | Detection |
|---|-----|--------|-------------|------------|-----------|
| 24 | `github` | GitHub leak | +3000 | -25s | Using leaked admin key |
| 25 | `social` | Social engineering | +4000 | -40s | Request from campus IP range |
| 26 | `birthday` | Birthday attack | +2000 | -15s | CRC32(user_id) == special date |

**Maximum: 500 + sum(bonuses) = 10000, minimum time = -1s**

## Frontend Changes

### New file: `js/api.js`
- `API_BASE = 'https://api.oldmaple.top'`
- `register(username, password)`, `login(username, password)`
- `submitScore(game, score, time, levelId)` — constructs payload, computes bypasses
- `getLeaderboard(game)`, `getMyScores()`
- Token management (localStorage `cgp_token`)

### index.html (Hub)
- Top-right: login/register buttons → modal forms
- Logged in: show username + total rank
- Leaderboard tab/section

### campus-defender.html
- After level complete: auto-submit to API
- Terminal message: "分数已上传 · 检测到 X 个绕过 · 排名: #Y"

### cyber-guardian.html
- After game complete: auto-submit to API
- Same feedback pattern

## Implementation Order

1. **Backend**: Cloudflare Worker + D1 schema + all endpoints
2. **Frontend api.js**: Shared API client
3. **Hub auth UI**: Login/register in index.html
4. **Game integration**: campus-defender.html + cyber-guardian.html
5. **Leaderboard UI**: Display on hub and in-game
6. **Bypass easter eggs**: Plant secrets (HTML comments, CSS comments, robots.txt, logo EXIF, old env files, etc.)
