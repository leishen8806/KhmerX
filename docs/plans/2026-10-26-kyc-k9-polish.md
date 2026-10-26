# K9 文案收尾

范围仅 PR-a：跟进 JSX 空格、审核返回链接、history action 三语标签及未知值回退、母语待复核登记。无接口、权限或数据结构修改。

从 #117 分支新建 fix/client/kyc-k9-polish；执行时 #116/#117 均已合并，因此先同步最新 main（包含 #114），不再保持过时堆叠基线。

先增加真实 JSX 输出的三语断言并验证失败，再最小修改。history 兼容实际服务端冒号动作及已有点号动作；用户原文和 actor 不翻译。

全量 npm test/typecheck/build:separated/源码 lint，生成产物排除；375px zh/km 合成数据浏览器队列展开、审核页顶部及历史截图。提交 PR 待 Claude 评审，无明确批准不合并；不部署。
