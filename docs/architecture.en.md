# 🔧 Architecture

Understanding the build system and module design of this repository.

---

## 🏗️ Module Design

```text
bin/
└── index.ts              # CLI entry (only calls run)

src/
├── cli.ts               # Command dispatch entry
├── args.ts              # CLI argument parsing (--key=value / --flag / positional + command splitting)
│
├── commands/            # Standalone CLI command implementations
│   ├── build.ts         # build command (including watch mode)
│   ├── epub.ts          # EPUB export command
│   ├── export-html.ts   # export html command
│   ├── init.ts          # Repository initialization command
│   └── new-story.ts     # story new scaffolding command
│
├── core/                # Story management domain core
│   ├── scanner.ts       # Scan story folders, read content, extract chapters
│   ├── sort.ts          # Series grouping & sorting (series / seriesOrder logical coordinates)
│   ├── schema.ts        # Declarative validation rules (required / enum / format)
│   ├── validate.ts      # Generic validation engine based on schema (supports repo-level overrides)
│   ├── config.ts        # Repo-level config (story.config.json custom enums + localized labels)
│   └── types.ts         # Global TypeScript type definitions
│
├── render/              # Rendering / output
│   ├── readme.ts        # Generate story READMEs and root README (template-driven)
│   ├── template.ts      # Handlebars template rendering (with compile cache)
│   ├── epub-generator.ts # Minimal EPUB 3 generator + Markdown → HTML
│   └── html-utils.ts    # Shared HTML utilities (escapeHtml / sanitizeUrl / PAGE_STYLE / readStoryTitle)
│
└── utils/               # Side-effect-free pure utilities
    ├── i18n.ts          # Chinese/English locale strings
    ├── errors.ts        # Structured errors (with error codes + context)
    └── word-count.ts    # Language-aware word counting

tests/                   # node:test tests (zero additional test dependencies)
templates/               # Scaffolding templates (config + story README template)
```

`templates/` directory structure:

```text
templates/
├── config.fanfic.json      # Fan-fic config template
├── config.original.json    # Original story config template
├── root-template.md        # Root README Handlebars template
├── story-template.md       # Story README Handlebars template
├── story.config.json       # Repo config template
└── scaffold/               # story init scaffolding templates
    ├── .gitignore.template # Ignore rules (npm excludes .gitignore)
    ├── README.md           # Initial README
    ├── LICENSE             # --full mode: CC BY-NC-SA 4.0
    ├── add-story.md        # --full mode: How to add a story
    └── CHANGELOG.md        # --full mode: Changelog (with {{DATE}} placeholder)
```

### 💡 Custom Template Notes

`root-template.md` / `story-template.md` use the [Handlebars](https://handlebarsjs.com/) template engine. **Handlebars preserves blank lines in templates as-is** — blank lines in the template are reflected directly in the final README output:

- **Keep exactly one blank line between Markdown paragraphs** — extra blank lines cause inconsistent rendering, while missing blank lines merge paragraphs together
- Handlebars block tags (`{{#if}}` / `{{#each}}` / `{{else}}` / `{{/if}}`) produce no content themselves, but blank lines before/after block tags are preserved — when a condition is false or a list is empty, these "leaked blank lines" result in multiple consecutive blank lines in the output
- **Avoid arbitrarily adding or removing blank lines in templates**. If you do adjust the layout, run `story build` to verify the output and use `git diff` to confirm the change scope matches expectations

---

## 🎯 Core Design Ideas

### 1. Declarative Validation (schema.ts)

All config validation rules live in `schema.ts`, while `validate.ts` only executes them generically:

```ts
// schema.ts — just add one entry to get full validation
export const FIELD_RULES: Record<string, FieldRule> = {
  title: { type: "string" },
  type: { type: "string", enum: VALID_TYPES },
  created: { type: "string", pattern: DATE_PATTERN },
  // ...
}
```

**Benefit**: adding a new field requires no changes to the validation engine logic, reducing maintenance cost.

### 2. Series Grouping & Sorting (sort.ts)

`sort.ts` implements the "physical coordinates never change, logical coordinates freely adjustable" sorting design:

- **Physical coordinates**: folder name `NN-` prefix — set once and never modified (keeping Git links stable)
- **Logical coordinates**: `series` / `seriesOrder` in `config.json` control README display order
- `seriesOrder` supports decimals (fractional indexing) — insert anywhere without renumbering other stories
- In-group sorting: `seriesOrder` numeric ascending, falls back to folder number when missing
- Between-group sorting: by group's min folder number, series name as tiebreaker
- Stories without `series` are grouped under "Standalone Stories", sorted by folder number

### 3. Language Awareness (i18n.ts + word-count.ts)

- Each story declares `language` (`zh` / `en`) in `config.json`
- `resolveLang` resolves the language; `formatType` / `formatStatus` map display text by language
- Repo-level config supports `typeLabels` / `statusLabels` for localized labels on custom enums
- Root README language is automatically decided by the stories' languages (English if all English, otherwise Chinese)
- Word counting: Chinese counts characters, English counts words

### 4. Shared HTML Utilities (html-utils.ts)

`html-utils.ts` centralizes cross-module HTML helpers to avoid duplication:

- `escapeHtml` — HTML special character escaping (shared by export-html / epub-generator)
- `sanitizeUrl` — dangerous URL protocol filtering (XSS protection: `javascript:`, `vbscript:`, `data:text/html` are blocked)
- `PAGE_STYLE` — page style constant (used by export-html)
- `readStoryTitle` — read story title from config (used by export-html)

### 5. Zero-Build Runtime (bin/index.ts)

```ts
#!/usr/bin/env node
import { run } from "../src/cli.ts"
run(process.argv)
```

The published package ships compiled `dist/` output (compatible with Node 20+). For development, you can run `.ts` source directly with Node.js 24+ native TypeScript type stripping, **no compilation step needed**. This is why `engines.node >= 20` for the published runtime.

### 6. Minimal-Compliant EPUB Generation (epub-generator.ts)

An EPUB is essentially a ZIP package. This project generates the file structure defined by the EPUB 3 spec directly:

```text
├── mimetype              ← Must be first and uncompressed (STORE mode)
├── META-INF/container.xml
└── OEBPS/
    ├── content.opf       ← Metadata + spine manifest
    ├── toc.xhtml         ← Table of contents navigation
    ├── chapterN.xhtml    ← Individual chapters
    └── images/           ← Embedded images
```

**Highlights**:

- Runtime dependencies are only `fflate` (ZIP packaging) and `handlebars` (template rendering)
- Markdown → HTML converter supports tables, nested lists, code blocks, and more
- Image paths support absolute paths / story-folder-relative / project-root-relative

### 7. Structured Error Handling (errors.ts)

CLI tool errors need to be both **machine-readable** and **human-readable**. `StoryError` provides this structured design:

```ts
class StoryError extends Error {
  code: ErrorCodeValue          // Machine-readable error code (e.g. "CONFIG_PARSE")
  context: Record<string, unknown>  // Structured context (story folder name, etc.)
}
```

**Error code reference**:

| Error code | Trigger | Example fix |
|------------|---------|-------------|
| `CONFIG_MISSING` | Story folder missing `config.json` | Run `story new` or create one manually |
| `CONFIG_PARSE` | `config.json` is not valid JSON | Check for syntax errors in the file |
| `CONFIG_INVALID` | Config validation failed (e.g. missing required field) | Read the specific field from the error message |
| `STORY_NOT_FOUND` | `story epub "Title"` found no matching story | Check if the title matches the folder name |
| `EMPTY_CONTENT` | Story content is empty when exporting EPUB | Write content into `text.md` |
| `EPUB_EXPORT` | Error during EPUB generation | Check the error message details |
| `IMAGE_MISSING` | Image path points to a non-existent file | Verify the image path is correct |
| `IMAGE_READ` | Failed to read an image file | Check file permissions |
| `INVALID_ARGS` | Invalid CLI arguments (e.g. `epub` without a title) | Run `story help` for usage |
| `WATCH_ERROR` | Error during watch mode | Check filesystem permissions |

**Design principles**:

- The CLI entry (`cli.ts`) catches all exceptions and formats them uniformly via `formatError`
- `context` provides machine-readable attachment info (e.g. `{ folder: "01-story-name" }`) for automation tools
- Config validation errors use `ValidationIssue[]` (a structured issue list) instead of concatenated strings
- Setting `DEBUG` prints full stack traces; by default only user-friendly error messages are shown

---

## 📦 Dependencies

| Package          | Type    | Purpose                        |
| ---------------- | ------- | ------------------------------ |
| `fflate`         | Runtime | EPUB ZIP packaging             |
| `handlebars`     | Runtime | README template rendering      |
| `typescript`     | Dev     | Type checking (`tsc --noEmit`) |
| `@types/node`    | Dev     | Node.js type definitions       |
| `@biomejs/biome` | Dev     | Code style (lint + format)     |

**Zero test framework dependencies**: tests use Node.js built-in `node:test`.

---

## 🧪 Testing Strategy

- Uses `node:test` + `node:assert` (zero additional dependencies)
- Each core module has an independent test file
- CLI entry points are integration-tested via `execFileSync` running real commands
- Key behavior coverage: scanning, validation, rendering, word counting, i18n, README generation, EPUB export, CLI commands
