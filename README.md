# 📚 story-cli

[![中文](https://img.shields.io/badge/简体中文-README-blue?style=flat-square)](README.md)
[![English](https://img.shields.io/badge/English-README-blue?style=flat-square)](README.en.md)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square)](package.json)
[![Tests](https://img.shields.io/badge/tests-174%20passed-brightgreen?style=flat-square)](README.md#-测试)

**零部署、Git 原生的 Markdown 故事内容管理 CLI。**

通过简单的目录约定管理故事，自动生成 GitHub 友好的 README，支持导出 EPUB，双语（中/英）内容支持。

---

## ✨ 功能特性

- **简单目录约定** — 故事就是文件夹：`NN-名称/` 包含 `config.json` + `text.md`
- **自动生成 README** — 每个故事和根目录索引 README 都能自动生成（模板驱动，可自定义）
- **运行时校验** — 构建前检查配置（必填字段、枚举、格式）
- **双语支持** — `language: "zh" | "en"` 配置，生成本地化 README
- **字数统计** — 语言感知的中文字符 / 英文单词计数
- **章节提取** — README 中展示章节标题 + 字数
- **EPUB 导出** — 一条命令把故事转成 `.epub`，含封面页（支持封面图）、版权页
- **脚手架** — `story new "标题"` 创建一切所需
- **观看模式** — `story build --watch` 文件变更自动重建
- **可扩展枚举** — 通过 `story.config.json` 自定义故事类型和状态
- **赞助支持** — 在 `assets/sponsor/` 放收款码图片，自动生成 ☕ 赞助区块
- **CI 友好** — 完美适配 GitHub Actions（含 lint + 测试）

---

## 📦 安装

```bash
# 全局安装
npm install -g story-cli

# 或使用 npx 直接运行
npx story-cli
```

> 发布包为编译后的 `dist/` 产物（兼容 Node 24 原生执行限制）。开发时仍可直接运行源码：`node bin/index.ts version`。

---

## 🚀 快速开始

```bash
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
```

---

## 🛠️ 命令参考

| 命令                          | 描述                                            |
| ----------------------------- | ----------------------------------------------- |
| `story init`                  | 初始化仓库（模板 + `.gitignore` + README 骨架） |
| `story init --full`           | 额外生成 LICENSE / docs/CHANGELOG               |
| `story new "标题" [选项]`     | 创建新故事脚手架                                |
| `story build`                 | 构建所有故事 README + 根索引                    |
| `story build --validate-only` | 仅校验配置不生成 README                         |
| `story build --save-counts`   | 构建时将自动字数写入 config.json                |
| `story build --watch`         | 监听文件变更，自动重建 README                   |
| `story epub "标题"`           | 导出单个故事为 EPUB                             |
| `story epub --all`            | 导出所有故事为 EPUB                             |
| `story export html`           | 导出静态 HTML 站点                              |
| `story export txt`            | 导出全部故事为纯文本（.txt）                    |
| `story help`                  | 显示帮助                                        |
| `story version`               | 显示版本号                                      |

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

| 文档              | 中文                                    | English                                       | 内容                            |
| ----------------- | --------------------------------------- | --------------------------------------------- | ------------------------------- |
| 设计理念          | [design.md](docs/design.md)             | [design.en.md](docs/design.en.md)             | 为什么这样做、项目哲学          |
| 如何新增故事      | [add-story.md](docs/add-story.md)       | [add-story.en.md](docs/add-story.en.md)       | 目录约定、config.json、写作方式 |
| EPUB 导出指南     | [epub.md](docs/epub.md)                 | [epub.en.md](docs/epub.en.md)                 | 支持的 Markdown 语法、图片嵌入  |
| GitHub Actions CI | [ci.md](docs/ci.md)                     | [ci.en.md](docs/ci.en.md)                     | 自动构建工作流配置              |
| 技术架构          | [architecture.md](docs/architecture.md) | [architecture.en.md](docs/architecture.en.md) | 模块设计、核心思路、依赖清单    |

---

## 🧪 测试

```bash
pnpm test
```

当前 174 项测试全部通过，覆盖：扫描器、校验、模板渲染、字数统计、国际化、README 生成、EPUB 导出（含封面图）、参数解析、仓库配置、CLI 入口、Markdown 转换边界。

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
