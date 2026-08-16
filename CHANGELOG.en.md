# Changelog

This project follows [Semantic Versioning](https://semver.org/).

## [1.3.0] - 2026-08-16

### Added

- **MCP Server**: AI clients (Claude Desktop / Cursor) can read and write your content library directly. Exposes 8 tools covering the full "browse → read → write → validate → build → stats" loop; built-in Token optimizations (compact output / on-demand loading / tail truncation)
- **General-purpose content platform**: `story init` supports three preset templates (story / knowledge / tech), covering fiction, knowledge base, and tech docs scenarios
- **`--stdout` pipeline export**: `export md / txt / json` support stdout, composable with external tools (yq / jq / pandoc)
- **`stats --json` enhanced**: each story now includes chapter/paragraph/dialogue details, feeding `make analyze`
- **GitHub Action**: zero-config CI entry, one-click "Push → Build → Release" pipeline
- **Makefile verify target**: one-command validation (typecheck + lint + test + build)

### Improved

- **Markdown renderer refactored**: nested formatting, URL parenthesis balancing, list indentation continuation, lists inside blockquotes; 20+ new boundary tests
- **Shared module extraction**: `loader` / `sequence` / `exporter` / `epub-assets` / `json-utils` eliminate duplicated code
- **`--save-counts` batch writes**: config writes switch from serial IO to parallel batch for 1000+ story repos
- **Watch mode**: exception recovery without crashing, auto-listens to newly created story directories
- **MCP `generateReadmes` supports injectable logger**: removes the fragile global `console.log` interception approach

### Fixed

- **XSS vulnerability**: `sanitizeUrl` now uses a data URI whitelist
- **URL double-escaping**: Markdown link rendering escapes capture groups individually
- **Shell injection risk**: `execSync` → `execFileSync`

### Tests

- Added boundary tests: Markdown rendering (nested / URL / encoding safety), MCP protocol/tools, `--stdout` pipeline, `sanitizeFileName` / `extractNumericWordCount` / template cache
- 423 tests run, 420 pass (3 GBK tests skipped on small-ICU Node builds)

<details>
<summary>## [1.2.0] - 2026-08-15</summary>

### Added

- **`story demo` command**: generates a complete demo repository with one command
- **`story stats` command**: writing statistics (word counts / series progress / activity, with `--json`)
- **Makefile workflow**: `story init` generates by default — `make new/build/commit/push` etc. (Windows also gets `story.ps1`)
- **`story export json --stdout`**: JSON export supports stdout (pipe-friendly)
- **Benchmark suite**: new `bench/` scripts to generate large repos and measure performance
- **Watch mode incremental rebuild**: single-story changes rebuild only that story's README, not everything
- **Split-volume EPUB export**: `story epub --split-by-volume` splits by the `volume` field
- **UTF-8 encoding detection**: detects GBK/GB2312 and other non-UTF-8 encodings on file reads, warns without blocking (zero new dependencies)
- **README comparison section**: "Why story-cli?" table vs web novel software

### Fixed

- EPUB cover warnings i18n
- Removed unsafe type assertions in `build.ts`
- Eliminated shell injection risk (`execSync` → `execFileSync`)

### Improved

- Chinese rare character counting (CJK Extension A/B)
- Chapter extraction deduplication (shared `splitSections`)
- Watch mode enhancement (new story folders trigger rebuilds)
- EPUB title matching (config `title` first, ambiguous matches error out)
- CI coverage (91.51%)
- Template variable documentation (full reference tables in architecture docs)
- Template cache invalidation: `renderTemplate` now checks file mtime — template edits auto-recompile (watch-mode friendly)
- Cross-platform filename consistency: `sanitizeFileName` uses unified Windows rules, documented design intent
- SVG safety check: added CSS `expression()` injection guard
- Bench path resolution: `bench.ts` uses `fileURLToPath` to locate the project root instead of hardcoded relative paths
- Word count extraction defense: `extractNumericWordCount` documents language/format mutual exclusivity

### Tests

- All 265 tests pass (+13, including encoding detection)

</details>

<details>
<summary>## [1.1.0] - 2026-08-15</summary>

### Added

- **Series grouping & sorting**: new optional `series` / `seriesOrder` / `volume` fields in `config.json` (fractional indexing, insert anywhere without renumbering)
- **Standalone stories section**: stories without a `series` are grouped as "Standalone Stories", sorted by folder number
- **Folder rename detection**: `story build` detects staged story folder renames (`git status` R state), emits a gentle warning without blocking the build
- **JSON export**: `story export json` exports structured JSON with chapters, word counts, and metadata (AI-friendly, Obsidian Dataview-compatible)
- **JSON import**: `story import json` imports JSON → auto-generates convention-compliant story directories, symmetric with `export json`
- **Merged Markdown export**: `story export md` exports each story as a single Markdown file (with YAML frontmatter)
- **`.storyignore` exclusion rules**: exclude drafts/temp files from scanning and stats (simplified `.gitignore` subset; `story init` generates a template automatically)
- **Documentation**: `docs/specification.md` (Repository Specification v1.0) + "Toolbox, Not an All-in-One Suite" section in `docs/design.md` (bilingual)

### Changed

- Story folder sorting changed from lexicographic to **numeric order** (`12-` < `100-`)
- Root README template supports series grouping and standalone stories sections
- **PDF export (browser print)**: `export html` adds `@media print` styles — save directly as PDF from the browser
- Cleanup: removed unused function in `validate.ts`, `build.ts` reuses shared `detectCliLang`, fixed `new-story.ts` sequential regex
- README badge: hardcoded test count → CI dynamic badge
- **i18n module restructure**: `src/utils/i18n.ts` (512 lines) split into top-level `src/i18n/` (index.ts + zh.ts + en.ts)
- **Chapter naming convention**: `specification.md` §3.2 adds recommended naming patterns (simple sequence / volume-chapter / script-scene) + zero-padding rules

### Tests

- 228 tests pass (+30), adding coverage for `.storyignore` (8 tests), `import json` (10 tests), and series grouping / fractional index / rename detection integration tests

</details>

<details>
<summary>## [1.0.0] - 2026-08-14</summary>

### Core Features

- Directory convention for managing stories (`NN-name/` + `config.json` + `text.md`)
- `story init` / `story new` scaffolding
- `story build` auto-generates story README + root index README
- `story build --validate-only` / `--save-counts` / `--watch`
- `story epub` exports EPUB 3 (cover, copyright, TOC, images)
- `story export html` exports a static site
- `story export txt` one-command export of all stories as `.txt`
- Declarative config validation (required, enum, format, conditional)
- Bilingual support (story language + CLI language detection)
- Repo-level custom enums (`story.config.json`)
- Language-aware word counting (Chinese chars / English words)
- Donation support (`assets/sponsor/` auto-generates collapsible section)

### Release Prep & Engineering Improvements

- **Compiled release**: fixed npm global install compatibility (Node 24 disallows executing `.ts` under `node_modules`); release package now ships compiled `dist/` output
- **Build pipeline**: added `pnpm build` (`tsc -p tsconfig.build.json`), `prepack` auto-compiles
- **Path resolution**: added `src/utils/paths.ts` to unify package-root/template resolution, compatible with both source and compiled runs
- **export-html refactor**: unified i18n + config validation + structured error handling (replaces hardcoded Chinese)
- **Async FS optimization**: build hot path loads stories in parallel (`Promise.all`), significantly faster for large repositories
- **Markdown rendering fixes**:
  - Fixed `<br/>` inside paragraphs being HTML-escaped as text
  - Added backslash escape support (`\*` → literal `*`)
- **Redundant function extraction**: `cli-utils.ts` unifies `detectCliLang` / `sanitizeFileName`
- **Design docs**: added `docs/design.md` / `docs/design.en.md`
- **CI polish**: `build.yml` adds `pnpm build` step to verify compiled output

### Tests

- All 175 tests pass, covering: scanner, validation, template rendering, word counting, i18n, README generation, EPUB export (including cover images), argument parsing, repo config, CLI entry points, Markdown conversion edge cases

</details>
