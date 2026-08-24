# ADR 0006: Codex App-Server 受控 Fork 策略

- 状态：Accepted
- 日期：2026-08-24
- 取代：RFC 0004 §3.1–§3.2 中的「上游优先、不轻易 fork」默认策略
- 影响范围：`third_party/codex/`、CI 上游同步流水线、协议兼容性门禁

## 1. 决策

Sunlab Desktop 采用 **Layer 3 受控 fork** 作为 Codex App-Server 的二次开发策略。

核心原则：
1. 维护自己的 `codex` fork 分支（`sunlab/main`）。
2. 所有 Sunlab 定制代码放在独立模块或目录中，不内联修改上游文件。
3. 定期（至少每两周）同步上游最新 stable tag。
4. 每一处偏离必须在 `DEVIATIONS.md` 中登记。
5. CI 自动检测上游新 tag 并触发合并 + 兼容性测试。

## 2. 为什么从「上游优先」切换到受控 fork

### 2.1 Patch-only 的结构性缺陷

| 问题 | 影响 |
|------|------|
| 行号级 diff 脆弱 | 上游改动靠近 patch 区域时冲突解决成本指数增长 |
| AI 辅助开发受限 | 模型无法从散落的 patch 文件建立完整心智模型 |
| 无模块边界 | patch 之间可能存在隐式依赖，难以独立测试 |
| 审计困难 | 无法一眼看出当前 fork 相对上游的完整差异面 |

### 2.2 受控 fork 的优势

| 优势 | 说明 |
|------|------|
| 模块化偏离 | 所有修改集中在 `sunlab/` 子目录，Git diff 一目了然 |
| AI 可理解性 | 完整源码树 + 清晰的自定义目录 -> 模型可以建立准确上下文 |
| 可测试性 | 每个 deviation 有独立测试，不依赖其他 patch 的应用顺序 |
| 上游同步可预测 | Git merge 冲突集中在明确文件，而非行号碎片 |

## 3. Fork 目录结构

```text
third_party/codex/
├── README.md                  # 快速上手指南
├── UPSTREAM.md                # 上游仓库地址和版本策略
├── DEVIATIONS.md              # 所有偏离登记表
├── base-tag.txt               # 当前基于的上游 tag（如 rust-v0.42.0）
├── sunlab/                    # 所有 Sunlab 定制代码
│   ├── mod.rs                 # 或 lib.rs：Sunlab 扩展入口
│   ├── middleware/            # 协议中间件
│   ├── plugins/               # 内置插件
│   └── telemetry/             # 遥测与审计
├── scripts/
│   ├── sync-upstream.sh       # 同步上游并生成报告
│   ├── check-deviations.sh    # 验证 DEVIATIONS.md 完整性
│   └── build.sh               # 构建 Sunlab 定制版 app-server
└── tests/
    ├── deviations/            # 每个 deviation 的集成测试
    └── upstream-compat/       # 上游兼容性回归测试
```

## 4. 偏离登记规则

每个 deviation 必须在 `DEVIATIONS.md` 中包含：

```markdown
### DEV-001: 标题

- **类型**：新增 / 修改 / 移除
- **文件**：`sunlab/middleware/tracker.rs`
- **动机**：一句话说明
- **上游状态**：未提交 / 已提 PR / 已被上游接受
- **移除条件**：什么情况下可以删掉这个偏离
- **Owner**：负责人或团队
- **最后审查**：YYYY-MM-DD
```

强制规则：

1. 禁止在上游原始文件中做任何修改。所有新逻辑 MUST 放在 `sunlab/` 目录下。
2. 如果必须修改上游文件（如添加 `mod sunlab;` 声明），该修改 MUST 在 `DEVIATIONS.md` 中标记为类型「修改」。
3. 对上游文件的修改行数 SHOULD 不超过 10 行；超过则触发架构评审。
4. 每个 deviation MUST 有对应的集成测试放在 `tests/deviations/` 下。
5. 每 90 天审查一次所有 deviation，移除不再需要的项。

## 5. 上游同步流程

### 5.1 自动检测

CI 定时任务（建议每 6 小时）执行：

```bash
git fetch upstream --tags
latest_tag=$(git describe --tags --abbrev=0 upstream/latest)
current_tag=$(cat third_party/codex/base-tag.txt)
if [ "$latest_tag" != "$current_tag" ]; then
  echo "New upstream tag available: $latest_tag"
fi
```

### 5.2 合并流程

```bash
cd third_party/codex
./scripts/sync-upstream.sh
```

脚本执行以下步骤：

1. Fetch upstream tags。
2. 比较 `base-tag.txt` 与最新 stable tag。
3. 创建 `sync/<new-tag>` 分支。
4. Merge upstream tag into current branch。
5. 运行 `check-deviations.sh` 确认所有 deviation 文件仍然存在。
6. 运行完整测试套件。
7. 更新 `base-tag.txt`。
8. 生成 `sync-report.md` 列出变更文件、冲突和测试结果。

### 5.3 合并失败处理

如果 merge 产生冲突：

1. 冲突文件如果是上游原始文件 -> 接受上游版本，然后在 `sunlab/` 目录中重新适配。
2. 冲突文件如果在 `sunlab/` 目录 -> 说明上游删除了某个接口，需要更新对应 deviation。
3. 解决冲突后必须重新运行完整测试套件。
4. 在 `DEVIATIONS.md` 中记录本次适配的原因和方法。

## 6. 构建与分发

Sunlab Desktop 捆绑自己构建的 codex 二进制：

```text
resources/runtime/codex/<target-triple>/<version>/codex
resources/runtime/codex/<target-triple>/<version>/VERSION
resources/runtime/codex/<target-triple>/<version>/SHA256SUMS
```

VERSION 文件格式：

```text
upstream=<tag>
sunlab=<build-number>
deviations=<count>
```

About 页显示 `Codex Engine (Sunlab Fork) <upstream>+<sunlab>`。

## 7. 安全约束

无论 fork 多深，以下红线不可越过：

1. 不得绕过用户审批流程。
2. 不得在未经用户知情的情况下上传本地文件。
3. 不得移除沙箱边界检查。
4. 不得将 API key 写入日志或遥测数据。
5. 所有安全相关修改必须单独评审。

## 8. 退出条件

如果出现以下情况，应重新评估本策略：

1. DEVIATIONS.md 条目超过 20 个且无法减少。
2. 上游连续 3 个 major 版本与 Sunlab fork 出现不可调和的架构分歧。
3. 上游项目停止维护或转向闭源。
4. 维护 fork 的人力成本超过自研 Agent runtime 的成本。

此时应考虑回归 Layer 0/1（纯客户端扩展）或完全自研 Agent runtime。

## 9. 与现有 RFC 的关系

| RFC | 变更 |
|-----|------|
| RFC 0004 §3.1–§3.2 | 关系定位从外部运行时改为受控 fork 运行时 |
| RFC 0004 §3.8 | 二次开发顺序简化为直接在 fork 中实现 |
| RFC 0004 §3.9 | Downstream patch 治理升级为受控 fork 治理 |
| RFC 0004 §3.10 | Upstream contribution 仍保留但不再是主要路径 |
| RFC 0001–0003 | 不变；客户端架构不受影响 |
