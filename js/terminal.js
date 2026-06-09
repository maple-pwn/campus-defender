/**
 * Terminal - Terminal I/O module for Campus Defender.
 *
 * Handles all terminal input/output including command history,
 * tab completion, quick command bar, and auto-scrolling output.
 *
 * Zero dependencies — uses the global GameState reference (from state.js)
 * for tab-completing against unlocked commands.
 *
 * Usage:
 *   Terminal.init();
 *   Terminal.onSubmit(function(input) { /* handle command *\/ });
 *   Terminal.print('Hello, world!');
 *   Terminal.printError('Something went wrong');
 *   Terminal.updateCommandBar(['help', 'scan', 'connect']);
 */

const Terminal = {
  outputEl: null,
  inputEl: null,
  promptEl: null,
  commandHistory: [],
  historyIndex: -1,
  commandBarEl: null,
  _onSubmitCallback: null,

  // --------------------------------------------------------------------------
  // Tab-completion state
  // --------------------------------------------------------------------------
  _tabMatches: [],
  _tabIndex: -1,
  _tabPrefix: '',

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /**
   * Bind to DOM elements and wire up keyboard listeners.
   * Call once after the DOM is ready.
   */
  init: function () {
    this.outputEl = document.getElementById('terminal-output');
    this.inputEl = document.getElementById('terminal-input');
    this.promptEl = document.querySelector('.terminal-prompt');
    this.commandBarEl = document.getElementById('command-bar');

    if (!this.inputEl) {
      console.warn('[Terminal] #terminal-input not found — terminal I/O disabled');
      return;
    }

    // Automatically focus the input on page load
    this.inputEl.focus();

    // Re-focus input when clicking anywhere on the terminal output or prompt area
    var self = this;
    if (this.outputEl) {
      this.outputEl.addEventListener('click', function () {
        self.inputEl.focus();
      });
    }

    // Keyboard handler
    this.inputEl.addEventListener('keydown', function (e) {
      self._handleKeydown(e);
    });
  },

  // --------------------------------------------------------------------------
  // Print methods
  // --------------------------------------------------------------------------

  /**
   * Append a line of text to the terminal output and auto-scroll to the bottom.
   *
   * @param {string} text      The text to display
   * @param {string} className CSS class(es) to apply (default 'terminal-line')
   */
  print: function (text, className) {
    if (!this.outputEl) return;
    className = className || 'terminal-line';

    var div = document.createElement('div');
    div.className = className;
    div.textContent = text;
    this.outputEl.appendChild(div);

    // Auto-scroll to the latest line
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  },

  /** Print a success line (green). */
  printSuccess: function (text) {
    this.print(text, 'terminal-line terminal-success');
  },

  /** Print an error line (red). */
  printError: function (text) {
    this.print(text, 'terminal-line terminal-error');
  },

  /** Print a system line (yellow/amber). */
  printSystem: function (text) {
    this.print(text, 'terminal-line terminal-system');
  },

  /** Print an info line (cyan). */
  printInfo: function (text) {
    this.print(text, 'terminal-line terminal-info');
  },

  /** Print a hint line (gold — more visible). */
  printHint: function (text) {
    this.print(text, 'terminal-line terminal-hint');
  },

  /**
   * Clear all terminal output.
   */
  clear: function () {
    if (this.outputEl) {
      this.outputEl.innerHTML = '';
    }
  },

  // --------------------------------------------------------------------------
  // Input helpers
  // --------------------------------------------------------------------------

  /** @returns {string} The current value of the input field. */
  getInput: function () {
    return this.inputEl ? this.inputEl.value : '';
  },

  /**
   * Set the input field value and restore focus.
   * @param {string} value
   */
  setInput: function (value) {
    if (!this.inputEl) return;
    this.inputEl.value = value;
    this.inputEl.focus();
  },

  /** Clear the input field. */
  clearInput: function () {
    if (this.inputEl) {
      this.inputEl.value = '';
    }
  },

  /** Place focus on the input field. */
  focus: function () {
    if (this.inputEl) {
      this.inputEl.focus();
    }
  },

  // --------------------------------------------------------------------------
  // History navigation
  // --------------------------------------------------------------------------

  /** Navigate backward through command history (Up arrow). */
  historyBack: function () {
    if (this.commandHistory.length === 0) return;
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.inputEl.value = this.commandHistory[this.historyIndex];
    }
    // Cursor to end
    this._moveCursorToEnd();
  },

  /** Navigate forward through command history (Down arrow). */
  historyForward: function () {
    if (this.historyIndex < this.commandHistory.length - 1) {
      this.historyIndex++;
      this.inputEl.value = this.commandHistory[this.historyIndex];
    } else {
      // At the end of history — clear the input
      this.historyIndex = this.commandHistory.length;
      this.inputEl.value = '';
    }
    this._moveCursorToEnd();
  },

  // --------------------------------------------------------------------------
  // Tab completion
  // --------------------------------------------------------------------------

  /**
   * Cycle through unlocked commands that match the current input prefix.
   * Calling repeatedly cycles through matches; typing a new prefix resets.
   */
  tabComplete: function () {
    if (!this.inputEl) return;

    var currentValue = this.inputEl.value;
    var parts = currentValue.split(/\s+/);
    // Only complete the first word (the command itself)
    var prefix = parts[0] || '';

    // If the input is empty or the prefix changed since last tab, re-calculate matches
    if (prefix === '' || prefix !== this._tabPrefix || this._tabMatches.length === 0) {
      this._tabPrefix = prefix;
      this._tabMatches = this._getMatchingCommands(prefix);
      this._tabIndex = -1;
    }

    if (this._tabMatches.length === 0) return;

    // Cycle forward through matches
    this._tabIndex = (this._tabIndex + 1) % this._tabMatches.length;
    this.inputEl.value = this._tabMatches[this._tabIndex];
    this._moveCursorToEnd();
  },

  /**
   * Get the list of unlocked commands that start with the given prefix.
   * Falls back to a built-in list if GameState is not available.
   * @param {string} prefix
   * @returns {string[]}
   */
  _getMatchingCommands: function (prefix) {
    var allCommands = [];

    // Prefer GameState if available, otherwise fall back to a static list
    if (typeof GameState !== 'undefined' && GameState.getData) {
      allCommands = GameState.getData().unlockedCommands;
    } else {
      // Fallback for early loading or testing
      allCommands = ['help', 'scan', 'connect', 'curl', 'exploit', 'crack', 'inspect', 'patch'];
    }

    if (!prefix) {
      return allCommands.slice(); // return a copy
    }

    var lowerPrefix = prefix.toLowerCase();
    return allCommands.filter(function (cmd) {
      return cmd.toLowerCase().indexOf(lowerPrefix) === 0;
    });
  },

  // --------------------------------------------------------------------------
  // Quick command bar
  // --------------------------------------------------------------------------

  /**
   * Replace the command bar contents with clickable buttons for each command.
   *
   * @param {string[]} commands  Array of command strings, e.g. ['help', 'scan']
   */
  updateCommandBar: function (commands) {
    if (!this.commandBarEl) return;

    // Clear existing buttons
    this.commandBarEl.innerHTML = '';

    var self = this;
    commands.forEach(function (cmd) {
      var btn = document.createElement('button');
      btn.className = 'cmd-btn';
      btn.textContent = cmd;
      btn.addEventListener('click', function () {
        self.setInput(cmd);
        self.focus();
      });
      self.commandBarEl.appendChild(btn);
    });
  },

  // --------------------------------------------------------------------------
  // Submit callback
  // --------------------------------------------------------------------------

  /**
   * Register a callback that fires whenever the user submits a command.
   * The callback receives the trimmed input string.
   *
   * @param {function(string): void} callback
   */
  onSubmit: function (callback) {
    this._onSubmitCallback = callback;
  },

  // --------------------------------------------------------------------------
  // Internal handlers
  // --------------------------------------------------------------------------

  /**
   * Central keydown dispatcher.
   * @param {KeyboardEvent} e
   */
  _handleKeydown: function (e) {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        this._handleSubmit();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.historyBack();
        break;

      case 'ArrowDown':
        e.preventDefault();
        this.historyForward();
        break;

      case 'Tab':
        e.preventDefault();
        this.tabComplete();
        break;

      default:
        // Keypress sound (only for printable keys, not modifiers)
        if (e.key.length === 1 || e.key === 'Backspace' || e.key === ' ') {
          if (typeof AudioFX !== 'undefined') AudioFX.play('keypress');
        }
        // Any other key resets the tab-completion state so that the next
        // Tab press will re-calculate matches based on the new prefix.
        if (this._tabMatches.length > 0) {
          this._tabMatches = [];
          this._tabIndex = -1;
          this._tabPrefix = '';
        }
        break;
    }
  },

  /**
   * Handle Enter key: save to history, fire callback, clear input.
   */
  _handleSubmit: function () {
    var input = this.getInput().trim();

    // Enter key sound

    // If overlays are visible, dismiss them instead of processing command
    var levelComplete = document.getElementById('level-complete');
    var badgeOverlay = document.getElementById('badge-overlay');
    if (levelComplete && !levelComplete.classList.contains('hidden')) {
      document.getElementById('next-level-btn').click();
      return;
    }
    if (badgeOverlay && !badgeOverlay.classList.contains('hidden')) {
      document.getElementById('badge-ok-btn').click();
      return;
    }

    // Empty input: trigger continue button if visible (handled by main.js)
    if (!input) {
      if (typeof this._onSubmitCallback === 'function') {
        this._onSubmitCallback('');
      }
      return;
    }
    if (typeof AudioFX !== 'undefined') AudioFX.play('enter');

    // Save to command history
    this.commandHistory.push(input);
    this.historyIndex = this.commandHistory.length;

    // Clear input
    this.clearInput();

    // Reset tab-completion state
    this._tabMatches = [];
    this._tabIndex = -1;
    this._tabPrefix = '';

    // Fire callback
    if (typeof this._onSubmitCallback === 'function') {
      this._onSubmitCallback(input);
    }
  },

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  /** Move the text cursor to the end of the input field. */
  _moveCursorToEnd: function () {
    if (!this.inputEl) return;
    // requestAnimationFrame ensures the DOM has updated before we set the cursor
    var self = this;
    requestAnimationFrame(function () {
      var len = self.inputEl.value.length;
      if (self.inputEl.setSelectionRange) {
        self.inputEl.setSelectionRange(len, len);
      }
    });
  },
};
