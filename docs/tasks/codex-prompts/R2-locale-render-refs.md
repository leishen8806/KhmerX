# R2：语言组件渲染期写 ref 的 lint 修复（卡二）

基线：`origin/main` = `461d070`（R1 合并后请基于最新 `origin/main`）。分支：`fix/client/locale-render-refs`，提交末尾 `Line: client`。独立 worktree，一个任务一个分支一个 PR，PR < 400 行，不整文件格式化。
冻结：L2/Q12 = HOLD；灰度/VPS = HOLD；不操作 159.223.77.134、165.22.108.5；不访问任何 khmerx.org 域名；不改限流、认证、数据库迁移、贷款规则、部署配置；不启动第三档任务；只用虚构数据。

## 1. 已核实事实（`461d070`，容器 `node:22.22.1-bookworm-slim` 内 `npx eslint . --quiet` 复现）

| # | 事实 | 证据 |
|---|---|---|
| R2-F1 | 全量 lint = **2 errors + 577 warnings**；两个 error 都是 `react-hooks/refs`（"Cannot access refs during render"），分别在 `components/auth-locale.tsx:8:277` 与 `components/mini-shell.tsx:26:37` | 容器内 eslint 输出 |
| R2-F2 | `auth-locale.tsx` 的 `AuthLocaleBridge`：`const ref=useRef(locale);ref.current=locale;`（渲染期写 ref）。`ref.current` **只在** `useEffect` 内的 `apply()`（及其触发的 `MutationObserver` 回调）里读取；该 effect 依赖 `[locale]`，每次语言变化都会**清理并重建** observer，所以 `apply` 闭包里的 `locale` 与 `ref.current` 在回调执行时必然相同 | `components/auth-locale.tsx:8` |
| R2-F3 | `AuthLocaleBridge` 没有"服务端禁用语言"逻辑；持久化键是 `payease-auth-language`；`choose` 只调用 `setLocale`、写 `localStorage`、设 `document.documentElement.lang`（**不**写 ref）。它只出现在 `app/h5/layout.tsx`，作用于 `.mini-login` | 同上、`app/h5/layout.tsx:4` |
| R2-F4 | `mini-shell.tsx` 的 `MiniShell`：`const languageRef=useRef(language);languageRef.current=language;`（渲染期写 ref）。ref 在三处使用：渲染期写入（要去掉）、`chooseLanguage` 事件处理器里**先于 `setLanguage` 同步写入** `languageRef.current=next` 并立即 `localize(root,next)`（注释写明目的：避免慢设备上语言切换出现混合语言帧）、observer effect 的 `apply()` 读取 `languageRef.current`。事件处理器里写 ref 是允许的，不违规 | `components/mini-shell.tsx:26,35,44` |
| R2-F5 | `mini-shell` 另有"服务端禁用语言后回退"逻辑：mount 时请求 `/api/h5/auth`，若当前语言被禁用则回退到 `en`→`km`→`zh` 之一并写 `payease-language`；该 effect 依赖 `[]`（读到的是首次渲染的 `language`，属现有行为，**不要改**）。这条回退路径只调用 `setLanguage`，**不**写 ref——因此 mini-shell 去掉渲染期写入后，需要另一处把 ref 同步到最新 `language` | `components/mini-shell.tsx:30` |
| R2-F6 | `mini-shell` 在 mount 时有一个 observer 删除 `.auth-locale` 元素（两个组件不同时出现） | `components/mini-shell.tsx:29` |
| R2-F7 | 仓库**没有** jsdom / testing-library / happy-dom；现有的组件测试做法是 `tests/h5-navigation.test.mjs`：用 `typescript.transpileModule` 转译源文件，在 `vm.runInNewContext` 里加载，并 mock `react` 的 hooks（`useState/useEffect/useCallback`）和各 import | `tests/h5-navigation.test.mjs:8-24`、`package.json` |
| R2-F8 | eslint 配置里 `react-hooks/set-state-in-effect`、`react-hooks/purity` 为 warn（部分路径 off）；`react-hooks/refs` 为 error，**不得改规则级别** | `eslint.config.mjs` |

## 2. 实施要求（根据 R2-F2…F5 的真实调用关系选择最小修复，不要机械搬代码）

**`components/auth-locale.tsx`（推荐：删除 ref）**
- 因为 effect 依赖 `[locale]` 且每次变化都重建 observer（R2-F2），把 `apply` 里的 `ref.current` 换成 effect 作用域内的 `locale`，**删除 `useRef` 与渲染期写入**，并从 import 里去掉不用的 `useRef`。
- 只有当测试证明这样会让"语言切换后的回调使用旧语言"时，才退而采用"effect 内同步 ref"的方案，并在 PR 里写明原因。

**`components/mini-shell.tsx`（推荐：保留 ref，只移除渲染期写入）**
- 删除 `languageRef.current=language;`（渲染期写入）。`useRef(language)` 保留作为初始值。
- 新增一个把 ref 同步到最新 state 的 effect：`useEffect(()=>{languageRef.current=language},[language])`，**声明位置必须在 observer effect 之前**（同一次 commit 里按声明顺序执行，保证 observer 读到最新语言）。它同时覆盖 R2-F5 的"服务端禁用后回退"路径。
- `chooseLanguage` 里"先写 ref、再 `localize`、再 `setLanguage`"的顺序**保持不变**（防止混合语言帧）。

**不得做的事**：不关闭 `react-hooks/refs`，不加 `eslint-disable`，不降低检查级别；不重写 DOM 翻译机制（`localize`、`copy` 表）；不改语言策略（可用语言、`?lang=` 查询、`defaultLocale`）、持久化键、导航路径、认证、页面布局、`MiniNavLink`/`MiniNavigationProvider`；不顺手修 `exhaustive-deps` 等其他 warnings。

## 3. 允许 / 禁止修改

- **允许**：`components/auth-locale.tsx`、`components/mini-shell.tsx`、新增 `tests/locale-render-refs.test.mjs`（以及对 `tests/h5-navigation.test.mjs` 的只读复用/抽取共用的 mock 辅助，若需要修改它须保持其断言不变）。
- **禁止**：`lib/**`、`app/**`、`drizzle/**`、`deploy/**`、`eslint.config.mjs`、`package.json`/lock（**不新增依赖**；若确需，先停下说明理由）、其他组件。

## 4. 先读

`components/auth-locale.tsx`（全文）、`components/mini-shell.tsx`（全文，尤其 20–50 行）、`lib/i18n`（`Locale`、`localeLabels`、`i18nValue`、`supported`/`defaultLocale` 的来源）、`app/h5/layout.tsx`、`tests/h5-navigation.test.mjs`、`eslint.config.mjs`。

## 5. 验收（缺一不通过）

### 5.1 lint
- 容器内 `npx eslint components/auth-locale.tsx components/mini-shell.tsx` 对 `react-hooks/refs` 为 **0 个 error**；全量 `npm run lint` 的 **errors = 0**；warnings 不要求清理，**不得新增** warning（对比修改前后这两个文件的 warning 数）。
- 用 ESLint 的 Node API 在测试里对这两个文件跑一遍并断言没有 `react-hooks/refs` 报错（防止以后回归）。

### 5.2 行为（沿用 R2-F7 的 hook-mock + vm 做法；不新增依赖）
对 `auth-locale`：
1. 初始语言取自 `payease-auth-language`（`en`/`km`/`zh`，非法值回退 `en`）；点击切换后 state、`localStorage`、`document.documentElement.lang` 一致更新。
2. 语言变化后，**旧 observer 已断开、新 observer 恰好一个**（统计 observe/disconnect 次数），之后回调使用**新语言**（`root.lang` 与 `localize` 参数为新值）。
3. observer 回调内部重入受 `busy` 保护，不出现更新循环（模拟一次 mutation 触发回调，`localize` 只调用预期次数）。
4. 卸载（effect cleanup）断开 observer。

对 `mini-shell`：
5. 初始语言优先级：`?lang=` > `payease-language` > `defaultLocale()`。
6. `chooseLanguage`：被服务端禁用的语言点击无效；可用语言点击后**同步**把 `languageRef` 与 `.mini-app` 的 `lang`、`localize` 更新（先于 `setLanguage` 生效），随后 `payease-language-change` 事件、`localStorage`、URL `?lang=`、`/api/h5/locale` 请求各发生一次。
7. **服务端禁用回退**：`/api/h5/auth` 返回 `languages:{km:false}` 且当前语言为 `km` → 回退到 `en` 并写 `payease-language`；`/api/h5/auth` 失败时保持原语言（现有行为）。
8. **ref 最新值**：回退（只调用 `setLanguage`）之后，`MutationObserver`/`requestAnimationFrame` 回调使用的是**回退后的语言**（这是保留 ref 同步 effect 的原因，必须有断言）。
9. observer 与 rAF：语言变化时旧 observer 断开、新 observer 一个；卸载时 `cancelAnimationFrame` 与 `disconnect`；`applying` 保护下无更新循环。
10. 菜单：`MiniNavLink` 的客户端跳转仍走 `navigate`（不新增 `window.location.assign`），`tests/h5-navigation.test.mjs` 全部原样通过（证明无整页刷新、无重复登录验证的回归）。

若 `mini-shell` 在不新增依赖的前提下无法 mock 到可测试（例如被 import 的模块过多），在 PR 里写明具体原因，改为：(a) 对上述 5.2 的 5–9 用"从源码抽出最小可测的纯逻辑 + vm 测试"覆盖，**且不改变组件对外行为**；(b) 其余由 5.1 的 ESLint 断言覆盖。**不得**因此降低验收或删除断言，需要技术负责人确认后才可缩减。

### 5.3 回归
- `npm test`：没有新增失败；R1 未合并前，仍存在的 `audit` 失败要如实写明（不是本卡引入）。
- `npm run typecheck -- --incremental false`、`npm run check:client-boundary`（容器内，Windows 宿主机的路径报错属环境问题）、`git diff --check`。
- 不引入 `next build` 的新警告；不修改 `dist`。

## 6. 验证环境（仅本机）
同 R1 §4：`node:22.22.1-bookworm-slim`，`--network none`，只读挂载，复用已有依赖，不挂载生产配置或凭据；在 worktree 里先建空的 `node_modules` 作挂载点。涉及 L1-G 测试时保留 `--user 1000:1000`、`L1G_CONTAINER=1`、`/data` 与 `/out` 的 tmpfs。

## 7. 假设、风险与回退
- 假设：`auth-locale` 的 effect 重建 observer 足以保证"使用最新语言"（R2-F2）；`mini-shell` 的 ref 同步 effect 在 observer effect 之前声明，提交阶段按声明顺序执行。
- 风险：语言切换与 observer 回调的时序（毫秒级窗口）；对两处的 5.2 断言就是为了发现该类回归。`mini-shell` 的 `[]` 依赖回退 effect 属既有写法，本卡不改。
- 回退：还原这两个文件与新增测试，不涉及数据、迁移或配置。

## 8. 给 Codex 的提示词

```
【任务】R2：语言组件渲染期写 ref 的 lint 修复。严格按 docs/tasks/codex-prompts/R2-locale-render-refs.md 执行。
先读该文 §4 所列文件。在独立 worktree 里基于最新 origin/main 建分支 fix/client/locale-render-refs。
只改 components/auth-locale.tsx、components/mini-shell.tsx 和新增 tests/locale-render-refs.test.mjs；不关闭或降级 lint 规则，不加 eslint-disable，不重写 DOM 翻译机制，不改语言策略、导航、认证、布局；不新增依赖。
修复方案按文档 §2：auth-locale 删除 ref、用 effect 内的 locale；mini-shell 保留 ref、删除渲染期写入、在 observer effect 之前新增 ref 同步 effect。若测试证明方案不成立再调整并说明原因。
先写 §5.2 的行为测试并确认能通过原实现的预期行为，再改代码；两处 react-hooks/refs error 必须消失。验证在本机 Docker（node:22.22.1-bookworm-slim，--network none，只读挂载）里完成；只用虚构数据；不要操作 159.223.77.134 / 165.22.108.5，不要访问任何 khmerx.org 域名。
PR 小于 400 行；提交末尾加 `Line: client`；按固定格式汇报；若 R1 尚未合并，如实记录仍存在的 audit 失败，不称全绿。
```
