# 📤 内容导出指南

story-cli 提供 **6 种导出方式**，覆盖读者侧（HTML / TXT / EPUB / PDF）和创作者侧（JSON / 合并 Markdown）。

---

## 📊 导出总览

| 格式         | 命令                                     | 默认输出目录          | 适用场景                                  |
| ------------ | ---------------------------------------- | --------------------- | ----------------------------------------- |
| **HTML**     | `story export html`                      | `dist/html/`          | 静态站点阅读、浏览器打印为 PDF            |
| **TXT**      | `story export txt`                       | `dist/txt/`           | 纯文字稿、通用文本分发                    |
| **EPUB**     | `story epub "标题"` / `story epub --all` | `dist/epub/`          | 电子阅读器（Kindle / Apple Books / Kobo） |
| **PDF**      | `story export html` + 浏览器打印         | `dist/html/` → 浏览器 | 打印 / 分发 / 存档                        |
| **JSON**     | `story export json`                      | `dist/json/`          | AI 工作流、数据分析、Obsidian Dataview    |
| **Markdown** | `story export md`                        | `dist/md/`            | 跨平台搬运、便携备份                      |

---

## 🌐 HTML 导出

```bash
story export html
```

生成静态站点：`dist/html/index.html` + 每个故事的独立 `.html` 页面。

- **自带打印样式**（`@media print`）：隐藏导航元素、标题孤行控制、代码块/表格不跨页
- **支持 Markdown 子集渲染**：粗体/斜体/标题/列表/表格/代码块/引用等，完整语法见 [specification.md §3.3](specification.md#33-支持的-markdown-语法)
- **可浏览器打印为 PDF**：打开 `index.html` → `Ctrl+P` → 另存为 PDF
- 自定义输出目录：`story export html --output=dist/custom`

---

## 📄 TXT 导出

```bash
story export txt
```

将每个故事导出为 `.txt` 纯净文本文件（保留 Markdown 原始格式）。

- 适合：纯文字稿、通用文本分发
- 自定义输出目录：`story export txt --output=dist/custom`

**管道友好（`--stdout`）**：

```bash
# 输出到标准输出（带故事标题行 + 分隔符，管道友好）
story export txt --stdout
story export txt --stdout | grep -c "story-separator"  # 统计故事数
```

> 多故事输出用 `<!-- story-separator -->` 分隔，每个故事前有标题行，便于下游脚本按故事切分。

---

## 📚 EPUB 导出

```bash
story epub "故事标题"     # 导出单个
    
story epub --all          # 导出全部

story epub "故事标题" --split-by-volume  # 按 config.volume 分卷导出
```

生成标准 EPUB 3 格式（封面、版权页、目录、图片支持）。详见 [docs/epub.md](epub.md)。

> 💡 **分卷导出**：`--split-by-volume` 按 `config.json` 中的 `volume` 字段生成 `标题-卷名.epub`，适合长篇（百万字级）分卷发布。

---

## 📄 PDF 导出（浏览器打印）

story-cli **不内置 PDF 生成器**——浏览器就是最好的 PDF 引擎。

```bash
# 1. 导出静态 HTML 站点
story export html

# 2. 浏览器打开 dist/html/index.html，Ctrl+P → 另存为 PDF
```

**为什么推荐这种方式**：

| 维度            | CLI 内置 PDF 生成器                | 浏览器打印为 PDF       |
| --------------- | ---------------------------------- | ---------------------- |
| 依赖            | 需要 `pdf-lib` 等库（约 600KB+）   | **零依赖**             |
| 中文排版        | 需要手动嵌入字体（TTF → CID 映射） | 浏览器内置最佳排版引擎 |
| 页边距 / 页眉脚 | CLI 参数穷举                       | GUI 可视化自由调整     |

---

## 🔗 JSON 导出

```bash
story export json
```

将全部故事导出为单个结构化 JSON 文件：`dist/json/stories.json`。

**管道友好（`--stdout`）**：

```bash
# 输出到标准输出（配合 jq 等工具使用）
story export json --stdout
story export json --stdout | jq '.stories[0].title'
```

```json
{
  "version": "1.0.0",
  "exportedAt": "2026-08-15T...",
  "storyCount": 1,
  "stories": [
    {
      "title": "我的故事",
      "type": "original",
      "status": "completed",
      "language": "zh",
      "summary": "...",
      "created": "2026-08-14",
      "wordCount": "约 X 字",
      "rawWordCount": 3240,
      "chapters": [{ "title": "第一章", "content": "正文内容..." }]
    }
  ]
}
```

**用途**：

- 🤖 **AI 工作流**：把故事喂给 Claude / ChatGPT 进行续写、翻译、分析（`--stdout` 可直接管道传输）
- 📊 **数据分析**：统计章节数、字数趋势、角色出场
- 📝 **Obsidian Dataview**：用 Dataview 插件查询和管理你的故事库

---

## 📝 合并 Markdown 导出

```bash
story export md
```

将每个故事导出为**单文件 Markdown**（`dist/md/故事标题.md`），包含 YAML Frontmatter 元数据。

**管道友好（`--stdout`）**：

```bash
# 输出到标准输出（多故事用分隔符连接，可直接管道给 pandoc）
story export md --stdout
story export md --stdout | pandoc -f markdown -t docx -o book.docx
```

> 多故事输出用 `<!-- story-separator -->` 分隔，每一段都是一个合法独立的 MD 文件。

```markdown
---
title: "我的故事"
type: "original"
status: "completed"
language: "zh"
summary: "..."
created: "2026-08-14"
author: "作者名"
---

# 第一章

正文内容...
```

**用途**：

- 📦 **跨平台搬运**：论坛发帖、邮件分享、发给朋友
- 💾 **便携备份**：一个文件包含完整故事 + 元数据

---

## 🔗 工具链组合（与其他工具协作）

story-cli 不穷举所有输出格式，而是通过 `--stdout` 与专业工具组合完成高级转换。

### 导出为 YAML

```bash
# 需要先安装 yq（brew install yq / apt install yq）
story export json --stdout | yq -P > stories.yaml
```

### 导出为 Word（.docx）

```bash
# 需要先安装 pandoc（brew install pandoc）
story export md --stdout | pandoc -f markdown -t docx -o book.docx
```

### 导出为 PDF

```bash
# 方案 1：浏览器打印（推荐，见上文）
# 方案 2：wkhtmltopdf
story export html --output=dist/html
wkhtmltopdf dist/html/index.html book.pdf
```

### 字数分布报表

```bash
story stats --json | jq -r '.stories[] | "\(.title): \(.wordCount)"'
```

### 系列总字数排行

```bash
story stats --json | jq 'group_by(.series) | map({series: .[0].series, total: map(.wordCount) | add}) | sort_by(-.total)'
```

### 分章节字数分布

```bash
story export json --stdout | jq '.stories[].chapters | map(.title + ": " + (.content | length | tostring) + "字")'
```

> **原则**：CLI 做原子能力（输出标准原料），用户做编排（自由组合工具）。数据永远在你自己手里。

---

## 🎯 选择指南

| 你的需求            | 推荐格式                |
| ------------------- | ----------------------- |
| 在 GitHub 上阅读    | HTML（或直接用 README） |
| 电子阅读器看书      | EPUB                    |
| 打印 / 分发纸质版   | PDF（浏览器打印）       |
| 给 AI 续写 / 翻译   | JSON                    |
| 搬到论坛 / 发给朋友 | 合并 Markdown           |
| 纯文字稿            | TXT                     |
