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

### 2. Language Awareness (i18n.ts + word-count.ts)

- Each story declares `language` (`zh` / `en`) in `config.json`
- `resolveLang` resolves the language; `formatType` / `formatStatus` map display text by language
- Repo-level config supports `typeLabels` / `statusLabels` for localized labels on custom enums
- Root README language is automatically decided by the stories' languages (English if all English, otherwise Chinese)
- Word counting: Chinese counts characters, English counts words

### 3. Shared HTML Utilities (html-utils.ts)

`html-utils.ts` centralizes cross-module HTML helpers to avoid duplication:

- `escapeHtml` — HTML special character escaping (shared by export-html / epub-generator)
- `sanitizeUrl` — dangerous URL protocol filtering (XSS protection: `javascript:`, `vbscript:`, `data:text/html` are blocked)
- `PAGE_STYLE` — page style constant (used by export-html)
- `readStoryTitle` — read story title from config (used by export-html)

### 4. Zero-Build Runtime (bin/index.ts)

```ts
#!/usr/bin/env node
import { run } from "../src/cli.ts"
run(process.argv)
```

The published package ships compiled `dist/` output (compatible with Node 20+). For development, you can run `.ts` source directly with Node.js 24+ native TypeScript type stripping, **no compilation step needed**. This is why `engines.node >= 20` for the published runtime.

### 5. Minimal-Compliant EPUB Generation (epub-generator.ts)

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
