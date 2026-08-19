# Changelog

This project follows [Semantic Versioning](https://semver.org/).

## [Unreleased] - 1.5.2

### Fixed

- **MCP JSON-RPC notification compliance**: `parseRequest` now correctly distinguishes requests from notifications (messages without `id`). Previously `notifications/initialized` — a mandatory step of the MCP handshake — was rejected with `-32600 Invalid request` and answered with an error response, violating JSON-RPC 2.0 §4.2 (notifications must not be answered, even with an error). This broke strict clients (Claude Desktop / Cursor) and produced ZodError noise in mcp-proxy logs. Valid notifications are now silently ignored (fire-and-forget) with no output

### Added

- **Dockerfile**: container image built from the published npm package (stdio MCP server, non-root user) for MCP directories such as Glama / Smithery build and introspection checks
- **npm metadata expansion**: description and keywords now cover content-management / data-pipeline / ebook / rag / fine-tuning / sft / model-training / content-governance, improving npm search discoverability

### Improved

- **Test temp-dir cleanup**: `cli.test.ts` `after()` cleanup switched from a broad `cli-` prefix match to `cleanupTempDirs` with an exact prefix list, avoiding deletion of temp dirs owned by other test files

### Tests

- Added 3 MCP tests: valid notification returns null (fire-and-forget), invalid notification (bad method / bad version) still throws InvalidRequest, and an end-to-end handshake (initialize → notifications/initialized → tools/list) produces exactly two responses
- 601 tests run, 598 pass (3 GBK tests skipped on small-ICU Node builds)

## [1.5.1] - 2026-08-19

### Fixed

- **EPUB spec compliance**: four generator defects discovered and fixed via spec-assertion tests — all XHTML content documents now include `<meta charset="UTF-8"/>` (required by the EPUB spec); NCX `dtb:uid` and `dc:identifier` UUID unified (previously generated separately, producing different values); `dcterms:modified` fixed to remove the duplicate trailing `Z` (produced `...45ZZ` instead of `...45Z`); `styles.css` added to the OPF manifest (EPUB spec requires all resources referenced by content documents to be declared)

### Improved

- **MCP stdout protocol safety**: `startMcpServer` now redirects `console.log` to stderr at startup, preventing any stray debug statements from polluting the JSON-RPC protocol stream (protocol output uses only `process.stdout.write`)
- **Subcommand --help**: `story <cmd> --help` now outputs the command-specific usage and description (with subcommand list if applicable) instead of global help; top-level `--help` still shows global help
- **EPUB spec compliance tests**: added 12 structural assertions (charset declaration, UUID consistency, ISO 8601 date format, NCX playOrder sequencing, styles.css media-type, empty description / long title / empty chapter edge cases), coverage from 52 → 64 tests

<details>
<summary>## [1.5.0] - 2026-08-19</summary>

### Added

- **`story demo` polish**: demo repo now includes `links` relations (showcases the README "Related Stories" section), a cover image and an inline illustration (zero-dependency generated valid PNGs, showcasing EPUB cover rendering and image embedding)
- **Contribution & feedback infrastructure**: GitHub Issue templates (bug report / feature request forms) and `CONTRIBUTING.md` / `CONTRIBUTING.en.md` contribution guides

### Fixed

- **`stats` data accuracy**: `stats --json` no longer silently swallows broken stories (errors now surface in the `errors` array, visible to pipeline consumers like `make analyze`); `countDialogues` no longer double-counts English quotes nested inside Chinese quotes
- **demo PNG**: `strToU8("\x89PNG...")` UTF-8-encodes U+0089 into two bytes, corrupting the signature; switched to a raw byte array (locked by a new unit test)
- **Watch mode process lifetime**: `bin/index.ts` now parses commands via `parseCommand` + `parseArgs` instead of hardcoding `argv[3]` position; `story build --validate-only --watch` (and any flag order) keeps listening correctly instead of exiting immediately
- **Chapter file sort order**: `chapter-*.md` now uses natural sort (`localeCompare` with `numeric: true`); `chapter-10.md` no longer sorts before `chapter-2.md`, compatible with unpadded chapter numbering
- **README rendering & Quick Start**: root README TOC anchors changed from the obsolete `<a name>` to `<a id>` (HTML5 spec, correct jumps under stricter renderers); auto-generated copyright line format changed from `_..._` back to `*...*` (renders as italic); the "🚀 Quick Start" section now leads with the `npm install` step

### Improved

- **EPUB productization**: cover image now rendered on the title page (centered); built-in `styles.css` typesetting (wholesale replaceable via `--css=<path>`); `toc.ncx` EPUB2 compatibility TOC (Kindle / legacy ADE); metadata enriched with `dc:date` / `dc:rights` / series (`belongs-to-collection` + `group-position`); `--output=<dir>` custom output directory
- **MCP governance deepening**: new `edit_config` tool (AI can edit governance fields like summary/status/series/links directly — whitelist + repo-level schema validation + atomic write, validation failure never writes); `story mcp-server --root=<path>` explicitly sets the repo root; `write_chapter` gains an optional `validate` flag (returns compliance check after writing); tool count 8 → 9
- **Incremental build cache** (`.story-cache.json`, Git-ignored): `story build` skips content reads and word counting for unchanged stories using cheap stat fingerprints; invalidated wholesale on CLI upgrade or repo config change, silently degrading to a full build on read/write failure. Benchmarked on a 100-story × 1MB novel repo: cold build 4.3s → warm build 0.2s (~22×)
- **Large-repo performance (O(n²) → O(n))**: `suggestLinks` buckets by `series` and compares within buckets only; `generateReadmes` hoists the `folderTitle` Map out of the per-story loop; `import json` computes the sequence number once then increments
- **Redundant computation elimination**: `loader` / `stats` count raw words once per story and scan chapters in a single pass; `renderInline` restores placeholders in one reverse-order pass (outer before inner), removing the while-loop rescan
- **Testing & benchmarks**: tests now run in parallel (full suite 46s → 16s, ~3×); `bench.ts` adds a "cold / warm (cache hit)" build comparison row and discards child process output
- **Housekeeping**: duplicate-number detection consolidated into the shared `scanner.checkDuplicateNumbers`; `prepublishOnly` changed from `lint:fix` to `lint` (publish no longer rewrites source)

</details>

<details>
<summary>## [1.4.0] - 2026-08-17</summary>

### Added

- **`story validate`**: Story-Repo spec compliance checker (folder naming / required files / UTF-8 / schema), supports `--json`, exit code 0/1
- **`story link`**: manages the weak `links` field in config.json (add / `--remove` / `--list`), idempotent dedup
- **`export embeddings`**: cleans stories into plain text chunks (JSONL), supports `--stdout`, for external vector retrieval
- **build suggestion layer**: detects candidate relations among stories with same `series` + shared keywords, suggests only without writing to disk
- **`stats --json` enhancements**: chapter `rawWordCount` numeric field; `analysis.repeated` top-10 repeated phrases; structured health `{ code, folder, message }`
- **Story-Repo spec upgraded to v2.0**: declares itself an independent open standard "not bound to story-cli", documents the `links` field
- Story README "Related Stories" section (auto-rendered when config has `links`)

### Fixed

- **Watch mode**: infinite rebuild loop (README content diff); lost changes during rebuild (queue + replay); `.storyignore` changes now trigger rebuild
- **`story export` no subcommand now errors** (previously silently ran HTML export)
- **`story new` title rules unified** to the sanitize approach (consistent with `import json` / MCP); whitespace-only titles rejected before folder creation
- **`export txt --stdout` separator**: HTML comment replaced with `====`
- **Sync/async chapter reading**: sync version now skips unreadable files (matching async behavior)
- **Writing activity stats**: `git log --numstat` now only counts files inside story folders (NN- prefix), no longer counting dist/ and other non-content changes
- **`import json`**: removed the nonexistent `--overwrite` misleading hint
- **Command registry**: `--help` / `-h` / `--version` / `-v` reclassified from "command aliases" to "global flags", fixing the defect where subcommand-level `story build --help` silently executed the command instead of showing help; help output now includes a "Global flags" section
- **Unicode truncation**: `.slice()` in `sanitizeFileName` / `truncateSummary` / MCP `tailLength` could split surrogate pairs (emoji / CJK Extension-B characters), producing broken surrogates (displayed as `�`); now safely truncates by Unicode code point

### Improved

- **Export dedup**: `json / md / txt / html` shared skeleton extracted into `forEachExportStory` iterator (~80 lines removed); unified `storyFileName` safe naming; skipped-count text moved to i18n
- **i18n consolidation**: `story new` / `import json` / EPUB license text migrated to bilingual locale
- **Unified statistics**: CLI `stats` and MCP `stats` share `computeStoryStats`, eliminating ~40 lines of duplication and behavioral drift
- **MCP**: `validate` reuses compliance checker; `create_story` / `import_json` support `links`
- **Writing health dashboard**: `stats --json` per story now adds three derived metrics — `avgChapterLen` (avg chapter length), `chapterLenStdDev` (pacing variance), `dialogueRatio` (dialogue/narration share) — for AI / scripts to assess pacing and structure
- **Windows CI**: CI adds an OS matrix (ubuntu + windows); the `build` script's `chmod` is replaced with cross-platform `fs.chmodSync` (no-op on Windows)

### Tests

- New WatchScheduler unit tests (debounce / queue / dispose), Watch integration tests (loop regression / new dir / invalid config recovery / `.storyignore`); compliance / story link / link suggestions / embeddings / stats parity — 45+ new tests
- 554 tests run, 551 pass (3 GBK tests skipped on small-ICU Node builds)

</details>

<details>
<summary>## [1.3.0] - 2026-08-16</summary>

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

</details>

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
