/**
 * api.js — Campus Defender / Cyber Guardian API Client
 *
 * Shared frontend client for auth, score submission, and leaderboard.
 * Token stored in localStorage as 'cgp_token'.
 *
 * Usage:
 *   await API.register('username', 'password');
 *   await API.login('username', 'password');
 *   await API.submitScore('campus-defender', 500, 42, 'ch1-1');
 *   const lb = await API.getLeaderboard('campus-defender');
 *   const me = await API.getMe();
 */

var API = {
  base: 'https://api.oldmaple.top',

  // ── Auth ─────────────────────────────────────────────────────

  /** @returns {string|null} */
  getToken: function () {
    return localStorage.getItem('cgp_token');
  },

  /** @param {string} t */
  setToken: function (t) {
    localStorage.setItem('cgp_token', t);
  },

  clearToken: function () {
    localStorage.removeItem('cgp_token');
    localStorage.removeItem('cgp_user');
  },

  /** @returns {{id:number, username:string}|null} */
  getUser: function () {
    try {
      return JSON.parse(localStorage.getItem('cgp_user') || 'null');
    } catch (_) { return null; }
  },

  setUser: function (u) {
    localStorage.setItem('cgp_user', JSON.stringify(u));
  },

  isLoggedIn: function () {
    return !!this.getToken();
  },

  /** POST /api/auth/register */
  register: async function (username, password) {
    var r = await fetch(this.base + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password }),
    });
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Register failed');
    this.setToken(d.token);
    this.setUser(d.user);
    return d;
  },

  /** POST /api/auth/login */
  login: async function (username, password) {
    var r = await fetch(this.base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password }),
    });
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Login failed');
    this.setToken(d.token);
    this.setUser(d.user);
    return d;
  },

  /** Logout — clear stored token */
  logout: function () {
    this.clearToken();
  },

  /** GET /api/auth/me */
  getMe: async function () {
    var token = this.getToken();
    if (!token) return null;
    var r = await fetch(this.base + '/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!r.ok) { this.clearToken(); return null; }
    var d = await r.json();
    return d.user;
  },

  // ── Scores ────────────────────────────────────────────────────

  /**
   * POST /api/scores
   * @param {string} game      'campus-defender' | 'cyber-guardian'
   * @param {number} score
   * @param {number} timeSeconds
   * @param {string} [levelId]
   * @returns {Promise<object>}
   */
  submitScore: async function (game, score, timeSeconds, levelId) {
    var token = this.getToken();
    if (!token) throw new Error('Not logged in');

    var body = {
      game: game,
      score: Math.round(score),
      time_seconds: timeSeconds,
      level_id: levelId || undefined,
    };

    var r = await fetch(this.base + '/api/scores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify(body),
    });

    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Score submission failed');
    return d;
  },

  // ── Leaderboard ───────────────────────────────────────────────

  /**
   * GET /api/leaderboard/:game
   * @param {string} game  'campus-defender' | 'cyber-guardian' | 'total'
   */
  getLeaderboard: async function (game) {
    var r = await fetch(this.base + '/api/leaderboard/' + game);
    if (!r.ok) throw new Error('Leaderboard fetch failed');
    return await r.json();
  },

  /** GET /api/scores/mine */
  getMyScores: async function () {
    var token = this.getToken();
    if (!token) return [];
    var r = await fetch(this.base + '/api/scores/mine', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!r.ok) return [];
    var d = await r.json();
    return d.scores || [];
  },
};
