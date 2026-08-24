# 贡献指南

## 环境准备

```bash
git clone https://github.com/AuroraX-UI/sunlab.git
cd sunlab
pnpm install
source .env.caches   # 加载外部缓存路径环境变量
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发模式（HMR） |
| `pnpm build` | 生产构建 |
| `pnpm test` | 运行单元测试 |
| `pnpm test:e2e` | 运行 E2E 测试 |
| `pnpm lint` | Biome 代码检查 |
| `pnpm format` | 自动格式化 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm verify` | 全量验证（提交前必须通过） |

## 提交规范

所有提交信息必须使用中文。格式：

```
<类型>: <中文摘要>

<正文：动机和上下文>
```

类型：`feat` / `fix` / `refactor` / `docs` / `style` / `test` / `chore`

## 分支命名

```
feat/<功能简述>     新功能
fix/<缺陷简述>      缺陷修复
refactor/<范围>     重构
docs/<主题>         文档
```

示例：`feat/ipc-bridge`、`fix/supervisor-timeout`

## PR 流程

1. 从 `main` 创建功能分支。
2. 完成开发和测试，确保 `pnpm verify` 通过。
3. 创建 PR，使用中文标题和描述。
4. 至少一人 Code Review 后合并（squash merge）。

## 代码规范

详细规则见 [AGENTS.md](./AGENTS.md)。核心要点：

- 所有注释、文档、提交信息使用中文。
- 变量和函数命名使用英文。
- TypeScript strict 模式，禁止 any。
- 使用 Biome 替代 ESLint + Prettier。
- 样式使用 Tailwind CSS v4，不引入 CSS-in-JS。
- 状态管理使用 Zustand + XState。

## 架构决策

重大技术选型变更需要先写 RFC 文档到 `docs/rfc/` 目录。
参考现有 RFC 了解格式和深度要求。
