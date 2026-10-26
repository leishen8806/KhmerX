# Flutter K4 Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans after plan review.

**Goal:** App needs_info 按结构化补件定位与展示，兼容旧数据。
**Architecture:** domain 解析保留 requests 缺省与 [] 的区别；presentation 将服务端七个核心分区映射至 App 五组，使用现有 controller 导航。只改 Flutter，不改服务端。
**Tech Stack:** Flutter/Dart，现有 ARB 三语与 widget tests。
**Spec:** claude-bridge/done/20261024-1650-03-flutter-k4-requests.md；docs/flutter-android/76-P2-kyc-contract.md §9。

## Global Constraints
- 从最新 main 建 feat/app/kyc-k4-requests；只 PR、约400行，不合并、不部署。
- commit 末尾 Line: app；高棉语须母语复核。
- flutter analyze 0 问题，测试与 Flutter CI 通过，模拟器 zh/km 截图，不冒充 Web 截图。

## Review Focus
- requests 缺省才走 checklist，[] 不能被当缺省。
- 非 needs_info 不把历史补件视作待办。
- 七核心分区到五 App 分组映射不丢 income/assets。
- 未知 target/原因安全回退，不让 wire key 泄漏到客户文案。
- note 是原始审核意见，不自动翻译或记录敏感值日志。

### Task 1：解析与页面
Files: mobile/lib/features/kyc/domain/kyc_case.dart、kyc_wire.dart；presentation/kyc_controller.dart、kyc_pages.dart、kyc_labels.dart；mobile/lib/l10n/app_{zh,en,km}.arb；mobile/test/features/kyc/kyc_test.dart、kyc_pages_test.dart。
- [ ] 先阅读现有模型与导航；用服务端 requests.ts 的 seven reasonCodes 和 requestSection 固定 wire 契约，不创造原因码。
- [ ] 写 RED：缺省/[]、字段/slot/section、旧 checklist、needs_info 与已提交状态、首项定位、zh/en/km 原因标签。
- [ ] domain 增加不可变 KycRequest(target,reasonCode,note)，不丢缺省语义；controller 解析第一项目标，页面分组与字段/材料显示需补充和原因。
- [ ] 复用 Web 已有三语原因，不新编高棉语；审核 note 保持原文。无 requests 的旧数据保留原逻辑。
- [ ] focused GREEN，再 flutter analyze、flutter test 及项目四门禁；普通推送、等待 Flutter CI。
- [ ] 用合成数据拍模拟器 zh/km 截图，PR 记录真实证据与限制；不合并。

## 执行前复核
当前 main 682bbcb 的契约 §9 与 requests.ts/server.ts 核对一致，没有以此虚构接口阻塞。writing-plans 要求先复核计划，待复核后执行。PATH 未发现 flutter；实现前需定位既有 SDK/模拟器，找不到时不能声称 analyze/截图完成，需单独报告环境缺口。
