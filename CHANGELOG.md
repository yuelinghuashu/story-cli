# Changelog

本项目遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.1.0] - 2026-08-15

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
