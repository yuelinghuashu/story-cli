# Changelog

本项目遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.3.0] - 2026-08-16

### 新增

- **`story export md --stdout`**：Markdown 导出支持标准输出（管道友好），多故事用 `<!-- story-separator -->` 分隔拼接
- **`story export txt --stdout`**：纯文本导出支持标准输出（管道友好），每个故事前自动插入标题行，多故事用分隔符拼接
- **MCP Server（`story mcp-server`）**：AI 时代的战略入口，通过 JSON-RPC 2.0 over stdio 协议暴露 6 个工具（`scan_stories` / `read_chapter` / `write_chapter` / `import_json` / `validate` / `build`），零新增运行时依赖，复用 `core/loader.ts` 共享逻辑。支持 Claude Desktop / Cursor 等 MCP 客户端连接。
- **MCP 文档**：新增 `docs/mcp.md` / `docs/mcp.en.md`，包含 Claude Desktop / Cursor 连接配置与示例对话。
- **`stats --json` 增强**：每个故事新增 `chapters`（章节明细）、`paragraphs`（段落数）、`dialogues`（对话数）字段，为 `make analyze` 提供原料；Makefile 新增 `analyze` target（需 jq）。

### 改进

- **工具链组合**：`docs/export.md` 新增「工具链组合」章节，展示与 yq / jq / pandoc / wkhtmltopdf 等外部工具的管道组合用法
- **Help 输出更新**：`story help` 增加 `export md/txt/json --stdout` 管道用法说明
- **构建与导出模块重组**（为 MCP Server / 插件系统铺垫）：
  - `build.ts`（485 行 → 259 行）：`loadStories` / `loadStoryConfigAsync` / `loadStoryContentAsync` / `buildStoryData` 抽取至 `core/loader.ts`，保留 README 渲染与命令编排
  - `core/sequence.ts` 新建：`getNextNumber` 去重（`new-story.ts` 与 `import-json.ts` 共用，统一使用 `scanStoryFolders`，正确排除基础设施目录与 `.storyignore`）
  - `core/exporter.ts` 新建：导出公共的 `resolveExportOptions` / `loadExportOverrides` / `loadExportRepoConfig` / `resolveOutputDir`，消除四个 export 命令重复的参数解析与配置加载模板代码
  - `render/epub-assets.ts` 新建：封面图片加载从 `epub.ts`（434 行 → 394 行）抽离，与 `epub-generator.ts` 职责分离

### 测试

- 新增 `--stdout` 测试：`export md --stdout`（多故事分隔符/不落盘）、`export txt --stdout`（标题行/分隔符/不落盘）
- 新增单元测试：`sanitizeFileName`（6 项：非法字符/连续空格/超长截断/Unicode）、`extractNumericWordCount`（7 项：千字/万字/K words/小数/无法解析）、`renderTemplate` 缓存失效（2 项：mtime 变化重新编译/未变化使用缓存）
- 新增 MCP 协议/工具测试（14 项）：JSON-RPC 解析/序列化、工具注册、`scan_stories` / `read_chapter` / `write_chapter`（原子写入）/ `import_json`（批量导入）/ `validate`
- 302 项测试运行，299 项通过（+29）

<details>
<summary>## [1.2.0] - 2026-08-15</summary>

### 新增

- **`story demo` 命令**：一键生成完整示例故事仓库
- **`story stats` 命令**：创作数据统计（字数/系列进度/活跃度，支持 `--json`）
- **Makefile 工作流**：`story init` 默认生成 `make new/build/commit/push` 与 Windows `story.ps1`
- **`story export json --stdout`**：JSON 导出支持标准输出（管道友好）
- **基准测试**：`bench/` 脚本可生成大规模仓库并测量性能
- **Watch 增量重建**：单故事变更只重建该故事 README，不再全量重建
- **分卷 EPUB 导出**：`story epub --split-by-volume` 按 `volume` 字段切分
- **UTF-8 编码检测**：读取文件时检测 GBK/GB2312 等非 UTF-8 编码并输出警告（不阻断构建，零新依赖）
- **README 对比场景区块**：「为什么用 story-cli？」与网文软件对比表

### 修复

- EPUB 封面警告国际化
- 消除 `build.ts` 不安全类型断言
- 消除 shell 注入风险（`execSync` → `execFileSync`）

### 改进

- 中文生僻字数统计支持（CJK 扩展 A/B 区）
- 章节提取逻辑去重（抽取公共 `splitSections`）
- Watch 模式增强（新增故事目录触发重建）
- EPUB 标题匹配增强（`config.title` 优先，歧义报错）
- 模板缓存失效：`renderTemplate` 增加 mtime 检查（适配 Watch 模式）
- 跨平台文件名一致性：`sanitizeFileName` 统一 Windows 规则
- SVG 安全检查增强：增加 CSS `expression()` 表达式注入防护
- 消除同步/异步重复代码：`scanner.ts` 抽取 `decodeBuffer`/`selectStoryFolders`/`selectChapterFiles`/`resolveStoryText`，`config.ts` 抽取 `normalizeRepoConfig`/`parseConfigBuffer`，公开 API 不变
- 异步扫描优化：`scanStoryFoldersAsync` 并行 stat 构建目录集合
- **Node 24 新特性应用**：
  - `import.meta.dirname` 替代 `fileURLToPath`（`paths.ts`、`bench.ts`）
  - `crypto.randomUUID()` 替代手写 UUID（`epub-generator.ts`）
  - `readdirSync withFileTypes` 避免额外 stat 系统调用（`scanner.ts`）
  - `util.parseArgs` 替代手写参数解析（`args.ts`）
- **最低支持版本提升至 Node 22**：`import.meta.dirname` 需 Node 21.2+，`engines.node` 更新为 `>=22`，相关文档同步更新
- 文档更新：`docs/design.md` / `docs/design.en.md` 同步反映 Node 24 内置能力应用（移除已过时的"手写哲学"表述）

### 测试

- EPUB 集成测试：结构完整性（mimetype/container/opf/toc）、mimetype STORE 压缩验证、manifest/spine 引用一致性、章节索引命名、目录导航、图片引用一致性
- 271 项测试运行，268 项通过（+6，新增 EPUB 集成测试；另 3 项 GBK 测试在 small-ICU Node 构建下跳过）

</details>

<details>
<summary>## [1.1.0] - 2026-08-15</summary>

### 新增

- **系列分组排序**：`config.json` 新增 `series` / `seriesOrder` / `volume` 可选字段（分数索引，任意插入无需重排）
- **独立故事区块**：未配置系列的故事归入「独立故事」，按文件夹序号排序
- **文件夹重命名检测**：`story build` 检测暂存区重命名（`git status` R 状态），温和警示不阻断构建
- **JSON 导出**：`story export json` 导出含章节/字数/元数据的结构化 JSON（AI 友好、Obsidian Dataview 可用）
- **JSON 导入**：`story import json` 导入 JSON → 自动生成符合规范的故事目录，与 `export json` 双向对称
- **合并 Markdown 导出**：`story export md` 导出单文件 Markdown（含 YAML Frontmatter）
- **`.storyignore` 排除规则**：排除草稿/临时文件不参与扫描统计（`.gitignore` 简化子集，`story init` 自动生成模板）
- **文档新增**：`docs/specification.md`（仓库数据规范 v1.0）+ `docs/design.md`「工具箱」章节（中英双语）

### 变更

- 故事文件夹排序从字典序改为**数值序**（`12-` < `100-`）
- 根 README 模板支持系列分组与独立故事区块
- **PDF 导出（浏览器打印）**：`export html` 新增 `@media print` 样式，可直接另存为 PDF
- 清理：删除 `validate.ts` 未使用函数、`build.ts` 复用公共 `detectCliLang`、`new-story.ts` 序号正则修正
- README badge：测试数硬编码 → CI 动态 badge
- **i18n 模块重组**：`src/utils/i18n.ts`（512 行）拆分为顶层 `src/i18n/`（index.ts + zh.ts + en.ts）
- **章节命名规范**：`specification.md` 3.2 节新增推荐命名模式（简单顺序 / 分卷分章 / 剧本分场）+ 补零规则

### 测试

- 228 项测试全部通过（+30），新增覆盖 `.storyignore`（8 项）、`import json`（10 项）及系列分组 / 分数索引 / 重命名检测集成测试

</details>

<details>
<summary>## [1.0.0] - 2026-08-14</summary>

### 基础功能

- 目录约定管理故事（`NN-名称/` + `config.json` + `text.md`）
- `story init` / `story new` 脚手架
- `story build` 自动生成故事 README + 根索引 README
- `story build --validate-only` / `--save-counts` / `--watch`
- `story epub` 导出 EPUB 3（封面、版权、目录、图片）
- `story export html` 导出静态站点
- `story export txt` 一键导出全部故事为 `.txt`
- 声明式配置校验（必填、枚举、格式、条件必填）
- 中英双语支持（故事语言 + CLI 语言检测）
- 仓库级自定义枚举（`story.config.json`）
- 语言感知字数统计（中文按汉字 / 英文按单词）
- 赞助支持（`assets/sponsor/` 自动生成折叠区块）

### 发布准备与工程改进

- **编译发布**：修复 npm 全局安装兼容性（Node 24 禁止在 `node_modules` 下执行 `.ts`），发布包改为编译产物 `dist/`
- **构建流程**：新增 `pnpm build`（`tsc -p tsconfig.build.json`），`prepack` 自动编译
- **路径解析**：新增 `src/utils/paths.ts`，统一解析包根/模板目录，兼容源码运行与编译运行
- **export-html 重构**：统一 i18n + 配置校验 + 结构化错误处理（替代硬编码中文）
- **异步 FS 优化**：build 热路径并行加载故事（`Promise.all`），大仓库显著提速
- **Markdown 渲染修复**：
  - 修复段落内 `<br/>` 被 HTML 转义为文本的 Bug
  - 新增反斜杠转义支持（`\*` → 字面量 `*`）
- **冗余函数抽取**：`cli-utils.ts` 统一 `detectCliLang` / `sanitizeFileName`
- **设计理念文档**：新增 `docs/design.md` / `docs/design.en.md`
- **CI 完善**：`build.yml` 新增 `pnpm build` 步骤，验证编译产物可生成

### 测试

- 175 项测试全部通过，覆盖：扫描器、校验、模板渲染、字数统计、i18n、README 生成、EPUB 导出（含封面图）、参数解析、仓库配置、CLI 入口、Markdown 转换边界

</details>
