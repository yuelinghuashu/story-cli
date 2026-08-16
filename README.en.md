# 📚 story-cli

[![中文](https://img.shields.io/badge/简体中文-README-blue?style=flat-square)](README.md)
[![English](https://img.shields.io/badge/English-README-blue?style=flat-square)](README.en.md)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen?style=flat-square)](package.json)
[![CI](https://img.shields.io/github/actions/workflow/status/yuelinghuashu/story-cli/build.yml?style=flat-square)](https://github.com/yuelinghuashu/story-cli/actions)
[![npm version](https://img.shields.io/npm/v/@yuelinghuashu/story-cli?style=flat-square)](https://www.npmjs.com/package/@yuelinghuashu/story-cli)
[![npm downloads](https://img.shields.io/npm/dm/@yuelinghuashu/story-cli?style=flat-square)](https://www.npmjs.com/package/@yuelinghuashu/story-cli)

**A zero-deploy, Git-native content management CLI for Markdown stories.**

Manage stories with simple directory conventions, automatically generate GitHub-ready READMEs, export EPUB, and support bilingual (Chinese/English) content.

---

## ✨ Features

- **Simple directory convention** — stories are folders: `NN-name/` with `config.json` + `text.md`
- **Automatic README generation** — both per-story and root index READMEs (template-driven, customizable)
- **Series grouping & sorting** — `series` / `seriesOrder` in config.json control display order (fractional indexing, insert anywhere without renumbering)
- **Runtime validation** — config checks before building (required fields, enums, formats)
- **Bilingual support** — `language: "zh" | "en"` in config for localized READMEs
- **Word count** — Chinese characters or English words, language-aware
- **Chapter extraction** — shows chapter titles with word counts in READMEs
- **EPUB export** — one command converts stories to `.epub` with cover page (image support), copyright page
- **Scaffolding** — `story new "Title"` creates everything you need
- **Watch mode** — `story build --watch` auto-rebuilds on file changes
- **Extensible enums** — customize story types and statuses via `story.config.json`
- **Donation support** — drop QR code images into `assets/sponsor/`, auto-generates a ☕ Support section
- **CI-ready** — works perfectly in GitHub Actions (lint + tests included)

---

## 🤔 Why story-cli?

| Scenario            |   Web Novel Software   |       Manual Markdown        |              **story-cli**               |
| ------------------- | :--------------------: | :--------------------------: | :--------------------------------------: |
| Data ownership      | ❌ Proprietary / cloud |        ✅ Plain files        |              ✅ Plain files              |
| Git-native workflow |   ❌ Not applicable    | ⚠️ Manual README maintenance |    ✅ Auto READMEs + rename detection    |
| Bilingual (zh/en)   |  Usually unsupported   |            ⚠️ DIY            |               ✅ Built-in                |
| Chapter management  |      ✅ Built-in       |      ⚠️ Manual folders       | ✅ Auto chapter extraction + word counts |
| EPUB export         |      ✅ Built-in       |     ⚠️ Needs extra tools     |              ✅ One command              |
| Editor freedom      |      ❌ Locked in      |            ✅ Any            |                  ✅ Any                  |
| AI tool freedom     |   ❌ Platform-bound    |            ✅ Any            |                  ✅ Any                  |

**story-cli gives Git-loving creators a "data is always portable" writing workflow.** Your stories are always plain files — openable by any tool, any editor, anytime.

---

## ⚠️ File Encoding Requirements

**All files (`config.json`, `text.md`, `chapter-*.md`, `.storyignore`) must be saved in UTF-8 encoding.**

- **VS Code**: Click the encoding button at the bottom right → "Save with Encoding" → select `UTF-8`
- **Windows Notepad**: Save As → Encoding → choose `UTF-8`
- **macOS / Linux**: UTF-8 by default, no action needed

> If you save files in GBK/GB2312 encoding, `story build` will output garbled text and word counts will be wrong.
> story-cli warns you when encoding issues are detected but does not block the build.

---

## 📦 Installation

```bash
# Global install
npm install -g @yuelinghuashu/story-cli

# Or use directly with npx
npx @yuelinghuashu/story-cli
```

> The published package ships compiled `dist/` output (Node 24 disallows type-stripping `.ts` files under `node_modules`). For development, you can still run the source directly: `node bin/index.ts version`.

---

## 🚀 Quick Start

```bash
# 0. Want to see it in action? Generate a demo repository
story demo

# 1. Initialize an empty story repository
story init

# 2. Create your first story
story new "My First Story" --lang=en

# Or a Chinese original story
story new "我的新故事"

# Or a fan fiction
story new "My Fan World" --type=fanfic --author="Original Work" --creator="Author" --lang=en

# 3. Write/edit the story content
#   - Edit config.json (title, type, status, summary, etc.)
#   - Write in text.md (or chapter-*.md files)

# 4. Build all READMEs
story build

# 5. Export EPUB
story epub "My First Story"
# or export all
story epub --all

# 6. Show writing statistics
story stats
```

> 💡 **Recommended: Use the Makefile workflow (more efficient):**
>
> ```bash
> make init                     # Initialize
> make new TITLE="My Story"      # Create + auto-build
> make commit                   # Build + commit
> make push                     # Build + commit + push
> make stats                    # Show writing statistics
> ```
>
> Run `make help` for all commands.
>
> `story init` auto-generates an editable `Makefile`. You can also run atomic commands like `story build` directly.
>
> 💡 **Windows users**: `story init` also generates `story.ps1` (PowerShell workflow entry), mirroring the Makefile:
>
> ```powershell
> .\story.ps1 init
> .\story.ps1 new -Title 'My Story'
> .\story.ps1 build
> ```

---

## 🛠️ Commands

| Command                                | Description                                                         |
| -------------------------------------- | ------------------------------------------------------------------- |
| `story init`                           | Initialize a repository (templates + `.gitignore` + README)         |
| `story init --full`                    | Also generate LICENSE / docs / CHANGELOG                            |
| `story new "Title" [options]`          | Create a new story scaffold                                         |
| `story build`                          | Build all READMEs + root index                                      |
| `story build --validate-only`          | Validate configs only, no README generation                         |
| `story build --save-counts`            | Persist auto-calculated word counts to config.json                  |
| `story build --watch`                  | Watch for file changes and auto-rebuild READMEs                     |
| `story epub "Title"`                   | Export a story to EPUB                                              |
| `story epub "Title" --split-by-volume` | Export as split volumes based on config.volume (volume in filename) |
| `story epub --all`                     | Export all stories to EPUB                                          |
| `story export html`                    | Export as static HTML site (print to PDF via browser)               |
| `story export txt`                     | Export all stories as plain text (.txt)                             |
| `story export json`                    | Export all stories as structured JSON (AI-friendly)                 |
| `story export md`                      | Export all stories as merged Markdown (with frontmatter)            |
| `story stats`                          | Show writing statistics (stories, words, series, health)            |
| `story import json`                    | Import stories from JSON (AI output → auto directory structure)     |
| `story help`                           | Show usage                                                          |
| `story version`                        | Show version                                                        |

### `story new` options

| Option                    | Description                                                    |
| ------------------------- | -------------------------------------------------------------- |
| `--type=original\|fanfic` | Story type (default: `original`)                               |
| `--author="Work"`         | Original work name (required for fanfic)                       |
| `--creator="Author"`      | Original author (required for fanfic)                          |
| `--lang=zh\|en`           | Language of the story (default: `zh`, invalid values rejected) |

### Repository Config (story.config.json)

Customize story types and statuses via a root-level `story.config.json` (defaults: `original/fanfic` and `completed/ongoing`), and configure localized labels for custom enums:

```json
{
  "types": ["original", "fanfic", "translation"],
  "statuses": ["completed", "ongoing", "planned"],
  "typeLabels": {
    "translation": { "zh": "翻译", "en": "Translation" }
  },
  "statusLabels": {
    "planned": { "zh": "计划中", "en": "Planned" }
  }
}
```

- `typeLabels` / `statusLabels` are optional, used for localized display of custom enums
- Built-in enums (`original`, `fanfic`, `completed`, `ongoing`) have built-in labels and don't need to be configured
- Custom enums without labels display as the raw code string in READMEs

Generated by `story init`. Remove the file to fall back to defaults.

---

## 📚 Documentation

| Doc                | English                                         | 中文                                      | Content                                                 |
| ------------------ | ----------------------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| Design Philosophy  | [design.en.md](docs/design.en.md)               | [design.md](docs/design.md)               | Why it's built this way, project philosophy             |
| Specification      | [specification.en.md](docs/specification.en.md) | [specification.md](docs/specification.md) | Directory convention data spec (third-party compatible) |
| How to Add a Story | [add-story.en.md](docs/add-story.en.md)         | [add-story.md](docs/add-story.md)         | Directory conventions, config.json, writing styles      |
| Export Guide       | [export.en.md](docs/export.en.md)               | [export.md](docs/export.md)               | HTML / TXT / EPUB / PDF / JSON / MD                     |
| EPUB / PDF Export  | [epub.en.md](docs/epub.en.md)                   | [epub.md](docs/epub.md)                   | EPUB format, PDF export (browser print)                 |
| GitHub Actions CI  | [ci.en.md](docs/ci.en.md)                       | [ci.md](docs/ci.md)                       | Automated build workflow configuration                  |
| Architecture       | [architecture.en.md](docs/architecture.en.md)   | [architecture.md](docs/architecture.md)   | Module design, core ideas, dependency list              |
| Changelog          | [CHANGELOG.en.md](CHANGELOG.en.md)              | [CHANGELOG.md](CHANGELOG.md)              | Version history                                         |

---

## 🧪 Testing

```bash
make test         # or pnpm test
```

All 265 tests pass, covering: scanner, series grouping sorting, folder rename detection, validation, template rendering, word counting (including CJK Extension A/B rare characters), i18n, README generation (including series grouping), EPUB export (including cover images and split volumes), argument parsing, repo config, CLI entry points, XSS protection, Markdown parsing edge cases, init --full, `.storyignore` exclusion rules, encoding detection (UTF-8/GBK), JSON import, writing statistics, and Makefile workflow.

> 💡 **Dev quick commands**: the root `Makefile` provides `make build` / `make test` / `make typecheck` / `make lint` / `make format` as dev workflow entry points. Run `make help` for all commands.

---

## ☕ Support

<details>
<summary>If you like my work, feel free to buy me a coffee.</summary>

<img src="./assets/sponsor/ali-pay.jpg" width="200" alt="Alipay QR code" />
<img src="./assets/sponsor/wechat-pay.jpg" width="200" alt="WeChat Pay QR code" />

</details>

---

## ⚖️ License

[MIT](./LICENSE)
