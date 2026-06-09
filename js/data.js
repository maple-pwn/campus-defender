/**
 * data.js - Campus Defender Level Data Definitions (Simplified Edition)
 *
 * 5 Chapters × 2 Levels = 10 Levels total
 *   Level 1 of each chapter: Tutorial / Teaching
 *   Level 2 of each chapter: Practical / Hands-on (Boss)
 *
 * Global variable pattern (not ES modules) — loaded first in index.html.
 */

const LEVELS = {

  // ===========================================================================
  // Chapters
  // ===========================================================================

  CHAPTERS: [
    {
      id: 1,
      name: '网络侦察',
      story: '校园网发生异常流量，辅导员请你帮忙调查',
      unlockCommands: ['help', 'scan', 'connect'],
      levels: ['ch1-1', 'ch1-2'],
    },
    {
      id: 2,
      name: 'Web安全',
      story: '学校官网被人挂上奇怪页面，排查Web漏洞',
      unlockCommands: ['exploit', 'curl', 'patch'],
      levels: ['ch2-1', 'ch2-2'],
    },
    {
      id: 3,
      name: '密码攻防',
      story: '学生会数据库泄露，密码安全岌岌可危',
      unlockCommands: ['crack', 'inspect', 'patch'],
      levels: ['ch3-1', 'ch3-2'],
    },
    {
      id: 4,
      name: '系统安全',
      story: '服务器被植入了后门，追踪入侵者痕迹',
      unlockCommands: [],
      levels: ['ch4-1', 'ch4-2'],
    },
    {
      id: 5,
      name: '综合挑战',
      story: '校际网络安全对抗赛，代表学校出战',
      unlockCommands: [],
      levels: ['ch5-1', 'ch5-2'],
    },
  ],

  // ===========================================================================
  // Chapter 1 — 网络侦察
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // ch1-1: 初次接触 (教学)
  // ---------------------------------------------------------------------------
  'ch1-1': {
    chapter: 1,
    index: 0,
    title: '初次接触',
    story: '辅导员说最近教学楼的服务器有异常流量，让你去看看。打开终端，我们先从最基础的开始。',
    isBoss: false,
    objectives: [
      { id: 'help', description: '输入 help 查看可用命令' },
      { id: 'scan', description: '使用 scan teach.school.cn 扫描目标' },
      { id: 'connect_80', description: '连接 80 端口查看 Web 服务: connect teach.school.cn 80' },
    ],
    target: null,
    expectedCommands: ['help', 'scan', 'connect'],
    mentorMessages: [
      { trigger: 'start', text: '嘿，新来的！我是张学长，CTF社的。网络安全的第一步叫"侦察"——搜集目标信息。终端里输入 help 看看你手头有哪些工具。' },
      { trigger: 'cmd:help', text: 'help 列出了所有可用命令。现在试试 scan teach.school.cn ——这就像用望远镜观察一栋大楼有几个入口。端口就是"门"，不同门通向不同服务。' },
      { trigger: 'cmd:scan', text: '看到3个开放端口了！22是SSH管理员通道，80是网站入口，3306通向数据库。现在用 connect teach.school.cn 80 亲自敲敲Web服务的大门，看看它怎么响应。' },
      { trigger: 'cmd:connect', text: '连接成功！你看，nginx 1.18 就是Web服务器在"自报家门"——告诉所有来访者自己叫什么、什么版本。这就叫 banner 信息。攻击者会收集这些版本来查找已知漏洞。侦察完成！' },
    ],
    knowledgeCards: [
      { trigger: 'cmd:help', text: 'help 命令就像一本说明书，任何时候迷茫了都可以查它！' },
      { trigger: 'cmd:scan', text: '"端口"是计算机提供服务的通道。常见端口：22(SSH远程登录)、80(HTTP网页)、443(HTTPS加密网页)、3306(MySQL数据库)。' },
      { trigger: 'cmd:connect', text: '连接端口后服务器会返回 banner ——包含软件名称和版本号。这在侦察中很有价值，但也是信息泄露：攻击者用版本号查找已知漏洞。' },
    ],
    scanResults: {
      'teach.school.cn': [
        { port: 22, service: 'SSH', banner: 'OpenSSH 7.4', info: '远程登录服务，需要密码认证' },
        { port: 80, service: 'HTTP', banner: 'nginx 1.18', info: 'Web 服务器，托管学校教务系统' },
        { port: 3306, service: 'MySQL', banner: 'MySQL 5.7.38', info: '数据库服务，存储教学数据' },
      ],
    },
    connectResults: {
      'teach.school.cn:80': '连接成功！[HTTP/1.1 200 OK] nginx 1.18 — 教务系统 Web 服务正常运行。服务器返回了版本号和状态码 200，表示一切正常。',
    },
    curlResults: null,
    exploitResults: null,
    score: 70,
    badge: null,
    completionCriteria: { type: 'all_objectives' },
    nextLevel: 'ch1-2',
  },

  // ---------------------------------------------------------------------------
  // ch1-2: 侦察实战 (实战·Boss)
  // ---------------------------------------------------------------------------
  'ch1-2': {
    chapter: 1,
    index: 1,
    title: '侦察实战',
    story: '实战考核！教学楼 dorm.school.cn 和核心服务器 server.school.cn 都有异常流量，你需要全面扫描这两台服务器，并连接核心服务器的关键端口确认服务信息。全部侦察完成后输入 report 提交报告。',
    isBoss: true,
    objectives: [
      { id: 'scan_dorm', description: '扫描教学楼服务器 scan dorm.school.cn' },
      { id: 'scan_server', description: '扫描核心服务器 scan server.school.cn' },
      { id: 'connect_22', description: '连接 SSH 端口 (22) 分析服务' },
      { id: 'connect_80', description: '连接 HTTP 端口 (80) 分析 Web 服务' },
      { id: 'connect_3306', description: '连接 MySQL 端口 (3306) 分析数据库' },
      { id: 'report', description: '汇总侦察结果，输入 report 提交报告' },
    ],
    target: null,
    expectedCommands: ['scan', 'connect'],
    mentorMessages: [
      { trigger: 'start', text: '实战时间！综合运用 scan 和 connect，完成侦察任务。记住，每步操作如果连续3次没有进展，我会给你提示。' },
      { trigger: 'timeout', text: '别愣着！想想侦察流程：先 scan 扫描目标，再 connect 连接端口查看详情，最后 report。' },
    ],
    hints: [
      '侦察的第一步是什么？试试 scan dorm.school.cn',
      '还有一台服务器需要扫描。试试 scan server.school.cn',
      '端口扫描完了，用 connect <target> <port> 逐一连接核心服务器的端口。先试试 connect server.school.cn 22',
      '继续连接：connect server.school.cn 80',
      '最后一个端口：connect server.school.cn 3306',
      '所有服务确认完毕！输入 report 提交侦察报告',
    ],
    knowledgeCards: [
      { trigger: 'cmd:scan', text: '端口扫描是网络侦察的第一步。FTP(21)、SSH(22)、HTTP(80)、MySQL(3306) 是最常见的服务端口。' },
      { trigger: 'cmd:connect', text: '连接到端口后获取的 banner 信息可以识别服务版本，帮助发现已知漏洞。' },
    ],
    scanResults: {
      'dorm.school.cn': [
        { port: 21, service: 'FTP', banner: 'vsftpd 3.0.3', info: '文件传输服务，可能存储学生资料' },
        { port: 80, service: 'HTTP', banner: 'Apache 2.4.6', info: 'Web 服务器，宿舍管理系统' },
        { port: 443, service: 'HTTPS', banner: 'Apache 2.4.6', info: '加密 Web 服务' },
      ],
      'server.school.cn': [
        { port: 22, service: 'SSH', banner: 'OpenSSH 7.4', info: '远程管理入口，注意认证方式' },
        { port: 80, service: 'HTTP', banner: 'Apache 2.4.46', info: '学校官网主站，版本较旧' },
        { port: 3306, service: 'MySQL', banner: 'MySQL 5.7.38', info: '核心数据库，不应暴露在公网！' },
      ],
    },
    connectResults: {
      'server.school.cn:22': '连接成功！[SSH-2.0-OpenSSH_7.4] 远程管理服务。建议使用密钥认证而非密码登录。',
      'server.school.cn:80': '连接成功！[HTTP/1.1 200 OK] Apache 2.4.46 — 学校官网。服务器版本较旧，可能存在已知漏洞。',
      'server.school.cn:3306': '连接成功！[MySQL 5.7.38] 数据库服务暴露在公网，风险极高！需要立即处理。',
    },
    curlResults: null,
    exploitResults: null,
    score: 100,
    badge: '侦察兵',
    completionCriteria: { type: 'all_objectives' },
    nextLevel: 'ch2-1',
  },

  // ===========================================================================
  // Chapter 2 — Web安全
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // ch2-1: 网站的结构 (教学)
  // ---------------------------------------------------------------------------
  'ch2-1': {
    chapter: 2,
    index: 0,
    title: '网站的结构',
    story: '学校官网最近被人挂上了奇怪的页面，我们需要查看网站的结构和响应信息。用 curl 命令来探索 Web 服务。',
    isBoss: false,
    objectives: [
      { id: 'curl_page', description: '使用 curl school.cn 获取学校官网页面内容' },
      { id: 'curl_headers', description: '查看服务器响应头: curl school.cn --headers' },
      { id: 'curl_admin', description: '探索隐藏路径: curl school.cn/admin' },
    ],
    target: null,
    expectedCommands: ['curl'],
    mentorMessages: [
      { trigger: 'start', text: 'Web安全是网络安全的重要战场。curl 命令就像浏览器的"技术眼"——能看到网页背后的源代码和服务器信息。试试 curl school.cn 看看学校官网的 HTML 源码。' },
      { trigger: 'cmd:curl', text: 'HTML 源码里藏着注释！开发者留下了管理员入口 /admin 和密码 admin123。再用 curl school.cn --headers 看看 HTTP 响应头，它会暴露服务器软件和版本号。' },
      { trigger: 'cmd:curl_headers', text: '看到 Server 和 X-Powered-By 头了吗？攻击者会用这些版本号搜索已知漏洞。最后用 curl school.cn/admin 访问一下那个隐藏的管理员入口——看看开发者还暴露了什么。' },
    ],
    knowledgeCards: [
      { trigger: 'cmd:curl', text: 'HTTP 响应头包含服务器类型、版本号、Cookie 等信息。暴露这些细节会增加被攻击的风险，称为"信息泄露"。' },
      { trigger: 'cmd:curl_headers', text: '常见的敏感响应头：Server(服务器软件)、X-Powered-By(编程语言/框架)、X-Debug-Token(调试信息)。生产环境应禁用或隐藏它们。' },
      { trigger: 'cmd:curl_admin', text: '"路径枚举"是攻击者常用技术：通过猜测URL路径（如/admin, /backup, /robots.txt）发现隐藏的管理页面或敏感文件。' },
    ],
    scanResults: null,
    connectResults: null,
    curlResults: {
      'school.cn': '<!DOCTYPE html>\n<html>\n<head>\n  <title>XX 大学官网</title>\n</head>\n<body>\n  <!-- TODO: 移除调试信息 -->\n  <h1>欢迎来到 XX 大学</h1>\n  <p>学校新闻：<a href="/news">查看最新动态</a></p>\n  <!-- 管理员入口: /admin 密码: admin123 -->\n  <footer>(c) 2025 XX 大学</footer>\n</body>\n</html>',
      'school.cn:headers': 'HTTP/1.1 200 OK\nServer: Apache/2.4.46 (Unix)\nX-Powered-By: PHP/7.4.33\nSet-Cookie: PHPSESSID=abc123; path=/\nContent-Type: text/html; charset=UTF-8',
      'school.cn/admin': '<!DOCTYPE html>\n<html>\n<head>\n  <title>管理后台 - XX 大学</title>\n</head>\n<body>\n  <h1>管理员登录</h1>\n  <form action="/admin/login" method="POST">\n    <input type="text" name="username" placeholder="用户名">\n    <input type="password" name="password" placeholder="密码">\n    <button type="submit">登录</button>\n  </form>\n  <!-- 开发中，暂未加验证 -->\n</body>\n</html>',
    },
    exploitResults: null,
    score: 80,
    badge: null,
    completionCriteria: { type: 'all_objectives' },
    nextLevel: 'ch2-2',
  },

  // ---------------------------------------------------------------------------
  // ch2-2: Web攻防实战 (实战·Boss)
  // ---------------------------------------------------------------------------
  'ch2-2': {
    chapter: 2,
    index: 1,
    title: 'Web攻防实战',
    story: '学校官网存在严重的 SQL 注入漏洞，搜索框没有对用户输入做过滤。你需要发现漏洞、利用它获取数据库信息，然后用 patch 命令修复漏洞。全部完成后输入 report 提交。',
    isBoss: true,
    objectives: [
      { id: 'curl_page', description: '查看学校官网: curl school.cn' },
      { id: 'sql_discover', description: '利用 SQL 注入漏洞: exploit school.cn/search sql-inject' },
      { id: 'patch_sanitize', description: '修复输入过滤漏洞: patch school.cn sanitize-input' },
      { id: 'report', description: '输入 report 提交安全修复报告' },
    ],
    target: null,
    expectedCommands: ['curl', 'exploit', 'patch'],
    mentorMessages: [
      { trigger: 'start', text: 'Web安全实战！官网的搜索框可能存在漏洞。仔细想想你学过的命令，自己探索吧。每步操作如果连续3次没有进展，我会给你提示。' },
      { trigger: 'timeout', text: '想想 Web 安全的流程：先 curl 查看页面，再 exploit 测试漏洞，然后 patch 修复，最后 report 提交。' },
    ],
    hints: [
      '先用 curl school.cn 看看学校官网页面，找找线索',
      '用 exploit school.cn/search sql-inject 测试搜索框有没有 SQL 注入漏洞',
      '漏洞确认了！用 patch school.cn sanitize-input 修复输入过滤',
      '修复完成！输入 report 提交安全报告',
    ],
    knowledgeCards: [
      { trigger: 'cmd:exploit', text: 'SQL 注入是最经典的 Web 漏洞之一。开发者没有对用户输入做过滤，攻击者可以在输入框中插入 SQL 代码来操纵数据库。' },
      { trigger: 'cmd:patch', text: '修复 SQL 注入的方法：参数化查询（预编译语句）、输入验证与转义、最小权限原则。三层防护缺一不可。' },
    ],
    scanResults: null,
    connectResults: null,
    curlResults: {
      'school.cn': '<!DOCTYPE html>\n<html>\n<head>\n  <title>XX 大学官网</title>\n</head>\n<body>\n  <!-- TODO: 移除调试信息 -->\n  <h1>欢迎来到 XX 大学</h1>\n  <form action="/search">\n    <input type="text" name="q" placeholder="搜索...">\n    <button type="submit">搜索</button>\n  </form>\n  <!-- 管理员入口: /admin 密码: admin123 -->\n  <footer>(c) 2025 XX 大学</footer>\n</body>\n</html>',
    },
    exploitResults: {
      'school.cn/search:sql-inject': "注入成功！获取到用户表信息:\n\nusers 表:\n| id | username | password_hash | role |\n| 1 | admin | e10adc3949ba59abbe56e057f20f883e | 管理员 |\n| 2 | teacher_wang | 25d55ad283aa400af464c76d713c07ad | 教师 |\n| 3 | student_li | 827ccb0eea8a706c4c34a16891f84e7b | 学生 |\n\n共发现 3 条用户记录。搜索框完全没有过滤用户输入！",
    },
    score: 100,
    badge: '网站医生',
    completionCriteria: { type: 'all_objectives' },
    nextLevel: 'ch3-1',
  },

  // ===========================================================================
  // Chapter 3 — 密码攻防
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // ch3-1: 密码怎么存 (教学)
  // ---------------------------------------------------------------------------
  'ch3-1': {
    chapter: 3,
    index: 0,
    title: '密码怎么存',
    story: '学生会数据库泄露了，有人在网上发布了包含密码哈希的文件。我们需要分析这些哈希的类型和强度。',
    isBoss: false,
    objectives: [
      { id: 'inspect_file', description: '查看泄露的密码文件: inspect passwords.txt' },
      { id: 'inspect_hash', description: '查看密码安全策略: inspect /etc/login.defs' },
      { id: 'crack_brute', description: '体验破解 MD5 哈希: crack e10adc3949ba59abbe56e057f20f883e brute' },
    ],
    target: null,
    expectedCommands: ['inspect', 'crack'],
    mentorMessages: [
      { trigger: 'start', text: '密码安全核心问题：如果你的密码库泄露了，黑客能直接看到你的密码吗？好的网站不存密码原文，只存"哈希值"——像指纹一样，不可逆。先用 inspect passwords.txt 看看泄露文件，再 inspect /etc/login.defs 对比系统标准配置。' },
      { trigger: 'cmd:inspect', text: '看到了吗？泄露文件用的是 MD5——一种30年前的算法，现代GPU每秒能算数十亿次。而且没有"盐"(salt)——同一密码产生相同哈希，攻击者一眼能看出谁用了弱密码。再检查另一个路径！' },
      { trigger: 'cmd:crack', text: '看到了吗？2.3秒就破解了！这就是 MD5 + 弱密码的后果。安全的做法是 bcrypt/Argon2 + 强密码 + 盐值，让暴力破解需要上千年而不是几秒。' },
    ],
    knowledgeCards: [
      { trigger: 'cmd:inspect', text: '"哈希"是将任意数据变成固定长度"指纹"的算法。好的密码哈希要满足：不可逆、加随机盐值、计算速度慢（如bcrypt、Argon2）。MD5和SHA1已不再安全。' },
      { trigger: 'cmd:crack', text: '"暴力破解"逐字符尝试所有组合，短密码秒破。"字典攻击"用常见密码列表快速匹配。这就是为什么需要12位以上的随机密码。' },
    ],
    scanResults: null,
    connectResults: null,
    curlResults: null,
    exploitResults: null,
    inspectResults: {
      'passwords.txt': '=== passwords.txt ===\n\n泄露的用户密码哈希列表:\n\n用户名     哈希值                                  算法\n--------------------------------------------------------\nadmin      e10adc3949ba59abbe56e057f20f883e      MD5\nteacher    fcea920f7412b5da7be0cf42b8c93759      MD5\nstudent    827ccb0eea8a706c4c34a16891f84e7b      MD5\nguest      084e0343a0486ff05530df6c705c8bb4      MD5\n\n安全分析:\n  - 算法: MD5 (已废弃)\n  - 无盐值\n  - 建议: 使用 bcrypt + 随机盐值',
      '/etc/login.defs': '=== /etc/login.defs ===\n\n当前系统密码安全配置:\n\nPASS_MAX_DAYS   90      # 密码有效期 90 天\nPASS_MIN_DAYS   1       # 修改间隔最少 1 天\nPASS_MIN_LEN    8       # 最小密码长度 8 ⚠️ 太短！建议 12+\nENCRYPT_METHOD  SHA512  # 哈希算法 SHA512 ✓\n\n对比泄露文件:\n  泄露文件: MD5 (已废弃) vs 系统配置: SHA512 (安全)\n  泄露文件: 无盐值      vs 系统配置: 自动加盐\n  泄露文件: 无密码策略  vs 系统配置: 90天过期\n\n⚠️ 差距明显！学生会的密码系统严重落后。',
    },
    crackResults: {
      'e10adc3949ba59abbe56e057f20f883e:brute': { password: '123456', time: '2.3 秒' },
    },
    score: 80,
    badge: null,
    completionCriteria: { type: 'all_objectives' },
    nextLevel: 'ch3-2',
  },

  // ---------------------------------------------------------------------------
  // ch3-2: 密码攻防实战 (实战·Boss)
  // ---------------------------------------------------------------------------
  'ch3-2': {
    chapter: 3,
    index: 1,
    title: '密码攻防实战',
    story: '泄露文件中的密码哈希需要被破解以评估危害，然后你要帮助学校加固整个密码系统。先用 inspect 分析文件，再用 crack 破解弱密码，最后用 patch 部署安全策略。完成后 report 提交。',
    isBoss: true,
    objectives: [
      { id: 'inspect_file', description: '查看泄露文件 inspect passwords.txt' },
      { id: 'crack_brute', description: '暴力破解哈希 crack <hash> brute' },
      { id: 'patch_policy', description: '加固密码策略 patch campus password-policy' },
      { id: 'report', description: '输入 report 提交安全加固报告' },
    ],
    target: null,
    expectedCommands: ['inspect', 'crack', 'patch'],
    mentorMessages: [
      { trigger: 'start', text: '密码攻防实战！自己动手分析泄露文件、破解弱密码、加固系统。每步操作如果连续3次没有进展，我会给你提示。' },
      { trigger: 'timeout', text: '别放弃！步骤: inspect 分析文件 → crack 破解密码 → patch 加固策略 → report。' },
    ],
    hints: [
      '先查看泄露文件：inspect passwords.txt',
      '用 crack 破解管理员的密码哈希: crack e10adc3949ba59abbe56e057f20f883e brute',
      '密码被秒破了！快用 patch campus password-policy 部署强密码策略',
      '加固完成！输入 report 提交报告',
    ],
    knowledgeCards: [
      { trigger: 'cmd:crack', text: '暴力破解逐字符尝试所有组合。短密码（如123456）秒破。字典攻击用常见密码列表（如rockyou.txt）快速匹配。这就是为什么需要12位以上的复杂密码。' },
      { trigger: 'cmd:patch', text: '好的密码策略：至少12位、大小写字母+数字+特殊字符、使用bcrypt/Argon2哈希、加随机盐值、90天强制更换。' },
    ],
    scanResults: null,
    connectResults: null,
    curlResults: null,
    exploitResults: null,
    inspectResults: {
      'passwords.txt': '=== passwords.txt ===\n\n泄露的用户密码哈希列表:\n\n用户名     哈希值                                  算法\n--------------------------------------------------------\nadmin      e10adc3949ba59abbe56e057f20f883e      MD5\nteacher    fcea920f7412b5da7be0cf42b8c93759      MD5\nstudent    827ccb0eea8a706c4c34a16891f84e7b      MD5\n\n安全分析:\n  - 算法: MD5 (已废弃，可被快速破解)\n  - 无盐值 (相同的密码产生相同的哈希)\n  - 建议: 使用 bcrypt + 随机盐值',
    },
    crackResults: {
      'e10adc3949ba59abbe56e057f20f883e:brute': { password: '123456', time: '2.3 秒' },
    },
    score: 100,
    badge: '密码守护者',
    completionCriteria: { type: 'all_objectives' },
    nextLevel: 'ch4-1',
  },

  // ===========================================================================
  // Chapter 4 — 系统安全
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // ch4-1: 文件系统探秘 (教学)
  // ---------------------------------------------------------------------------
  'ch4-1': {
    chapter: 4,
    index: 0,
    title: '文件系统探秘',
    story: '服务器上发现了可疑活动。我们需要检查文件系统的权限设置，找出异常文件。',
    isBoss: false,
    objectives: [
      { id: 'inspect_perms', description: '检查 /etc 目录权限: inspect /etc' },
      { id: 'inspect_strange', description: '检查可疑暂存目录: inspect /tmp' },
      { id: 'inspect_users', description: '检查用户列表: inspect /etc/passwd' },
    ],
    target: null,
    expectedCommands: ['inspect'],
    mentorMessages: [
      { trigger: 'start', text: 'Linux系统里"一切皆文件"。每个文件有三组权限：Owner(所有者)、Group(用户组)、Other(其他人)，分别可以读(r=4)、写(w=2)、执行(x=1)。先 inspect /etc 检查系统配置目录，再 inspect /tmp 检查临时目录，最后 inspect /etc/passwd 看看有没有可疑用户。' },
      { trigger: 'cmd:inspect', text: '777权限意味着任何人都能读写执行——就像把家门钥匙挂在门外。继续检查下一个路径！' },
    ],
    knowledgeCards: [
      { trigger: 'cmd:inspect', text: 'Linux文件权限用三个数字表示：Owner/Group/Other × Read(4)/Write(2)/Execute(1)。例如755=Owner全权限, Group和Other只读和执行。' },
    ],
    scanResults: null,
    connectResults: null,
    curlResults: null,
    exploitResults: null,
    inspectResults: {
      '/etc': '=== /etc 目录 ===\n类型: 系统配置目录\n权限: drwxr-xr-x root:root\n\n⚠️ 发现问题:\n  1. /etc/cron.d/backup.sh — 权限 777（过于宽松！任何人可修改）\n  2. /etc/.hidden_script — 隐藏文件（以.开头，ls 默认不显示）\n  3. /etc/passwd — 存在未知用户 "temp_admin"',
      '/tmp': '=== /tmp 目录 ===\n类型: 临时文件目录\n权限: drwxrwxrwt root:root\n\n⚠️ 发现可疑文件:\n  1. /tmp/.x_sess — 隐藏文件，包含加密数据\n  2. /tmp/keylog.bin — 键盘记录器输出文件\n  3. /tmp/nc_backdoor — netcat 后门脚本\n\n入侵者似乎在 /tmp 投放了多个恶意程序！',
      '/etc/passwd': '=== /etc/passwd ===\n\n正常用户:\n  root:x:0:0:root:/root:/bin/bash\n  student:x:1000:1000:Student:/home/student:/bin/bash\n  mysql:x:999:999:MySQL:/var/lib/mysql:/bin/false\n\n⚠️ 发现可疑用户:\n  temp_admin:x:0:0::/root:/bin/bash  ← UID=0 就是 root 权限！\n\n入侵者创建了一个名为 temp_admin 的账户，UID 设为 0，等于给自己留了一把永远能进的后门钥匙。这是入侵后最常见的持久化手段。',
    },
    score: 80,
    badge: null,
    completionCriteria: { type: 'all_objectives' },
    nextLevel: 'ch4-2',
  },

  // ---------------------------------------------------------------------------
  // ch4-2: 系统安全实战 (实战·Boss)
  // ---------------------------------------------------------------------------
  'ch4-2': {
    chapter: 4,
    index: 1,
    title: '系统安全实战',
    story: '服务器被植入了后门！入侵者通过 SSH 暴力破解登录，留下了反向 Shell 后门。你需要分析后门程序、追踪入侵者 IP，然后用 patch 命令彻底清除后门。全部完成后 report 提交。',
    isBoss: true,
    objectives: [
      { id: 'inspect_find', description: '查找后门文件 inspect /etc' },
      { id: 'inspect_analyze', description: '分析后门行为 inspect /etc/backdoor' },
      { id: 'inspect_ip', description: '追踪入侵者 inspect auth.log' },
      { id: 'patch_backdoor', description: '清除后门 patch system remove-backdoor' },
      { id: 'report', description: '输入 report 提交安全事件报告' },
    ],
    target: null,
    expectedCommands: ['inspect', 'patch'],
    mentorMessages: [
      { trigger: 'start', text: '系统安全实战！入侵者留下了后门。你需要自己找出后门、分析行为、追踪来源、清除威胁。每步操作如果连续3次没有进展，我会给你提示。' },
      { trigger: 'timeout', text: '入侵者随时可能回来！步骤: inspect 查后门 → inspect 分析 → inspect 追踪IP → patch 清除 → report。' },
    ],
    hints: [
      '先检查系统目录找后门：inspect /etc',
      '发现可疑文件了！分析后门详情：inspect /etc/backdoor',
      '追踪入侵者是怎么进来的：inspect auth.log',
      '证据到手！用 patch system remove-backdoor 彻底清除后门',
      '后门已清除！输入 report 提交安全事件报告',
    ],
    knowledgeCards: [
      { trigger: 'cmd:inspect', text: '后门程序常见特征：隐藏文件名（以.开头）、监听非标准端口、伪装成系统进程、通过cron定时任务自动启动、反向连接外部IP。' },
      { trigger: 'cmd:patch', text: '系统加固包括：移除后门程序、修复文件权限、删除可疑用户和cron任务、配置防火墙、开启日志审计。' },
    ],
    scanResults: null,
    connectResults: null,
    curlResults: null,
    exploitResults: null,
    inspectResults: {
      '/etc': '=== /etc 目录 ===\n\n可疑文件:\n  .bash_update (隐藏文件) — 位于 /etc/.bash_update\n  权限: -rwxr-xr-x  — 每 5 分钟执行一次\n  内容: 反向连接到 203.0.113.99:4444',
      '/etc/backdoor': '=== /etc/backdoor (符号链接 → /etc/.bash_update) ===\n\n分析结果:\n  类型: 反向 Shell (Reverse Shell)\n  C2 服务器: 203.0.113.99:4444\n  连接协议: TCP\n  自动启动: 通过 cron 任务每 5 分钟执行\n  隐藏方式: 文件名以 . 开头，伪装成 bash 更新脚本\n\n⚠️ 危险等级: 高 — 攻击者可随时远程控制服务器',
      'auth.log': '=== /var/log/auth.log ===\n\n时间线:\n  02:15:23 — SSH 登录尝试 用户: root    来源: 203.0.113.99 ❌ 失败\n  02:15:25 — SSH 登录尝试 用户: admin   来源: 203.0.113.99 ❌ 失败\n  ... (重复 150+ 次暴力破解) ...\n  02:58:16 — SSH 登录尝试 用户: temp    来源: 203.0.113.99 ✅ 成功！\n  02:58:17 — 用户 temp 执行了 sudo su (提权为 root)\n\n结论: 入侵者 IP 为 203.0.113.99，通过 SSH 暴力破解获取了 temp 用户权限。',
    },
    score: 100,
    badge: '系统卫士',
    completionCriteria: { type: 'all_objectives' },
    nextLevel: 'ch5-1',
  },

  // ===========================================================================
  // Chapter 5 — 综合挑战
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // ch5-1: 信息收集 (教学)
  // ---------------------------------------------------------------------------
  'ch5-1': {
    chapter: 5,
    index: 0,
    title: '信息收集',
    story: '校际网络安全对抗赛开始了！你的任务是攻破靶机 target.ctf.school.cn，先收集尽可能多的情报。',
    isBoss: false,
    objectives: [
      { id: 'scan_target', description: '扫描靶机开放端口 scan target.ctf.school.cn' },
      { id: 'curl_target', description: '查看靶机 Web 服务内容 curl target.ctf.school.cn' },
      { id: 'connect_80', description: '连接 Web 端口确认服务: connect target.ctf.school.cn 80' },
    ],
    target: null,
    expectedCommands: ['scan', 'curl', 'connect'],
    mentorMessages: [
      { trigger: 'start', text: 'CTF(Capture The Flag)是网络安全竞赛的经典形式。核心原则：永远先侦察再攻击！用 scan target.ctf.school.cn 扫描端口，curl 查看网页，connect 确认服务细节。信息越多，攻击路径越多。' },
      { trigger: 'cmd:scan', text: '两个端口：80是标准Web服务，2222是非标准SSH端口——管理员故意换了端口号想隐藏它。现在用 curl target.ctf.school.cn 抓取网页源码，看看有没有隐藏线索。' },
      { trigger: 'cmd:curl', text: '注意到HTML注释吗？默认密码admin:admin、隐藏参数role=user——都是开发者不小心留下的。再用 connect target.ctf.school.cn 80 直接跟Web服务握个手，看看它怎么回应。' },
      { trigger: 'cmd:connect', text: 'nginx 1.22，200 OK。靶机开着最新版 nginx，登录页面正常响应。这就是完整的"信息收集三件套"：scan→curl→connect。记住这个流程，最后一关你会用到。准备好了吗？' },
    ],
    knowledgeCards: [
      { trigger: 'cmd:scan', text: 'CTF比赛中信息收集是决定成败的第一步。端口、服务版本、网页源码、隐藏注释、robots.txt、备份文件——每个细节都可能是突破口。' },
      { trigger: 'cmd:curl', text: '查看网页源码时注意：HTML注释(<!-- -->)、隐藏input字段、JavaScript中的API端点、debug参数。开发者经常无意中泄露关键信息。' },
      { trigger: 'cmd:connect', text: '"信息收集三件套"：scan(扫描端口) → curl(查看网页内容) → connect(确认服务详情)。三者组合构建完整的攻击面画像。' },
    ],
    scanResults: {
      'target.ctf.school.cn': [
        { port: 80, service: 'HTTP', banner: 'nginx 1.22', info: 'Web 服务，显示一个登录页面' },
        { port: 2222, service: 'SSH', banner: 'OpenSSH 8.9', info: '自定义端口 SSH，可能允许远程登录' },
      ],
    },
    connectResults: {
      'target.ctf.school.cn:80': '连接成功！[HTTP/1.1 200 OK] nginx 1.22 — CTF 挑战靶机 Web 服务。登录页面正在运行，准备好迎接挑战。',
    },
    curlResults: {
      'target.ctf.school.cn': '<!DOCTYPE html>\n<html>\n<head>\n  <title>CTF Challenge - Login</title>\n</head>\n<body>\n  <h1>CTF 挑战靶机</h1>\n  <form action="/login" method="POST">\n    <input type="text" name="username" placeholder="用户名">\n    <input type="password" name="password" placeholder="密码">\n    <button type="submit">登录</button>\n  </form>\n  <!-- 提示: 试试默认密码 admin:admin -->\n  <!-- 隐藏参数: <input type="hidden" name="role" value="user"> -->\n</body>\n</html>',
    },
    exploitResults: null,
    score: 100,
    badge: null,
    completionCriteria: { type: 'all_objectives' },
    nextLevel: 'ch5-2',
  },

  // ---------------------------------------------------------------------------
  // ch5-2: 终极挑战 (实战·最终Boss)
  // ---------------------------------------------------------------------------
  'ch5-2': {
    chapter: 5,
    index: 1,
    title: '终极挑战',
    story: '最后一关！目标: ultimate.ctf.school.cn。这台终极靶机集成了多层防护，你需要综合运用所有已学技能完成完整攻击链，找到最终 flag。每步操作如果连续3次没有进展，我会给你提示。',
    isBoss: true,
    objectives: [
      { id: 'scan', description: '扫描靶机: scan ultimate.ctf.school.cn' },
      { id: 'connect_8080', description: '连接 Tomcat 管理后台 (8080) 分析服务' },
      { id: 'exploit', description: '利用 Tomcat 漏洞: exploit ultimate.ctf.school.cn tomcat-manager' },
      { id: 'crack', description: '破解提取的密码哈希: crack <hash> brute' },
      { id: 'inspect_flag', description: '查找 flag 文件: inspect /flag.txt' },
      { id: 'report', description: '输入 report 提交最终报告' },
    ],
    target: 'ultimate.ctf.school.cn',
    expectedCommands: ['scan', 'connect', 'exploit', 'crack', 'inspect'],
    mentorMessages: [
      { trigger: 'start', text: '最终决战！这是对你所有技能的综合考验。没有提示，自己思考攻击链——从侦察到拿到 flag。每步操作如果连续3次没有进展，我会给你提示。祝你好运！' },
      { trigger: 'timeout', text: '想想完整的攻击链：scan → 找到薄弱端口 → connect 确认 → exploit 突破 → crack 破解密码 → inspect 找 flag → report。' },
    ],
    hints: [
      '第一步永远是侦察：scan ultimate.ctf.school.cn',
      '8080端口是Tomcat管理后台——通常是最薄弱的入口。用 connect ultimate.ctf.school.cn 8080 确认服务信息',
      'Tomcat 9.0 存在已知的默认密码漏洞。试试 exploit ultimate.ctf.school.cn tomcat-manager',
      '拿到哈希了！用 crack 破解它: crack $2y$10$D3f4u1tP4s5w0rDHa5hF0eN0tS0s3cUr3P4s5w0rD brute',
      '密码到手了！最后一个目标：inspect /flag.txt',
      '所有目标完成！输入 report 提交最终报告',
    ],
    knowledgeCards: [
      { trigger: 'cmd:scan', text: '完整的攻击链：侦察(scan) → 扫描(connect) → 漏洞利用(exploit) → 密码破解(crack) → 数据提取(inspect)。记住这个流程！' },
      { trigger: 'cmd:exploit', text: 'Tomcat Manager默认密码漏洞是最常见的企业安全漏洞之一。永远记得修改默认凭证、删除示例应用、限制管理后台访问IP。' },
    ],
    scanResults: {
      'ultimate.ctf.school.cn': [
        { port: 22, service: 'SSH', banner: 'OpenSSH 8.9', info: '远程登录服务，需要有效凭据' },
        { port: 80, service: 'HTTP', banner: 'Apache 2.4.51', info: 'Web 服务器，公司官网' },
        { port: 8080, service: 'HTTP-Alt', banner: 'Tomcat 9.0', info: '管理后台，存在登录界面 ⚠️ 可能存在默认密码漏洞' },
        { port: 3306, service: 'MySQL', banner: 'MySQL 8.0', info: '数据库服务，可能存储用户凭证' },
      ],
    },
    connectResults: {
      'ultimate.ctf.school.cn:22': '连接成功！[SSH-2.0-OpenSSH_8.9] 标准 SSH 服务，需要有效凭据。',
      'ultimate.ctf.school.cn:80': '连接成功！[HTTP/1.1 200 OK] Apache 2.4.51 — 静态企业官网页面。',
      'ultimate.ctf.school.cn:8080': '连接成功！[HTTP/1.1 200 OK] Apache Tomcat 9.0 — 管理后台登录页面。⚠️ 版本存在已知漏洞！默认凭据可能未修改。',
      'ultimate.ctf.school.cn:3306': '连接成功！[MySQL 8.0] 数据库服务，使用默认端口 3306。',
    },
    curlResults: {
      'ultimate.ctf.school.cn:80': '<!DOCTYPE html>\n<html>\n<body>\n  <h1>UltraSecure Corp</h1>\n  <p>我们致力于提供最安全的解决方案。</p>\n  <!-- 员工入口: http://ultimate.ctf.school.cn:8080 -->\n</body>\n</html>',
    },
    exploitResults: {
      'ultimate.ctf.school.cn:tomcat-manager': '成功利用 Tomcat Manager 默认密码漏洞！\n\n已获取后台管理权限。在 /backup 目录下发现哈希文件:\nadmin:$2y$10$D3f4u1tP4s5w0rDHa5hF0eN0tS0s3cUr3P4s5w0rD\n\n将此哈希用于 crack 命令进行破解。',
    },
    crackResults: {
      '$2y$10$D3f4u1tP4s5w0rDHa5hF0eN0tS0s3cUr3P4s5w0rD:brute': { password: 'admin123!', time: '12.3 秒' },
    },
    inspectResults: {
      '/flag.txt': 'CTF-2025{you_are_the_ultimate_campus_defender}\n\n🎉 恭喜！你找到了最终的 flag！\n你已掌握网络安全的完整攻击链。',
    },
    score: 200,
    badge: '安全卫士',
    completionCriteria: { type: 'all_objectives' },
    nextLevel: null,
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get a level definition by its ID.
 * @param {string} id - Level ID, e.g. "ch1-1"
 * @returns {object|null} The level definition, or null if not found.
 */
function getLevelById(id) {
  return LEVELS[id] || null;
}

/**
 * Get a chapter definition by its number.
 * @param {number} chapterNum - Chapter number (1-based)
 * @returns {object|null} The chapter definition, or null if not found.
 */
function getChapter(chapterNum) {
  return LEVELS.CHAPTERS.find(function (c) { return c.id === chapterNum; }) || null;
}

/**
 * Get a specific level within a chapter by its index.
 * @param {number} chapterNum - Chapter number (1-based)
 * @param {number} index - Level index (0-based within the chapter)
 * @returns {object|null} The level definition, or null if not found.
 */
function getLevelInChapter(chapterNum, index) {
  var ch = getChapter(chapterNum);
  if (!ch) return null;
  return LEVELS[ch.levels[index]] || null;
}
