# 🎯 Design Philosophy

story-cli is not just a tool — it's a writing workflow philosophy.

---

## 🪶 Everything Is a File

**A story is a folder + Markdown files.**

- Story = `NN-name/` directory + `config.json` (metadata) + `text.md` (content)
- Metadata is readable JSON; content is plain Markdown
- Directory structure naturally reflects content structure

This makes your story library **natively compatible with all Git capabilities**:

| Git capability | What it means for writing                          |
| -------------- | -------------------------------------------------- |
| `git diff`     | See exact line changes, precise rollback           |
| `git log`      | Review your creative journey over time             |
| `git tag`      | Mark completions, side stories, special editions   |
| `git grep`     | Search dialogue, characters, scenes across the lib |
| Branches/PRs   | Safely experiment with rewrites, review as a team  |

No database. No cloud sync. No proprietary format. **Your stories are always plain files** — openable by any tool, editor, or timeframe.

---

## ⚡ Zero Dependency Overhead

**Only 2 runtime dependencies**: `fflate` (EPUB ZIP packing) and `handlebars` (template rendering).

- No `commander`/`yargs` — 50 lines of hand-written arg parsing is enough
- No `marked`/`markdown-it` — a 180-line hand-written Markdown converter covers writing needs
- No test framework — `node:test` zero-dependency
- No compilation step — Node 24+ runs TypeScript natively in dev; published dist runs on Node >= 20

**Why hand-write instead of adopting mature libraries?**

1. **Dependencies are responsibility** — each one brings bugs, version migrations, and supply chain risk
2. **Toolchain stays controllable** — a 180-line converter means you can locate and fix any issue in minutes
3. **Good enough is enough** — the Markdown subset needed for fiction writing is well-defined, no general-purpose parser required
4. **Instant setup** — users `pnpm i` in seconds, `story build` runs directly

The trade-off is edge-case handling is less mature than established libraries (nested quotes, complex escaping). This is addressed through **edge-case tests** (see `tests/md-to-html.test.ts`) rather than adopting dependencies.

---

## 🚀 Zero Deployment

**All build outputs (README / HTML / EPUB) are static files.**

- Story README → rendered natively by GitHub
- Root index README → your GitHub repo homepage
- HTML export → any static hosting (GitHub Pages / Vercel / any HTTP server)
- EPUB → local reading / distribution

No server. No database. No build service. **`story build` output can be read anywhere.**

---

## 📐 Convention Over Configuration

**Directory structure IS content structure.**

```text
repo/
├── 01-story-A/
│   ├── config.json      # Metadata (title/type/status/word count)
│   └── text.md          # Content (or chapter-*.md files)
├── 02-story-B/
└── assets/sponsor/      # Sponsor QR codes
```

Concepts a user needs to understand:

1. A directory starting with `NN-` is a story
2. `config.json` holds metadata
3. `text.md` holds the content

**That's it.** No config syntax to learn, no database model to understand, no concept mapping. 5 minutes to start writing.

---

## 🇨🇳 Chinese-First

**Designed for Chinese creators, with full English support.**

- Chinese word counting (by hanzi characters, not character count)
- Bilingual UI text (`LANG` env var auto-detection)
- Bilingual documentation (every doc has both versions)
- Mixed-language writing (per-story `language` field)
- Chinese-friendly filename handling (Chinese titles preserved in README display)

---

## 🔄 Design Directions in Existing Tools

Story management / writing tools can be roughly grouped into several directions:

| Direction             | Typical characteristics                                          | Target users                  |
| --------------------- | ---------------------------------------------------------------- | ----------------------------- |
| Cloud publishing      | Hosted + GUI editor + team collaboration, proprietary format     | Teams, content creators       |
| Static docs generator | Local generation + theme system + plugin ecosystem, general docs | Developers, doc authors       |
| Universal converter   | Strong format interoperability, wide input/output                | Academic, cross-format needs  |
| Web-fiction platform  | Editor + cloud sync + platform distribution                      | Web fiction authors           |
| Local knowledge base  | GUI + bidirectional links + graph view + plugin ecosystem        | Note & knowledge enthusiasts  |
| **story-cli**         | Git-native + zero-dependency Markdown + CLI-driven               | Git users, developer-creators |

Each direction serves its own audience. story-cli doesn't replace any of them — it offers a dedicated path for people who want to manage story files directly in Git.

---

## 🧭 When to Use / Not Use

### Fits

- Developers who manage everything with Git
- Creators who write in Markdown
- People telling stories bilingually (Chinese/English)
- Those who want stories to stay traceable and portable long-term
- Those uncomfortable with "data living on someone else's servers"

### Doesn't fit

- Writing beginners who need a GUI editor
- Power writers needing cloud sync / real-time collaboration
- Authors needing one-click publishing to web-fiction platforms
- Those needing rich-media layout (illustrations, fonts, complex typesetting)

**story-cli doesn't aim to replace writing software. It provides a Git-deeply-integrated writing workflow for people who believe "file ownership is ownership".**
