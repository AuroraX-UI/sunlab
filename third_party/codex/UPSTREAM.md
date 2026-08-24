# Upstream

- 仓库：https://github.com/openai/codex
- 当前基线 tag：见 `base-tag.txt`
- 许可证：Apache-2.0
- 同步频率：至少每两周；CI 每 6 小时检测新 tag

## Remote 配置

```bash
git remote add upstream https://github.com/openai/codex.git
git fetch upstream --tags
```

## 版本选择策略

优先跟随上游最新 stable release tag。如果 stable tag 存在已知安全漏洞或关键 bug，
可以选择紧邻的 patch release 或 main 分支的 hotfix commit（必须在 DEVIATIONS.md 中说明）。
