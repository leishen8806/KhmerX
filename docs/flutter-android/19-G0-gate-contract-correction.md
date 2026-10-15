# G0 Gate Contract Correction — JDK 验收口径

```
Document:   19-G0-gate-contract-correction.md
Date:       2026-10-07
Owner:      Claude（System / Product / Requirements / Architecture / Contract）
Scope:      仅修正 G0 最终验收契约中的 Java/JDK 条款；不修改 Flutter 代码，不修改 Codex/HELIX/Trae 编写的任何报告
Status:     CORRECTION ISSUED — 不宣布 G0 PASS

G0 = FAIL / RECOVERY   （直到独立最终复验给出 PASS）
G1 = HOLD
G2 = HOLD
G3 = BLOCKED BY CR-001
```

> **本文只修正“什么算 G0 的 JDK 阻断项”。** 最终 PASS 仍由 Codex / HELIX 独立给出。本文**不是**放宽 JDK 要求：Gradle 构建 JDK 与干净构建仍然是阻断项。

---

## 1. Problem

### 1.1 现状
HELIX 最终复验（`18-helix-g0-final-review.md`）的结论是 **FAIL**。它同时给出：

| 项 | 独立结果 |
|---|---|
| `flutter clean` / `pub get` / `gen-l10n` / `analyze` / `test` / `build apk --debug` | **全部 PASS**（`analyze` 0 issues；`test` 90 项；APK 已产出，160,566,662 字节） |
| 契约回归（Retry、Cookie 隔离、登出隔离、脱敏、Endpoint、Origin、错误映射、Feature Flag、本地化、Router） | **全部 PASS** |
| P0 | 无 |
| **P1** | **仅两条，且同源**：① Flutter 工具选中的 JDK 是 Java 25.0.3（`config --list` 无 `jdk-dir`）；② Round 4 报告声称“已持久化 `jdk-dir` 且 doctor 为 JDK 17”，与 HELIX 的独立输出不一致 |

**因此 G0 目前唯一的 FAIL 原因是：`flutter doctor` 显示的 Java 不是 JDK 17。**

### 1.2 这个条件从哪里来
本文核对了 Claude 负责的文档：**`10-G0-implementation-contract.md` 从未要求 `flutter doctor` 必须显示 JDK 17**（该文件只要求报告记录环境，并要求 `flutter build apk --debug` 成功）。这一要求出现在审查文本中（`14`、`16`、`18` 的 “Flutter-compatible JDK / Flutter Tool JDK 17”），**没有被写成正式契约**。本文的作用是把它**正式化为正确的口径**，而不是追认一个隐含条款。

### 1.3 要回答的问题
> “`flutter doctor` 显示 JDK 17”究竟是 **Project Build Contract**，还是 **Developer Machine Environment Requirement**？

**结论：它是 Developer Machine Environment Requirement，不是 Project Build Contract。** 项目的 Build Contract 是 **“Gradle 构建 JDK 兼容 + 干净构建通过”**，这一条保持阻断。依据见第 2–4 节。

---

## 2. Evidence

### 2.1 HELIX 的独立事实（`18`，2026-10-07 约 15:09）
| 项 | 值 |
|---|---|
| Flutter / Dart | 3.47.0 stable / 3.13.0；SDK 路径 `E:\Dev\flutter` |
| System `JAVA_HOME` | `C:\Program Files\Android\Android Studio\jbr` |
| PATH Java | `where.exe java` 无结果 |
| Flutter 选中的 JDK（`doctor -v`） | Android Studio JBR，**Java 25.0.3** |
| Gradle JDK | `C:\Java\jdk-17.0.2`（经 `org.gradle.java.home`） |
| AGP / Gradle / Kotlin | 8.11.1 / 8.14.1 / 2.4.0 |
| JDK 17 本体 | 存在，`OpenJDK 17.0.2` |

### 2.2 Claude 在本会话中的独立核实（2026-10-07，Windows 用户 `Administrator`）
**未修改任何文件，未运行 Gradle**（避免干扰他人的构建）。

| # | 核实内容 | 结果 |
|---|---|---|
| E-1 | **Flutter SDK 源码**：`E:\Dev\flutter\packages\flutter_tools\lib\src\android\java.dart`，`_findJavaHome`（约 232–246 行）与 `_findJavaBinary`（约 249–262 行） | 顺序为 **① `config.getValue('jdk-dir')` → ② Android Studio 内置 JDK → ③ 环境变量 `JAVA_HOME` → ④ PATH 上的 `java`**。类注释（66–69 行）只列了 ②③④，**与代码不一致，以代码为准** |
| E-2 | 同文件 `Java.environment`（约 145–160 行）及 `gradle.dart`（356、757、934 行使用 `_java?.environment`） | Flutter 把**所选 JDK 写入 `JAVA_HOME`（并前置 PATH）**，再调用 Gradle 等 Java 进程 |
| E-3 | `flutter config --list`（本会话） | `jdk-dir: C:\Java\jdk-17.0.2`；`android-sdk: C:\Android\Sdk` |
| E-4 | `%APPDATA%\.flutter_settings`（本会话的 Flutter 用户配置） | 文件存在，内容含 `"jdk-dir": "C:\\Java\\jdk-17.0.2"`；**修改时间 14:59:47**；路径 `C:\Users\Administrator\AppData\Roaming\.flutter_settings` |
| E-5 | `flutter doctor -v`（本会话） | `Java binary at: C:\Java\jdk-17.0.2\bin\java` / `This JDK is specified in your Flutter configuration.` |
| E-6 | 同一次 `doctor -v` 的详细日志 | 仍会**探测性**执行一次 `C:\Program Files\Android\Android Studio\jbr\bin\java -version`（输出 25.0.3）。这只是探测，**权威结果是 “Java binary at:” 那一行** |
| E-7 | 本会话环境 | `JAVA_HOME`（用户级）= Android Studio JBR（25.0.3）；PATH 无 `java` |
| E-8 | 项目文件 `mobile/android/gradle.properties` | `org.gradle.java.home=C\:\\Java\\jdk-17.0.2`；该路径存在，`java -version` = OpenJDK 17.0.2 |
| E-9 | Gradle 官方兼容性文档（`docs.gradle.org/current/userguide/compatibility.html`，网页摘要，非逐字） | **Gradle 8.14 起支持 Java 24 运行；Java 25 作为“运行 Gradle 的 JVM”最早由 Gradle 9.1.0 支持；8.14.x 不支持**。新版 Java 可通过 toolchain 用于编译，但不一定能运行 Gradle |

### 2.3 三个观察者，两种配置
| 观察者 | `jdk-dir`（Flutter 用户配置） | `doctor -v` 选中的 Java |
|---|---|---|
| Trae（`17`，约 15:02） | 已设置 `C:\Java\jdk-17.0.2` | JDK 17.0.2 |
| HELIX（`16`、`18`，约 14:41、15:09） | `config --list` 中**没有** `jdk-dir` | Android Studio JBR 25.0.3 |
| **Claude（本会话，约 15:2x）** | **已设置**（E-3、E-4，文件修改时间 14:59:47） | **JDK 17.0.2**（E-5） |

**解读（诚实边界）**：
- `flutter config` 写入的是**当前操作系统用户**的配置文件（E-4），**不在仓库里**。三方观察到不同结果，**与“HELIX 的进程使用了另一份 Flutter 用户配置”一致**；但 `18` 没有记录 HELIX 进程的用户名/`APPDATA`，所以**这一点是推断，不是已证明的事实**。
- 无论原因如何，这个条件**依赖于“谁、在哪个用户环境下运行 Flutter”**，不是仓库内容的函数。这正是它不应成为项目 G0 阻断项的原因。

---

## 3. Flutter JDK Discovery Model

```
Flutter Tool JDK  =  first match of
   ① jdk-dir            ← Flutter 用户配置（flutter config --jdk-dir；%APPDATA%\.flutter_settings；按 OS 用户）
   ② Android Studio 内置 JDK
   ③ JAVA_HOME 环境变量
   ④ PATH 上的 java
```
- 来源：Flutter 3.47.0 源码（E-1）。你提供的“未配置 `jdk-dir` 时按 Android Studio → `JAVA_HOME` → PATH”是**正确的**，需要补充的是：**①才是最高优先级**，且它是**用户级配置，不是项目配置**。
- 所选 JDK 会被 Flutter 写入 Gradle 进程的 `JAVA_HOME`（E-2）。
- **权威读数**是 `flutter doctor -v` 中 “Java binary at:” 一行，以及 `flutter config --list` 中的 `jdk-dir`；doctor 日志里的探测性 `java -version` 不是依据（E-6）。

---

## 4. Project JDK vs Tool JDK

### 4.1 四个概念（不再统称 “Java Version”）
| 概念 | 是什么 | 由谁设置 | 作用域 | 存放位置 | 在 G0 中的地位 |
|---|---|---|---|---|---|
| **A. System `JAVA_HOME`** | 操作系统环境变量（进程/用户/机器三级） | 用户或管理员 | OS 用户 / 机器 | 环境变量 | **Informational** |
| **B. PATH Java** | `where java` 找到的 `java` | 用户或安装程序 | OS 用户 / 机器 | `PATH` | **Informational** |
| **C. Flutter Tool Selected JDK** | Flutter CLI 按第 3 节顺序选中的 JDK；`doctor -v` 显示；并作为 `JAVA_HOME` 传给 Gradle 进程 | `flutter config --jdk-dir`，或回退到 Android Studio / A / B | **OS 用户** | `%APPDATA%\.flutter_settings` | **Environment**（不阻断；与批准的 JDK 不同时记 P2） |
| **D. Gradle Build JDK** | 实际**运行构建**的 JDK | **项目**：`mobile/android/gradle.properties` 的 `org.gradle.java.home` | **项目（仓库）** | 仓库 | **Blocking**（必须兼容并有证据） |

### 4.2 D 的补充：Gradle 有两个 JVM
| 子项 | 含义 | 由谁决定 |
|---|---|---|
| **D1 Daemon JVM（构建 JDK）** | 真正执行构建（含 AGP、Kotlin、Java 编译）的 JVM | `org.gradle.java.home`（项目） |
| **D2 Launcher JVM** | `gradlew`/Gradle client 的启动 JVM | **继承 C**——Flutter 把 C 写入 `JAVA_HOME`（E-2） |

**含义**：C 并非与构建完全无关——它是 D2。当 C = Java 25 而项目使用 Gradle 8.14.1 时，D2 运行在 **Gradle 官方尚不支持的 Java 25** 上（E-9）。当前构建仍然通过（HELIX 独立 PASS），因为实际构建发生在 D1 = JDK 17。这被记为 **P2 风险（TD-2）**，而不是 G0 阻断项；若它**导致构建失败，则仍是 P1**（见第 6 节）。

### 4.3 为什么这样划分
1. C 是 **Flutter CLI 的用户环境选择**（E-4），不是项目代码；不同用户/不同审查进程可以合法地得到不同的 C（第 2.3 节）。
2. **项目已通过 D1 固定构建 JDK 为 17**（E-8），且干净构建在独立环境中通过（`18`）。验收应针对**项目能否可复现地构建**，而不是针对某个开发者机器上 Flutter 工具的偏好。
3. 把 C 设为阻断项会让 G0 取决于**审查进程是否碰巧拥有同一份用户配置**，这不是项目质量的度量。

### 4.4 这不是取消 JDK 要求
**仍然阻断**：① D1 是兼容的 JDK（当前为 JDK 17）并有证据；② 干净构建通过。
**仍然是 P1**：如果未来构建因为实际使用了不兼容的 JDK（例如 Gradle 实际运行在 Java 25）而失败。
**只取消**：“`flutter doctor` 界面必须显示 Java 17”作为 G0 P1。

---

## 5. Previous Gate Defect

### 5.1 时间线与分类（历史记录保留，不删除）
| 轮次 | 报告 | 声称 | 事实 | 分类 |
|---|---|---|---|---|
| Round 3 | `15` | `flutter config --jdk-dir` 已设置，Flutter 使用 JDK 17 | 据 `17` 自身的根因分析，当时 **`jdk-dir` 未设置**；`config` 帮助页被误读为“已设置”；证据实际是 D1（Gradle），却被当作 C（Tool）的证据 | **Historical evidence error**（声明为假；Round 4 已承认） |
| Round 3 复验 | `16` | — | HELIX 观察到 Java 25、无 `jdk-dir` | 观察属实 |
| Round 4 | `17` | 已持久化 `jdk-dir`；doctor 显示 JDK 17；并拆分了三种 JDK 概念 | **在 `Administrator` 用户配置中为真**（E-3/E-4/E-5，写入时间 14:59:47 早于报告 15:02） | **Evidence reproducibility gap**：声明在其环境内准确，但**没有记录环境身份**（用户、`APPDATA`、配置文件），使审查者无法判断两种观察是否同一环境 |
| Round 4 复验 | `18` | — | HELIX 的进程看不到 `jdk-dir`，doctor = Java 25 | 观察属实；**其进程的配置身份未记录**，无法与 `17` 对齐 |

> **对你前文的一点修正**：你写到 “Round 3 / Round 4 曾错误声称 Flutter Tool selected JDK17”。**Round 3 的声称确实是错的；Round 4 的声称我核实后在 `Administrator` 配置里是准确的**，HELIX 看到不同结果**并不证明它是假的**。它们的差别应归类为“证据不可复现（环境身份缺失）”，而不是“虚假声明”。这个区分会影响后续如何改进证据规则（第 8 节）。

### 5.2 当前缺陷
| 类别 | 现状 |
|---|---|
| **Current product/build defect** | **无**：干净构建 PASS；Gradle 构建 JDK 为 17 |
| Historical evidence error | Round 3（保留） |
| Evidence reproducibility gap | Round 4（保留，由第 8 节的证据规则解决） |

只要**当前报告诚实记录** `Flutter Tool = <实际值>`、`Gradle Build = JDK 17`、`Build = PASS`，并标明各项的观察范围，就**不应再作为永久 G0 P1**。

### 5.3 文件保留
`15`、`16`、`17`、`18` **不修改**。后续报告若需更正，写新文件。

---

## 6. Corrected Blocking Criteria

**G0 PASS 需要以下全部满足；缺任何一项保持 G0 = FAIL。**

| # | 阻断项 | 通过标准 |
|---|---|---|
| **BC-1** | P0 = 0 | 无已确认的 P0 |
| **BC-2** | 项目相关 P1 = 0 | 与项目代码、构建、依赖、契约相关的 P1 为 0（定义见下） |
| **BC-3** | `flutter pub get` | PASS（干净副本；无 `dependency_overrides`） |
| **BC-4** | `flutter gen-l10n` | PASS |
| **BC-5** | `flutter analyze` | PASS（0 issues） |
| **BC-6** | `flutter test` | PASS（含 `10` §4 G0-TEST-01 的必需测试与架构测试；无被跳过的必需测试） |
| **BC-7** | `flutter build apk --debug` | PASS，**APK 存在** |
| **BC-8** | **Gradle Build JDK 兼容且有证据** | D1（`org.gradle.java.home`）指向的 JDK **存在**且为**批准的兼容版本**（当前：JDK 17）；并按第 8.3 节提供**可复核的证据** |
| **BC-9** | 必需契约测试 | `10` §7.1 的 B-5 至 B-16（Counter 已删除、启动链路、Riverpod 重试 OFF、URL 含 `/api`、Cookie 真实格式、公司隔离、Origin 含端口、Feature Flag 默认 false、安全存储与日志、无重复类型、Theme/本地化、报告齐全）全部成立 |
| **BC-10** | 证据诚实且可复现 | 报告中每条声明都能由所列命令复现；涉及 Flutter 用户配置的声明必须附**环境身份**（第 8.2 节）。**注意**：不同进程因用户配置不同而对 C 观察不同，**不构成** BC-10 的违反，只要报告标明了其观察范围 |

**“项目相关 P1”的定义**：由仓库内容（源码、`pubspec`、Gradle/AGP/Kotlin 配置、测试、契约）或构建结果决定的、对任何干净环境都成立的缺陷。**由单个开发者机器的 Flutter 用户配置、`JAVA_HOME`、PATH 决定的现象不属于项目相关 P1。**

**仍为 P1 的情形**：
- D1 指向的路径不存在 / 不是批准的 JDK；
- 构建因实际使用了不兼容的 JDK 而失败（例如 Gradle 实际运行在 Java 25 并报错）；
- 干净构建或 `analyze`/`test` 失败。

---

## 7. Nonblocking Environment Criteria

| # | 环境项 | 分类 | 说明 |
|---|---|---|---|
| NE-1 | **Flutter Tool Selected JDK**（C） | Informational；**与 JDK 17 不同时记 P2** | 见 TD-1/TD-2；不阻断 G0/G1 |
| NE-2 | System `JAVA_HOME`（A） | Informational | 当前用户级为 Android Studio JBR（25.0.3） |
| NE-3 | PATH Java（B） | Informational | 当前无 |
| NE-4 | `flutter doctor -v` 中探测性的 `java -version` 行 | Informational | 以 “Java binary at:” 为准（E-6） |
| NE-5 | Flutter doctor 中与 Android 无关的条目（Chrome、Visual Studio 等） | Informational | |
| NE-6 | Android 真机/模拟器运行验证 | P2（待办） | 当前 `flutter devices` 仅有 Windows/Chrome/Edge（`18`） |

### 7.1 开发者环境建议（Environment Setup Recommendation，不是项目契约）
为避免 D2（Launcher JVM）落在 Gradle 8.14.1 不支持的 Java 25 上，**建议**每位开发者/CI 执行并在自己的环境中核对：
```
flutter config --jdk-dir="<JDK17 路径>"
flutter config --list        # 应显示 jdk-dir
flutter doctor -v            # “Java binary at:” 应为该路径
```
这是**用户级**设置（`%APPDATA%\.flutter_settings`），**不进入仓库、不是验收门槛**。

---

## 8. Evidence Policy

### 8.1 原则
1. **声明的作用域必须与证据的作用域一致。** “Flutter Tool = JDK 17”只能由**同一操作系统用户、同一 Flutter SDK** 的 `config --list` 与 `doctor -v` 证明，不能用 `gradle.properties` 证明（Round 3 的错误）。
2. **不同观察者的结果不一致时，记录两者及各自的环境身份**，不要用一方覆盖另一方。
3. 历史报告**不改写**；更正写新文件。
4. 未执行的验证写 `NOT EXECUTED` 与原因。

### 8.2 环境身份块（凡涉及 Flutter/Java 的报告必须包含）
```
Environment Identity
  OS user / USERPROFILE / APPDATA
  Flutter SDK path & version; Dart version
  Flutter user config file: %APPDATA%\.flutter_settings  (exists? mtime? contents of jdk-dir / android-sdk)
  `flutter config --list` (relevant lines)
  `flutter doctor -v` — the "Java binary at:" bullet (not the probe log)
  JAVA_HOME: process / user / machine
  `where java` (PATH)
  Working directory and exact command for every result; exit codes
```

### 8.3 Gradle Build JDK 的证据（BC-8）
必须同时给出：
1. **配置**：`mobile/android/gradle.properties` 中 `org.gradle.java.home` 的取值。
2. **JDK 本体**：该路径下 `bin\java -version` 的输出（需为批准的兼容版本）。
3. **Gradle 实际使用**：在与 Flutter 相同的环境下（`JAVA_HOME` 取 Flutter 所选 JDK）运行 `android\gradlew.bat --version`（或等价命令），记录 Launcher JVM / Daemon JVM 信息；若该 Gradle 版本不打印 Daemon JVM，则**写明实际运行的命令与输出**，并附 `flutter build apk --debug` 的成功日志，由验收者判断。
4. **干净构建**：`flutter clean` → `pub get` → `gen-l10n` → `analyze` → `test` → `build apk --debug` 的完整结果。

> 本文**没有**替任何人执行第 3 项；`18` 已验证第 1、2、4 项，第 3 项（Gradle 实际使用的 JVM）目前是间接证据（构建通过且 Java 25 作 D1 已知会失败，见 `15`），建议补一次直接取证。

### 8.4 证据规则的后果
- Round 4 类问题（准确但不可复现）今后由 **8.2 身份块**消除。
- 报告不得再把 D（Gradle）的证据当作 C（Tool）的证据，反之亦然。

---

## 9. Updated G0 Gate

### 9.1 新的 Java / 环境验收表
| Evidence | G0 Requirement | 分类 |
|---|---|---|
| Flutter SDK | 3.47.0 | Blocking（环境一致性：与验收使用的 SDK 一致） |
| **Gradle Build JDK（D1）** | **JDK 17 / 批准的兼容 JDK，并有 §8.3 证据** | **Blocking** |
| `flutter clean` | PASS | Blocking |
| `flutter pub get` | PASS | Blocking |
| `flutter gen-l10n` | PASS | Blocking |
| `flutter analyze` | PASS | Blocking |
| `flutter test` | PASS | Blocking |
| `flutter build apk --debug` | PASS，APK 存在 | Blocking |
| Flutter doctor selected Java（C） | 不要求为 17 | **Informational；不同则 P2** |
| System `JAVA_HOME`（A） | — | Informational |
| PATH Java（B） | — | Informational |

### 9.2 G0 Final Gate
```
P0 = 0
Project-related P1 = 0

pub get PASS · gen-l10n PASS · analyze PASS · test PASS · build apk PASS
required contract tests PASS
Gradle Build JDK verified compatible (with §8.3 evidence)
APK exists
```
满足即可由独立复验给出 **G0 PASS**。**本文不宣布 PASS。**

### 9.3 对 HELIX `18` 的衔接
`18` 已独立验证：全部干净命令 PASS、全部契约回归 PASS、无 P0、APK 存在。其 FAIL 仅来自 C 的 P1 与随之的证据不一致 P1。按本文口径：
- “C = Java 25”→ **NE-1，P2（TD-1/TD-2）**，不阻断；
- “Round 4 声明与 HELIX 输出不一致”→ **证据可复现性缺口（第 5.1 节）**，由第 8 节规则处理，**不再作为项目 P1**；
- 剩余需确认的阻断项：**BC-8 的第 3 项**（Gradle 实际使用的 JVM 的直接取证）。

---

## 10. G1 Entry Criteria

**G1 现在仍是 HOLD。** 仅当以下**全部**满足才可改为 GO：
1. **G0 PASS**（由 Codex/HELIX 独立复验，按本文 §6、§9）；
2. `10` §8 中尚未完成的 G1 前置：三方 Gate Review（Architecture + UX + API）、Codex 修订 `04` 的 R-3、R-5、R-12（见 `09`）；
3. §11 的 P2 技术债**已登记并被接受**（不要求关闭）；
4. 建议（非阻断）：为 `mobile/` 与文档做一次 git 快照提交——`17` 记录 “working tree dirty，无快照提交”，不利于独立复验复现同一份代码。

**本轮不生成 G1 Implementation Contract**；待 G0 PASS 之后再启动。

---

## 11. Technical Debt（P2，不阻塞 G1）

| ID | 债务 | 说明 | 建议 |
|---|---|---|---|
| **TD-1** | 部分环境的 Flutter Tool 使用 Java 25 | 取决于 `jdk-dir`、Android Studio、`JAVA_HOME`（第 3 节） | 开发者环境设置（§7.1）；文档化 |
| **TD-2** | **Gradle Launcher JVM 可能落在不受支持的 Java 25** | Tool JDK → `JAVA_HOME` → D2；Gradle 8.14.x 不支持 Java 25（E-9）；当前靠 D1 = 17 通过构建 | 同 TD-1；并随 TD-5 升级 Gradle ≥ 9.1.0 时消除 |
| **TD-3** | **`org.gradle.java.home` 是写死的机器绝对路径** `C:\Java\jdk-17.0.2`，且已提交到仓库 | 在没有该路径的机器/CI 上 Gradle 会因该属性无效而失败——这是**项目可移植性缺陷**，与第 4.3 节“项目已固定 JDK”的论据并存 | 评估更可移植的做法（如 Gradle 的 Daemon JVM criteria / Java toolchains / 用户级 `~/.gradle/gradle.properties`）；**采用前需在本项目验证**，本文不预设方案 |
| **TD-4** | 依赖版本与历史架构目标有漂移（Riverpod 3.3.2 vs 3.4.3；go_router 17.0.0 vs 18.0.2；flutter_secure_storage 9.2.4 vs 11.2.0；app_links 6.4.1 vs 7.2.2；`intl 0.20.3`，据 `16`） | 行为测试通过，HELIX 判定非阻断 | G1 前评估是否对齐，或更新 `05` 的版本目标 |
| **TD-5** | Flutter 对 Gradle 8.14.1 / AGP 8.11.1 的未来支持警告（将要求 Gradle ≥ 9.1.0、AGP ≥ 9.0.1） | `17` 记录 | 下一轮工具链升级 |
| **TD-6** | 高棉文/中文文案的语言学审校 | 结构上 0 未翻译，审校待做 | 业务/语言审校 |
| **TD-7** | Android 真机/模拟器运行验证未做 | `flutter devices` 仅 Windows/Chrome/Edge | 有设备后补充 |
| **TD-8** | 工作树未做快照提交 | `17`：HEAD `4bceda1`，工作树 dirty；本会话 `git status` 仍有未提交变更 | 提交快照 |

---

## 12. Decision Record

| ID | 决策 | 依据 | 状态 |
|---|---|---|---|
| DR-1 | Java 概念拆分为 A（System JAVA_HOME）、B（PATH Java）、C（Flutter Tool JDK）、D（Gradle Build JDK，含 D1 daemon / D2 launcher）；不再统称 “Java Version” | §3、§4（源码核实） | **冻结** |
| DR-2 | **D1 Gradle Build JDK = 兼容 JDK（当前 JDK 17）+ 干净构建通过 = G0 阻断项（Project Build Contract）** | §4.3、§6 | **冻结** |
| DR-3 | **C（`flutter doctor` 选中的 Java）= Developer Environment Requirement；从 G0 阻断项移除；与 JDK 17 不同记 P2** | §2.3（环境依赖）、§4.3 | **冻结** |
| DR-4 | “项目相关 P1”的定义：由仓库内容/构建结果决定，对任何干净环境成立；开发者机器的 Flutter 用户配置/`JAVA_HOME`/PATH 现象不属于项目 P1 | §6 | **冻结** |
| DR-5 | Round 3 的 JDK 声明 = Historical evidence error；Round 4 的声明 = 证据可复现性缺口（在 `Administrator` 配置中准确）；两者均保留，不改写历史文件 | §5 | **冻结** |
| DR-6 | 新证据规则：声明作用域必须匹配证据作用域；涉及 Flutter/Java 的报告须附**环境身份块**；观察者不一致时并列记录 | §8 | **冻结** |
| DR-7 | `org.gradle.java.home` 写死绝对路径是项目可移植性缺陷（TD-3），**P2、不阻断**；解决方案待评估与验证 | §11 | **开放（方案）** |
| DR-8 | G0 PASS 仍由 Codex/HELIX 独立给出；本文不宣布 PASS | — | 冻结 |
| DR-9 | 不修改 `15`–`18` 及任何 Codex/HELIX/Trae 报告 | §5.3 | 冻结 |

### 未决 / 需独立验收者确认
1. **BC-8 第 3 项**：对 Gradle 实际使用的 JVM 做一次直接取证（目前为间接证据）。
2. HELIX 进程的 Flutter 用户配置身份（用户名、`APPDATA`）——用于确认第 2.3 节的推断；**不影响本文口径**。
