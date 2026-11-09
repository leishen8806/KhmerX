# 金融服务公司与持牌机构硬分离：拆分清单与最小契约（草案 v0.1）

日期：2026-11-06　作者：Claude　状态：**草案，待技术负责人确认**　基线：`origin/main` = `6ae1594`
依据：技术负责人 2026-11-06 17:25–17:30 的决定（D-56 至 D-59，见 §6）、`docs/architecture-target-20261015.md` §1 原则 3、`docs/master-plan-20261015.md` §6.4–6.5（M3、M4）。

## 1. 目标与硬边界
```
客户（H5 / Mini App / App）
   │  只和金融服务公司交互
   ▼
金融服务公司系统  —— 仓库 leishen8806/KhmerX，服务器 159.223.77.134
   │  ① 提交申请（签名 HTTPS，发件箱，可重试、幂等）
   │  ② 回调审批、放款、还款结果（签名 HTTPS，已有接收端）
   ▼
持牌机构系统      —— 新仓库（建议 leishen8806/KhmerX-Licensed），服务器 165.22.108.5
```
- **每台服务器只部署自己公司的代码**：金融服务公司的仓库和制品中不含机构审批、放款、还款代码；机构的仓库和制品中不含客户端、KYC 采集、运营代码。
- 不共用：数据库、对象存储、会话、员工账号、密钥、域名、CI。两边唯一共享的是**契约文档**和契约测试向量（双方各存一份副本）。
- 客户永远不直接访问机构系统。
- 现有代码**搬移、不重写**：机构那部分代码作为新仓库的起点，改为使用机构自己的数据库；金融服务公司删除这部分代码。

## 2. 拆分清单（按文件）
标记：**搬**＝复制到机构仓库作为起点、并从 KhmerX 删除；**复制**＝两边各需要一份，之后各自演进；**留**＝只留在 KhmerX；**改**＝留在 KhmerX，但要修改；**新**＝两边都没有，需要新写。

### 2.1 搬到持牌机构系统
| 代码 | 内容 | 备注 |
|---|---|---|
| `lib/team/policy.ts` 中的 `lender`、`checker`、`finance`、`finance_checker` 四个角色，以及 `institution` 数据范围、`canSee` 的机构分支 | 机构员工角色与权限 | KhmerX 删除这四个角色 |
| `lib/team/workflow.ts` `staffAction` 中 `approve`、`reject`、`approval_check`、`disburse_request`、`disburse` 五个分支 | 机构初审、复核、放款双人控制 | 改为对机构自己的"申请"表操作 |
| `lib/team/admin-funds.ts`（`admin_disburse`、`admin_repay`） | 管理员放款、登记还款 | D-57：放款与还款都归机构 |
| `lib/funding-limits.ts`、`lib/funding-risk.ts`、`lib/team/funding-settings.ts`、`lib/team/funding-risk-events.ts` | 资金额度、资金风险事件 | |
| `app/api/team/funding-settings`、`app/api/team/funding-risk` | 对应接口 | |
| `components/funding-panel.tsx`、`components/repayment-panel.tsx` | 放款、还款界面 | |
| `app/lender/page.tsx`；`app/team/login/client.tsx` 和 `lib/team/auth.ts` 中的 `portal='lender'` 入口；`app/team/client.tsx` 中机构相关的界面区块 | 持牌机构后台入口和界面 | KhmerX 去掉"持牌机构后台"入口 |
| 表 `team_repayment_receipts`；迁移 0043（资金风险事件）、0044（资金设置）、0052 中资金应急范围部分 | 资金相关表 | 机构仓库重新编号；KhmerX 用新迁移删除或停用这些表 |

### 2.2 两边各复制一份（基础设施）
| 代码 | 说明 |
|---|---|
| `lib/team/auth.ts`（密码、MFA、会话）、`team_staff_*`、`team_mfa_*` 表 | 机构要有自己的员工账号体系 |
| `lib/team/audit-writer.ts`、`lib/team/audit-integrity.ts`、`team_audit` 及清单 | 两边各自审计，互不可见 |
| `lib/http/*`（错误体、requestId、`route()`）、`lib/request-security.ts`、`lib/runtime-guards.ts` | 通用服务端基础 |
| `lib/institution-callback.ts`（HMAC 签名与验签） | 契约的签名实现；两边必须保持一致，由契约测试向量保证 |
| `deploy/standalone/*` 的部署骨架 | 机构用自己的部署模板 |

### 2.3 留在金融服务公司（KhmerX）
客户端与渠道（`app/h5`、`app/mini`、`components/mini-*`、`app/api/h5/*`、`app/api/telegram`、`app/api/bots`、`mobile/`）；KYC 采集与审核（`lib/kyc/*`、`app/api/kyc/*`、`app/kyc`）；运营分单与员工管理（`ops`、`kyc`、`dept_admin`、`admin`、`audit` 角色）；贷后与催收（`lib/postloan/*`、`app/api/postloan`、`app/api/jobs/postloan`）；通知、工单、客户标签、风控规则、报表、客户清理、埋点；**机构回调接收**（`app/api/institution/callback`、`lib/institution-callback-*.ts`、`lib/institution-events.ts`、`lib/institution-event-plans.ts`、`app/api/team/institution-callbacks`、迁移 0036–0041）；合作机构登记（`team_units` 中 kind=institution 的记录、迁移 0060 机构资料：作为"合作方配置"保留，不再挂员工）。

### 2.4 金融服务公司需要修改的地方
| 位置 | 修改 |
|---|---|
| `lib/domain.ts` 状态机 | `approve`、`reject`、`disburse` 不再由员工操作，只由机构回调驱动；客户端的 `withdraw`、`repay`（测试资金）改为只显示机构确认的结果；状态名不变 |
| `lib/team/workflow.ts` | 删除机构分支；客户"申请"时写入发件箱（见 §3 的 `application.submitted`）；客户"签约"时写入 `agreement.signed` |
| `lib/team/policy.ts` | 删除四个机构角色和 `institution` 数据范围 |
| `team_assignments` | 保留 `institution_id`（申请发给哪家机构）；`funding_institution_id`、`repayment_institution_id` 待定（见 §5） |
| `lib/institution-callback-consumer.ts` | 现在只处理批准和拒绝；补上 `funding.confirmed`、`repayment.confirmed`、`payment.failed` 对状态的推进 |
| 现有数据 | KhmerX 库里四种机构角色的员工账号全部停用（新迁移，不删审计） |

### 2.5 两边都要新写
| 一方 | 内容 |
|---|---|
| 金融服务公司 | 发件箱表、投递 worker、签名、退避重试、死信、对账查询；后台"机构投递状态"页 |
| 持牌机构 | 接收接口（验签、防重放、幂等）；按引用拉取 KYC 文件并校验哈希、加密存储；回调发送端（签名、重试、死信）；机构自己的"申请"表 |

## 3. 最小契约 v0（ARC-04-lite）
**签名**：沿用现有 `lib/institution-callback.ts` 的方案，两个方向都用：
- 请求头：`X-Partner-Id`（发送方编号）、`X-Timestamp`（10 位秒级时间戳，允许偏差 300 秒）、`X-Nonce`（16–128 位）、`X-Idempotency-Key`（8–120 位）、`X-Signature` = HMAC-SHA256(secret, `partnerId\ntimestamp\nnonce\nidempotencyKey\nbody`) 的十六进制值。
- 两个方向**各用一把独立的密钥**；密钥只放在各自服务器的配置里。
- 接收方先验签，再检查 nonce 是否重复，再按幂等键去重：同一个键、同一份内容返回原结果；同一个键、内容不同返回 409。
- 现有回调接收端用的是 `X-Institution-Id`；v0 保留这个名称作为别名，或者统一改名，由技术负责人二选一。

**金融服务公司 → 机构**（`POST https://<机构 API>/v0/events`）

| 事件 | 时机 | 主要字段（v0 草案） |
|---|---|---|
| `application.submitted` | 客户提交贷款申请 | `applicationId`（金融服务公司的公开申请号）、`customerRef`（对机构的化名编号，不是客户 ID）、产品、金额、期限、账单、KYC 资料包（**只给引用**：文件编号、类型、sha256、短时效下载地址，机构拉取后校验哈希） |
| `agreement.signed` | 客户签署借款协议 | `applicationId`、协议版本、协议文件引用与 sha256、签署时间 |
| `application.withdrawn` | 客户撤回，或资料失效 | `applicationId`、原因代码 |

**机构 → 金融服务公司**（`POST https://<金融服务公司 API>/api/institution/callback`，接收端已有）

| 事件 | 含义 | 对应客户状态 |
|---|---|---|
| `loan.approved` | 机构批准（机构内部已完成双人复核） | `decision_pending` → `approved`（待签约） |
| `loan.rejected` | 机构拒绝 | → `rejected` |
| `funding.confirmed` | 机构已放款 | `signed` → `active` |
| `repayment.confirmed` | 机构确认收到还款（部分或全额） | `active` → `active` / `closed` |
| `payment.failed` | 放款或还款失败 | 状态不变，提示客户和运营 |

**可靠性**：
- 发送方用发件箱持久化后异步投递；失败按指数退避重试，24 小时后进入死信，由人工处理。
- 接收方幂等，且必须接受乱序：例如在 `agreement.signed` 之前收到 `funding.confirmed`，应拒绝并要求重试，不得推进状态。
- 每日对账：双方按 `applicationId` 比对状态，不一致就告警。
- 机构不可用时，客户界面保持"审核中"。

## 4. 建议的任务顺序（技术负责人确认本文后再派卡）
1. **契约定稿**：Claude 起草，技术负责人与法务确认 §5 的问题。
2. **新建机构仓库**：从 KhmerX 复制 §2.1 和 §2.2 的代码作为起点，去掉客户端、KYC、运营代码；建立独立的 CI 和部署模板。
3. **机构系统**：接收接口、文件拉取、申请表；审批和放款流程改为对申请表操作；回调发送端。
4. **金融服务公司**：发件箱和投递、消费者补齐三个事件、§2.4 的修改。
5. **契约测试与模拟对端**：双方各自对着契约测试向量和模拟对端测试。
6. **从 KhmerX 删除 §2.1 的代码**，停用机构角色账号。
7. **端到端联调**（两台服务器）→ 灰度。
8. 工作量（粗估，未经实测）：约为总体规划 M3 + M4 的 60–70%，因为审批、放款、回调接收、员工鉴权都可以搬过来用。一个人执行，大约 5–7 周。

## 5. 需要技术负责人或法务决定
1. **给机构的资料包**：KYC 证件、联系人、收入、银行账户中，哪些给机构，能否按最少必要原则裁剪。
2. **客户同意书**：是否写明资料会提供给持牌机构、是否披露机构名称。这与"客户看不到机构"的约定冲突，总体规划 §8.4 已经列为待法务确认。
3. **借款协议**：协议的甲方是机构；签署由金融服务公司代为收集，这种模式是否可行。
4. **定价与账单**：费率、期限、账单由谁定（`lib/pricing.ts`、产品配置现在在金融服务公司）。如果由机构定，需要增加一个"报价"事件。
5. **还款路径**：客户的钱付给谁、通过什么渠道；金融服务公司是否参与收款。按 D-57，确认权在机构。
6. **贷后催收**：机构的贷款由金融服务公司代为催收（现在的代码是这样），还是由机构自己催收。
7. **`team_assignments` 里放款机构、还款机构两个字段**是否保留（一笔贷款是否可能由不同机构放款和收款）。
8. **请求头名称**：沿用 `X-Institution-Id`，还是统一改为 `X-Partner-Id`。

## 6. 本批决定（待提交进决定记录）
| 编号 | 决定 | 状态 |
|---|---|---|
| D-55 | 前后端容器拆分版灰度：**撤回**（17:25）。目标是两家公司硬分离，SEP 卡留档不执行 | 已撤回 |
| D-56 | 持牌机构系统使用**新建的独立仓库**；每台服务器只部署本公司代码 | 已确认 |
| D-57 | **放款与还款都归持牌机构**；金融服务公司只根据回调展示状态 | 已确认 |
| D-58 | **暂停灰度**：取消 D-54 的 11-09 窗口，等拆分完成后重新排期；D-50 至 D-52 保留，到时按新的提交号重新确认 | 已确认 |
| D-59 | 第一步由 Claude 出拆分清单与最小契约（本文），确认后再派代码卡 | 已确认 |
