# 📖 EPUB 导出指南

> 📋 完整命令清单见 [commands.md](commands.md)。

一条命令把故事转成 `.epub`，适合电子阅读器。

---

## 🚀 基本用法

```bash
# 导出单个故事
story epub "故事标题"

# 导出全部故事
story epub --all
```

### 分卷导出（--split-by-volume）

对于长篇故事（百万字级），可将单本 EPUB 拆分为多卷：

```bash
story epub "我的故事" --split-by-volume
```

- 当 `config.json` 中存在 `volume` 字段时，输出文件名为 `我的故事-<volume>.epub`
- 未配置 `volume` 时，行为与普通导出一致（单卷输出）
- 与 `--all` 组合可批量分卷导出全部故事

### 标题匹配规则

`story epub "标题"` 中的**标题**支持两种匹配方式（按优先级尝试）：

1. **精确匹配 `config.json` 的 `title` 字段** — 即你在 README 中看到的故事标题
2. **回退匹配文件夹名**（子串匹配）— 如 `story epub "星河入梦"` 可以匹配文件夹 `01-星河入梦`

> 💡 通常情况下 `title` 与文件夹名一致（`story new` 生成时自动保持一致）。如果你修改了 `config.json` 中的 `title`，两种方式都可以用来定位故事。

导出的文件输出到 `dist/epub/` 目录：

```bash
dist/epub/
├── 我的故事.epub
├── 另一个故事.epub
└── ...
```

---

## 📝 支持的 Markdown 语法

故事正文使用 Markdown 格式，支持 **CommonMark 常用子集**（粗体、斜体、删除线、行内代码、标题、引用、链接、图片、有序/无序列表、表格、代码块、水平线、反斜杠转义）。

> 💡 完整语法列表及不支持的语法说明见 [specification.md §3.3](specification.md#33-支持的-markdown-语法)。

| 语法       | 示例                    | 说明                       |
| ---------- | ----------------------- | -------------------------- |
| 粗体       | `**文字**`              |                            |
| 斜体       | `*文字*`                |                            |
| 删除线     | `~~文字~~`              |                            |
| 行内代码   | `` `code` ``            |                            |
| 标题       | `#` ~ `###`             | 章节标题渲染为 h1          |
| 引用块     | `> 引用内容`            |                            |
| 链接       | `[文字](https://...)`   |                            |
| 图片       | `![alt](assets/cover.png)` | 见下文正文图片说明        |
| 无序列表   | `- 项目`                | 支持嵌套缩进               |
| 有序列表   | `1. 项目`               | 支持嵌套缩进               |
| 表格       | `\| 列1 \| 列2 \|`      | 标准 Markdown 表格         |
| 代码块     | ` ```js `               | 保留原始格式               |
| 水平线     | `---` 或 `***`          |                            |

---

## 🖼️ 封面图片

在 `config.json` 中添加可选的 `cover` 字段，EPUB 导出时会将图片作为封面打包：

```json
{
  "title": "我的故事",
  "type": "original",
  "status": "completed",
  "summary": "故事简介。",
  "created": "2026-08-14",
  "cover": "cover.jpg"
}
```

封面路径支持三种写法（与正文图片解析规则一致）：

1. **绝对路径** — 如 `/home/user/images/cover.png`
2. **相对故事文件夹** — 如 `cover.jpg` 相对于 `01-故事名/`
3. **相对项目根目录** — 如 `assets/cover.png` 相对于仓库根

支持格式：`png`、`jpg` / `jpeg`、`gif`、`webp`。

> ⚠️ 封面文件不存在时不会导致导出失败，会输出警告并继续（使用纯文字封面页）。
> ⚠️ 未设置 `cover` 字段时使用纯文字封面页（标题 + 作者 + 简介）。

---

## 🖼️ 正文图片支持

在 `text.md` 中使用 Markdown 图片语法，即可将图片嵌入 EPUB：

```markdown
![封面](assets/cover.png)
```

### 路径解析规则（按顺序尝试）

1. **绝对路径** — 如 `/home/user/images/pic.jpg`
2. **相对故事文件夹** — 如 `assets/cover.png` 相对于 `01-故事名/`
3. **相对项目根目录** — 如 `assets/cover.png` 相对于仓库根

### 注意事项

- ⚠️ 外部 URL（`https://`）不会被下载，仅保留引用
- ⚠️ 图片文件不存在时会给出警告并跳过
- 同一图片被多次引用时只会嵌入一次，自动复用

---

## 🔄 与章节拆分的关系

- 如果使用 `text.md` 单文件写作，`#` 和 `##` 会触发新章节，`###` 及以上作为章节内小节（详见 [add-story.md](add-story.md#章节提取规则)）
- 如果使用 `chapter-*.md` 分章写作，`story epub` 会自动合并后按章节导出

---

## 📦 输出格式

EPUB 是标准的 EPUB 3 格式：

- 正确放置 `mimetype`（第一个且不压缩）
- 包含 `content.opf` 元数据（标题、作者、语言、UUID）
- 包含 `toc.xhtml` 目录导航
- 章节内容为 XHTML
- 封面图片（可选）通过 `properties="cover-image"` 正确标记

兼容大多数主流阅读器（Kindle、Apple Books、Kobo、微信读书等）。

> 💡 **需要导出 PDF？**
> 请参阅 [docs/export.md](export.md#📄-pdf-导出浏览器打印) ——story-cli 不内置 PDF 生成器，使用 `story export html` + 浏览器打印即可。
