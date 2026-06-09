/**
 * UI - Right panel DOM updates and overlay management for Campus Defender.
 *
 * Handles all DOM manipulation for:
 *   - Mission panel (title, objectives with checkmarks)
 *   - Mentor chat panel (bubble messages)
 *   - Knowledge card panel (term + definition)
 *   - Score display
 *   - Title screen overlay
 *   - Level complete overlay
 *   - Badge overlay
 *
 * Usage:
 *   UI.init();
 *   UI.setMission(levelData);
 *   UI.updateObjective('help');
 *   UI.appendMentorMessage('Welcome!');
 *   UI.showKnowledge('help shows available commands', 'help');
 *   UI.updateScore(100);
 *   UI.showTitleScreen(false);
 *   UI.hideTitleScreen();
 *   UI.showLevelComplete(level, 'All objectives done!');
 *   UI.hideLevelComplete();
 *   UI.showBadge('侦察兵');
 *   UI.hideBadge();
 */

const UI = {
  missionEl: null,
  mentorEl: null,
  knowledgeEl: null,
  scoreEl: null,
  titleScreenEl: null,
  levelCompleteEl: null,
  badgeOverlayEl: null,
  gameUiEl: null,

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Bind to DOM elements. Call once after the DOM is ready.
   */
  init: function () {
    this.missionEl       = document.getElementById('mission-content');
    this.mentorEl        = document.getElementById('mentor-chat');
    this.knowledgeEl     = document.getElementById('knowledge-content');
    this.scoreEl         = document.getElementById('score-display');
    this.titleScreenEl   = document.getElementById('title-screen');
    this.levelCompleteEl = document.getElementById('level-complete');
    this.badgeOverlayEl  = document.getElementById('badge-overlay');
    this.gameUiEl        = document.getElementById('game-ui');
  },

  // ---------------------------------------------------------------------------
  // Mission panel
  // ---------------------------------------------------------------------------

  /**
   * Render the mission section with title and objectives.
   *
   * @param {object} level  Level definition object:
   *   { title, objectives: [{id, description, done?:boolean}], story? }
   */
  setMission: function (level) {
    if (!this.missionEl) return;

    var story = level.story || level.title;
    var objectives = level.objectives || [];

    // Build mission brief
    var brief = document.createElement('p');
    brief.className = 'mission-brief';
    brief.textContent = story;

    // Build objectives container
    var objContainer = document.createElement('div');
    objContainer.className = 'mission-objectives';

    for (var i = 0; i < objectives.length; i++) {
      var obj = objectives[i];
      var objDiv = document.createElement('div');
      objDiv.className = 'objective incomplete';
      objDiv.setAttribute('data-obj-id', obj.id);
      objDiv.textContent = '\u2610 ' + obj.description;  // ☐
      objContainer.appendChild(objDiv);
    }

    // Replace content
    this.missionEl.innerHTML = '';
    this.missionEl.appendChild(brief);
    this.missionEl.appendChild(objContainer);
  },

  /**
   * Mark a single objective as complete by its ID.
   *
   * @param {string} id  Objective ID (matches data-obj-id attribute)
   */
  updateObjective: function (id) {
    if (!this.missionEl) return;

    var el = this.missionEl.querySelector('[data-obj-id="' + id + '"]');
    if (!el) return;

    el.className = 'objective complete';
    el.textContent = '\u2611 ' + el.textContent.replace(/^./, '').trim();  // ☑
  },

  /** Clear all mission content. */
  clearMission: function () {
    if (this.missionEl) {
      this.missionEl.innerHTML = '';
    }
  },

  // ---------------------------------------------------------------------------
  // Mentor panel
  // ---------------------------------------------------------------------------

  /**
   * Append a chat bubble to the mentor chat panel and auto-scroll to bottom.
   *
   * @param {string}  text      The message text
   * @param {boolean} isPlayer  true for player messages, false for mentor
   */
  appendMentorMessage: function (text, isPlayer) {
    if (!this.mentorEl) return;

    var msgDiv = document.createElement('div');
    msgDiv.className = 'mentor-msg';

    var nameSpan = document.createElement('span');
    nameSpan.className = 'mentor-name';
    nameSpan.textContent = isPlayer ? '\u4f60' : '\u5f20\u5b66\u957f';  // 你 / 张学长

    var textSpan = document.createElement('span');
    textSpan.className = 'mentor-text';
    // Highlight commands and hostnames in the text
    textSpan.innerHTML = this._highlightCommands(text);

    msgDiv.appendChild(nameSpan);
    msgDiv.appendChild(textSpan);

    this.mentorEl.appendChild(msgDiv);

    // Auto-scroll to bottom
    this.mentorEl.scrollTop = this.mentorEl.scrollHeight;
  },

  /**
   * Highlight command names and hostname patterns in text.
   * Wraps matches in span.cmd-highlight for visual emphasis.
   * @param {string} text
   * @returns {string} HTML with highlighted commands
   */
  _highlightCommands: function (text) {
    var escaped = this._escapeHtml(text);
    // Known command names to highlight
    var commands = ['help', 'scan', 'connect', 'exploit', 'curl', 'crack',
                    'inspect', 'patch', 'report', 'freemode', 'levels', 'load'];
    // Sort by length descending so longer matches take priority
    commands.sort(function (a, b) { return b.length - a.length; });

    // Build a regex: \b(command)\b  (word boundaries)
    var cmdPattern = commands.map(function (c) {
      return c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }).join('|');
    var cmdRegex = new RegExp('\\b(' + cmdPattern + ')\\b', 'gi');

    // Hostname pattern: xxx.xxx.xxx (at least two dots, domain-like)
    var hostRegex = /\b([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+\.[a-zA-Z]{2,}(?::\d{1,5})?)\b/g;

    // Apply highlighting: first hostnames, then commands (to avoid double-wrapping)
    var result = escaped.replace(hostRegex, '<span class="cmd-highlight cmd-target">$1</span>');
    result = result.replace(cmdRegex, '<span class="cmd-highlight">$1</span>');

    return result;
  },

  /** Clear all mentor chat messages. */
  clearMentor: function () {
    if (this.mentorEl) {
      this.mentorEl.innerHTML = '';
    }
  },

  // ---------------------------------------------------------------------------
  // Knowledge card
  // ---------------------------------------------------------------------------

  /**
   * Replace the knowledge card content with a new term and definition.
   *
   * @param {string} text    The definition text
   * @param {string} trigger The term / trigger word
   */
  showKnowledge: function (text, trigger) {
    if (!this.knowledgeEl) return;

    this.knowledgeEl.innerHTML =
      '<div class="knowledge-card">' +
        '<div class="knowledge-term">' + this._escapeHtml(trigger) + '</div>' +
        '<div class="knowledge-def">' + this._escapeHtml(text) + '</div>' +
      '</div>';
  },

  /** Reset knowledge card to the default "ready" state. */
  clearKnowledge: function () {
    if (!this.knowledgeEl) return;

    this.knowledgeEl.innerHTML =
      '<div class="knowledge-card">' +
        '<div class="knowledge-term">\u51c6\u5907\u5c31\u7eea</div>' +
        '<div class="knowledge-def">\u5b8c\u6210\u4efb\u52a1\u89e3\u9501\u77e5\u8bc6\u70b9</div>' +
      '</div>';
  },

  // ---------------------------------------------------------------------------
  // Score
  // ---------------------------------------------------------------------------

  /**
   * Update the score display text.
   * @param {number|string} newScore
   */
  updateScore: function (newScore) {
    if (this.scoreEl) {
      this.scoreEl.textContent = String(newScore);
    }
  },

  // ---------------------------------------------------------------------------
  // Overlay management
  // ---------------------------------------------------------------------------

  /**
   * Show the title screen overlay and hide the game UI.
   * @param {boolean} hasSave  Whether a saved game exists (enables continue btn)
   */
  showTitleScreen: function (hasSave) {
    if (this.titleScreenEl) {
      this.titleScreenEl.classList.remove('hidden');
    }
    if (this.gameUiEl) {
      this.gameUiEl.classList.add('hidden');
    }

    var continueBtn = document.getElementById('continue-btn');
    if (continueBtn) {
      continueBtn.disabled = !hasSave;
    }
  },

  /** Hide the title screen overlay and show the game UI. */
  hideTitleScreen: function () {
    if (this.titleScreenEl) {
      this.titleScreenEl.classList.add('hidden');
    }
    if (this.gameUiEl) {
      this.gameUiEl.classList.remove('hidden');
    }
  },

  /**
   * Show the level complete overlay with a custom message.
   *
   * @param {object} level   Level definition object (unused in this implementation)
   * @param {string} message Completion message to display
   */
  showLevelComplete: function (level, message) {
    var msgEl = document.getElementById('lc-message');
    if (msgEl) {
      msgEl.textContent = message;
    }

    if (this.levelCompleteEl) {
      this.levelCompleteEl.classList.remove('hidden');
    }
  },

  /** Hide the level complete overlay. */
  hideLevelComplete: function () {
    if (this.levelCompleteEl) {
      this.levelCompleteEl.classList.add('hidden');
    }
  },

  /**
   * Show the badge unlock overlay with the badge name.
   * @param {string} name  Badge name displayed after "成就解锁: "
   */
  showBadge: function (name) {
    var badgeNameEl = document.getElementById('badge-name');
    if (badgeNameEl) {
      badgeNameEl.textContent = '\u6210\u5c31\u89e3\u9501: ' + name;  // 成就解锁:
    }

    if (this.badgeOverlayEl) {
      this.badgeOverlayEl.classList.remove('hidden');
    }
  },

  /** Hide the badge overlay. */
  hideBadge: function () {
    if (this.badgeOverlayEl) {
      this.badgeOverlayEl.classList.add('hidden');
    }
  },

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Escape HTML special characters to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml: function (str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  },

  // ---------------------------------------------------------------------------
  // Theme toggle
  // ---------------------------------------------------------------------------

  /** Toggle between dark and light theme, persist to localStorage. */
  toggleTheme: function () {
    var html = document.documentElement;
    var btn = document.getElementById('theme-toggle');
    var isLight = html.classList.toggle('light-theme');
    localStorage.setItem('campus-defender-theme', isLight ? 'light' : 'dark');
    if (btn) {
      btn.textContent = isLight ? '☀️' : '🌙';
      btn.title = isLight ? '切换夜间模式' : '切换日间模式';
    }
  },

  /** Apply saved theme preference on init. Default is dark mode. */
  initTheme: function () {
    var saved = localStorage.getItem('campus-defender-theme');
    // Only use light mode if user explicitly chose it before
    var isLight = (saved === 'light');
    var html = document.documentElement;
    var btn = document.getElementById('theme-toggle');
    if (isLight) {
      html.classList.add('light-theme');
    }
    if (btn) {
      btn.textContent = isLight ? '☀️' : '🌙';
      btn.title = isLight ? '切换夜间模式' : '切换日间模式';
    }

    // Wire up button
    var self = this;
    if (btn) {
      btn.onclick = function () { self.toggleTheme(); };
    }
  },
};
