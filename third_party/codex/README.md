# Sunlab Codex Fork

这是 `openai/codex` 的受控 fork，用于 Sunlab Desktop 的定制 Agent 运行时。

## 快速上手

1. 阅读 [DEVIATIONS.md](./DEVIATIONS.md) 了解当前偏离列表。
2. 所有新代码放在 `sunlab/` 目录下，不修改上游原始文件。
3. 同步上游：`./scripts/sync-upstream.sh`
4. 检查偏离完整性：`./scripts/check-deviations.sh`

## 目录结构

```text
sunlab/          Sunlab 定制代码（唯一允许新增逻辑的地方）
scripts/         同步、检查和构建脚本
tests/           偏离测试和上游兼容性测试
```

## 规则速查

- 新增逻辑 → `sunlab/`
- 修改上游文件 → 必须登记 DEVIATIONS.md，且不超过 10 行
- 安全相关修改 → 单独评审
- 每 90 天审查 deviation 列表

详见 [ADR 0006](../../docs/rfc/0006-controlled-fork-strategy.md)。
