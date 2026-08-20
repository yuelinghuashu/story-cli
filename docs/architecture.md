# 🔧 技术架构

了解本仓库的构建系统与模块设计。

---

## 🏗️ 模块设计

```text
Makefile                 # 开发工作流入口（make test / make build / make lint）
bin/
└── index.ts              # CLI 入口（仅调用 run）

src/
├── cli.ts               # 命令分发入口
├── args.ts              # 命令行参数解析（--key=value / --flag / 位置参数 + 命令切分）
│
├── commands/            # 独立 CLI 命令实现
│   ├── build.ts         # build 命令（含 watch 模式，异步并行加载）
│   ├── demo.ts          # demo 命令（生成示例仓库）
│   ├── epub.ts          # EPUB 导出命令
│   ├── export-html.ts   # export html 命令（i18n + 校验 + 错误处理）
│   ├── export-json.ts   # export json 命令（结构化 JSON 导出）
│   ├── export-md.ts     # export md 命令（合并 Markdown）
│   ├── export-txt.ts    # export txt 命令（纯文本导出）
│   ├── export-embeddings.ts # export embeddings 命令（文本块 JSONL）
│   ├── import-json.ts   # import json 命令（批量导入）
│   ├── init.ts          # 仓库初始化命令（三种模板）
│   ├── link.ts          # story link 命令（关联故事管理）
│   ├── mcp.ts           # MCP Server 启动命令
│   ├── new-story.ts     # story new 脚手架命令
│   ├── stats.ts         # story stats 创作统计命令
│   └── validate.ts      # story validate 合规检查命令
│
├── core/                # 故事管理的领域核心
│   ├── scanner.ts       # 扫描故事文件夹、.storyignore 规则、编码检测
│   ├── story-text.ts    # 故事正文读取与章节合并（text.md / chapter-*.md）
│   ├── content-parser.ts # 内容解析：章节切分、标题提取、字数统计
│   ├── sort.ts          # 系列分组与排序（series / seriesOrder 逻辑坐标排序）
│   ├── schema.ts        # 声明式校验规则（必填字段 / 枚举 / 格式）
│   ├── validate.ts      # 基于 schema 的通用校验引擎（支持仓库级覆盖）
│   ├── config.ts        # 仓库级配置（story.config.json 自定义枚举 + 本地化标签）
│   ├── loader.ts        # 故事加载器（loadStories，build 与 MCP 共享；useCache 增量加载）
│   ├── story-cache.ts   # 增量构建缓存（.story-cache.json：mtime+size 指纹 + 派生数据缓存）
│   ├── sequence.ts      # 序号管理（getNextNumber）
│   ├── exporter.ts      # 导出共享工具（forEachExportStory 等）
│   ├── story-loader.ts  # 单故事配置加载与校验
│   ├── compliance.ts    # 合规检查（story validate / MCP 共用）
│   ├── stats-shared.ts  # 统计计算（CLI stats / MCP 共用）
│   ├── watch-scheduler.ts # Watch 防抖/串行/排队调度器
│   ├── link-suggestion.ts # build 关联建议层（零写入）
│   └── types.ts         # 全局 TypeScript 类型定义
│
├── mcp/                 # MCP Server 适配层（AI 客户端连接）
│   ├── protocol.ts      # JSON-RPC 2.0 协议
│   ├── server.ts        # stdio 服务器
│   └── tools.ts         # MCP 工具注册
│
├── render/              # 渲染 / 输出
│   ├── readme.ts        # 生成故事 README 和根目录 README（模板驱动）
│   ├── template.ts      # Handlebars 模板渲染（带编译缓存）
│   ├── epub-generator.ts # EPUB 3 生成器（封面渲染/排版样式/NCX 兼容目录/系列元数据）
│   ├── epub-assets.ts   # 封面图片加载与安全校验
│   ├── md-to-html.ts    # Markdown → HTML 转换器
│   └── html-utils.ts    # 公共 HTML 工具
│
└── utils/               # 无副作用的纯工具
    ├── cli-utils.ts     # CLI 公共工具
    ├── constants.ts     # 常量定义（阈值/超时/路径/错误码）
    ├── encoding.ts      # UTF-8 / GBK 编码检测
    ├── error-handler.ts # 统一错误处理（normalizeError / ErrorCollector）
    ├── errors.ts        # 结构化错误（StoryError + 错误码）
    ├── json-utils.ts    # JSON 读取统一流程
    ├── paths.ts         # 路径解析
    ├── unicode.ts       # Unicode 文本工具（safeTail 等）
    ├── word-count.ts    # 语言感知的字数统计（含 parseWordCount 反向解析）
    └── phrase-frequency.ts # 极简依赖重复短语词频（中文 bigram / 英文单词）

tests/                   # node:test 测试（零额外测试依赖）
bench/                   # 基准测试（generate.ts 生成仓库 + bench.ts 测量性能）
templates/               # 脚手架模板（config + story README 模板）
```

> 💡 `src/i18n/`（`index.ts` / `zh.ts` / `en.ts`）是顶层目录，存放中英文案与 `getLocale` 等 i18n 工具。

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
    ├── Makefile.template   # 工作流入口（make new/commit/push/stats/analyze）
    ├── story.ps1.template  # Windows PowerShell 工作流入口（.\story.ps1）
    ├── README.md           # 初始说明
    ├── LICENSE             # --full 模式：CC BY-NC-SA 4.0
    ├── add-story.md        # --full 模式：如何新增故事
    └── CHANGELOG.md        # --full 模式：变更日志（含 {{DATE}}）
```

### 💡 项目根 Makefile（开发工作流）

项目根目录的 `Makefile` 是**开发者工作流入口**，使用 `make help` 查看全部命令：

```bash
make build       # 编译构建（tsc → dist/）
make test        # 运行全部测试（node:test）
make typecheck   # TypeScript 类型检查
make lint        # 代码规范检查（biome）
make lint-fix    # 自动修复代码规范
make format      # 格式化代码
make demo        # 生成示例故事仓库
```

CLI 的 `story init` 在用户仓库中生成的是**用户工作流 Makefile**（`make new` / `make commit` / `make push`）。项目根 Makefile 与用户模板 Makefile 是同一分层哲学的两个侧面——**原子能力 + 工作流编排**。

### 💡 自定义模板注意事项

`root-template.md` / `story-template.md` 使用 [Handlebars](https://handlebarsjs.com/) 模板引擎渲染。**Handlebars 会原样保留模板中的空行**，模板中的空行会直接反映到最终输出的 README：

- **每个 Markdown 段落之间应恰好保留一个空行** —— 多余的空行会让渲染出现间距不一致，过少则段落连在一起
- Handlebars 控制块（`{{#if}}` / `{{#each}}` / `{{else}}` / `{{/if}}`）本身不产生内容，但块标签前/后的空行会被保留——条件不满足或列表为空时，这些「泄漏空行」会导致输出出现多个连续空行
- **建议不要随意增删模板中的段落空行**。如果确实需要调整布局，修改后请运行 `story build` 检查输出效果，并通过 `git diff` 确认变更范围符合预期

### 📋 模板变量参考

#### 根 README 模板（root-template.md）

以下变量由 `src/render/readme.ts` 生成，可在根 README 模板中使用：

| 变量                                                | 类型    | 说明                                                         |
| --------------------------------------------------- | ------- | ------------------------------------------------------------ |
| `rootTitle`                                         | string  | 仓库标题                                                     |
| `rootStats`                                         | string  | 统计信息（故事数 / 总字数 / 最后更新日期）                   |
| `rootWelcome`                                       | string  | 欢迎文本                                                     |
| `tocLabel`                                          | string  | 目录区块标题                                                 |
| `tocStoryList`                                      | string  | 目录「故事列表」链接文本                                     |
| `tocHowToAdd`                                       | string  | 目录「如何新增故事」链接文本                                 |
| `tocArchitecture`                                   | string  | 目录「技术架构」链接文本                                     |
| `tocSponsor`                                        | string  | 目录「赞助支持」链接文本（`hasSponsor` 为 true 时显示）      |
| `tocLicense`                                        | string  | 目录「许可证」链接文本                                       |
| `storyListTitle`                                    | string  | 故事列表标题                                                 |
| `storyListHeader`                                   | string  | 故事列表表格表头（Markdown 表格第一行）                      |
| `storyListHint`                                     | string  | 故事列表提示文本                                             |
| `hasSeries`                                         | boolean | 是否存在系列分组（配合 `{{#if}}` 使用）                      |
| `seriesGroups`                                      | array   | 系列分组数组，结构为 `{ name: string, stories: StoryRow[] }` |
| `hasUngrouped`                                      | boolean | 是否存在独立故事                                             |
| `ungroupedStories`                                  | array   | 独立故事数组（`StoryRow[]` 结构）                            |
| `independentStoriesTitle`                           | string  | 独立故事区块标题                                             |
| `howToAddTitle`                                     | string  | 如何新增故事标题                                             |
| `howToAddDesc`                                      | string  | 如何新增故事描述                                             |
| `howToAddStep1` / `howToAddStep2` / `howToAddStep3` | string  | 如何新增故事的三步指引                                       |
| `architectureTitle`                                 | string  | 架构区块标题                                                 |
| `architectureDesc`                                  | string  | 架构描述文本                                                 |
| `hasSponsor`                                        | boolean | 是否有赞助图片（`assets/sponsor/` 中存在图片为 true）        |
| `sponsorTitle`                                      | string  | 赞助区块标题                                                 |
| `sponsorSummary`                                    | string  | 赞助折叠摘要                                                 |
| `sponsorImages`                                     | array   | 赞助图片数组，结构为 `{ src: string, alt: string }`          |
| `licenseTitle`                                      | string  | 许可证标题                                                   |
| `licenseOriginal`                                   | string  | 原创故事许可证说明                                           |
| `licenseFanfic`                                     | string  | 二创故事许可证说明                                           |
| `autoGenerated`                                     | string  | 自动生成声明                                                 |

**StoryRow 结构**（`seriesGroups[].stories` 和 `ungroupedStories` 中的元素）：

| 字段            | 类型   | 说明                            |
| --------------- | ------ | ------------------------------- |
| `num`           | string | 全局序号（如 `01`、`02`）       |
| `folder`        | string | 故事文件夹名                    |
| `title`         | string | 故事标题                        |
| `typeDisplay`   | string | 本地化类型文本                  |
| `wordCount`     | string | 格式化字数                      |
| `statusDisplay` | string | 本地化状态文本                  |
| `summary`       | string | 单行简介（自动截断到 120 字符） |

#### 故事 README 模板（story-template.md）

以下变量由 `src/commands/build.ts` 生成，可在故事 README 模板中使用：

| 变量                | 类型   | 说明                                                    |
| ------------------- | ------ | ------------------------------------------------------- |
| `title`             | string | 故事标题                                                |
| `type`              | string | 故事类型代码（`original` / `fanfic` / 自定义）          |
| `status`            | string | 故事状态代码（`completed` / `ongoing` / 自定义）        |
| `summary`           | string | 故事简介                                                |
| `created`           | string | 创建日期（`YYYY-MM-DD`）                                |
| `language`          | string | 语言（`zh` / `en`）                                     |
| `author`            | string | 作者（可选）                                            |
| `originalWork`      | string | 原作名称（fanfic 可选）                                 |
| `originalAuthor`    | string | 原作者（fanfic 可选）                                   |
| `wordCount`         | string | 格式化字数                                              |
| `cover`             | string | 封面路径（可选）                                        |
| `series`            | string | 系列名称（可选）                                        |
| `seriesOrder`       | number | 系列内排序键（可选）                                    |
| `volume`            | string | 卷/册名称（可选）                                       |
| `typeDisplay`       | string | 本地化类型文本                                          |
| `statusDisplay`     | string | 本地化状态文本                                          |
| `chapters`          | array  | 章节列表，结构为 `{ title: string, wordCount: string }` |
| `backToStoryList`   | string | 返回列表链接文本                                        |
| `seriesLabel`       | string | 系列标签文本                                            |
| `basicInfoTitle`    | string | 基本信息标题                                            |
| `typeLabel`         | string | 类型标签                                                |
| `wordCountLabel`    | string | 字数标签                                                |
| `statusLabel`       | string | 状态标签                                                |
| `createDateLabel`   | string | 发布日期标签                                            |
| `summaryTitle`      | string | 简介标题                                                |
| `readingGuideTitle` | string | 阅读指引标题                                            |
| `textFileLabel`     | string | 正文文件标签                                            |
| `chaptersTitle`     | string | 章节列表标题                                            |
| `licenseTitle`      | string | 许可证标题                                              |
| `licenseText`       | string | 许可证正文（已根据故事类型选择版本）                    |
| `licenseNote`       | string | 二创许可证附加说明（fanfic 时非空）                     |
| `autoGenerated`     | string | 自动生成声明                                            |

#### 模板中可用的条件判断

模板使用 [Handlebars](https://handlebarsjs.com/) 语法，支持以下条件：

```handlebars
{{#if hasSponsor}}   <!-- 布尔值条件 -->
{{#if series}}       <!-- 字符串存在性 -->
{{#each chapters}}   <!-- 数组遍历 -->
{{#if (eq lang "en")}}  <!-- 字符串等值比较（内置 eq helper） -->
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

### 2. 系列分组与排序（sort.ts）

> 设计理念（「物理坐标 vs 逻辑坐标」的动机与获益）详见 [design.md](../docs/design.md#🧮-分数索引物理坐标与逻辑坐标的分离)。此处只说明实现细节。

`sort.ts` 实现了 `series` / `seriesOrder` 逻辑坐标排序：

- **逻辑坐标**：`config.json` 中的 `series` / `seriesOrder` 控制 README 展示顺序，`seriesOrder` 支持小数（分数索引）
- **组内排序**：`seriesOrder` 数值升序，缺失时回退文件夹序号
- **组间排序**：按组内最小文件夹序号，组名作为二级键保证确定性
- 未配置 `series` 的故事归入「独立故事」，按文件夹序号排序

### 3. 语言感知（i18n.ts + word-count.ts）

- 每个故事在 `config.json` 中声明 `language`（`zh` / `en`）
- `resolveLang` 统一解析，`formatType` / `formatStatus` 根据语言映射显示文本
- 仓库级配置支持通过 `typeLabels` / `statusLabels` 为自定义枚举配置中英文标签
- 根 README 语言根据所有故事的语言自动决定（全部英文则用英文，否则中文）
- 字数统计：中文按汉字计数，英文按单词计数

### 4. 公共 HTML 工具（html-utils.ts）

`html-utils.ts` 集中管理跨模块共享的 HTML 相关工具，避免重复实现：

- `escapeHtml` — HTML 特殊字符转义（export-html / epub-generator 共享）
- `sanitizeUrl` — 危险 URL 协议过滤（XSS 防护：`javascript:`、`vbscript:`、`data:text/html` 被拦截）
- `PAGE_STYLE` — 通用页面样式常量（export-html 使用）
- `readConfigTitle` — 读取故事 config 的标题（epub 命令定位目标时使用）

### 5. 零构建运行时（bin/index.ts）

```ts
#!/usr/bin/env node
import { run } from "../src/cli.ts"
run(process.argv)
```

发布包为编译后的 `dist/` 产物（兼容 Node 22+ 运行）。开发时直接运行 `.ts` 源码需要 Node.js 24+ 的原生 TypeScript type stripping。这也是 `engines.node >= 22`（发布运行时）的原因。

### 6. 创作统计（stats.ts）

`story stats` 提供创作数据分析，与 `git status` 的「文件变更视角」形成互补：

- **故事统计**：故事总数、完成/连载状态分布、总字数、章节数
- **系列进度**：每个系列的部数 + 完成率（按 `status` 字段）
- **健康度检查**：config 中 `wordCount` 与实际差距 >20% 警告（`stale-word-count`）
- **重复短语**：`analysis.repeated` 输出全局 top 10 重复短语（中文 bigram / 英文单词）
- **写作活跃度**：通过 `git log --numstat` 统计本月/上月新增行数（近似字数），仅统计故事文件夹内文件
- **`--json` 输出**：结构化数据，支持管道消费

### 7. EPUB 生成（epub-generator.ts）

EPUB 本质是一个 ZIP 包，本项目直接生成符合 EPUB 3 规范的文件结构（含 EPUB2 兼容层）：

```text
├── mimetype              ← 必须第一个且不压缩（STORE 模式）
├── META-INF/container.xml
└── OEBPS/
    ├── content.opf       ← 元数据 + spine 清单（日期/版权/系列）
    ├── toc.xhtml         ← EPUB3 nav 目录导航
    ├── toc.ncx           ← EPUB2 兼容目录（Kindle/旧 ADE）
    ├── styles.css        ← 内置排版样式（--css 可自定义）
    ├── chapterN.xhtml    ← 各章节
    ├── titlepage.xhtml   ← 标题页（封面图居中渲染）
    └── images/           ← 嵌入的图片
```

**特点**：

- 运行时依赖仅 `fflate`（ZIP 打包）和 `handlebars`（模板渲染）
- Markdown → HTML 转换器支持表格、嵌套列表、代码块等
- 图片路径支持绝对路径 / 相对故事文件夹 / 相对项目根目录
- 封面通过 `properties="cover-image"` 标记（老阅读器识别）并渲染到标题页
- 内置排版样式表（`--css=<path>` 可整体替换），NCX 兼容目录保证老阅读器可用
- 系列元数据（`belongs-to-collection` + `group-position`）支持书架系列归组

### 8. 结构化错误处理（errors.ts）

CLI 工具的错误信息需要**机器可读**和**人类可读**兼顾。`StoryError` 提供了这种结构化设计：

```ts
class StoryError extends Error {
  code: ErrorCodeValue // 机器可读错误码（如 "CONFIG_PARSE"）
  context: Record<string, unknown> // 结构化上下文（故事文件夹名等）
}
```

**错误码一览**：

| 错误码            | 触发场景                             | 示例修复                    |
| ----------------- | ------------------------------------ | --------------------------- |
| `CONFIG_MISSING`  | 故事文件夹缺少 `config.json`         | 运行 `story new` 或手动创建 |
| `CONFIG_PARSE`    | `config.json` 不是合法 JSON          | 检查文件是否有语法错误      |
| `CONFIG_INVALID`  | 配置校验失败（如缺少必填字段）       | 查看错误消息中的具体字段    |
| `STORY_NOT_FOUND` | `story epub "标题"` 找不到匹配故事   | 检查标题是否与文件夹名匹配  |
| `EMPTY_CONTENT`   | EPUB 导出时正文为空                  | 在 `text.md` 中写入内容     |
| `EPUB_EXPORT`     | EPUB 生成过程中出错                  | 查看错误消息详情            |
| `IMAGE_MISSING`   | 图片路径指向不存在的文件             | 检查图片路径是否正确        |
| `IMAGE_READ`      | 图片文件读取失败                     | 检查文件权限                |
| `INVALID_ARGS`    | 命令行参数无效（如 `epub` 缺少标题） | 查看帮助：`story help`      |
| `WATCH_ERROR`     | Watch 模式运行出错                   | 检查文件系统权限            |

**设计原则**：

- CLI 入口（`cli.ts`）统一捕获异常并通过 `formatError` 格式化输出
- `context` 提供机器可读的附件信息（如 `{ folder: "01-故事名" }`），便于自动化工具解析
- 配置校验错误使用 `ValidationIssue[]`（结构化问题列表），而非拼接字符串
- `DEBUG` 环境变量开启时输出完整堆栈，默认只显示用户友好的错误消息

### 9. 增量构建缓存（story-cache.ts）

`story build` 每次全量重建时，对每个故事都要重新读取正文 + 字数统计 + 章节切分。`story-cache.ts` 用仓库根目录的 `.story-cache.json`（Git 忽略）记录每个故事 `StoryData` 派生字段的指纹，命中时直接复用：

- **指纹** = config（规范化对象序列化）+ 正文来源（`text.md` 的 mtime + size，仅 stat 不读内容）+ 仓库级配置；任一部分变化即失效
- **只读优化**：缓存命中时 `story.content` 为空串——build 路径的 README 渲染与关联建议都不依赖正文；MCP / watch 路径默认不启用缓存
- **正确性边界**：仅缓存 `text.md` 来源的故事（多章节合并故事每次完整读取，保证 build 物化 `text.md` 的副作用不丢失）；CLI 升级或 `story.config.json` 变化整体失效；缓存读取 / 写入失败一律静默降级为全量构建
- **配套优化**：`suggestLinks` 关联建议改为按 `series` 分桶后桶内两两比较，消除大规模仓库下 O(n²) 全量配对

实测（100 篇 × 1MB 长篇小说仓库）：冷构建 ~4.3s → 热构建 ~0.2s（约 22×）。

> 💡 `.story-cache.json` 是纯缓存，删除即回到全量构建，无残留风险。`story init` 新仓库的 `.gitignore` 已包含该文件；**升级前创建的老仓库**请手动在 `.gitignore` 中追加一行 `.story-cache.json`，避免缓存文件出现在 `git status` 中。

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
- 关键行为测试：扫描、排序、校验、渲染、字数统计、i18n、README 生成、EPUB 导出、仓库配置、CLI 命令
- 代码规范：`@biomejs/biome` 统一 lint + format

### 📊 性能基准

使用 `bench/generate.ts` 生成基准仓库后运行 `bench/bench.ts` 测量：

**基准仓库规模**（2000 个故事）：

| 维度         | 数值                                |
| ------------ | ----------------------------------- |
| 故事数       | 2,000                               |
| 章节总数     | ~12,000                             |
| 统计数据字数 | ~84,000 字                          |
| 源文件总量   | ~1.4 MB（不含导出产物）             |
| 文件总数     | ~10,000                             |
| 单个故事平均 | text.md ~828 B + config.json ~618 B |

**测试结果**（当前开发机，以 `node bench/generate.ts 2000` 生成的仓库测量）：

| 操作                      | 耗时    |
| ------------------------- | ------- |
| `build --validate-only`   | ~510 ms |
| `build`（全量，冷缓存）   | ~870 ms |
| `build`（全量，命中缓存） | ~770 ms |
| `export json`             | ~260 ms |
| `export md`               | ~330 ms |
| `epub --all`              | ~1.7 s  |

> 玩具体量故事（数百字节/篇）下字数统计占比很小，冷/热构建差异不明显；增量缓存的收益主要体现在**真实体量**的仓库上。

**增量缓存收益**（贴近真实体量：100 篇 × 1MB 长篇小说仓库）：

| 场景                         | 耗时   |
| ---------------------------- | ------ |
| 冷构建（首次，含建缓存）     | ~4.3 s |
| 热构建（第二次起，命中缓存） | ~0.2 s |

**Watch 增量重建**：单故事变更检测 + rebuild 总耗时约 **304 ms**（含 300ms debounce，实际重建约 4ms）。

> ⚠️ 性能数据依赖硬件环境，以上结果为当前开发机上的参考值。
>
> 💡 自行复现：`node bench/generate.ts 2000 <目录>` + `node bench/bench.ts <目录>`（`bench.ts` 会输出冷 / 热构建对比行）
