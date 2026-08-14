# 🔄 GitHub Actions CI

story-cli 设计为「CI 友好」，可以无缝集成到 GitHub Actions 中。

本仓库自带完整的 CI 工作流：[`.github/workflows/build.yml`](../.github/workflows/build.yml)。

---

## 📦 自动构建

以下工作流会在每次 push 到 `main` 分支时自动运行：

```yaml
name: Build & Test
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install
      - name: Typecheck
        run: pnpm typecheck
      - name: Lint
        run: pnpm lint
      - name: Validate configs
        run: pnpm exec story build --validate-only
      - name: Build READMEs
        run: pnpm exec story build
      - name: Run tests
        run: pnpm test
      - name: Check git diff
        run: git diff --exit-code
```

---

## 📌 各步骤说明

| 步骤                          | 作用                                             |
| ----------------------------- | ------------------------------------------------ |
| `actions/checkout@v4`         | 检出仓库代码                                     |
| `pnpm/action-setup@v4`        | 安装 pnpm（需先在仓库根目录放置 `package.json`） |
| `actions/setup-node@v4`       | 配置 Node.js，指定版本并启用 pnpm 缓存           |
| `pnpm install`                | 安装依赖                                         |
| `pnpm typecheck`              | **类型检查**：验证 TypeScript 类型正确           |
| `pnpm lint`                   | **代码规范**：Biome 检查代码风格                 |
| `story build --validate-only` | **校验阶段**：仅检查配置合法性，不生成 README    |
| `story build`                 | **构建阶段**：生成所有故事 README + 根索引       |
| `pnpm test`                   | **测试阶段**：运行完整测试套件                   |
| `git diff --exit-code`        | **变更检测**：确保 README 与源码同步             |

---

## 🛡️ CI 的价值

1. **配置错误早发现** — `--validate-only` 在构建前先校验 config，配置错误直接失败，不会生成半成品
2. **README 自动更新** — 每次 push 自动重新生成 README，确保目录索引和章节字数始终最新
3. **质量保障** — 测试覆盖校验、渲染、EPUB、扫描等核心逻辑，防止回归

---

## 💡 进阶用法

### 使用 `--save-counts` 持久化字数

如果你的故事 `config.json` 中没有 `wordCount` 字段，可以显式保存：

```yaml
- run: story build --save-counts
- run: git diff --exit-code # 确保无未提交变更
```

这样字数会写回 `config.json`，并且 `git diff` 可以检测是否有需要提交的变更。

### 多分支构建

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
```

---

## ⚠️ 注意事项

- `actions/setup-node@v4` 中的 `node-version` 需要与 `package.json` 的 `engines.node` 保持一致（CI 直接运行源码测试需 Node 24+ 原生支持 `.ts`；发布运行时仅需 Node >= 20）
- 如果使用 npm 而非 pnpm，将 `cache: pnpm` 改为 `cache: npm`，`pnpm install` 改为 `npm install`
