# 批准:构建机上一次联网 `npm ci`(H1 / D4)

决定日期:2026-10-27。技术负责人原话:"H1 批准联网 npm ci"。由负责人在本对话中明确回复,Claude 据此记录。
来源:`docs/tasks/rebaseline-v3-20261027.md` §5 H1;`docs/tasks/status/2026-10-27-o2-provenance-fix-runsheet.md` §2 第 2 项。

## 批准的范围(只此一项)
- **做什么:** 在构建机上,为从已评审提交 `02ddd0d01493ea6051e9d0ef4bb48a2904e2bc61` 构建灰度制品,执行**一次**按锁定文件的联网 `npm ci`(`scripts/build-gray-artifact.sh` 默认依赖步骤)。
- **依赖来源:** 仅限该提交里的 `package-lock.json`,联网只用于从包注册表取回锁定的依赖。不新增依赖,不改 `package.json` 或 `package-lock.json`,不放宽锁定。
- **在哪里:** 仅限构建机(运维人员的 Linux 构建机,`node:22.22.1-bookworm-slim` 容器内,按灰度 README "Reviewed gray artifacts (C2)")。**不得在灰度源站 159.223.77.134、压测机 165.22.108.5 或旧 VPS 159.223.92.104 上执行 `npm ci`、`npm install` 或应用构建。**
- **次数:** 一次构建所需的一次 `npm ci`。重新构建、换提交、或失败后重试第二次,需要另行说明并经负责人确认,不在本批准范围内。

## 这个批准没有授权的事
- **不是重建窗口批准(H3),不是 W1/W2 批准。** 灰度源站上的任何写操作(替换制品、重建容器)仍需负责人对窗口单独书面批准。
- **没有指定构建机。** H1 的第二部分("哪台是构建机")负责人尚未回复;在回复之前,不得开始构建。建议为运维人员的 Linux 构建机,不是灰度源站。
- 不改变灰度、VPS、L2/Q12 的 HOLD,不批准任何配置修改、fixture 写入、压测或部署。

## 执行时必须保留的证据
- 构建机的 `BUILD_DEPS.json`、`BUILD_INFO.json`、`dist.sha256`(不含密钥)回填给负责人转 Claude。灰度 README 要求在 PR 或回填中记录依赖来源:写明"联网 `npm ci`,2026-10-27 负责人批准"。
- 校验 `BUILD_DEPS.json` 的锁定文件摘要与 `02ddd0d` 的 `package-lock.json` 一致;平台绑定缺失、`node_modules/.package-lock.json` 与源锁定文件不一致时,脚本会拒绝,不得绕过。
- 构建过程不得向外部服务发送令牌、密钥或任何仓库内的敏感数据;不得把联网时拿到的内容写入仓库。
