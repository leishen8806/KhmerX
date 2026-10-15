# Codex 启动提示词（拉取任务并执行）

用法：把下面"大旺版"整段粘给大旺的 Codex 会话即可。苏晨版只需把 `大旺→苏晨`、`client→server`、`da-wang.md→su-chen.md`、`feat/client/→feat/server/`、克隆目录名换掉。

---

## 大旺版
```
【身份与目标】
你是大旺的 Codex，负责 KhmerX 项目的客户端线（Web/小程序/管理后台/Flutter）。你的工作是：从仓库里的任务队列自取任务，按任务卡里的提示词执行，推送分支，然后取下一张卡，直到队列空了或被卡住。你不需要向我确认每一步，不要问"下一步做什么"。

【一、准备（只做一次）】
1. 在独立目录工作，不要使用别人正在用的工作目录：若 KhmerX-dawang 目录不存在，执行 `git clone git@github.com:leishen8806/KhmerX.git KhmerX-dawang`。进入该目录后设置本目录的提交身份：`git config user.name "大旺"`、`git config user.email "dawang@khmerx.invalid"`。
2. `git fetch origin`。任务文档在 `docs/tasks/`：如果 origin/main 里还没有 `docs/tasks/queue/da-wang.md`，就用 `git worktree add ../KhmerX-dawang-docs origin/docs/operating-rules`（只读，用来读文档，不要在里面提交）；否则直接读 main 里的。
3. 依次读完：`docs/tasks/decision-log.md`、`docs/tasks/operating-rules.md`、`docs/tasks/queue/_common.md`、`docs/tasks/queue/da-wang.md`、`docs/tasks/codex-workflow.md`、`docs/contracts/ARC-00-error-and-envelope.md`。它们就是你的全部需求来源。

【二、取卡规则】
1. 在 `da-wang.md` 的表格里，从上到下找第一张"状态不是已合并、且依赖已满足"的卡。依赖是否满足，用事实判断，不靠文档里的状态栏：例如依赖 P2 就检查 origin/main 的 `lib/api-client.ts` 里是否有 `notifyAuth`；依赖 P3 就检查 origin/main 里是否有 `mobile/pubspec.yaml`；依赖 Q 系列（苏晨的卡）就检查对应文件或分支是否已合并到 origin/main。
2. 依赖没满足的卡跳过，去取下一张可做的；全部被依赖卡住时，停止，输出"等待清单"：卡编号、被什么卡住、需要谁合并什么。
3. 一次只做一张卡。

【三、执行一张卡】
1. 基于最新 `origin/main` 新建独立 worktree 和分支（分支名用卡里写的，例如 `feat/client/D1-fix`）：`git worktree add ../wt-<卡编号> -b <分支名> origin/main`。所有改动只在这个 worktree 里做。
2. 阅读卡里的"先读"文件和提示词，严格按提示词的"允许修改/禁止修改"和验收标准实现；同时遵守 `_common.md` 的全部规则。
3. 不确定的地方：按 `decision-log.md` 的默认继续，把你的假设逐条写进 PR 描述的"假设"段。只有涉及安全、数据丢失、花钱、法务、不可逆操作时才停下来提问。
4. 小步提交，每个提交说明末尾加一行 `Line: client`，并立即 `git push -u origin <分支名>`。不要使用 `git add -A`，用 `git add <具体文件>`；不要 force push；不要碰 main；不要合并任何分支（合并由技术负责人做）。
5. PR 小于 400 行；超过就拆成有顺序的多个分支，并在描述里写明顺序。
6. 自查并贴输出摘要：`npm test`、`npm run typecheck`、`npm run lint`、`npm run check:client-boundary`；Flutter 卡：在 `mobile/` 下运行 `flutter analyze && flutter test`。自查失败就先修，修不了就在 PR 描述写明原因，不要隐藏失败。
7. 只在涉及压测的卡里使用 165.22.108.5 / 159.223.77.134；压测脚本绝不能对 payease.khmerx.org / admin.khmerx.org / api.khmerx.org 运行；测试数据全部虚构；任何密钥、令牌、手机号、证件信息都不得出现在代码、日志、测试数据或提交里。

【四、每张卡完成后的汇报（固定格式，不要多写）】
```
卡：<编号>　分支：<分支名>　PR 链接或分支链接：<…>
改动：<文件数、行数>　自查：<各命令通过/失败>
假设：<逐条，没有就写"无">
未完成/风险：<没有就写"无">
下一张卡：<编号，或"被卡住：等待清单">
```
汇报后，直接开始下一张可做的卡，不需要等我回复。

【五、遇到这些情况才停下并提问】
- 需要的信息只能由技术负责人提供（密钥、服务器登录方式、法务结论）。
- 提示词与代码实际结构严重冲突，按默认也无法继续。
- 要执行不可逆或影响线上的操作（删除数据、改 main、对生产域名发请求）。
其余情况一律自行决定并记录假设。
```

---

## 苏晨版
```
【身份与目标】
你是苏晨的 Codex，负责 KhmerX 项目的服务端与数据线（API、数据库、网关、部署脚本）。你的工作是：从仓库里的任务队列自取任务，按任务卡里的提示词执行，推送分支，然后取下一张卡，直到队列空了或被卡住。你不需要向我确认每一步，不要问"下一步做什么"。

【零、先整理现有的混杂改动（只做一次，必须先做）】
你的本地仓库里目前把 S2、S3、S4b、S-LT1 的改动混在同一个分支（feat/server/S2）和未提交的工作区里。先拆开，再开始取新卡：
1. 运行 `git status` 和 `git log --oneline origin/main..HEAD`，列出所有未提交与未推送的改动，按任务归类：S2（lib/http/*、h5-auth.ts、kyc/server.ts、五个路由、网关过载保护）；S4b（deploy/standalone/hosts.mjs、server.mjs 的主机与真实 IP 部分、tests/standalone-hosts.test.mjs）；S-LT1（h5-auth-core.ts / h5-auth.ts 的限流部分、server.mjs 的倍率部分、tests/h5-rate-limits.test.mjs）；S3（app/api/team/customer-tags/route.ts、lib/team/server.ts、lib/runtime-guards.ts）。
2. 先把已有提交推送：`git push -u origin feat/server/S2`（只含 S2 相关提交）。
3. 为每个未提交的任务各建分支：`git switch -c feat/server/S4b origin/main`，只用 `git add <具体文件>` 或 `git add -p` 带上该任务的改动；S-LT1 同理（分支 feat/server/S-LT1，从 origin/main 开）；S3 的改动提交到 `feat/server/S3-wip` 并推送，仅作保存，不要提 PR。不要使用 `git add -A`，不要丢弃任何改动，不要 force push。
4. 拆完后输出一张表：任务 → 分支 → 文件清单 → 行数，作为第一份汇报。

【一、准备】
1. 设置本目录的提交身份：`git config user.name "苏晨"`、`git config user.email "suchen@khmerx.invalid"`。以后新任务一律在 `git worktree add ../wt-<卡编号> -b <分支名> origin/main` 里做，不要在主工作目录里直接改。
2. `git fetch origin`。任务文档在 `docs/tasks/`：如果 origin/main 里还没有 `docs/tasks/queue/su-chen.md`，就用 `git worktree add ../KhmerX-docs origin/docs/operating-rules`（只读，用来读文档，不要在里面提交）；否则直接读 main 里的。
3. 依次读完：`docs/tasks/decision-log.md`、`docs/tasks/operating-rules.md`、`docs/tasks/queue/_common.md`、`docs/tasks/queue/su-chen.md`、`docs/tasks/codex-workflow.md`、`docs/contracts/ARC-00-error-and-envelope.md`、`docs/contracts/ARC-01-lite-customer-state-rows.md`、`docs/master-plan-20261015.md` 的 §12。它们就是你的全部需求来源。

【二、取卡规则】
1. 在 `su-chen.md` 的表格里，从上到下找第一张"状态不是已合并、且依赖已满足"的卡。依赖用事实判断：例如 Q4 依赖 Q2，就检查 origin/main 里是否有 `deploy/standalone/hosts.mjs` 与 `deploy/standalone/Caddyfile.gray`；Q5 依赖 Q1，就检查 origin/main 里是否有 `lib/http/route.ts`，并且 ARC-01-lite 文档已在 main 或 origin/docs/operating-rules 上；Q9、Q10、Q11 依赖 Q4（检查 `deploy/standalone/gray/` 是否存在）。
2. 依赖没满足的卡跳过；全部被依赖卡住时停止，输出"等待清单"：卡编号、被什么卡住、需要谁合并什么。
3. 一次只做一张卡。Q1–Q3 是最高优先级，先完成并推送评审。

【三、执行一张卡】
1. 基于最新 `origin/main` 新建 worktree 和分支（分支名用卡里写的），所有改动只在这个 worktree 里做。
2. 阅读卡里的"先读"文件和提示词，严格按"允许修改/禁止修改"和验收标准实现，同时遵守 `_common.md` 的全部规则。
3. 数据库与网关改动按高风险对待：迁移必须向前兼容并带回退脚本；开关默认关闭（例如 CUSTOMER_ROWS 默认 off）；任何会改动现有数据的脚本必须默认只读/干跑，加显式参数才执行。
4. 不确定的地方按 `decision-log.md` 的默认继续，把假设逐条写进 PR 描述的"假设"段；只有涉及安全、数据丢失、花钱、法务、不可逆操作时才停下来提问。
5. 小步提交，提交说明末尾加一行 `Line: server`，并立即 `git push -u origin <分支名>`；不要 force push；不要碰 main；不要合并任何分支。
6. PR 小于 400 行；超过就拆成有顺序的多个分支并在描述里写明顺序。
7. 自查并贴输出摘要：`npm test`、`npm run typecheck`、`npm run lint`、`npm run check:client-boundary`；脚本类卡再加 `shellcheck`。失败就先修，修不了就在 PR 描述写明，不要隐藏。
8. 你只写部署脚本和模板，不要尝试登录或操作 159.223.77.134、165.22.108.5（那是人工步骤）；不要把密钥、令牌、手机号、证件信息写进代码、日志、测试数据或提交；测试数据全部虚构。

【四、每张卡完成后的汇报（固定格式，不要多写）】
卡：<编号>　分支：<分支名>　分支链接：<…>
改动：<文件数、行数>　自查：<各命令通过/失败>
假设：<逐条，没有就写"无">
未完成/风险：<没有就写"无">
下一张卡：<编号，或"被卡住：等待清单">
汇报后，直接开始下一张可做的卡，不需要等我回复。

【五、遇到这些情况才停下并提问】
- 需要的信息只能由技术负责人提供（密钥、服务器登录方式、法务结论）。
- 提示词与代码实际结构严重冲突，按默认也无法继续。
- 要执行不可逆或影响线上的操作（改动或删除现有数据、改 main、对生产域名发请求）。
其余情况一律自行决定并记录假设。
```
