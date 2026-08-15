# 📤 Export Guide

story-cli provides **6 export methods**, covering both reader-side (HTML / TXT / EPUB / PDF) and creator-side (JSON / merged Markdown).

---

## 📊 Overview

| Format       | Command                                   | Default Output         | Use Cases                                      |
| ------------ | ----------------------------------------- | ---------------------- | ---------------------------------------------- |
| **HTML**     | `story export html`                       | `dist/html/`           | Static site reading, browser print to PDF      |
| **TXT**      | `story export txt`                        | `dist/txt/`            | Plain text drafts, universal text distribution |
| **EPUB**     | `story epub "Title"` / `story epub --all` | `dist/epub/`           | E-readers (Kindle / Apple Books / Kobo)        |
| **PDF**      | `story export html` + browser print       | `dist/html/` → browser | Printing / distribution / archiving            |
| **JSON**     | `story export json`                       | `dist/json/`           | AI workflows, data analysis, Obsidian Dataview |
| **Markdown** | `story export md`                         | `dist/md/`             | Cross-platform portability, portable backup    |

---

## 🌐 HTML Export

```bash
story export html
```

Generates a static site: `dist/html/index.html` + a standalone `.html` page for each story.

- **Built-in print styles** (`@media print`): hides navigation elements, controls widows/orphans, prevents code blocks/tables from breaking across pages
- **Printable to PDF**: open `index.html` → `Ctrl+P` → Save as PDF
- Custom output: `story export html --output=dist/custom`

---

## 📄 TXT Export

```bash
story export txt
```

Exports each story as a `.txt` plain text file (preserves original Markdown format).

- Good for: plain text drafts, universal distribution
- Custom output: `story export txt --output=dist/custom`

---

## 📚 EPUB Export

```bash
# Export a single story
story epub "Story Title"

# Export all stories
story epub --all
```

Generates standard EPUB 3 format (cover, copyright, TOC, image support). See [docs/epub.en.md](epub.en.md).

---

## 📄 PDF Export (browser print)

story-cli does **not bundle a PDF generator** — your browser is the best PDF engine.

```bash
# 1. Export a static HTML site
story export html

# 2. Open dist/html/index.html in browser, Ctrl+P → Save as PDF
```

**Why this approach**:

| Aspect            | CLI-built PDF generator              | Browser print to PDF            |
| ----------------- | ------------------------------------ | ------------------------------- |
| Dependencies      | Needs `pdf-lib` etc. (~600KB+)       | **Zero dependencies**           |
| CJK typography    | Must embed fonts (TTF → CID mapping) | Best-in-class browser rendering |
| Margins / headers | Command-line flags, clunky           | Visual GUI adjustment           |

---

## 🔗 JSON Export

```bash
story export json
```

Exports all stories to a single structured JSON file: `dist/json/stories.json`.

```json
{
  "version": "1.0.0",
  "exportedAt": "2026-08-15T...",
  "storyCount": 1,
  "stories": [
    {
      "title": "My Story",
      "type": "original",
      "status": "completed",
      "language": "zh",
      "summary": "...",
      "created": "2026-08-14",
      "wordCount": "~X words",
      "rawWordCount": 3240,
      "chapters": [{ "title": "Chapter 1", "content": "Story content..." }]
    }
  ]
}
```

**Use cases**:

- 🤖 **AI workflows**: feed stories to Claude / ChatGPT for rewriting, translation, analysis
- 📊 **Data analysis**: chapter counts, word count trends, character appearances
- 📝 **Obsidian Dataview**: query and manage your story library

---

## 📝 Merged Markdown Export

```bash
story export md
```

Exports each story as a **single-file Markdown** (`dist/md/Story Title.md`) with YAML frontmatter metadata.

```markdown
---
title: "My Story"
type: "original"
status: "completed"
language: "zh"
summary: "..."
created: "2026-08-14"
author: "Author Name"
---

# Chapter 1

Story content...
```

**Use cases**:

- 📦 **Cross-platform portability**: forum posts, email sharing, sending to friends
- 💾 **Portable backup**: one file contains the complete story + metadata

---

## 🎯 How to Choose

| Your Need                              | Recommended Format            |
| -------------------------------------- | ----------------------------- |
| Read on GitHub                         | HTML (or use README directly) |
| Read on e-reader                       | EPUB                          |
| Print / physical distribution          | PDF (browser print)           |
| Feed to AI for rewriting / translation | JSON                          |
| Move to forum / share with friends     | Merged Markdown               |
| Plain text draft                       | TXT                           |
