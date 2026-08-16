# 📚 story-cli

[![中文](https://img.shields.io/badge/简体中文-README-blue?style=flat-square)](README.md)
[![English](https://img.shields.io/badge/English-README-blue?style=flat-square)](README.en.md)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen?style=flat-square)](package.json)
[![CI](https://img.shields.io/github/actions/workflow/status/yuelinghuashu/story-cli/build.yml?style=flat-square)](https://github.com/yuelinghuashu/story-cli/actions)
[![npm version](https://img.shields.io/npm/v/@yuelinghuashu/story-cli?style=flat-square)](https://www.npmjs.com/package/@yuelinghuashu/story-cli)
[![npm downloads](https://img.shields.io/npm/dm/@yuelinghuashu/story-cli?style=flat-square)](https://www.npmjs.com/package/@yuelinghuashu/story-cli)

**零部署、Git 原生的 Markdown 故事内容管理 CLI。**

通过简单的目录约定管理故事，自动生成 GitHub 友好的 README，支持导出 EPUB，双语（中/英）内容支持。

---

## ✨ 功能特性

- **简单目录约定** — 故事就是文件夹：`NN-名称/` 包含 `config.json` + `text.md`
- **自动生成 README** — 每个故事和根目录索引 README 都能自动生成（模板驱动，可自定义）
- **系列分组排序** — `config.json` 中的 `series` / `seriesOrder` 控制展示顺序（分数索引，任意插入无需重排）
- **运行时校验** — 构建前检查配置（必填字段、枚举、格式）
- **双语支持** — `language: "zh" | "en"` 配置，生成本地化 README
- **字数统计** — 语言感知的中文字符 / 英文单词计数
- **章节提取** — README 中展示章节标题 + 字数
- **EPUB 导出** — 一条命令把故事转成 `.epub`，含封面页（支持封面图）、版权页
- **脚手架** — `story new "标题"` 创建一切所需
- **观看模式** — `story build --watch` 文件变更自动重建
- **可扩展枚举** — 通过 `story.config.json` 自定义故事类型和状态
- **赞助支持** — 在 `assets/sponsor/` 放收款码图片，自动生成 ☕ 赞助区块
- **MCP Server** — `story mcp-server` 暴露 JSON-RPC 2.0 over stdio 协议，AI 客户端（Claude Desktop / Cursor 等）可直接读写故事库
- **CI 友好** — 完美适配 GitHub Actions（含 lint + 测试）

---

## 🤔 为什么用 story-cli？

| 场景           |    网文写作软件    |  手动管理 Markdown   |        **story-cli**        |
| -------------- | :----------------: | :------------------: | :-------------------------: |
| 数据所有权     | ❌ 专有格式 / 云端 |      ✅ 纯文件       |          ✅ 纯文件          |
| Git 原生工作流 |     ❌ 不适用      | ⚠️ 需手动维护 README | ✅ 自动 README + 重命名检测 |
| 中英文双语     |     通常不支持     |    ⚠️ 需自行处理     |       ✅ 内置双语支持       |
| 章节管理       |      ✅ 内置       |   ⚠️ 需手动建目录    |   ✅ 自动提取章节 + 字数    |
| EPUB 导出      |      ✅ 内置       |    ⚠️ 需额外工具     |         ✅ 一条命令         |
| 编辑器自由     |      ❌ 锁定       |       ✅ 任意        |           ✅ 任意           |
| AI 工具自由    |    ❌ 平台绑定     |       ✅ 任意        |           ✅ 任意           |

**story-cli 给喜欢 Git 的创作者提供一条"数据永可迁移"的写作工作流。** 你的故事永远是普通文件，任何工具、任何编辑器、任何时间都能打开。

---

## ⚠️ 文件编码要求

**所有文件（`config.json`、`text.md`、`chapter-*.md`、`.storyignore`）必须使用 UTF-8 编码保存。**

- **VS Code**：右下角点击编码按钮 → 「通过编码保存」→ 选择 `UTF-8`
- **Windows 记事本**：另存为 → 编码选择 `UTF-8`
- **macOS / Linux**：默认即 UTF-8，无需额外操作

> 如果你用 GBK/GB2312 编码保存文件，`story build` 会输出乱码警告，字数统计也会出错。
> story-cli 会在检测到编码问题时提示你转换，但不阻断构建。

---

## 📦 安装

```bash
# 全局安装
npm install -g @yuelinghuashu/story-cli

# 或使用 npx 直接运行
npx @yuelinghuashu/story-cli
```

> 发布包为编译后的 `dist/` 产物，需要 Node >= 22。开发时使用 Node 24+ 可直接运行源码：`node bin/index.ts version`。

---

## 🚀 快速开始

```bash
# 0. 想快速看效果？直接生成一个示例故事仓库
story demo

# 1. 初始化一个空的故事仓库
story init

# 2. 创建你的第一个故事
story new "我的新故事"

# 或英文原创故事
story new "My First Story" --lang=en

# 或二创（fanfic）故事
story new "My Fan World" --type=fanfic --author="原作名" --creator="原作者" --lang=en

# 3. 编写/编辑故事内容
#   - 编辑 config.json（标题、类型、状态、简介等）
#   - 在 text.md 中写作（或使用 chapter-*.md 分章）

# 4. 构建所有 README
story build

# 5. 导出 EPUB
story epub "我的新故事"
# 或导出全部
story epub --all

# 6. 查看创作统计
story stats
```

> 💡 **推荐使用 Makefile 工作流（更高效）：**
>
> ```bash
> make init                     # 初始化
> make new TITLE="我的新故事"    # 新建并自动构建
> make commit                   # 构建 + 提交
> make push                     # 构建 + 提交 + 推送
> make stats                    # 查看创作统计
> ```
>
> 更多命令请运行 `make help`。
>
> `story init` 会自动生成一个可编辑的 `Makefile`，你也可以手动执行 `story build` 等原子命令。
>
> 💡 **Windows 用户**：`story init` 还会生成 `story.ps1`（PowerShell 版工作流入口），用法与 Makefile 一致：
>
> ```powershell
> .\story.ps1 init
> .\story.ps1 new -Title '我的新故事'
> .\story.ps1 build
> ```

---

## 🛠️ 命令参考

| 命令                                  | 描述                                            |
| ------------------------------------- | ----------------------------------------------- |
| `story init`                          | 初始化仓库（模板 + `.gitignore` + README 骨架） |
| `story init --full`                   | 额外生成 LICENSE / docs/CHANGELOG               |
| `story new "标题" [选项]`             | 创建新故事脚手架                                |
| `story build`                         | 构建所有故事 README + 根索引                    |
| `story build --validate-only`         | 仅校验配置不生成 README                         |
| `story build --save-counts`           | 构建时将自动字数写入 config.json                |
| `story build --watch`                 | 监听文件变更，自动重建 README                   |
| `story epub "标题"`                   | 导出单个故事为 EPUB                             |
| `story epub "标题" --split-by-volume` | 按 config.volume 分卷导出（文件名带卷名）       |
| `story epub --all`                    | 导出所有故事为 EPUB                             |
| `story export html`                   | 导出静态 HTML 站点（可浏览器打印为 PDF）        |
| `story export txt`                    | 导出全部故事为纯文本（.txt）                    |
| `story export txt --stdout`           | 纯文本导出到标准输出（管道友好，带标题行）      |
| `story export json`                   | 导出全部故事为结构化 JSON（AI 友好）            |
| `story export json --stdout`          | JSON 导出到标准输出（管道友好）                 |
| `story export md`                     | 导出全部故事为合并 Markdown（含 Frontmatter）   |
| `story export md --stdout`            | Markdown 导出到标准输出（管道友好，多故事分隔） |
| `story import json`                   | 从 JSON 导入故事（AI 输出 → 自动生成目录结构）  |
| `story mcp-server`                    | 启动 MCP stdio 服务器（AI 客户端连接入口）      |
| `story help`                          | 显示帮助                                        |
| `story version`                       | 显示版本号                                      |

### `story new` 选项

| 选项                      | 描述                                 |
| ------------------------- | ------------------------------------ |
| `--type=original\|fanfic` | 故事类型（默认：`original`）         |
| `--author="原作名"`       | 原作名称（二创必填）                 |
| `--creator="原作者"`      | 原作者（二创必填）                   |
| `--lang=zh\|en`           | 故事语言（默认：`zh`，非法值会报错） |

### 仓库级配置（story.config.json）

通过根目录的 `story.config.json` 自定义故事类型和状态枚举（默认已包含 `original/fanfic` 和 `completed/ongoing`），并可为自定义枚举配置中英文标签：

```json
{
  "types": ["original", "fanfic", "translation"],
  "statuses": ["completed", "ongoing", "planned"],
  "typeLabels": {
    "translation": { "zh": "翻译", "en": "Translation" }
  },
  "statusLabels": {
    "planned": { "zh": "计划中", "en": "Planned" }
  }
}
```

- `typeLabels` / `statusLabels` 为可选字段，用于自定义枚举的本地化显示
- 内置枚举（`original`、`fanfic`、`completed`、`ongoing`）已内置中英文标签，无需重复配置
- 未配置标签的自定义枚举值在 README 中显示为原始代码字符串

`story init` 会自动生成此文件。删除该文件即回退到默认枚举。

---

## 📚 文档

| 文档              | 中文                                      | English                                         | 内容                                |
| ----------------- | ----------------------------------------- | ----------------------------------------------- | ----------------------------------- |
| 设计理念          | [design.md](docs/design.md)               | [design.en.md](docs/design.en.md)               | 为什么这样做、项目哲学              |
| 仓库规范          | [specification.md](docs/specification.md) | [specification.en.md](docs/specification.en.md) | 目录约定数据规范（第三方兼容）      |
| 如何新增故事      | [add-story.md](docs/add-story.md)         | [add-story.en.md](docs/add-story.en.md)         | 目录约定、config.json、写作方式     |
| 内容导出          | [export.md](docs/export.md)               | [export.en.md](docs/export.en.md)               | HTML / TXT / EPUB / PDF / JSON / MD |
| EPUB / PDF 导出   | [epub.md](docs/epub.md)                   | [epub.en.md](docs/epub.en.md)                   | EPUB 格式、PDF 导出（浏览器打印）   |
| GitHub Actions CI | [ci.md](docs/ci.md)                       | [ci.en.md](docs/ci.en.md)                       | 自动构建工作流配置                  |
| MCP Server        | [mcp.md](docs/mcp.md)                     | [mcp.en.md](docs/mcp.en.md)                     | 连接 Claude / Cursor、MCP 工具列表  |
| 技术架构          | [architecture.md](docs/architecture.md)   | [architecture.en.md](docs/architecture.en.md)   | 模块设计、核心思路、依赖清单        |
| 更新日志          | [CHANGELOG.md](CHANGELOG.md)              | [CHANGELOG.en.md](CHANGELOG.en.md)              | 版本变更记录                        |

---

## 🧪 测试

```bash
make test         # 或 pnpm test
```

当前 300 项测试全部通过，覆盖：扫描器、系列分组排序、文件夹重命名检测、校验、模板渲染、字数统计（含 CJK 扩展区生僻字）、国际化、README 生成（含系列分组）、EPUB 导出（含封面图、分卷导出）、参数解析、仓库配置、CLI 入口、Markdown 转换边界、`.storyignore` 排除规则、编码检测（UTF-8/GBK）、JSON 导入（import json）、创作统计（stats）、Makefile 工作流、MCP 协议/工具（JSON-RPC 解析、scan/read/write/validate）。

> 💡 **开发者快捷命令**：项目根目录的 `Makefile` 提供 `make build` / `make test` / `make typecheck` / `make lint` / `make format` 等开发工作流入口。运行 `make help` 查看全部命令。

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
