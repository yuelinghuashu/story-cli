# 📖 EPUB Export Guide

Convert stories to `.epub` with one command — perfect for e-readers.

---

## 🚀 Basic Usage

```bash
# Export a single story
story epub "Story Title"

# Export all stories
story epub --all
```

### Split-Volume Export (--split-by-volume)

For long stories (million-word scale), you can split a single EPUB into multiple volumes:

```bash
story epub "My Story" --split-by-volume
```

- When a `volume` field exists in `config.json`, the output filename becomes `My Story-<volume>.epub`
- Without a `volume` field, behavior is identical to normal export (single volume)
- Combine with `--all` to batch-export all stories as split volumes

Exported files go to `dist/epub/`:

```bash
dist/epub/
├── My Story.epub
├── Another Story.epub
└── ...
```

---

## 📝 Supported Markdown Syntax

| Syntax          | Example                    | Notes                       |
| --------------- | -------------------------- | --------------------------- |
| Bold            | `**text**`                 |                             |
| Italic          | `*text*`                   |                             |
| Strikethrough   | `~~text~~`                 |                             |
| Inline code     | `` `code` ``               |                             |
| Headings        | `#` ~ `###`                | Chapter titles render as h1 |
| Blockquote      | `> quoted text`            |                             |
| Link            | `[text](https://...)`      |                             |
| Image           | `![alt](assets/cover.png)` | See notes below             |
| Bullet list     | `- item`                   | Supports nested indentation |
| Numbered list   | `1. item`                  | Supports nested indentation |
| Table           | `\| col1 \| col2 \|`       | Standard Markdown table     |
| Code block      | ` ```js `                  | Preserves original format   |
| Horizontal rule | `---` or `***`             |                             |

---

## 🖼️ Cover Image

Add an optional `cover` field in `config.json` — the image will be used as the EPUB cover:

```json
{
  "title": "My Story",
  "type": "original",
  "status": "completed",
  "summary": "A short summary.",
  "created": "2026-08-14",
  "cover": "cover.jpg"
}
```

Cover paths support three forms (same resolution as inline images):

1. **Absolute path** — e.g. `/home/user/images/cover.png`
2. **Relative to story folder** — e.g. `cover.jpg` relative to `01-story-name/`
3. **Relative to project root** — e.g. `assets/cover.png` relative to the repo root

Supported formats: `png`, `jpg` / `jpeg`, `gif`, `webp`.

> ⚠️ If the cover file doesn't exist, export won't fail — a warning is printed and a text-only cover page is used.
> ⚠️ Without a `cover` field, a text-only cover page (title + author + summary) is used.

---

## 🖼️ Inline Image Support

Use Markdown image syntax in `text.md` to embed images into the EPUB:

```markdown
![Cover](assets/cover.png)
```

### Path Resolution (tried in order)

1. **Absolute path** — e.g. `/home/user/images/pic.jpg`
2. **Relative to story folder** — e.g. `assets/cover.png` relative to `01-story-name/`
3. **Relative to project root** — e.g. `assets/cover.png` relative to the repo root

### Notes

- ⚠️ External URLs (`https://`) are not downloaded, only referenced
- ⚠️ Missing image files print a warning and are skipped
- The same image referenced multiple times is only embedded once (auto-deduplicated)

---

## 🔄 Relationship with Chapter Splitting

- If you write in a single `text.md` file, `#` and `##` start new chapters; `###` and below are treated as subsections within a chapter (see [add-story.en.md](add-story.en.md#chapter-extraction-rules))
- If you use `chapter-*.md` files, `story epub` auto-merges them and exports per chapter

---

## 📦 Output Format

EPUB is standard EPUB 3:

- `mimetype` placed correctly (first & uncompressed)
- `content.opf` metadata (title, author, language, UUID)
- `toc.xhtml` navigation
- Chapter content as XHTML
- Cover image (optional) correctly marked via `properties="cover-image"`

Compatible with most major readers (Kindle, Apple Books, Kobo, WeRead, etc.).

> 💡 **Need PDF output?**
> See [docs/export.en.md](export.en.md#📄-pdf-export-browser-print) — story-cli doesn't bundle a PDF generator; use `story export html` + browser print instead.
