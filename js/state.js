/**
 * GameState - Manages all game progress in memory + localStorage.
 *
 * This module is the single source of truth for player progress.
 * All mutations automatically persist to localStorage via save().
 *
 * Usage:
 *   GameState.init();
 *   GameState.startLevel(1, 0);        // start ch1 level 1
 *   GameState.completeLevel('ch1-1', 100);
 *   GameState.unlockCommand('scan');
 */

const STORAGE_KEY = 'campus-defender-state';

const GameState = {
  _defaults: {
    currentLevel: null,
    chapter: 1,
    levelIndex: 0,
    score: 0,
    unlockedCommands: ['help', 'report'],
    completedLevels: [],
    badges: [],
    levelScores: {},  // { 'ch1-1': 50, 'ch1-2': 50, ... }
  },

  _data: null,

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Load saved state from localStorage, or initialise with defaults. */
  init: function () {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        // Merge with defaults so that new fields are never missing
        this._data = this._mergeDefaults(parsed);
      } catch (_e) {
        // Corrupted save — fall back to defaults
        this._data = this._cloneDefaults();
      }
    } else {
      this._data = this._cloneDefaults();
    }
    // Ensure 'report' is always unlocked (meta-command for boss levels)
    if (this._data.unlockedCommands.indexOf('report') === -1) {
      this._data.unlockedCommands.push('report');
    }
    return this._data;
  },

  /** Persist current state to localStorage. */
  save: function () {
    if (this._data === null) {
      // init() was never called; call it first to guarantee a valid state
      this.init();
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch (_e) {
      // localStorage may be full or unavailable — silently degrade
    }
  },

  /** Wipe all saved progress and reset to defaults. */
  reset: function () {
    localStorage.removeItem(STORAGE_KEY);
    this._data = this._cloneDefaults();
  },

  /** Return true if a saved game exists in localStorage. */
  hasSave: function () {
    return localStorage.getItem(STORAGE_KEY) !== null;
  },

  // ---------------------------------------------------------------------------
  // Level progression
  // ---------------------------------------------------------------------------

  /**
   * Mark a level as completed, award score, and check for new badges.
   *
   * @param {string} levelId    e.g. "ch1-1"
   * @param {number} scoreGained  Points earned for completing the level
   */
  completeLevel: function (levelId, scoreGained) {
    if (this._data === null) this.init();

    var alreadyCompleted = this._data.completedLevels.includes(levelId);

    if (!alreadyCompleted) {
      this._data.completedLevels.push(levelId);
      this._data.score += scoreGained;
    }

    // Track best score per level
    var currentBest = this._data.levelScores[levelId] || 0;
    if (scoreGained > currentBest) {
      this._data.levelScores[levelId] = scoreGained;
    }

    this.save();
  },

  /**
   * Award a badge to the player (no-op if already earned).
   * @param {string} badgeName  e.g. "侦察兵", "安全卫士"
   */
  addBadge: function (badgeName) {
    if (this._data === null) this.init();
    if (!this._data.badges.includes(badgeName)) {
      this._data.badges.push(badgeName);
      this.save();
    }
  },

  /** Return true if the player has earned the given badge. */
  hasBadge: function (badgeName) {
    if (this._data === null) this.init();
    return this._data.badges.includes(badgeName);
  },

  /**
   * Validate and set the current level.
   *
   * @param {number} chapter  1-based chapter number
   * @param {number} index    0-based level index within the chapter
   */
  startLevel: function (chapter, index) {
    if (this._data === null) this.init();

    if (typeof chapter !== 'number' || chapter < 1) {
      console.warn('[GameState] Invalid chapter:', chapter);
      return;
    }
    if (typeof index !== 'number' || index < 0) {
      console.warn('[GameState] Invalid level index:', index);
      return;
    }

    this._data.chapter = chapter;
    this._data.levelIndex = index;
    this._data.currentLevel = this.getLevelId(chapter, index);
    this.save();
  },

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  /** Unlock a command (no-op if already unlocked). */
  unlockCommand: function (cmd) {
    if (this._data === null) this.init();
    if (!this._data.unlockedCommands.includes(cmd)) {
      this._data.unlockedCommands.push(cmd);
      this.save();
    }
  },

  /** Return true if the given command has been unlocked. */
  isCommandUnlocked: function (cmd) {
    if (this._data === null) this.init();
    return this._data.unlockedCommands.includes(cmd);
  },

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Build a canonical level ID from chapter and index.
   * @param {number} chapter  1-based chapter
   * @param {number} index    0-based level index
   * @returns {string} e.g. "ch1-1"
   */
  getLevelId: function (chapter, index) {
    return 'ch' + chapter + '-' + (index + 1);
  },

  /** Return the current state data (for read-only access by UI). */
  getData: function () {
    if (this._data === null) this.init();
    return this._data;
  },

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Deep-clone the defaults object so mutations never poison the template. */
  _cloneDefaults: function () {
    return JSON.parse(JSON.stringify(this._defaults));
  },

  /** Merge a parsed save object over the defaults so missing keys are filled. */
  _mergeDefaults: function (parsed) {
    const merged = this._cloneDefaults();
    for (var key in parsed) {
      if (parsed.hasOwnProperty(key)) {
        merged[key] = parsed[key];
      }
    }
    // Sanitise arrays in case the save has stale data
    if (!Array.isArray(merged.unlockedCommands)) merged.unlockedCommands = ['help'];
    if (!Array.isArray(merged.completedLevels)) merged.completedLevels = [];
    if (!Array.isArray(merged.badges)) merged.badges = [];
    if (typeof merged.levelScores !== 'object' || merged.levelScores === null || Array.isArray(merged.levelScores)) merged.levelScores = {};
    return merged;
  },

};
