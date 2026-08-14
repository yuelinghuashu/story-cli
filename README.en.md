# 📚 story-cli

[![中文](https://img.shields.io/badge/简体中文-README-blue?style=flat-square)](README.md)
[![English](https://img.shields.io/badge/English-README-blue?style=flat-square)](README.en.md)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square)](package.json)
[![Tests](https://img.shields.io/badge/tests-174%20passed-brightgreen?style=flat-square)](README.en.md#-Testing)

**A zero-deploy, Git-native content management CLI for Markdown stories.**

Manage stories with simple directory conventions, automatically generate GitHub-ready READMEs, export EPUB, and support bilingual (Chinese/English) content.

---

## ✨ Features

- **Simple directory convention** — stories are folders: `NN-name/` with `config.json` + `text.md`
- **Automatic README generation** — both per-story and root index READMEs (template-driven, customizable)
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

## 📦 Installation

```bash
# Global install
npm install -g story-cli

# Or use directly with npx
npx story-cli
```

> The published package ships compiled `dist/` output (Node 24 disallows type-stripping `.ts` files under `node_modules`). For development, you can still run the source directly: `node bin/index.ts version`.

---

## 🚀 Quick Start

```bash
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
```

---

## 🛠️ Commands

| Command                       | Description                                                 |
| ----------------------------- | ----------------------------------------------------------- |
| `story init`                  | Initialize a repository (templates + `.gitignore` + README) |
| `story init --full`           | Also generate LICENSE / docs / CHANGELOG                    |
| `story new "Title" [options]` | Create a new story scaffold                                 |
| `story build`                 | Build all READMEs + root index                              |
| `story build --validate-only` | Validate configs only, no README generation                 |
| `story build --save-counts`   | Persist auto-calculated word counts to config.json          |
| `story build --watch`         | Watch for file changes and auto-rebuild READMEs             |
| `story epub "Title"`          | Export a story to EPUB                                      |
| `story epub --all`            | Export all stories to EPUB                                  |
| `story export html`           | Export as static HTML site                                  |
| `story export txt`            | Export all stories as plain text (.txt)                     |
| `story help`                  | Show usage                                                  |
| `story version`               | Show version                                                |

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

| Doc                | English                                       | 中文                                    | Content                                            |
| ------------------ | --------------------------------------------- | --------------------------------------- | -------------------------------------------------- |
| Design Philosophy  | [design.en.md](docs/design.en.md)             | [design.md](docs/design.md)             | Why it's built this way, project philosophy        |
| How to Add a Story | [add-story.en.md](docs/add-story.en.md)       | [add-story.md](docs/add-story.md)       | Directory conventions, config.json, writing styles |
| EPUB Export Guide  | [epub.en.md](docs/epub.en.md)                 | [epub.md](docs/epub.md)                 | Supported Markdown syntax, image embedding         |
| GitHub Actions CI  | [ci.en.md](docs/ci.en.md)                     | [ci.md](docs/ci.md)                     | Automated build workflow configuration             |
| Architecture       | [architecture.en.md](docs/architecture.en.md) | [architecture.md](docs/architecture.md) | Module design, core ideas, dependency list         |

---

## 🧪 Testing

```bash
pnpm test
```

All 174 tests pass, covering: scanner, validation, template rendering, word counting, i18n, README generation, EPUB export (including cover images), argument parsing, repo config, CLI entry points, XSS protection, Markdown parsing edge cases, and init --full.

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
