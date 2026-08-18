# 📤 Export Guide

> 📋 Full command list with aliases and subcommands: see [commands.en.md](commands.en.md).

story-cli provides **7 export methods**, covering reader-side (HTML / TXT / EPUB / PDF), creator-side (JSON / merged Markdown) and AI-retrieval-side (embeddings text chunks).

---

## 📊 Overview

| Format       | Command                                   | Default Output          | Use Cases                                      |
| ------------ | ----------------------------------------- | ----------------------- | ---------------------------------------------- |
| **HTML**     | `story export html`                       | `dist/html/`            | Static site reading, browser print to PDF      |
| **TXT**      | `story export txt`                        | `dist/txt/`             | Plain text drafts, universal text distribution |
| **EPUB**     | `story epub "Title"` / `story epub --all` | `dist/epub/`            | E-readers (Kindle / Apple Books / Kobo)        |
| **PDF**      | `story export html` + browser print       | `dist/html/` → browser  | Printing / distribution / archiving            |
| **JSON**     | `story export json`                       | `dist/json/`            | AI workflows, data analysis, Obsidian Dataview |
| **Markdown** | `story export md`                         | `dist/md/`              | Cross-platform portability, portable backup    |
| **Embeds**   | `story export embeddings`                 | `dist/embeddings.jsonl` | Text chunks for vector search / semantics      |

---

## 🌐 HTML Export

```bash
story export html
```

Generates a static site: `dist/html/index.html` + a standalone `.html` page for each story.

- **Built-in print styles** (`@media print`): hides navigation elements, controls widows/orphans, prevents code blocks/tables from breaking across pages
- **Markdown subset rendering**: bold/italic/headings/lists/tables/code blocks/blockquotes, see [specification.en.md §3.3](specification.en.md#33-supported-markdown-syntax) for the full list
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

**Pipe-friendly (`--stdout`)**:

```bash
# Output to stdout (story title line + separator, pipe-friendly)
story export txt --stdout
story export txt --stdout | grep -c "^====$"  # Count stories
```

> Multiple stories are separated by a line of `====`, each preceded by a title line so downstream scripts can split by story.

---

## 📚 EPUB Export

```bash
story epub "Story Title"     # Export a single story
story epub --all             # Export all stories
story epub "Story Title" --split-by-volume  # Export split volumes by config.volume
```

Generates standard EPUB 3 format (cover, copyright, TOC, image support). See [docs/epub.en.md](epub.en.md).

> 💡 **Split-volume export**: `--split-by-volume` generates `Title-<volume>.epub` based on the `volume` field in `config.json`, ideal for long-form publishing (million-word scale).

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

**Pipe-friendly (`--stdout`)**:

```bash
# Output to stdout (composable with jq and other tools)
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

- 🤖 **AI workflows**: feed stories to Claude / ChatGPT for rewriting, translation, analysis (pipe directly with `--stdout`)
- 📊 **Data analysis**: chapter counts, word count trends, character appearances
- 📝 **Obsidian Dataview**: query and manage your story library

---

## 📝 Merged Markdown Export

```bash
story export md
```

Exports each story as a **single-file Markdown** (`dist/md/Story Title.md`) with YAML frontmatter metadata.

**Pipe-friendly (`--stdout`)**:

```bash
# Output to stdout (multiple stories joined by a separator, pipe straight to pandoc)
story export md --stdout
story export md --stdout | pandoc -f markdown -t docx -o book.docx
```

> Multiple stories are separated by `<!-- story-separator -->`, and each part is a valid standalone Markdown file.

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

## 🧠 Embeddings Export (vector search)

```bash
story export embeddings                 # outputs to dist/embeddings.jsonl
story export embeddings --stdout        # pipe output
story export embeddings --output=dist/custom
```

Cleans each story **into plain text chunks per chapter**, output as JSONL:

```json
{"folder":"01-storyA","title":"StoryA","type":"original","chunkIndex":0,"chapter":"Chapter 1","text":"..."}
{"folder":"01-storyA","title":"StoryA","type":"original","chunkIndex":1,"chapter":"Chapter 2","text":"..."}
```

Each line is a chunk with `folder` / `title` / `type` / `chunkIndex` / `chapter` / `text`.

> 💡 **Design philosophy**: story-cli **only cleans, does not bundle a vector store** — it hands you clean text chunks to feed into Chroma / LanceDB / OpenAI or any embedding service. **We format, they retrieve.**

**Use cases**:

- 🧠 **Semantic search / RAG**: load the JSONL into a vector database for content-based (rather than keyword) search
- 🤖 **AI context**: feed relevant chapter chunks to an LLM for continuation or analysis, loading on demand to save tokens

---

## 🔗 Toolchain Combinations (work with other tools)

story-cli doesn't enumerate every output format — instead it combines `--stdout` with specialized tools for advanced conversions.

### Export to YAML

```bash
# Install yq first (brew install yq / apt install yq)
story export json --stdout | yq -P > stories.yaml
```

### Export to Word (.docx)

```bash
# Install pandoc first (brew install pandoc)
story export md --stdout | pandoc -f markdown -t docx -o book.docx
```

### Export to PDF

```bash
# Option 1: browser print (recommended, see above)
# Option 2: wkhtmltopdf
story export html --output=dist/html
wkhtmltopdf dist/html/index.html book.pdf
```

### Word-count distribution report

```bash
story stats --json | jq -r '.stories[] | "\(.title): \(.wordCount)"'
```

### Series total word-count ranking

```bash
story stats --json | jq 'group_by(.series) | map({series: .[0].series, total: map(.wordCount) | add}) | sort_by(-.total)'
```

### Per-chapter word-count distribution

```bash
story export json --stdout | jq '.stories[].chapters | map(.title + ": " + (.content | length | tostring) + " chars")'
```

> **Principle**: the CLI provides atomic abilities (standard raw output); you orchestrate by composing tools freely. The data always stays in your hands.

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
| Semantic search / RAG                  | embeddings                    |
