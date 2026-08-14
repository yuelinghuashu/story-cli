# 🔧 技术架构

了解本仓库的构建系统与模块设计。

---

## 🏗️ 模块设计

```text
bin/
└── index.ts              # CLI 入口（仅调用 run）

src/
├── cli.ts               # 命令分发入口
├── args.ts              # 命令行参数解析（--key=value / --flag / 位置参数 + 命令切分）
│
├── commands/            # 独立 CLI 命令实现
│   ├── build.ts         # build 命令（含 watch 模式，异步并行加载）
│   ├── epub.ts          # EPUB 导出命令
│   ├── export-html.ts   # export html 命令（i18n + 校验 + 错误处理）
│   ├── export-txt.ts    # export txt 命令（纯文本导出）
│   ├── init.ts          # 仓库初始化命令
│   └── new-story.ts     # story new 脚手架命令
│
├── core/                # 故事管理的领域核心
│   ├── scanner.ts       # 扫描故事文件夹、读取正文、提取章节（含异步版本）
│   ├── schema.ts        # 声明式校验规则（必填字段 / 枚举 / 格式）
│   ├── validate.ts      # 基于 schema 的通用校验引擎（支持仓库级覆盖）
│   ├── config.ts        # 仓库级配置（story.config.json 自定义枚举 + 本地化标签）
│   └── types.ts         # 全局 TypeScript 类型定义
│
├── render/              # 渲染 / 输出
│   ├── readme.ts        # 生成故事 README 和根目录 README（模板驱动）
│   ├── template.ts      # Handlebars 模板渲染（带编译缓存）
│   ├── epub-generator.ts # 最小合规 EPUB 3 生成器 + Markdown → HTML
│   └── html-utils.ts    # 公共 HTML 工具（escapeHtml / sanitizeUrl / PAGE_STYLE / readStoryTitle）
│
└── utils/               # 无副作用的纯工具
    ├── cli-utils.ts     # CLI 公共工具（detectCliLang / sanitizeFileName）
    ├── i18n.ts          # 中英文文案
    ├── errors.ts        # 结构化错误（带错误码 + 上下文）
    └── word-count.ts    # 语言感知的字数统计

tests/                   # node:test 测试（零额外测试依赖）
templates/               # 脚手架模板（config + story README 模板）
```

`templates/` 目录结构：

```text
templates/
├── config.fanfic.json      # 二创故事配置模板
├── config.original.json    # 原创故事配置模板
├── root-template.md        # 根 README 的 Handlebars 模板
├── story-template.md       # 故事 README 的 Handlebars 模板
├── story.config.json       # 仓库级配置模板
└── scaffold/               # story init 脚手架模板
    ├── .gitignore.template # 忽略规则（npm 排除 .gitignore，故用此名称）
    ├── README.md           # 初始说明
    ├── LICENSE             # --full 模式：CC BY-NC-SA 4.0
    ├── add-story.md        # --full 模式：如何新增故事
    └── CHANGELOG.md        # --full 模式：变更日志（含 {{DATE}}）
```

---

## 🎯 核心设计思路

### 1. 声明式校验（schema.ts）

所有配置校验规则集中在 `schema.ts` 中描述，`validate.ts` 只负责通用执行：

```ts
// schema.ts — 只需新增一条描述，即可获得完整校验
export const FIELD_RULES: Record<string, FieldRule> = {
  title: { type: "string" },
  type: { type: "string", enum: VALID_TYPES },
  created: { type: "string", pattern: DATE_PATTERN },
  // ...
}
```

**好处**：新增字段无需修改校验引擎逻辑，降低了维护成本。

### 2. 语言感知（i18n.ts + word-count.ts）

- 每个故事在 `config.json` 中声明 `language`（`zh` / `en`）
- `resolveLang` 统一解析，`formatType` / `formatStatus` 根据语言映射显示文本
- 仓库级配置支持通过 `typeLabels` / `statusLabels` 为自定义枚举配置中英文标签
- 根 README 语言根据所有故事的语言自动决定（全部英文则用英文，否则中文）
- 字数统计：中文按汉字计数，英文按单词计数

### 3. 公共 HTML 工具（html-utils.ts）

`html-utils.ts` 集中管理跨模块共享的 HTML 相关工具，避免重复实现：

- `escapeHtml` — HTML 特殊字符转义（export-html / epub-generator 共享）
- `sanitizeUrl` — 危险 URL 协议过滤（XSS 防护：`javascript:`、`vbscript:`、`data:text/html` 被拦截）
- `PAGE_STYLE` — 通用页面样式常量（export-html 使用）
- `readStoryTitle` — 读取故事标题（export-html 使用）

### 4. 零构建运行时（bin/index.ts）

```ts
#!/usr/bin/env node
import { run } from "../src/cli.ts"
run(process.argv)
```

发布包为编译后的 `dist/` 产物（兼容 Node 20 运行）。开发时直接运行 `.ts` 源码需要 Node.js 24+ 的原生 TypeScript type stripping。这也是 `engines.node >= 20`（发布运行时）的原因。

### 5. EPUB 最小合规生成（epub-generator.ts）

EPUB 本质是一个 ZIP 包，本项目直接生成符合 EPUB 3 规范的文件结构：

```text
├── mimetype              ← 必须第一个且不压缩（STORE 模式）
├── META-INF/container.xml
└── OEBPS/
    ├── content.opf       ← 元数据 + spine 清单
    ├── toc.xhtml         ← 目录导航
    ├── chapterN.xhtml    ← 各章节
    └── images/           ← 嵌入的图片
```

**特点**：

- 运行时依赖仅 `fflate`（ZIP 打包）和 `handlebars`（模板渲染）
- Markdown → HTML 转换器支持表格、嵌套列表、代码块等
- 图片路径支持绝对路径 / 相对故事文件夹 / 相对项目根目录

---

## 📦 依赖清单

| 依赖             | 类型   | 用途                       |
| ---------------- | ------ | -------------------------- |
| `fflate`         | 运行时 | EPUB ZIP 打包              |
| `handlebars`     | 运行时 | README 模板渲染            |
| `typescript`     | 开发   | 类型检查（`tsc --noEmit`） |
| `@types/node`    | 开发   | Node.js 类型定义           |
| `@biomejs/biome` | 开发   | 代码规范（lint + format）  |

**零测试框架依赖**：测试使用 Node.js 内置的 `node:test`。

---

## 🧪 测试策略

- 使用 `node:test` + `node:assert`（零额外依赖）
- 每个核心模块都有独立测试文件
- CLI 入口通过 `execFileSync` 运行真实命令进行集成测试
- 关键行为测试：扫描、校验、渲染、字数统计、i18n、README 生成、EPUB 导出、仓库配置、CLI 命令
- 代码规范：`@biomejs/biome` 统一 lint + format
