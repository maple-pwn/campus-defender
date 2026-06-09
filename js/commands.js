/**
 * commands.js - Campus Defender Command Registry
 *
 * Defines all 8+1 command handlers (help, scan, connect, exploit, curl,
 * crack, inspect, patch, report) via the CommandRegistry global object.
 *
 * Each handler receives (args, levelData, levelContext) and returns:
 *   {
 *     output: [{ type, text }, ...],
 *     knowledgeCard: null | { trigger, text },
 *     mentorTrigger: null | string,
 *     objectivesMet: null, _skipFallback: true | string[],
 *     levelComplete: false
 *   }
 *
 * Dependencies:
 *   - GameState (from state.js) for unlocked commands
 *   - LEVELS / getLevelById (from data.js) for level data lookups
 *
 * Load order in HTML: data.js -> state.js -> terminal.js -> commands.js
 */

// =============================================================================
// Command descriptions (used by helpCmd)
// =============================================================================

var COMMAND_HELP = {
  help:    '查看可用命令及说明',
  scan:    '扫描目标主机，发现开放端口和服务',
  connect: '连接到指定端口查看服务详情',
  exploit: '利用漏洞攻击目标 (sql-inject / xss / brute-login)',
  curl:    '发送HTTP请求，获取网页内容',
  crack:   '破解密码哈希 (brute=暴力破解 / dict=字典攻击)',
  inspect: '查看文件或目录内容',
  patch:   '修复加固漏洞 (sanitize-input / fix-query / password-policy 等)',
  report:  '提交任务报告，完成当前关卡',
};

// =============================================================================
// CommandRegistry
// =============================================================================

var CommandRegistry = {

  // ---------------------------------------------------------------------------
  // Handler storage
  // ---------------------------------------------------------------------------

  handlers: {},

  /**
   * Register a command handler.
   * @param {string} name    Command name (lowercase)
   * @param {function} handler  Function (args, levelData, levelContext) -> result
   */
  register: function (name, handler) {
    this.handlers[name] = handler;
  },

  /** Retrieve a handler by name. */
  get: function (name) {
    return this.handlers[name] || null;
  },

  /** Return all registered command names. */
  getAll: function () {
    return Object.keys(this.handlers);
  },

  // ---------------------------------------------------------------------------
  // Init — register all 8+1 handlers
  // ---------------------------------------------------------------------------

  init: function () {
    this.register('help',    this.helpCmd.bind(this));
    this.register('scan',    this.scanCmd.bind(this));
    this.register('connect', this.connectCmd.bind(this));
    this.register('exploit', this.exploitCmd.bind(this));
    this.register('curl',    this.curlCmd.bind(this));
    this.register('crack',   this.crackCmd.bind(this));
    this.register('inspect', this.inspectCmd.bind(this));
    this.register('patch',   this.patchCmd.bind(this));
    this.register('report',  this.reportCmd.bind(this));
  },

  // ---------------------------------------------------------------------------
  // Input parsing
  // ---------------------------------------------------------------------------

  /**
   * Parse a raw input string into command + args.
   * @param {string} input  Raw user input
   * @returns {null|{command: string, args: string[]}}
   */
  parse: function (input) {
    input = input.trim();
    if (!input) return null;
    var parts = input.split(/\s+/);
    return {
      command: parts[0].toLowerCase(),
      args:    parts.slice(1),
    };
  },

  // ===========================================================================
  // Internal helpers
  // ===========================================================================

  /**
   * Resolve the list of currently unlocked commands.
   * Prefers levelContext (for per-level override), then GameState.
   * @param {object|null} levelContext
   * @returns {string[]}
   */
  _getUnlockedCommands: function (levelContext) {
    if (levelContext && Array.isArray(levelContext.unlockedCommands)) {
      return levelContext.unlockedCommands.slice();
    }
    if (typeof GameState !== 'undefined' && GameState._data &&
        Array.isArray(GameState._data.unlockedCommands)) {
      return GameState._data.unlockedCommands.slice();
    }
    return ['help'];
  },

  /**
   * Find a knowledge card whose trigger matches the given trigger string.
   * @param {string} trigger   e.g. "cmd:scan"
   * @param {object} levelData
   * @returns {null|object}
   */
  _findKnowledgeCard: function (trigger, levelData) {
    if (!levelData || !Array.isArray(levelData.knowledgeCards)) return null;
    for (var i = 0; i < levelData.knowledgeCards.length; i++) {
      if (levelData.knowledgeCards[i].trigger === trigger) {
        return levelData.knowledgeCards[i];
      }
    }
    return null;
  },

  /**
   * Find a mentor trigger that matches the given trigger string.
   * @param {string} trigger   e.g. "cmd:scan", "cmd:connect"
   * @param {object} levelData
   * @returns {null|string}
   */
  _findMentorTrigger: function (trigger, levelData) {
    if (!levelData || !Array.isArray(levelData.mentorMessages)) return null;
    for (var i = 0; i < levelData.mentorMessages.length; i++) {
      if (levelData.mentorMessages[i].trigger === trigger) {
        return levelData.mentorMessages[i].trigger;
      }
    }
    return null;
  },

  /**
   * Determine which objectives are satisfied by the given command.
   *
   * Matching rules:
   *   - help  (no args)            -> objective id === 'help'
   *   - scan                       -> objective id === 'scan'
   *                              or  objective id starts with 'scan_'
   *   - connect <port>             -> objective id === 'connect_{port}'
   *                              or  objective id === 'connect'
   *   - exploit                    -> objective id === 'exploit'
   *                              or  objective id starts with the vuln-type
   *   - curl                       -> objective id starts with 'curl'
   *   - crack                      -> objective id starts with 'crack'
   *   - inspect                    -> objective id starts with 'inspect'
   *   - patch                      -> objective id starts with 'patch'
   *   - report (handled in reportCmd)
   *
   * @param {string} commandName
   * @param {string[]} args
   * @param {object[]} objectives
   * @returns {null|string[]}  Array of met objective ids, or null
   */
  _checkCommandObjectives: function (commandName, args, objectives) {
    if (!Array.isArray(objectives) || objectives.length === 0) return null;
    args = args || [];

    var met = [];

    for (var i = 0; i < objectives.length; i++) {
      var objId = objectives[i].id;
      if (!objId) continue;

      var matched = false;

      if (commandName === 'help') {
        // Only match 'help' when no args (just "help" by itself)
        if (args.length === 0 && objId === 'help') matched = true;

      } else if (commandName === 'scan') {
        // Match scan objectives: try target-specific, then sequential
        if (objId === 'scan') {
          matched = true;
        } else if (objId.indexOf('scan_') === 0 && args.length >= 1) {
          var targetStr = args[0].toLowerCase();
          // Try matching objective from target keywords
          // e.g., scan dorm.cassel.edu → target has "dorm" → match scan_dorm
          if (objId === 'scan_' + targetStr) {
            matched = true;
          } else if (objId.indexOf('scan_') >= 0) {
            // Try each token in the target to match objective suffix
            var targetParts = targetStr.replace(/[\.\-]/g, '_').split('_');
            for (var st = 0; st < targetParts.length && !matched; st++) {
              if (targetParts[st].length > 1 && objId === 'scan_' + targetParts[st]) {
                matched = true;
              }
            }
          }
          // Fallback removed — main.js handles unmatched objectives one-at-a-time
        }

      } else if (commandName === 'connect') {
        // Match 'connect_{port}' where port equals args[1]
        // Also match plain 'connect' objective
        if (objId === 'connect') {
          matched = true;
        } else if (args.length >= 2) {
          var portStr = String(args[1]);
          if (objId === 'connect_' + portStr) matched = true;
        }

      } else if (commandName === 'exploit') {
        // Match exploit objectives: specific vuln-type then sequential
        if (objId === 'exploit') {
          matched = true;
        } else if (args.length >= 2) {
          var typeStr = args[1].toLowerCase().replace(/-/g, '_');
          // Try exact match: exploit type → match objId starting with type
          if (objId.indexOf(typeStr + '_') === 0) {
            matched = true;
          } else {
            // Try tokens from vuln-type
            var vulnTokens = typeStr.split('_');
            for (var vt = 0; vt < vulnTokens.length && !matched; vt++) {
              if (vulnTokens[vt].length > 0 && objId.indexOf(vulnTokens[vt] + '_') === 0) {
                matched = true;
              }
            }
          }
        }

      } else if (commandName === 'curl') {
        // Match specific curl objective based on --headers flag
        if (args.length >= 2 && args[1] === '--headers') {
          if (objId === 'curl_headers') matched = true;
        } else if (args.length < 2 || args.length === 1) {
          if (objId === 'curl' || objId === 'curl_page') matched = true;
        }

      } else if (commandName === 'crack') {
        // Match specific crack_{method} based on method arg
        if (objId === 'crack') {
          matched = true;
        } else if (objId.indexOf('crack_') === 0 && args.length >= 2) {
          var methodStr = args[1].toLowerCase().replace(/-/g, '_');
          // Try exact match: crack method → crack_{method}
          if (objId === 'crack_' + methodStr) {
            matched = true;
          } else {
            // Try matching tokens: "brute-force" → try "brute" → match crack_brute
            var methodTokens = methodStr.split('_');
            for (var mt = 0; mt < methodTokens.length && !matched; mt++) {
              if (methodTokens[mt].length > 0 && objId === 'crack_' + methodTokens[mt]) matched = true;
            }
          }
          // Fallback removed
        }

      } else if (commandName === 'inspect') {
        // Match inspect objectives: try path-based first, then sequential
        if (objId === 'inspect') {
          matched = true;
        } else if (objId.indexOf('inspect_') === 0 && args.length >= 1) {
          var pathStr = args[0].toLowerCase().replace(/[\/\.\-]/g, '_');
          // Try exact path match: inspect passwords_txt → match inspect_passwords_txt
          if (objId === 'inspect_' + pathStr) {
            matched = true;
          } else {
            // Try each path token: "passwords_txt" → try "passwords", "txt"
            var pathTokens = pathStr.split('_');
            for (var pt = 0; pt < pathTokens.length && !matched; pt++) {
              if (pathTokens[pt].length > 0 && objId === 'inspect_' + pathTokens[pt]) {
                matched = true;
              }
            }
          }
          // Fallback removed
        }

      } else if (commandName === 'patch') {
        // Match specific patch_{fixType} based on fix-type arg
        if (objId === 'patch') {
          matched = true;
        } else if (objId.indexOf('patch_') === 0 && args.length >= 2) {
          var fixStr = args[1].toLowerCase().replace(/-/g, '_');
          // Try exact match: patch sanitize_input → match patch_sanitize_input
          if (objId === 'patch_' + fixStr) {
            matched = true;
          } else {
            // Try tokens: "sanitize_input" → try "sanitize" → match patch_sanitize
            var fixTokens = fixStr.split('_');
            for (var ft = 0; ft < fixTokens.length && !matched; ft++) {
              if (fixTokens[ft].length > 0 && objId === 'patch_' + fixTokens[ft]) {
                matched = true;
              }
            }
          }
          // Fallback removed
        }

      } else if (commandName === 'report') {
        if (objId === 'report') matched = true;
      }

      if (matched) {
        met.push(objId);
      }
    }

    // Limit to ONE match per command (prevents token matching from matching multiple)
    if (met.length > 1) {
      met = [met[0]];
    }

    return met.length > 0 ? met : null;
  },

  // ===========================================================================
  // helpCmd
  // ===========================================================================

  /**
   * help [command]
   *
   * With no args: list all unlocked commands and their short descriptions.
   * With a specific unlocked command name: show detailed help.
   */
  helpCmd: function (args, levelData, levelContext) {
    args = args || [];
    var unlocked = this._getUnlockedCommands(levelContext);
    var output = [];

    if (args.length === 0) {
      // List all unlocked commands
      output.push({ type: 'system', text: '=== 可用命令 ===' });
      output.push({ type: 'info', text: '💡 ⬆ 上/⬇ 下方向键切换历史命令 · Tab 键自动补全' });
      for (var i = 0; i < unlocked.length; i++) {
        var cmd = unlocked[i];
        var desc = COMMAND_HELP[cmd] || '暂无说明';
        output.push({ type: 'normal', text: '  ' + cmd + ' — ' + desc });
      }
    } else {
      // Detailed help for a specific command
      var requested = args[0].toLowerCase();
      if (unlocked.indexOf(requested) !== -1) {
        var detail = COMMAND_HELP[requested] || '暂无说明';
        output.push({ type: 'info', text: '命令: ' + requested });
        output.push({ type: 'normal', text: '说明: ' + detail });

        // Add usage hints for specific commands
        var usageHints = {
          help:    '用法: help [命令]',
          scan:    '用法: scan <target>',
          connect: '用法: connect <target> <port>',
          exploit: '用法: exploit <target> <vuln-type>',
          curl:    '用法: curl <url> [--headers]',
          crack:   '用法: crack <hash> <method>',
          inspect: '用法: inspect <path>',
          patch:   '用法: patch <target> <fix-type>',
          report:  '用法: report',
        };
        if (usageHints[requested]) {
          output.push({ type: 'info', text: usageHints[requested] });
        }
      } else {
        output.push({ type: 'error', text: '未知命令: ' + requested + '，输入 help 查看可用命令' });
      }
    }

    return this._buildResult(output, args, 'help', levelData, levelContext);
  },

  // ===========================================================================
  // scanCmd
  // ===========================================================================

  /**
   * scan <target>
   *
   * Scans the specified target and returns open ports.
   * Checks levelData.scanResults for pre-defined scan data.
   */
  scanCmd: function (args, levelData, levelContext) {
    var output = [];

    // Validate arguments
    if (!args || args.length < 1) {
      output.push({ type: 'error', text: '用法: scan <target>' });
      return { output: output, objectivesMet: null, _skipFallback: true };
    }

    var target = args[0];
    output.push({ type: 'system', text: '[*] 正在扫描 ' + target + '...' });

    // Check for scan results
    var results = null;
    if (levelData && levelData.scanResults && levelData.scanResults[target]) {
      results = levelData.scanResults[target];
    }

    if (results && results.length > 0) {
      output.push({ type: 'success', text: '[+] 扫描完成，发现 ' + results.length + ' 个开放端口:' });
      output.push({ type: 'normal', text: '' });
      output.push({ type: 'normal', text: '端口\t\t服务\t\t版本\t\t\t信息' });
      output.push({ type: 'normal', text: '----\t\t----\t\t----\t\t\t----' });

      for (var i = 0; i < results.length; i++) {
        var r = results[i];
        var line = r.port + '/tcp\t\t' + r.service + '\t\t' + r.banner + '\t\t' + r.info;
        output.push({ type: 'normal', text: line });
      }
    } else {
      output.push({ type: 'info', text: '未发现开放端口' });
      return { output: output, objectivesMet: null, _skipFallback: true };
    }

    return this._buildResult(output, args, 'scan', levelData, levelContext);
  },

  // ===========================================================================
  // connectCmd
  // ===========================================================================

  /**
   * connect <target> <port>
   *
   * Connects to a specific port on the target and returns service info.
   * Checks levelData.connectResults for pre-defined connection results.
   */
  connectCmd: function (args, levelData, levelContext) {
    var output = [];

    // Validate arguments
    if (!args || args.length < 2) {
      output.push({ type: 'error', text: '用法: connect <target> <port>' });
      return { output: output, objectivesMet: null, _skipFallback: true };
    }

    var target = args[0];
    var port = args[1];
    var key = target + ':' + port;

    // Check for connection results
    var result = null;
    if (levelData && levelData.connectResults && levelData.connectResults[key]) {
      result = levelData.connectResults[key];
    }

    if (result) {
      output.push({ type: 'success', text: result });
    } else {
      output.push({ type: 'error', text: '无法连接到 ' + key + '，可能端口未开放或地址不正确' });
      return { output: output, objectivesMet: null, _skipFallback: true };
    }

    return this._buildResult(output, args, 'connect', levelData, levelContext);
  },

  // ===========================================================================
  // exploitCmd
  // ===========================================================================

  /**
   * exploit <target> <vuln-type>
   *
   * Attempts to exploit a vulnerability on the target.
   * Checks levelData.exploitResults for pre-defined exploit results.
   * vuln-type: sql-inject, xss, brute-login, steal-cookie, get-users, etc.
   */
  exploitCmd: function (args, levelData, levelContext) {
    var output = [];

    // Validate arguments
    if (!args || args.length < 2) {
      output.push({ type: 'error', text: '用法: exploit <target> <vuln-type>' });
      return { output: output, objectivesMet: null, _skipFallback: true };
    }

    var target = args[0];
    var vulnType = args[1];
    var key = target + ':' + vulnType;

    // Check for exploit results
    var result = null;
    if (levelData && levelData.exploitResults && levelData.exploitResults[key]) {
      result = levelData.exploitResults[key];
    }

    if (result) {
      output.push({ type: 'success', text: result });
    } else {
      output.push({ type: 'error', text: '利用失败，目标似乎不存在此漏洞' });
      return { output: output, objectivesMet: null, _skipFallback: true };
    }

    return this._buildResult(output, args, 'exploit', levelData, levelContext);
  },

  // ===========================================================================
  // curlCmd
  // ===========================================================================

  /**
   * curl <url> [--headers]
   *
   * Sends an HTTP request to the target URL.
   * With --headers (second arg): also shows HTTP response headers.
   * Checks levelData.curlResults for pre-defined curl results.
   */
  curlCmd: function (args, levelData, levelContext) {
    var output = [];

    // Validate arguments
    if (!args || args.length < 1) {
      output.push({ type: 'error', text: '用法: curl <url> [--headers]' });
      return { output: output, objectivesMet: null, _skipFallback: true };
    }

    var target = args[0];
    var showHeaders = (args.length >= 2 && args[1] === '--headers');

    // Check for curl results
    var bodyContent = null;
    var headersContent = null;

    if (levelData && levelData.curlResults) {
      if (showHeaders) {
        var headersKey = target + ':headers';
        if (levelData.curlResults[headersKey]) {
          headersContent = levelData.curlResults[headersKey];
        }
        bodyContent = levelData.curlResults[target] || null;
      } else {
        bodyContent = levelData.curlResults[target] || null;
      }
    }

    if (bodyContent) {
      if (showHeaders && headersContent) {
        output.push({ type: 'info', text: '=== 响应头 ===' });
        output.push({ type: 'normal', text: headersContent });
        output.push({ type: 'info', text: '=== 响应体 ===' });
      }
      output.push({ type: 'normal', text: bodyContent });
    } else {
      output.push({ type: 'error', text: '无法连接到 ' + target + '，目标不可达或地址不正确' });
      return { output: output, objectivesMet: null, _skipFallback: true };
    }

    return this._buildResult(output, args, 'curl', levelData, levelContext);
  },

  // ===========================================================================
  // crackCmd
  // ===========================================================================

  /**
   * crack <hash> <method>
   *
   * Simulates cracking a password hash.
   * method: brute (暴力破解) or dict (字典攻击)
   * Checks levelData.crackResults for pre-defined results, or returns
   * a simulated success message.
   */
  crackCmd: function (args, levelData, levelContext) {
    var output = [];

    // Validate arguments
    if (!args || args.length < 2) {
      output.push({ type: 'error', text: '用法: crack <hash> <method> (method: brute/dict)' });
      return { output: output, objectivesMet: null, _skipFallback: true };
    }

    var hash = args[0];
    var method = args[1];
    var key = hash + ':' + method;

    // Check for pre-defined crack results
    var result = null;
    if (levelData && levelData.crackResults && levelData.crackResults[key]) {
      result = levelData.crackResults[key];
    }

    var password, crackTime;

    if (result) {
      password = result.password;
      crackTime = result.time;
    } else {
      password = this._simulateCrack(hash, method);
      crackTime = (method === 'dict') ? '12.5秒' : '3分42秒';
    }

    // Build cracking animation with fake attempts
    var methodLabel = (method === 'dict') ? '字典攻击' : '暴力破解';
    output.push({ type: 'system', text: '[*] 开始' + methodLabel + '...' });

    var attempts = this._generateAttempts(hash, method, password);
    for (var i = 0; i < attempts.length; i++) {
      var att = attempts[i];
      var prefix = att.hit ? '[+] ' : '[*] ';
      var suffix = att.hit ? ' → ✓ 命中!' : ' → ✗';
      var line = '  ' + prefix + '尝试: ' + att.value;
      // Pad to align the ✓/✗ marks
      while (line.length < 38) line += ' ';
      line += suffix;
      output.push({ type: att.hit ? 'success' : 'info', text: line });
    }

    output.push({ type: 'success', text: '[+] ✅ 密码已破解: ' + password });
    output.push({ type: 'system', text: '[*] 耗时: ' + crackTime });

    return this._buildResult(output, args, 'crack', levelData, levelContext);
  },

  /**
   * Generate a series of fake password attempts leading to the correct one.
   * Deterministic based on hash so the same input always gives the same animation.
   */
  _generateAttempts: function (hash, method, answer) {
    // Pool of common weak passwords to use as "failed attempts"
    var brutePool   = ['aaaaaa', '123123', 'abc123', 'password', 'admin', 'iloveyou',
                       'monkey', 'qwerty', '000000', 'letmein', 'dragon', 'master'];
    var dictPool    = ['password123', 'admin2024', 'summer2025', 'Welcome1', 'changeme',
                       'Spring2024', 'Winter2025', 'qwerty123', 'football', 'baseball'];
    var pool = (method === 'dict') ? dictPool : brutePool;

    // Pick 4-5 fake attempts deterministically, ensuring answer is the last one
    var hashSeed = 0;
    for (var i = 0; i < hash.length; i++) { hashSeed += hash.charCodeAt(i); }

    var count = 4 + (hashSeed % 3); // 4-6 attempts
    var seen = {};
    var attempts = [];

    // Filter out the answer from the pool (don't show it early)
    var candidates = [];
    for (var c = 0; c < pool.length; c++) {
      if (pool[c] !== answer) candidates.push(pool[c]);
    }

    // Pick deterministic unique candidates
    var idx = hashSeed % candidates.length;
    for (var j = 0; j < count - 1 && j < candidates.length; j++) {
      var pick = candidates[(idx + j * 3) % candidates.length];
      if (!seen[pick]) {
        seen[pick] = true;
        attempts.push({ value: pick, hit: false });
      }
    }

    // Final attempt is the real answer
    attempts.push({ value: answer, hit: true });

    return attempts;
  },

  /**
   * Generate a simulated cracked password for the given hash and method.
   * Deterministic based on the hash to make it feel consistent.
   * @param {string} hash
   * @param {string} method
   * @returns {string}
   */
  _simulateCrack: function (hash, method) {
    // Simple deterministic "password" derived from the hash
    var commonPasswords = ['123456', 'password', 'admin', 'admin123', 'welcome',
                           'letmein', 'monkey', 'dragon', 'master', 'qwerty'];
    var hashSum = 0;
    for (var i = 0; i < hash.length; i++) {
      hashSum += hash.charCodeAt(i);
    }
    var index = hashSum % commonPasswords.length;

    if (method === 'dict') {
      // Dictionary attack finds slightly more complex passwords
      var dictPasswords = ['P@ssw0rd', 'Summer2023', 'Changeme1', 'Welcome123',
                           'Admin@2024', 'SchoolNet!', 'Campus#2024', 'Security!'];
      return dictPasswords[hashSum % dictPasswords.length];
    }

    return commonPasswords[index];
  },

  // ===========================================================================
  // inspectCmd
  // ===========================================================================

  /**
   * inspect <path>
   *
   * Inspects a file or directory on the system.
   * Checks levelData.inspectResults for pre-defined content.
   */
  inspectCmd: function (args, levelData, levelContext) {
    var output = [];

    // Validate arguments
    if (!args || args.length < 1) {
      output.push({ type: 'error', text: '用法: inspect <path>' });
      return { output: output, objectivesMet: null, _skipFallback: true };
    }

    var path = args[0];

    // Check for pre-defined inspect results
    var content = null;
    if (levelData && levelData.inspectResults && levelData.inspectResults[path]) {
      content = levelData.inspectResults[path];
    }

    if (content) {
      output.push({ type: 'info', text: '=== ' + path + ' ===' });
      output.push({ type: 'normal', text: content });
    } else {
      // Generic simulated file listing
      output.push({ type: 'info', text: '正在读取: ' + path + ' ...' });
      output.push({ type: 'normal', text: '目录/文件内容暂不可用。路径 ' + path + ' 在当前系统中未找到预定义数据。' });
      return { output: output, objectivesMet: null, _skipFallback: true };
    }

    return this._buildResult(output, args, 'inspect', levelData, levelContext);
  },

  // ===========================================================================
  // patchCmd
  // ===========================================================================

  /**
   * patch <target> <fix-type>
   *
   * Applies a security fix to the target.
   * fix-type: sanitize-input, fix-query, close-port, update-config,
   *           remove-backdoor, fix-permissions, setup-firewall,
   *           password-policy, enable-2fa
   * Checks levelData.patchResults for pre-defined results.
   */
  patchCmd: function (args, levelData, levelContext) {
    var output = [];

    // Validate arguments
    if (!args || args.length < 2) {
      output.push({ type: 'error', text: '用法: patch <target> <fix-type>' });
      return { output: output, objectivesMet: null, _skipFallback: true };
    }

    var target = args[0];
    var fixType = args[1];
    var key = target + ':' + fixType;

    // Check for pre-defined patch results
    var result = null;
    if (levelData && levelData.patchResults && levelData.patchResults[key]) {
      result = levelData.patchResults[key];
    }

    if (result) {
      output.push({ type: 'success', text: result });
    } else {
      // Generic success messages for common fix types
      var fixMessages = {
        'sanitize-input':    '输入过滤已启用。所有用户输入将进行转义和验证处理，防止XSS和注入攻击。',
        'fix-query':         'SQL查询已修复。已改用参数化查询，SQL注入漏洞已修复。',
        'close-port':        '端口 ' + target + ' 已关闭。不必要的服务已停止，攻击面已缩小。',
        'update-config':     '配置已更新。安全配置已应用最佳实践。',
        'remove-backdoor':   '后门程序已清除。可疑文件和进程已被删除，系统完整性已恢复。',
        'fix-permissions':   '文件权限已修复。敏感文件权限已调整为600/700，目录权限调整为755。',
        'setup-firewall':    '防火墙已配置。已设置最小权限规则，仅允许必要的入站连接。',
        'password-policy':   '密码策略已更新。要求: 至少12位，包含大小写字母、数字和特殊字符。',
        'enable-2fa':        '双因素认证已启用。用户登录需要额外验证码验证。',
      };

      var message = fixMessages[fixType];
      if (message) {
        output.push({ type: 'success', text: '[+] 修复成功: ' + target + ' -> ' + fixType });
        output.push({ type: 'normal', text: message });
      } else {
        output.push({ type: 'error', text: '未知的修复类型: ' + fixType });
      }
    }

    return this._buildResult(output, args, 'patch', levelData, levelContext);
  },

  // ===========================================================================
  // reportCmd
  // ===========================================================================

  /**
   * report
   *
   * Submits the mission report. Used primarily in Boss levels.
   * Checks if all objectives are completed and returns levelComplete = true
   * if so. Otherwise lists incomplete objectives.
   */
  reportCmd: function (args, levelData, levelContext) {
    var output = [];
    var baseResult = this._buildResult(output, args, 'report', levelData, levelContext);
    baseResult.levelComplete = false;

    if (!levelData || !Array.isArray(levelData.objectives) || levelData.objectives.length === 0) {
      output.push({ type: 'error', text: '当前关卡没有需要完成的目标' });
      return baseResult;
    }

    // Determine which objectives have been met
    var allObjectives = levelData.objectives;
    var metObjectives = [];

    if (levelContext && Array.isArray(levelContext.metObjectives)) {
      metObjectives = levelContext.metObjectives;
    }

    var incompleteObjectives = [];
    for (var i = 0; i < allObjectives.length; i++) {
      var objId = allObjectives[i].id;
      // Skip 'report' objective — it is implicitly satisfied by running the report command
      if (objId === 'report') continue;
      if (metObjectives.indexOf(objId) === -1) {
        incompleteObjectives.push(allObjectives[i]);
      }
    }

    if (incompleteObjectives.length === 0) {
      output.push({ type: 'success', text: '[+] 报告完成！所有目标已达成。' });
      output.push({ type: 'system', text: '[+] 关卡即将结束，正在汇总成绩...' });
      baseResult.levelComplete = true;
    } else {
      output.push({ type: 'error', text: '报告不完整，还有目标未完成:' });
      for (var j = 0; j < incompleteObjectives.length; j++) {
        output.push({ type: 'normal', text: '  - ' + incompleteObjectives[j].description });
      }
      output.push({ type: 'info', text: '请完成所有目标后再提交报告。' });
    }

    return baseResult;
  },

  // ===========================================================================
  // Result builder (internal — all handlers funnel through this)
  // ===========================================================================

  /**
   * Build a task-specific mentor trigger string from the command and its args.
   *
   * For example, `curl <url> --headers` would produce `"cmd:curl_headers"`.
   * Returns null if no specific variant applies.
   *
   * @param {string} commandName
   * @param {string[]} args
   * @returns {string|null}
   */
  _buildMentorTrigger: function (commandName, args) {
    if (commandName === 'curl' && Array.isArray(args) && args.indexOf('--headers') !== -1) {
      return 'cmd:curl_headers';
    }
    // Future: add more specific trigger rules here as needed
    return null;
  },

  /**
   * Build the final result object for any command handler.
   *
   * This centralises:
   *   1. Objective matching  (_checkCommandObjectives)
   *   2. Knowledge card lookup  (_findKnowledgeCard)
   *   3. Mentor trigger lookup  (_findMentorTrigger)
   *
   * @param {Array}  output       Output lines already accumulated by the handler
   * @param {Array}  args         Command arguments
   * @param {string} commandName  The command being run
   * @param {object} levelData    Current level definition
   * @param {object} levelContext Current game context (metObjectives, etc.)
   * @returns {object}  Result object
   */
  _buildResult: function (output, args, commandName, levelData, levelContext) {
    // Objective matching
    var objectives = (levelData && levelData.objectives) ? levelData.objectives : null;
    var objectivesMet = this._checkCommandObjectives(commandName, args, objectives);

    // Knowledge card matching — try specific then generic trigger
    var knowledgeCard = null;
    if (levelData) {
      var specificCardTrigger = 'cmd:' + commandName;
      knowledgeCard = this._findKnowledgeCard(specificCardTrigger, levelData);
      // Fall back to generic if no specific match (for future flexibility)
    }

    // Mentor trigger matching — try specific variant first, then generic
    var mentorTrigger = null;
    if (levelData) {
      var specificTrigger = this._buildMentorTrigger(commandName, args);
      if (specificTrigger) {
        mentorTrigger = this._findMentorTrigger(specificTrigger, levelData);
      }
      // Fall back to generic 'cmd:{command}' trigger
      if (!mentorTrigger) {
        mentorTrigger = this._findMentorTrigger('cmd:' + commandName, levelData);
      }
    }

    return {
      output:         output,
      knowledgeCard:  knowledgeCard || null,
      mentorTrigger:  mentorTrigger,
      objectivesMet:  objectivesMet,
      levelComplete:  false,
    };
  },

};

// =============================================================================
// Auto-init when the script loads
// =============================================================================
CommandRegistry.init();
