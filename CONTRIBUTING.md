# 🤝 贡献指南

story-cli 是一个**零依赖、Git 原生、AI 友好**的内容治理 CLI。在改动代码前，请先了解项目的定位哲学（见 [ROADMAP.md](ROADMAP.md)），确保改动与其一致。

## 🧰 开发环境

| 依赖    | 版本要求 | 说明                                        |
| ------- | -------- | ------------------------------------------- |
| Node.js | >= 24    | 开发时直接运行 `.ts`（原生 type stripping） |
| pnpm    | >= 9     | 包管理器（`corepack enable` 可启用）        |
| Git     | 任意     | 项目是 Git 原生工作流                       |

```bash
git clone https://github.com/yuelinghuashu/story-cli.git
cd story-cli
pnpm install
```

> ⚠️ 发布包运行于 Node >= 22（编译后的 `dist/`）；**开发**需要 Node 24+ 的原生 TS 支持。

## 🏃 常用命令

```bash
pnpm typecheck   # TypeScript 类型检查
pnpm lint        # biome 代码规范检查
pnpm lint:fix    # 自动修复可修复的规范问题
pnpm test        # 全量测试（node:test，并行）
pnpm build       # 编译到 dist/
make verify      # typecheck + lint + test + build 一键验证
make demo        # 在 ./demo/ 生成示例仓库（体验全流程）
```

## 🧪 测试约定

- 使用 Node 内置 `node:test` + `node:assert`（**零额外测试依赖**，保持项目哲学）
- 每个核心模块有独立测试文件（`tests/<module>.test.ts`）
- 行为变化必须有对应测试；新功能优先以单元测试覆盖纯逻辑
- CLI 级行为用 `spawnSync` 跑真实命令做集成测试（见 `tests/helpers.ts` 的 `runCli`）
- 提交前请保证 `pnpm test` 全绿（修改前先跑一遍确认基线）

## 💬 贡献方式

项目当前由单一维护者开发，**Issue 是主要的贡献渠道**：

- **反馈 bug / 提功能建议**：直接开 [Issue](https://github.com/yuelinghuashu/story-cli/issues)（有表单模板，按模板填写即可）
- **有意提交代码**：
  1. 先开 Issue 讨论方向（尤其新功能），确认与项目定位契合，避免做完不合拍
  2. 从 `main` 切分支：`git checkout -b feat/xxx` 或 `fix/xxx`，小步提交（消息用中文，参考现有历史）
  3. 同步文档：用户可见变更需更新 `CHANGELOG.md` / `CHANGELOG.en.md` 的 `[Unreleased]`；文档（README / docs/）中英文同步
  4. 跑完整验证：`pnpm typecheck && pnpm lint && pnpm test && pnpm build`
  5. 提交 PR，在描述中说明变更与验证结果

## 🧭 项目结构速览

```text
src/
├── cli.ts           # 命令分发入口
├── commands/        # 各 CLI 命令实现
├── core/            # 领域核心（扫描/加载/校验/统计/缓存）
├── render/          # 输出渲染（README/EPUB/Markdown→HTML）
├── mcp/             # MCP Server（AI 客户端接入）
├── utils/           # 纯工具
└── i18n/            # 中英文案
tests/               # node:test 测试
bench/               # 性能基准（generate.ts + bench.ts）
docs/                # 文档（全部中英双语）
```

> 💡 模块设计细节见 [docs/architecture.md](docs/architecture.md)；设计哲学见 [docs/design.md](docs/design.md)。

## ⚠️ 定位红线（改动评审重点）

- **零依赖**：运行时仅 `fflate` + `handlebars`；新功能不得引入运行时依赖
- **Git 原生**：不引入数据库 / 锁 / 服务端状态；破坏性操作遵循 Git 语义
- **Unix 哲学**：CLI 做原子能力，`--stdout` 输出原料，编排交给外部工具
- **双语**：用户可见文案走 `src/i18n/`（zh/en），文档保持双语同步
