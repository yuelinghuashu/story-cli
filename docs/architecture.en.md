# 🔧 Architecture

Understanding the build system and module design of this repository.

---

## 🏗️ Module Design

```text
Makefile                 # Dev workflow entry (make test / make build / make lint)
bin/
└── index.ts              # CLI entry (only calls run)

src/
├── cli.ts               # Command dispatch entry
├── args.ts              # CLI argument parsing (--key=value / --flag / positional + command splitting)
│
├── commands/            # Standalone CLI command implementations
│   ├── build.ts         # build command (including watch mode, async parallel loading)
│   ├── demo.ts          # demo command (generates an example repo)
│   ├── epub.ts          # EPUB export command
│   ├── export-html.ts   # export html command
│   ├── export-json.ts   # export json command
│   ├── export-md.ts     # export md command
│   ├── export-txt.ts    # export txt command
│   ├── export-embeddings.ts # export embeddings command (text chunks JSONL)
│   ├── import-json.ts   # import json command
│   ├── init.ts          # Repository initialization command
│   ├── link.ts          # story link command (related-story management)
│   ├── mcp.ts           # MCP Server startup command
│   ├── new-story.ts     # story new scaffolding command
│   ├── stats.ts         # story stats command
│   └── validate.ts      # story validate compliance-check command
│
├── core/                # Story management domain core
│   ├── scanner.ts       # Scan story folders, .storyignore rules, encoding detection
│   ├── story-text.ts    # Story content reading & chapter merging (text.md / chapter-*.md)
│   ├── content-parser.ts # Content parsing: chapter splitting, title extraction, word counting
│   ├── sort.ts          # Series grouping & sorting (series / seriesOrder logical coordinates)
│   ├── schema.ts        # Declarative validation rules (required / enum / format)
│   ├── validate.ts      # Generic validation engine based on schema (supports repo-level overrides)
│   ├── config.ts        # Repo-level config (story.config.json custom enums + localized labels)
│   ├── loader.ts        # Story loader (loadStories, shared by build & MCP; useCache incremental loading)
│   ├── story-cache.ts   # Incremental build cache (.story-cache.json: mtime+size fingerprint + cached derived data)
│   ├── sequence.ts      # Sequence number management (getNextNumber)
│   ├── exporter.ts      # Shared export utilities (forEachExportStory etc.)
│   ├── story-loader.ts  # Single-story config loading & validation
│   ├── compliance.ts    # Compliance check (shared by story validate / MCP)
│   ├── stats-shared.ts  # Shared statistics computation (CLI stats / MCP)
│   ├── watch-scheduler.ts # Watch debounce / serialize / queue scheduler
│   ├── link-suggestion.ts # build suggestion layer (zero-write)
│   └── types.ts         # Global TypeScript type definitions
│
├── mcp/                 # MCP Server adapter layer (AI client connection)
│   ├── protocol.ts      # JSON-RPC 2.0 protocol
│   ├── server.ts        # stdio server
│   └── tools.ts         # MCP tool registration
│
├── render/              # Rendering / output
│   ├── readme.ts        # Generate story READMEs and root README (template-driven)
│   ├── template.ts      # Handlebars template rendering (with compile cache)
│   ├── epub-generator.ts # EPUB 3 generator (cover rendering / stylesheet / NCX compat / series metadata)
│   ├── epub-assets.ts   # Cover image loading & safety validation
│   ├── md-to-html.ts    # Markdown → HTML converter
│   └── html-utils.ts    # Shared HTML utilities (escapeHtml / sanitizeUrl / PAGE_STYLE / readConfigTitle)
│
└── utils/               # Side-effect-free pure utilities
    ├── cli-utils.ts     # CLI shared utilities
    ├── constants.ts     # Constants (thresholds / timeouts / paths / error codes)
    ├── encoding.ts      # UTF-8 / GBK encoding detection
    ├── error-handler.ts # Unified error handling (normalizeError / ErrorCollector)
    ├── errors.ts        # Structured errors (StoryError + error codes)
    ├── json-utils.ts    # Unified JSON reading flow
    ├── paths.ts         # Path resolution
    ├── unicode.ts       # Unicode text utilities (safeTail etc.)
    ├── word-count.ts    # Language-aware word counting (incl. parseWordCount reverse parser)
    └── phrase-frequency.ts # Zero-dependency repeated-phrase frequency (zh bigram / en words)

tests/                   # node:test tests (zero additional test dependencies)
bench/                   # Benchmark suite (generate.ts creates repos + bench.ts measures timings)
templates/               # Scaffolding templates (config + story README template)
```

> 💡 `src/i18n/`（`index.ts` / `zh.ts` / `en.ts`）是顶层目录，存放中英文案与 `getLocale` 等 i18n 工具。

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
    ├── Makefile.template   # Workflow entry (make new/commit/push/stats/analyze)
    ├── story.ps1.template  # Windows PowerShell workflow entry (.\story.ps1)
    ├── README.md           # Initial README
    ├── LICENSE             # --full mode: CC BY-NC-SA 4.0
    ├── add-story.md        # --full mode: How to add a story
    └── CHANGELOG.md        # --full mode: Changelog (with {{DATE}} placeholder)
```

### 💡 Project Root Makefile (Dev Workflow)

The root `Makefile` is the **developer workflow entry**. Use `make help` to see all commands:

```bash
make build       # Compile (tsc → dist/)
make test        # Run all tests (node:test)
make typecheck   # TypeScript type check
make lint        # Lint (biome)
make lint-fix    # Auto-fix lint issues
make format      # Format code
make demo        # Generate a demo story repo
```

When `story init` runs in a user repository, it generates a **user workflow Makefile** (`make new` / `make commit` / `make push`). The project root Makefile and the user template Makefile are two sides of the same layered philosophy — **atomic capabilities + workflow orchestration**.

### 💡 Custom Template Notes

`root-template.md` / `story-template.md` use the [Handlebars](https://handlebarsjs.com/) template engine. **Handlebars preserves blank lines in templates as-is** — blank lines in the template are reflected directly in the final README output:

- **Keep exactly one blank line between Markdown paragraphs** — extra blank lines cause inconsistent rendering, while missing blank lines merge paragraphs together
- Handlebars block tags (`{{#if}}` / `{{#each}}` / `{{else}}` / `{{/if}}`) produce no content themselves, but blank lines before/after block tags are preserved — when a condition is false or a list is empty, these "leaked blank lines" result in multiple consecutive blank lines in the output
- **Avoid arbitrarily adding or removing blank lines in templates**. If you do adjust the layout, run `story build` to verify the output and use `git diff` to confirm the change scope matches expectations

### 📋 Template Variable Reference

#### Root README Template (root-template.md)

The following variables are provided by `src/render/readme.ts` and can be used in the root README template:

| Variable                                            | Type    | Description                                                             |
| --------------------------------------------------- | ------- | ----------------------------------------------------------------------- |
| `rootTitle`                                         | string  | Repository title                                                        |
| `rootStats`                                         | string  | Stats (story count / total word count / last updated)                   |
| `rootWelcome`                                       | string  | Welcome text                                                            |
| `tocLabel`                                          | string  | Table of contents heading                                               |
| `tocStoryList`                                      | string  | TOC "Story List" link text                                              |
| `tocHowToAdd`                                       | string  | TOC "How to Add a Story" link text                                      |
| `tocArchitecture`                                   | string  | TOC "Architecture" link text                                            |
| `tocSponsor`                                        | string  | TOC "Support" link text (shown when `hasSponsor` is true)               |
| `tocLicense`                                        | string  | TOC "License" link text                                                 |
| `storyListTitle`                                    | string  | Story list heading                                                      |
| `storyListHeader`                                   | string  | Story list table header (first Markdown table row)                      |
| `storyListHint`                                     | string  | Story list hint text                                                    |
| `hasSeries`                                         | boolean | Whether series groups exist (use with `{{#if}}`)                        |
| `seriesGroups`                                      | array   | Series groups array, structure: `{ name: string, stories: StoryRow[] }` |
| `hasUngrouped`                                      | boolean | Whether standalone stories exist                                        |
| `ungroupedStories`                                  | array   | Standalone stories array (`StoryRow[]` structure)                       |
| `independentStoriesTitle`                           | string  | Standalone stories section heading                                      |
| `howToAddTitle`                                     | string  | "How to Add a Story" heading                                            |
| `howToAddDesc`                                      | string  | "How to Add a Story" description                                        |
| `howToAddStep1` / `howToAddStep2` / `howToAddStep3` | string  | Three-step guide                                                        |
| `architectureTitle`                                 | string  | Architecture section heading                                            |
| `architectureDesc`                                  | string  | Architecture description                                                |
| `hasSponsor`                                        | boolean | Whether sponsor images exist (true when `assets/sponsor/` has images)   |
| `sponsorTitle`                                      | string  | Support section heading                                                 |
| `sponsorSummary`                                    | string  | Support collapsible summary                                             |
| `sponsorImages`                                     | array   | Sponsor images array, structure: `{ src: string, alt: string }`         |
| `licenseTitle`                                      | string  | License heading                                                         |
| `licenseOriginal`                                   | string  | Original story license text                                             |
| `licenseFanfic`                                     | string  | Fan fiction license text                                                |
| `autoGenerated`                                     | string  | Auto-generated notice                                                   |

**StoryRow structure** (elements in `seriesGroups[].stories` and `ungroupedStories`):

| Field           | Type   | Description                                       |
| --------------- | ------ | ------------------------------------------------- |
| `num`           | string | Global sequence number (e.g. `01`, `02`)          |
| `folder`        | string | Story folder name                                 |
| `title`         | string | Story title                                       |
| `typeDisplay`   | string | Localized type text                               |
| `wordCount`     | string | Formatted word count                              |
| `statusDisplay` | string | Localized status text                             |
| `summary`       | string | Single-line summary (auto-truncated to 120 chars) |

#### Story README Template (story-template.md)

The following variables are provided by `src/commands/build.ts` and can be used in the story README template:

| Variable            | Type   | Description                                                      |
| ------------------- | ------ | ---------------------------------------------------------------- |
| `title`             | string | Story title                                                      |
| `type`              | string | Story type code (`original` / `fanfic` / custom)                 |
| `status`            | string | Story status code (`completed` / `ongoing` / custom)             |
| `summary`           | string | Story summary                                                    |
| `created`           | string | Creation date (`YYYY-MM-DD`)                                     |
| `language`          | string | Language (`zh` / `en`)                                           |
| `author`            | string | Author (optional)                                                |
| `originalWork`      | string | Original work name (fanfic, optional)                            |
| `originalAuthor`    | string | Original author (fanfic, optional)                               |
| `wordCount`         | string | Formatted word count                                             |
| `cover`             | string | Cover path (optional)                                            |
| `series`            | string | Series name (optional)                                           |
| `seriesOrder`       | number | Series sort key (optional)                                       |
| `volume`            | string | Volume name (optional)                                           |
| `typeDisplay`       | string | Localized type text                                              |
| `statusDisplay`     | string | Localized status text                                            |
| `chapters`          | array  | Chapters list, structure: `{ title: string, wordCount: string }` |
| `backToStoryList`   | string | "Back to story list" link text                                   |
| `seriesLabel`       | string | Series label text                                                |
| `basicInfoTitle`    | string | Basic info heading                                               |
| `typeLabel`         | string | Type label                                                       |
| `wordCountLabel`    | string | Word count label                                                 |
| `statusLabel`       | string | Status label                                                     |
| `createDateLabel`   | string | Publish date label                                               |
| `summaryTitle`      | string | Summary heading                                                  |
| `readingGuideTitle` | string | Reading guide heading                                            |
| `textFileLabel`     | string | Text file label                                                  |
| `chaptersTitle`     | string | Chapters heading                                                 |
| `licenseTitle`      | string | License heading                                                  |
| `licenseText`       | string | License body (selected by story type)                            |
| `licenseNote`       | string | Fan fiction additional license note (non-empty for fanfic)       |
| `autoGenerated`     | string | Auto-generated notice                                            |

#### Available Conditionals in Templates

Templates use [Handlebars](https://handlebarsjs.com/) syntax and support:

```handlebars
{{#if hasSponsor}}   <!-- boolean condition -->
{{#if series}}       <!-- string existence -->
{{#each chapters}}   <!-- array iteration -->
{{#if (eq lang "en")}}  <!-- string equality (built-in eq helper) -->
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

### 2. Series Grouping & Sorting (sort.ts)

> Design rationale (the "physical vs logical coordinates" motivation and benefits) is in [design.en.md](../docs/design.en.md#🧮-fractional-indexing-physical-vs-logical-coordinates). This section only covers implementation details.

`sort.ts` implements the `series` / `seriesOrder` logical-coordinate sorting:

- **Logical coordinates**: `series` / `seriesOrder` in `config.json` control README display order; `seriesOrder` supports decimals (fractional indexing)
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
- `readConfigTitle` — read story title from config (used by the epub command to locate targets)

### 5. Zero-Build Runtime (bin/index.ts)

```ts
#!/usr/bin/env node
import { run } from "../src/cli.ts"
run(process.argv)
```

The published package ships compiled `dist/` output (compatible with Node 22+). For development, you can run `.ts` source directly with Node.js 24+ native TypeScript type stripping, **no compilation step needed**. This is why `engines.node >= 22` for the published runtime.

### 6. Writing Statistics (stats.ts)

`story stats` provides creative data analysis, complementing `git status`'s "file change perspective":

- **Story statistics**: total stories, completed/ongoing status distribution, total word count, chapter count
- **Series progress**: stories per series + completion rate (by `status` field)
- **Health checks**: config `wordCount` vs actual divergence >20% warning (`stale-word-count`)
- **Repeated phrases**: `analysis.repeated` global top-10 repeated phrases (Chinese bigrams / English words)
- **Writing activity**: monthly/last-month added lines (approximate word count) via `git log --numstat`, counting only files inside story folders
- **`--json` output**: structured data, pipe-friendly

### 7. EPUB Generation (epub-generator.ts)

An EPUB is essentially a ZIP package. This project generates the file structure defined by the EPUB 3 spec directly (with an EPUB2 compatibility layer):

```text
├── mimetype              ← Must be first and uncompressed (STORE mode)
├── META-INF/container.xml
└── OEBPS/
    ├── content.opf       ← Metadata + spine manifest (date / rights / series)
    ├── toc.xhtml         ← EPUB3 nav table of contents
    ├── toc.ncx           ← EPUB2 compatibility TOC (Kindle / legacy ADE)
    ├── styles.css        ← Built-in typesetting stylesheet (overridable via --css)
    ├── chapterN.xhtml    ← Individual chapters
    ├── titlepage.xhtml   ← Title page (cover image centered)
    └── images/           ← Embedded images
```

**Highlights**:

- Runtime dependencies are only `fflate` (ZIP packaging) and `handlebars` (template rendering)
- Markdown → HTML converter supports tables, nested lists, code blocks, and more
- Image paths support absolute paths / story-folder-relative / project-root-relative
- Cover is marked via `properties="cover-image"` (legacy reader recognition) and rendered on the title page
- Built-in stylesheet (`--css=<path>` replaces it wholesale); NCX compatibility TOC keeps older readers working
- Series metadata (`belongs-to-collection` + `group-position`) enables bookshelf series grouping

### 8. Structured Error Handling (errors.ts)

CLI tool errors need to be both **machine-readable** and **human-readable**. `StoryError` provides this structured design:

```ts
class StoryError extends Error {
  code: ErrorCodeValue // Machine-readable error code (e.g. "CONFIG_PARSE")
  context: Record<string, unknown> // Structured context (story folder name, etc.)
}
```

**Error code reference**:

| Error code        | Trigger                                                | Example fix                                    |
| ----------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `CONFIG_MISSING`  | Story folder missing `config.json`                     | Run `story new` or create one manually         |
| `CONFIG_PARSE`    | `config.json` is not valid JSON                        | Check for syntax errors in the file            |
| `CONFIG_INVALID`  | Config validation failed (e.g. missing required field) | Read the specific field from the error message |
| `STORY_NOT_FOUND` | `story epub "Title"` found no matching story           | Check if the title matches the folder name     |
| `EMPTY_CONTENT`   | Story content is empty when exporting EPUB             | Write content into `text.md`                   |
| `EPUB_EXPORT`     | Error during EPUB generation                           | Check the error message details                |
| `IMAGE_MISSING`   | Image path points to a non-existent file               | Verify the image path is correct               |
| `IMAGE_READ`      | Failed to read an image file                           | Check file permissions                         |
| `INVALID_ARGS`    | Invalid CLI arguments (e.g. `epub` without a title)    | Run `story help` for usage                     |
| `WATCH_ERROR`     | Error during watch mode                                | Check filesystem permissions                   |

**Design principles**:

- The CLI entry (`cli.ts`) catches all exceptions and formats them uniformly via `formatError`
- `context` provides machine-readable attachment info (e.g. `{ folder: "01-story-name" }`) for automation tools
- Config validation errors use `ValidationIssue[]` (a structured issue list) instead of concatenated strings
- Setting `DEBUG` prints full stack traces; by default only user-friendly error messages are shown

### 9. Incremental Build Cache (story-cache.ts)

Every `story build` re-reads each story's content and re-runs word counting / chapter splitting. `story-cache.ts` records fingerprints of each story's derived `StoryData` fields in `.story-cache.json` at the repo root (Git-ignored), and reuses them on a hit:

- **Fingerprint** = config (serialized normalized object) + content source (`text.md` mtime + size, stat only — no content read) + repo-level config; any change invalidates the entry
- **Read-only optimization**: on a cache hit `story.content` is an empty string — the build path's README rendering and link suggestions never need the content; MCP / watch paths leave the cache disabled by default
- **Correctness boundaries**: only `text.md`-sourced stories are cached (multi-chapter merged stories always take the full path, so the side effect of materializing `text.md` is never skipped); a CLI upgrade or a `story.config.json` change invalidates the whole cache; any cache read/write failure silently degrades to a full build
- **Companion optimization**: `suggestLinks` now buckets stories by `series` and only compares within buckets, eliminating O(n²) all-pairs traversal on large repos

Measured on a 100-story × 1MB novel repo: cold build ~4.3s → warm build ~0.2s (~22×).

> 💡 `.story-cache.json` is pure cache — deleting it just falls back to a full build, no residual risk. Repos created via `story init` already ignore it; **repos created before this feature** should append `.story-cache.json` to their `.gitignore` manually to keep it out of `git status`.

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
- Key behavior coverage: scanning, sorting, validation, rendering, word counting, i18n, README generation, EPUB export, repo config, CLI commands

### 📊 Performance Benchmark

Measured with `bench/generate.ts` (creates the repo) + `bench/bench.ts` (runs timings):

**Benchmark repo size** (2000 stories):

| Dimension         | Value                               |
| ----------------- | ----------------------------------- |
| Stories           | 2,000                               |
| Total chapters    | ~12,000                             |
| Stats word count  | ~84,000 words                       |
| Source files size | ~1.4 MB (excluding exports)         |
| Total files       | ~10,000                             |
| Per-story average | text.md ~828 B + config.json ~618 B |

**Results** (on current dev machine, repo generated with `node bench/generate.ts 2000`):

| Operation                  | Time    |
| -------------------------- | ------- |
| `build --validate-only`    | ~510 ms |
| `build` (full, cold cache) | ~870 ms |
| `build` (full, cache hit)  | ~770 ms |
| `export json`              | ~260 ms |
| `export md`                | ~330 ms |
| `epub --all`               | ~1.7 s  |

> With toy-sized stories (hundreds of bytes each), word counting is a tiny share of the work, so the cold/warm difference is small; the incremental cache pays off mainly on **realistic** repos.

**Incremental cache benefit** (realistic scale: 100 stories × 1MB novels):

| Scenario                                | Time   |
| --------------------------------------- | ------ |
| Cold build (first run, fills cache)     | ~4.3 s |
| Warm build (subsequent runs, cache hit) | ~0.2 s |

**Watch incremental rebuild**: single-story change detect + rebuild ≈ **304 ms** (includes 300ms debounce; actual rebuild ~4ms).

> ⚠️ Performance depends on hardware; these are reference values from the current dev machine.
>
> 💡 Reproduce: `node bench/generate.ts 2000 <dir>` + `node bench/bench.ts <dir>` (`bench.ts` prints a cold / warm build comparison)
