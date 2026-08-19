# 📚 story-cli

[![中文](https://img.shields.io/badge/简体中文-README-blue?style=flat-square)](README.md)
[![English](https://img.shields.io/badge/English-README-blue?style=flat-square)](README.en.md)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen?style=flat-square)](package.json)
[![CI](https://img.shields.io/github/actions/workflow/status/yuelinghuashu/story-cli/build.yml?style=flat-square)](https://github.com/yuelinghuashu/story-cli/actions)
[![npm version](https://img.shields.io/npm/v/@yuelinghuashu/story-cli?style=flat-square)](https://www.npmjs.com/package/@yuelinghuashu/story-cli)
[![npm downloads](https://img.shields.io/npm/dm/@yuelinghuashu/story-cli?style=flat-square)](https://www.npmjs.com/package/@yuelinghuashu/story-cli)

**零部署、Git 原生的 Markdown 内容管理 CLI。** 用简单的目录约定管理故事/论文/笔记/教程，自动生成 README，导出 EPUB，中英双语。

---

## ✨ 功能特性

- **简单目录约定** — 内容就是文件夹：`NN-名称/` 包含 `config.json` + `text.md`
- **自动生成 README** — 每个条目和根目录索引自动生成（模板驱动，可自定义）
- **系列分组排序** — `series` / `seriesOrder` 控制展示顺序，任意插入无需重排
- **运行时校验** — 构建前检查配置（必填字段、枚举、格式）
- **合规检查** — `story validate` 按 Story-Repo 规范校验（目录命名 / UTF-8 / 重复序号 / schema）
- **关联故事** — `story link` 管理弱关联；`story build` 自动建议同系列候选关联
- **双语支持** — 中英内容 + 自动生成本地化 README
- **章节 + 字数** — 自动提取章节标题与语言感知的字数统计
- **多格式导出** — EPUB（封面渲染/排版样式/系列元数据）/ HTML / TXT / JSON / Markdown / embeddings，支持 `--stdout` 管道
- **通用内容中台** — 知识库模式（论文/访谈/笔记）、技术文档模式（教程/API）
- **MCP Server** — AI 客户端（Claude / Cursor）可直接读写内容库
- **GitHub Action** — 零配置 CI 入口（`yuelinghuashu/story-cli@v1`），一键实现「Push → Build → 发布」
- **Watch 模式** — 文件变更自动重建

---

## 🚀 快速开始

```bash
# 安装（需要 Node.js >= 22）
npm install -g @yuelinghuashu/story-cli

# 创建示例仓库并查看效果
story demo

# 初始化仓库
story init

# 创建内容并编写
story new "我的新故事"

# 构建所有 README
story build

# 导出 EPUB / 统计
story epub --all
story stats
```

<details>
<summary>💡 推荐使用 Makefile 工作流（更高效）</summary>

```bash
make init                 # 初始化
make new TITLE="我的故事"  # 新建并自动构建
make commit               # 构建 + 提交
make push                 # 构建 + 提交 + 推送
make stats                # 查看创作统计
make analyze              # 写作质量分析（重复短语 / 字数过期 / 章节趋势，需 jq）

```

Windows 用户也可使用 `story init` 生成的 `story.ps1`（PowerShell 版工作流）：`.\story.ps1 init` / `.\story.ps1 new -Title '我的故事'` / `.\story.ps1 build`。

</details>

---

## 🌱 不止于故事

**通用内容治理** — 任何能被"规范化"的文字资产都可以用同一套工作流：

| 模板模式                   | 内容类型                   | 典型场景           |
| :------------------------- | :------------------------- | :----------------- |
| `--template=story`（默认） | 小说 / 故事                | 原创、二创         |
| `--template=knowledge`     | 论文 / 访谈 / 博客 / 笔记  | 知识库、研究库     |
| `--template=tech`          | 教程 / API 文档 / 变更日志 | 技术博客、项目文档 |

```bash
story init --template=knowledge
story init --template=tech
```

---

## 🤖 让 AI 管理你的内容库

story-cli 内置 **MCP Server** —— AI 客户端（Claude Desktop / Cursor / VSCode Copilot Chat）可直接读写你的内容库。AI 能独立完成「创建 → 写作 → 构建 → 统计」的完整闭环，无需在终端手动执行命令。

> 💡 **Token 经济性**：MCP 工具从设计之初就以节省 AI 调用成本为核心原则。`scan_stories` 默认精简输出（目录浏览节省 ~80-95%）、`read_chapter` 支持按需截断（续写场景节省 ~95%+）、`stats` 一次调用拿全数据（~99%）——每个细节都在为你的 AI 工作流降低 Token 消耗。

| 能力    | MCP 工具                             | 说明                                                       |
| ------- | ------------------------------------ | ---------------------------------------------------------- |
| 📖 浏览 | `scan_stories` / `read_chapter`      | 列出故事库、读取章节（支持按需加载与末尾截断，节省 Token） |
| ✍️ 写作 | `write_chapter` / `create_story`     | 创建新故事、原子写入正文（可选写后合规校验）               |
| ✅ 治理 | `edit_config` / `build` / `validate` | 直接改元数据字段、执行 README 重建、校验配置合法性         |
| 📊 统计 | `stats`                              | 获取总字数 / 章节数 / 系列进度 / 健康度                    |

```bash
# 启动 MCP Server（需在故事仓库根目录；--root 可从任意目录指定仓库）
story mcp-server
```

> 💡 详细配置与示例见 [docs/mcp.md](docs/mcp.md)。**MCP Server 会读写当前工作目录下的所有文件，请仅在信任的仓库中运行。**

### 🎯 微调数据准备（SFT / Embedding）

故事库的结构化输出天然适合作为大模型训练数据源——`config.json` 自带分类标签，`export json` 按章节精准切片，`export embeddings` 输出纯文本块。配合 `--stdout` + Unix 工具链，**一行管道即可转为标准微调格式**：

```bash
# 导出为指令微调 JSONL（summary → instruction，正文 → output）
story export json --stdout | jq -c '.stories[] | {messages: [{role: "user", content: .summary}, {role: "assistant", content: .content}]}' > sft_data.jsonl

# 导出为 Embedding 训练格式
story export embeddings --stdout | jq -c '{text: .content, metadata: {title: .title, series: .series}}' > embedding_data.jsonl

# 快速分析数据配比（总字数/章节分布/重复短语）
story stats --json | jq '{words: .totalWords, chapters: .totalChapters, repeated: .analysis.repeated}'
```

> 💡 story-cli 已确保 UTF-8 编码（GBK 自动检测告警）、章节级切片（避免语义截断）、元数据完整（type/series/summary 天然可用作分类标签）。无需二次清洗脚本。

---

## 🛠️ 常用命令

| 命令                                                                        | 描述                                       |
| --------------------------------------------------------------------------- | ------------------------------------------ |
| `story init [--template=story\|knowledge\|tech]`                            | 初始化仓库（默认故事/知识库/技术文档模式） |
| `story new "标题" [--type] [--lang] [--author] [--creator]`                 | 创建新条目                                 |
| `story build [--validate-only] [--save-counts] [--watch]`                   | 构建 README                                |
| `story epub "标题" [--all] [--split-by-volume] [--output=dir] [--css=path]` | 导出 EPUB                                  |
| `story export html / txt / json / md / embeddings [--stdout]`               | 导出多种格式（embeddings 为文本块 JSONL）  |
| `story import json --file=xxx.json`                                         | 从 JSON 批量导入                           |
| `story stats [--json]`                                                      | 创作统计                                   |
| `story validate [--json]`                                                   | 合规检查（Story-Repo 规范）                |
| `story link "A" "B" [--remove=...] [--list]`                                | 管理故事关联（弱关联）                     |
| `story mcp-server`                                                          | 启动 MCP Server（AI 连接入口）             |

<details>
<summary>完整命令参考</summary>

全部命令的别名、子命令、参数、分类说明见 [docs/commands.md](docs/commands.md)（中英双语）。

</details>

<details>
<summary>repository 级配置（story.config.json）</summary>

自定义故事类型/状态及本地化标签：

```json
{
  "types": ["original", "fanfic", "translation"],
  "statuses": ["completed", "ongoing", "planned"],
  "typeLabels": { "translation": { "zh": "翻译", "en": "Translation" } }
}
```

内置枚举已内置标签，无需重复配置。删除文件即回退默认。

</details>

---

## 📚 文档

| 文档         | 中文                                      | English                                         | 内容           |
| ------------ | ----------------------------------------- | ----------------------------------------------- | -------------- |
| 设计理念     | [design.md](docs/design.md)               | [design.en.md](docs/design.en.md)               | 项目哲学       |
| 仓库规范     | [specification.md](docs/specification.md) | [specification.en.md](docs/specification.en.md) | 数据规范       |
| 如何新增内容 | [add-story.md](docs/add-story.md)         | [add-story.en.md](docs/add-story.en.md)         | 目录约定       |
| 内容导出     | [export.md](docs/export.md)               | [export.en.md](docs/export.en.md)               | 导出指南       |
| EPUB / PDF   | [epub.md](docs/epub.md)                   | [epub.en.md](docs/epub.en.md)                   | EPUB 导出      |
| CI           | [ci.md](docs/ci.md)                       | [ci.en.md](docs/ci.en.md)                       | GitHub Actions |
| MCP Server   | [mcp.md](docs/mcp.md)                     | [mcp.en.md](docs/mcp.en.md)                     | AI 连接指南    |
| 架构         | [architecture.md](docs/architecture.md)   | [architecture.en.md](docs/architecture.en.md)   | 模块设计       |
| **命令参考** | [commands.md](docs/commands.md)           | [commands.en.md](docs/commands.en.md)           | 全部命令清单   |
| 更新日志     | [CHANGELOG.md](CHANGELOG.md)              | [CHANGELOG.en.md](CHANGELOG.en.md)              | 变更记录       |

---

## ⚠️ 编码要求

所有文件必须使用 **UTF-8** 编码。检测到 GBK/GB2312 时会警告但不阻断构建。

---

## 🧪 测试

```bash
make test         # 或 pnpm test
```

**550+ 项测试全部通过**。覆盖：扫描器、系列分组、校验、模板渲染、字数统计、国际化、README 生成、EPUB 导出、CLI 端到端（冒烟测试覆盖全部命令）、`.storyignore`、MCP 协议、JSON 导入、GitHub Action 结构、合规检查、关联建议、增量构建缓存、embeddings 导出等。

---

## ☕ 赞助支持

<details>
<summary>如果你喜欢我的创作，可以请我喝杯咖啡。</summary>

<img src="./assets/sponsor/ali-pay.jpg" width="200" alt="ali-pay" />
<img src="./assets/sponsor/wechat-pay.jpg" width="200" alt="wechat-pay" />

</details>

---

## ⚖️ License

[MIT](./LICENSE)

---

## 🤝 参与贡献

欢迎提交 **Issue**（bug 反馈 / 功能建议，有表单模板）；有意贡献代码请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，并在 [ROADMAP.md](ROADMAP.md) 了解项目定位。
