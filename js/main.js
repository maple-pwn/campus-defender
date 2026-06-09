/**
 * main.js — Game initialization and level flow
 *
 * This is the integration layer that wires all prior modules together.
 * It is the last JS file loaded in index.html.
 *
 * Dependencies (load order):
 *   data.js → state.js → terminal.js → commands.js → ui.js → main.js
 *
 * Global variable pattern (not ES modules).
 */

const Game = {
  currentLevel: null,     // { chapter: 1, index: 0 }
  levelData: null,        // current level data object
  metObjectives: [],      // objective IDs met in current level
  _idleTimer: null,
  _idleTimeoutMs: 30000,  // 30 seconds for boss level idle hint
  _stuckCounter: 0,       // count failed attempts before showing hint

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  init: function () {
    GameState.init();
    Terminal.init();
    UI.init();
    UI.initTheme();
    CommandRegistry.init();

    // Init audio (lazy — real init on first user gesture)
    if (typeof AudioFX !== 'undefined') AudioFX.init();

    // Wire up command submit
    Terminal.onSubmit(function (input) {
      Game.handleCommand(input);
    });

    // Wire up overlay buttons
    document.getElementById('start-btn').onclick = function () { Game.startNewGame(); };
    document.getElementById('continue-btn').onclick = function () { Game.continueGame(); };
    document.getElementById('next-level-btn').onclick = function () { Game.loadNextLevel(); };
    document.getElementById('badge-ok-btn').onclick = function () { UI.hideBadge(); };


    // Show title screen (continue button enabled if save exists)
    UI.showTitleScreen(GameState.hasSave());
  },

  // ---------------------------------------------------------------------------
  // Game flow
  // ---------------------------------------------------------------------------

  startNewGame: function () {
    GameState.reset();
    UI.hideTitleScreen();
    Game.loadLevel(1, 0);
  },

  continueGame: function () {
    var state = GameState._data;
    UI.hideTitleScreen();
    // Find last completed level and go to next
    var completed = state.completedLevels;
    if (completed.length > 0) {
      var lastId = completed[completed.length - 1];
      var lastLevel = getLevelById(lastId);
      if (lastLevel && lastLevel.nextLevel) {
        var parts = lastLevel.nextLevel.split('-');
        var ch = parseInt(parts[0].replace('ch', ''), 10);
        var idx = parseInt(parts[1], 10) - 1;
        Game.loadLevel(ch, idx);
        return;
      }
    }
    Game.loadLevel(1, 0); // fallback
  },

  loadLevel: function (chapter, index) {
    this._levelCompleteData = null;
    var data = getLevelInChapter(chapter, index);
    if (!data) { Terminal.printError('关卡数据不存在'); return; }

    this.currentLevel = { chapter: chapter, index: index };
    this.levelData = data;
    this.metObjectives = [];
    this._stuckCounter = 0;

    GameState.startLevel(chapter, index);

    this._resetIdleTimer(data);

    Terminal.clear();
    UI.clearMission();
    UI.clearMentor();
    UI.clearKnowledge();

    // Unlock commands for this chapter
    var chData = getChapter(chapter);
    if (chData && chData.unlockCommands) {
      chData.unlockCommands.forEach(function (cmd) {
        GameState.unlockCommand(cmd);
      });
    }

    Terminal.updateCommandBar(GameState._data.unlockedCommands);
    UI.setMission(data);
    // Show level title in the panel header + terminal output
    var panelTitle = document.querySelector('#terminal-panel .panel-title');
    if (panelTitle) {
      panelTitle.textContent = chData.name + ' — ' + data.title;
    }
    Terminal.printSystem('═══ ' + chData.name + ' — ' + data.title + ' ═══');
    Terminal.printHint('💡 ⬆⬇ 方向键切换历史命令 · Tab 自动补全');
    Terminal.printInfo(data.story);

    // Show first mentor message (trigger === 'start')
    if (data.mentorMessages && data.mentorMessages.length > 0 && data.mentorMessages[0].trigger === 'start') {
      setTimeout(function () { UI.appendMentorMessage(data.mentorMessages[0].text); }, 500);
    }

    Terminal.focus();
  },

  // ---------------------------------------------------------------------------
  // Command handling
  // ---------------------------------------------------------------------------

  handleCommand: function (input) {
    var trimmed = input.trim();
    if (!trimmed) {
      // Empty Enter: if continue button is visible, trigger it
      if (Game._levelCompleteData) {
        Game._handleContinue();
      }
      return;
    }

    // Reset idle timer on any command
    Game._resetIdleTimer(this.levelData);

    Terminal.print(trimmed, 'terminal-input');

    var parsed = CommandRegistry.parse(trimmed);
    if (!parsed) return;

    // ---- Free mode / meta commands (always available) ----
    var cmd = parsed.command;
    if (cmd === 'freemode' || cmd === 'levels') {
      Game.showLevelSelect();
      Terminal.clearInput();
      Terminal.focus();
      if (typeof AudioFX !== 'undefined') AudioFX.play('success');
      return;
    }

    if (cmd === 'load') {
      Game.handleLoadCommand(parsed.args);
      Terminal.clearInput();
      Terminal.focus();
      if (typeof AudioFX !== 'undefined') AudioFX.play('success');
      return;
    }
    // ---- End free mode commands ----

    var handler = CommandRegistry.get(parsed.command);
    if (!handler) {
      Terminal.printError('未知命令: ' + parsed.command + '。输入 help 查看可用命令。');
      Terminal.focus();
      return;
    }

    if (!GameState.isCommandUnlocked(parsed.command)) {
      Terminal.printError('命令 ' + parsed.command + ' 还未解锁。继续完成当前章节来解锁！');
      Terminal.focus();
      return;
    }

    // Execute command handler
    var result = handler(parsed.args, this.levelData, {
      chapter: this.currentLevel.chapter,
      index: this.currentLevel.index,
      metObjectives: this.metObjectives,
      unlockedCommands: GameState._data.unlockedCommands,
    });

    // Print output
    if (result && result.output) {
      var hasError = false;
      var hasSuccess = false;
      for (var i = 0; i < result.output.length; i++) {
        var line = result.output[i];
        if (line.type === 'success') { Terminal.printSuccess(line.text); hasSuccess = true; }
        else if (line.type === 'error') { Terminal.printError(line.text); hasError = true; }
        else if (line.type === 'system') Terminal.printSystem(line.text);
        else if (line.type === 'info') Terminal.printInfo(line.text);
        else Terminal.print(line.text);
      }
      // Sound feedback
      if (typeof AudioFX !== 'undefined') {
        if (hasError) AudioFX.play('error');
        else if (hasSuccess || result.objectivesMet) AudioFX.play('success');
      }
    }

    // Crack sound
    if (parsed.command === 'crack' && result && !result.output.some(function(l) { return l.type === 'error'; })) {
      if (typeof AudioFX !== 'undefined') AudioFX.play('crack');
    }

    // Handle knowledge card
    if (result && result.knowledgeCard) {
      UI.showKnowledge(result.knowledgeCard.text, result.knowledgeCard.trigger);
    }

    // Handle mentor trigger
    if (result && result.mentorTrigger) {
      var msg = null;
      for (var j = 0; j < this.levelData.mentorMessages.length; j++) {
        if (this.levelData.mentorMessages[j].trigger === result.mentorTrigger) {
          msg = this.levelData.mentorMessages[j];
          break;
        }
      }
      if (msg) {
        setTimeout(
          (function (m) { return function () { UI.appendMentorMessage(m.text); }; })(msg),
          300
        );
      }
    }

    // Track met objectives
    var objectivesUpdated = false;
    if (result && result.objectivesMet) {
      for (var k = 0; k < result.objectivesMet.length; k++) {
        if (this.metObjectives.indexOf(result.objectivesMet[k]) === -1) {
          this.metObjectives.push(result.objectivesMet[k]);
          objectivesUpdated = true;
        }
        UI.updateObjective(result.objectivesMet[k]);
      }
    }

    // Fallback: only if command succeeded AND no objectives matched
    if (!objectivesUpdated && (!result || !result._skipFallback) && this.levelData && this.levelData.objectives) {
      var cmdName = parsed ? parsed.command : '';
      for (var v = 0; v < this.levelData.objectives.length; v++) {
        var oid = this.levelData.objectives[v].id;
        if (this.metObjectives.indexOf(oid) === -1) {
          // Check if this objective is relevant to the current command
          var isRelevant = (oid === cmdName || oid.indexOf(cmdName + '_') === 0);
          if (!isRelevant && cmdName === 'exploit') {
            isRelevant = (oid.indexOf('sql_') === 0 || oid.indexOf('xss_') === 0);
          }
          if (isRelevant) {
            this.metObjectives.push(oid);
            UI.updateObjective(oid);
            Terminal.printInfo('✅ 目标已标记: ' + this.levelData.objectives[v].description);
            break; // Only match ONE objective per command
          }
        }
      }
    }

    // Stuck counter: after 3 non-progressing commands, show a hint (practical levels only)
    if (this.levelData && this.levelData.isBoss && !result.levelComplete) {
      if (objectivesUpdated) {
        this._stuckCounter = 0;
      } else if (parsed && parsed.command !== 'help' && parsed.command !== 'report') {
        this._stuckCounter++;
        if (this._stuckCounter >= 3 && this.levelData.hints) {
          var hintIdx = this.metObjectives.length;
          if (hintIdx < this.levelData.hints.length) {
            var hintText = this.levelData.hints[hintIdx];
            UI.appendMentorMessage('💡 ' + hintText);
          }
          this._stuckCounter = 0;
        }
      }
    }

    // Handle level completion
    if (result && result.levelComplete) {
      Game.onLevelComplete();
    }

    // Boss levels: if all non-report objectives are met, remind player to type report
    if (this.levelData && this.levelData.isBoss && !result.levelComplete) {
      var objsTotal = this.levelData.objectives;
      var nonReportMet = true;
      for (var n = 0; n < objsTotal.length; n++) {
        if (objsTotal[n].id === 'report') continue;
        if (this.metObjectives.indexOf(objsTotal[n].id) === -1) {
          nonReportMet = false;
          break;
        }
      }
      if (nonReportMet && this.metObjectives.indexOf('report') === -1) {
        Terminal.printInfo('💡 提示: 所有侦察工作已完成，输入 report 提交最终报告！');
      }
    }

    // Auto-complete non-boss levels when all objectives are met
    if (result && !result.levelComplete && this.levelData && !this.levelData.isBoss) {
      var allMet = true;
      var objs = this.levelData.objectives;
      for (var m = 0; m < objs.length; m++) {
        if (this.metObjectives.indexOf(objs[m].id) === -1) {
          allMet = false;
          break;
        }
      }
      if (allMet && objs.length > 0) {
        Game.onLevelComplete();
      }
    }

    Terminal.clearInput();
    Terminal.focus();
  },

  // ---------------------------------------------------------------------------
  // Level completion
  // ---------------------------------------------------------------------------

  onLevelComplete: function () {
    var levelId = GameState.getLevelId(this.currentLevel.chapter, this.currentLevel.index);
    var level = this.levelData;
    var score = level.score || 0;
    var isBoss = level.isBoss;
    var badge = level.badge;

    GameState.completeLevel(levelId, score);

    // Award badge for boss levels
    if (isBoss && badge) {
      GameState.addBadge(badge);
      if (typeof AudioFX !== 'undefined') AudioFX.play('badge');
    }

    // Level complete sound
    if (typeof AudioFX !== 'undefined') AudioFX.play('levelComplete');

    UI.updateScore(GameState._data.score);

    // Show success message in terminal
    Terminal.printSuccess('✅ 任务完成！获得 +' + score + ' 分！');
    if (isBoss && badge) {
      Terminal.printSuccess('🏆 获得成就: ' + badge);
    }

    // Show a continue button in the command bar instead of auto-popup
    this._showContinueButton(level, score, isBoss, badge);

    // Check if game is fully complete
    if (!level.nextLevel) {
      Terminal.printSystem('🎉 恭喜你完成所有关卡！你已成为合格的卡塞尔安全卫士！');
      Terminal.printSystem('输入 freemode 或 levels 进入自由模式，可以重新挑战任何已通关关卡');
    }
  },

  // ---------------------------------------------------------------------------
  // Level completion — manual trigger (button click)
  // ---------------------------------------------------------------------------

  _levelCompleteData: null,

  /** Show a clickable "继续" button in the command bar. */
  _showContinueButton: function (level, score, isBoss, badge) {
    this._levelCompleteData = { level: level, score: score, isBoss: isBoss, badge: badge };

    var bar = document.getElementById('command-bar');
    if (!bar) return;

    // Clear existing command buttons and add continue button
    bar.innerHTML = '';

    var btn = document.createElement('button');
    btn.className = 'cmd-btn continue-btn';
    btn.textContent = '▶ 继续下一关';
    btn.onclick = function () { Game._handleContinue(); };
    bar.appendChild(btn);

    Terminal.printSystem('点击下方 "▶ 继续下一关" 按钮继续，或在终端按 Enter');
  },

  /** Handle continue button click or Enter key. */
  _handleContinue: function () {
    if (!this._levelCompleteData) return;
    var data = this._levelCompleteData;
    var message = '获得 +' + data.score + ' 分！总分: ' + GameState._data.score;
    if (data.isBoss && data.badge) {
      message = message + '\n🏆 你获得了成就: ' + data.badge;
    }
    UI.showLevelComplete(data.level, message);
    this._levelCompleteData = null;
  },

  // ---------------------------------------------------------------------------
  // Free mode / level select
  // ---------------------------------------------------------------------------

  /** Display a list of completed levels that can be replayed. */
  showLevelSelect: function () {
    var completed = GameState._data.completedLevels;
    if (completed.length === 0) {
      Terminal.printSystem('还没有已通关的关卡。请先完成一些关卡！');
      return;
    }

    Terminal.printSystem('已通关关卡（可自由挑战）:');
    for (var i = 0; i < completed.length; i++) {
      var levelId = completed[i];
      var level = getLevelById(levelId);
      if (!level) continue;
      var ch = getChapter(level.chapter);
      var chName = ch ? ch.name : '第' + level.chapter + '章';
      var score = GameState._data.levelScores[levelId] || 0;
      Terminal.printInfo((i + 1) + '. ' + chName + ' — ' + level.title + ' (' + score + '分)');
    }
    Terminal.printSystem('输入 load <关卡ID> 重新挑战，例如: load ch1-1');
  },

  /** Handle the 'load' command to replay a completed level. */
  handleLoadCommand: function (args) {
    if (!args || args.length < 1) {
      Terminal.printError('用法: load <关卡ID>，例如 load ch1-1');
      return;
    }

    var levelId = args[0].toLowerCase();
    var level = getLevelById(levelId);
    if (!level) {
      Terminal.printError('关卡 ' + levelId + ' 不存在。');
      return;
    }

    // Only allow replaying already-completed levels
    var completed = GameState._data.completedLevels;
    if (completed.indexOf(levelId) === -1) {
      Terminal.printError('关卡 ' + levelId + ' 尚未通关，不能自由挑战。');
      return;
    }

    Game.loadLevel(level.chapter, level.index);
  },

  loadNextLevel: function () {
    var next = this.levelData.nextLevel;
    UI.hideLevelComplete();
    if (!next) {
      Terminal.printSystem('你已经完成了所有关卡！输入 freemode 或 levels 查看已通关关卡。');
      Game.showLevelSelect();
      return;
    }
    var parts = next.split('-');
    var ch = parseInt(parts[0].replace('ch', ''), 10);
    var idx = parseInt(parts[1], 10) - 1;
    this.loadLevel(ch, idx);
  },

  // ---------------------------------------------------------------------------
  // Idle timer (boss levels only)
  // ---------------------------------------------------------------------------

  _resetIdleTimer: function (data) {
    if (this._idleTimer) clearTimeout(this._idleTimer);
    this._idleTimer = null;

    if (data && data.isBoss) {
      var self = this;
      this._idleTimer = setTimeout(function () {
        // Find the 'timeout' trigger mentor message
        var msgs = data.mentorMessages;
        for (var i = 0; i < msgs.length; i++) {
          if (msgs[i].trigger === 'timeout') {
            UI.appendMentorMessage(msgs[i].text);
            break;
          }
        }
      }, self._idleTimeoutMs);
    }
  },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function () { Game.init(); });
