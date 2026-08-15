# Changelog

This project follows [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-08-15

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
- README badge: hardcoded test count → dynamic GitHub Actions CI badge
- **i18n module restructured**: `src/utils/i18n.ts` (512 lines) split into top-level `src/i18n/` (index.ts + zh.ts + en.ts)
- **Chapter naming convention**: `specification.md` §3.2 adds recommended naming patterns (simple sequence / volume-chapter / script scenes) + zero-padding rules

### Tests

- All 228 tests pass (+30), covering `.storyignore` (8) and `import json` (10), plus series grouping / fractional indexing / rename detection integration tests

<details>
<summary>## [1.0.0] - 2026-08-14</summary>

### Core Features

- Directory convention for story management (`NN-name/` + `config.json` + `text.md`)
- `story init` / `story new` scaffolding
- `story build` auto-generates story READMEs + root index README
- `story build --validate-only` / `--save-counts` / `--watch`
- `story epub` exports EPUB 3 (cover, copyright page, TOC, images)
- `story export html` exports a static site
- `story export txt` exports all stories as `.txt`
- Declarative config validation (required fields, enums, formats, conditional requirements)
- Bilingual support (story language + CLI language detection)
- Repository-level custom enums (`story.config.json`)
- Language-aware word counting (Chinese characters / English words)
- Donation support (`assets/sponsor/` auto-generated collapsible section)

### Release Prep & Engineering

- **Compiled release**: fixed npm global install compat (Node 24 disallows type-stripping `.ts` under `node_modules`); published package ships compiled `dist/`
- **Build pipeline**: added `pnpm build` (`tsc -p tsconfig.build.json`), `prepack` auto-compiles
- **Path resolution**: added `src/utils/paths.ts`, unified package root/template resolution (source and compiled runs)
- **export-html refactor**: unified i18n + config validation + structured error handling (replaces hardcoded Chinese)
- **Async FS optimization**: build hot path loads stories in parallel (`Promise.all`), significant speedup for large repos
- **Markdown rendering fixes**:
  - Fixed `<br/>` inside paragraphs being HTML-escaped as text
  - Added backslash escape support (`\*` → literal `*`)
- **Dedup function extraction**: `cli-utils.ts` unifies `detectCliLang` / `sanitizeFileName`
- **Design philosophy docs**: added `docs/design.md` / `docs/design.en.md`
- **CI improvements**: `build.yml` adds `pnpm build` step, verifies compiled artifacts can be generated

### Tests

- All 175 tests pass, covering: scanner, validation, template rendering, word counting, i18n, README generation, EPUB export (including covers), argument parsing, repo config, CLI entry points, Markdown parsing edge cases

</details>
