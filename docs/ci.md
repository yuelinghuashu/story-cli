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
      - name: Build package
        run: pnpm build
      - name: Run tests
        run: pnpm test
```

---

## 📌 各步骤说明

| 步骤                    | 作用                                             |
| ----------------------- | ------------------------------------------------ |
| `actions/checkout@v4`   | 检出仓库代码                                     |
| `pnpm/action-setup@v4`  | 安装 pnpm（需先在仓库根目录放置 `package.json`） |
| `actions/setup-node@v4` | 配置 Node.js，指定版本并启用 pnpm 缓存           |
| `pnpm install`          | 安装依赖                                         |
| `pnpm typecheck`        | **类型检查**：验证 TypeScript 类型正确           |
| `pnpm lint`             | **代码规范**：Biome 检查代码风格                 |
| `pnpm build`            | **编译阶段**：TypeScript 编译为 `dist/`          |
| `pnpm test`             | **测试阶段**：运行完整测试套件                   |

---

## 🛡️ CI 的价值

1. **类型安全** — `tsc --noEmit` 确保 TypeScript 类型正确
2. **代码规范** — Biome 统一 lint + format，保证代码风格一致
3. **质量保障** — 175 项测试覆盖扫描、校验、渲染、EPUB、CLI 等核心逻辑，防止回归

---

## 💡 进阶用法

### 在故事仓库中使用 story-cli

story-cli 的源码仓库**不是故事仓库**，因此 CI 中不会运行 `story build`。如果要在你的**故事仓库**中集成 CI，可参考：

```yaml
- name: Validate configs
  run: node dist/bin/index.js build --validate-only

- name: Build READMEs
  run: node dist/bin/index.js build
```

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
