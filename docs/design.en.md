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

- Arg parsing uses Node built-in `util.parseArgs` (zero-dependency)
- Markdown conversion uses an ~180-line custom implementation (covers the fiction-writing subset)
- Tests use Node built-in `node:test` (zero-dependency)
- No compilation step — Node 24+ runs TypeScript natively in dev; published dist runs on Node >= 22

Edge cases are covered by **boundary tests** (see `tests/md-to-html.test.ts`) rather than adopting dependencies.

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

## 🧮 Fractional Indexing: Physical vs. Logical Coordinates

**This is the core of story-cli's sorting design: why folder numbers never change, yet display order can be freely adjusted.**

### The Problem: Additive Sorting

Traditional story libraries sort by folder number (`01-` / `02-` / `03-`):

```text
01-story-A
02-story-B
03-story-C
```

If you want to insert a new story `story-B2` between `story-B` and `story-C`, you MUST **rename** `03-story-C → 04-story-C`. The cost of renaming:

- All links to `03-story-C` (README, EPUB references, external links) break
- Git history shows "delete + add" instead of a continuous modification
- Renames cause merge conflicts in collaborative workflows

**This is the classic dilemma of "physical coordinates": numbers are the identity of content, and reordering means breaking identity.**

### Solution: Physical + Logical Coordinate Separation

| Coordinate Type | Carrier                                   | Characteristic                                        |
| --------------- | ----------------------------------------- | ----------------------------------------------------- |
| **Physical**    | Folder name `NN-` prefix                  | Set once and never modified — the story's "ID number" |
| **Logical**     | `series` / `seriesOrder` in `config.json` | Adjustable anytime — the story's "seat number"        |

**Physical coordinates determine where files live; logical coordinates determine display order.**

### Why Does `seriesOrder` Support Decimals?

Suppose a series currently has order `1, 2, 3`, and you want to insert a new story between `2` and `3`:

```json
{
  "title": "Inserted Story",
  "series": "Three-Body",
  "seriesOrder": 2.5
}
```

**Root README display order becomes: `1 → 2 → 2.5 → 3`**

- You do **NOT** need to modify any existing story's `seriesOrder`
- You do **NOT** need to rename any folder
- All existing links remain stable

This is **Fractional Indexing** — borrowed from floating-point sort keys in database design. Analogies:

| Scenario                   | Sorting Approach                                                                 |
| -------------------------- | -------------------------------------------------------------------------------- |
| Database row insertion     | `position = (prev.pos + next.pos) / 2`                                           |
| Git commit timestamps      | Timestamps are naturally insertable (any time can be inserted)                   |
| **story-cli series order** | `seriesOrder` numbers are never "full" (use `2.5` to insert between `2` and `3`) |

### Edge Cases

- **Theoretically infinite insertion**: decimals have no minimum interval — `2.5` → `2.25` → `2.125` → ... can be divided indefinitely
- **Practical advice**: most series have 10 or fewer volumes — integers plus one decimal place are more than sufficient
- **Failure mode**: if `seriesOrder` hits floating-point precision issues (e.g. `9.999999...`), you can renumber — this is a logical coordinate, freely adjustable with no destructive impact

### Core Benefits

- **Adding stories**: never reorder existing content
- **Deleting stories**: number gaps are automatically ignored, no need to fill
- **Reordering**: change one JSON field, don't touch folder names
- **Git stability**: folder names never change → links never break → history stays continuous

---

## 🌐 Bilingual-First

**Equal-first-class support for Chinese and English creators, architecturally ready for more languages.**

- Language-aware word counting (Chinese by hanzi characters, English by words)
- Bilingual UI text (`LANG` env var auto-detection)
- Bilingual documentation (every doc has both versions)
- Mixed-language writing (per-story `language` field)
- Chinese-friendly filename handling (Chinese titles preserved in README display)

> The `language` field and i18n module are designed to extend to additional languages easily.

---

## 🧰 Toolbox, Not an All-in-One Suite

**story-cli deliberately has no GUI, and no built-in AI.**

Not because it's impossible — but because it's intentionally out of scope. Editor experiences (syntax highlighting, live preview, spell check) have been refined to perfection by VS Code / JetBrains / Neovim, and AI assistance (completion, continuation, polishing) is covered by Copilot / Cursor / Continue and similar tools. Even with ten years of effort, story-cli could never match these specialized products in their own domains.

### Decoupling via the File System

The only interface between your editor and the CLI is **files**:

```text
text.md        ← Write content in any editor (VS Code live preview, Copilot continuation)
config.json    ← Edit metadata with any tool (title, type, status, series)
story build    ← CLI handles governance & building (validation, README, EPUB)
```

- Use VS Code + Markdown Preview Enhanced for live chapter preview
- Use GitHub Copilot / Cursor to assist with climactic paragraphs
- Switch to JetBrains, Neovim, or any future editor — **toolchain stays seamless, data stays common**

### "Integration" Is Often "Lock-in" in Disguise

| Tool                      | Data model                    | Cost of switching                                                              |
| ------------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| Scrivener                 | Proprietary `.scriv` format   | Data can't migrate; you must keep using Scrivener                              |
| Obsidian plugins          | Local `.md` (open)            | GUI-centric; plugin ecosystem bound to Obsidian                                |
| Some AI writing platforms | Cloud or proprietary format   | Deeply tied to specific model APIs; toolchain collapses if the model goes away |
| **story-cli**             | Plain files (`.md` + `.json`) | Any editor + any AI tool + any Git workflow                                    |

story-cli doesn't touch AI at all: want Claude or DeepSeek? Install a plugin in your editor. Want Copilot or Cursor? Your choice. The CLI only faithfully processes the text you've written — **it never hijacks your AI workflow or editing habits**.

### Unix Philosophy: Do One Thing, and Do It Well

The editor handles the creation experience; the CLI handles content governance. They're decoupled through the file system. This is the classic Unix philosophy applied to creative tools — **each tool does one thing well, and together they form a complete workflow**.

### Long-Term Maintainability

"Glue layers" (that bind excellent infrastructure together) often outlive "full-stack solutions". As long as Markdown and JSON don't disappear, `story new` / `story epub` will keep working. VS Code will iterate, AI models will change, but your story folder structure stays stable forever — core data (files) and core logic (CLI) remain firmly in your own hands.

### Atomic Abilities and Workflow Orchestration

**The CLI provides atomic capabilities; the Makefile orchestrates workflows.**

Real user scenarios are never single commands — they're chains like "create → build → commit → push". Each story-cli command (`story new` / `story build` / `story stats`) is an **atomic capability** — doing one thing that is simple, predictable, and composable.

`story init` also generates an **editable Makefile** that wraps high-frequency operation chains into workflow entry points:

```bash
make help                      # Show all available commands
make new TITLE="My Story"       # Create story + auto-build
make commit                    # Build + git add + git commit
make push                      # Build + commit + push
make stats                     # Writing statistics
make epub                      # Export all EPUBs
```

**Why not add `--commit` / `--push` directly to the CLI?**

1. **Unix philosophy**: each tool does one thing well. The CLI shouldn't be a "universal executor"
2. **User-customizable**: the Makefile can freely add your own hooks (e.g. run scripts before commit, notify after push)
3. **No lock-in**: don't enumerate every possible "chain combination" — users can simply edit the Makefile when they need something new

**Division of responsibilities**:

| Layer          | Tool        | Responsibility                      | Example                             |
| -------------- | ----------- | ----------------------------------- | ----------------------------------- |
| Workflow       | `Makefile`  | Combine multiple steps, handle deps | `make push` = build + commit + push |
| Atomic ability | `story` CLI | Single step, do one thing well      | `story build` / `story stats`       |
| Domain logic   | `src/`      | Scanning / validation / rendering   | `scanner.ts` / `validate.ts`        |

---

## ⚡ Token Economics: Content Infrastructure Designed for AI Consumption

**story-cli is not just a content governance tool — it's content infrastructure optimized at the Token level for AI consumption.**

The core bottleneck in the AI era is Token cost. Traditional approaches either stuff the full text into context (quickly blowing out the window) or rely on RAG retrieval (high vector-store maintenance costs, unstable results). story-cli slices content at the **file-system level** — using directory conventions, chapter segmentation, and structured metadata so AI can fetch data precisely and on-demand, like querying a database.

### One Principle Across All Designs

> **AI only thinks; the CLI provides the context it needs at the lowest possible cost.**

### Four Token-Optimized Design Patterns

#### 1. `scan_stories` Compact-by-Default Output (80-95% savings for directory browsing)

When browsing a library, AI usually only needs to know "what stories exist, roughly their status." The default returns compact fields:

```json
{
  "folder": "01-story-A",
  "title": "story-A",
  "type": "original",
  "status": "ongoing",
  "lang": "zh",
  "wordCount": "~120K chars"
}
```

Instead of full metadata + full content. In a library of 1,000 stories, this can mean **hundreds of thousands of Tokens vs. tens of thousands**.

#### 2. `read_chapter` + `tailLength` Truncation (95%+ savings for continuation)

The core need for AI continuation is "know what the end of the last chapter was about," not loading tens of thousands of words. `tailLength=2000` lets AI read only the last 2,000 characters to resume precisely:

```
❌ Load entire text.md (assume 50K words → ~50K Tokens)
✅ Read only last 2,000 chars → ~2K Tokens
```

#### 3. `chapterIndex` On-Demand Loading (80-90% savings for targeted edits)

When AI wants to modify chapter 2, it doesn't need to load all chapters. Precise targeting avoids Token waste on irrelevant content.

#### 4. `--stdout` + Structured JSON (No Exploration, Fetch Everything in One Shot)

Traditional approaches make AI explore the file system with `cat` / `find`, burning Tokens on every step to understand directory structure. story-cli outputs structured data directly:

```
story stats --json     → AI directly gets total words/chapters/series progress
story export json      → AI directly gets the complete structured story library
story export md        → AI directly gets merged Markdown
```

### Token Cost Comparison

| Scenario                                 | Traditional (without story-cli)              | story-cli                          | Token Savings |
| :--------------------------------------- | :------------------------------------------- | :--------------------------------- | :------------ |
| AI browses a 100-story library           | `cat */config.json` + read file by file      | `scan_stories` (compact mode)      | **~80-95%**   |
| AI continues a long novel's next chapter | Reads entire text.md                         | `read_chapter` + `tailLength=2000` | **~95%+**     |
| AI edits chapter 5                       | Reads all chapters                           | `read_chapter` + `chapterIndex=4`  | **~80-90%**   |
| AI reports writing progress              | Counts lines/words file by file              | `stats --json` one call            | **~99%**      |
| AI understands project structure         | Multiple `ls` + `cat` + guessing conventions | `init` template + spec docs        | **~90%**      |
| AI merges/concatenates stories           | Manual `cat` + handling separators           | `export md --stdout`               | **~70-80%**   |

> These are estimated magnitudes for typical scenarios; actual savings depend on content complexity and context window size.

**In long-form creation scenarios (5,000–10,000 words per chapter), the cumulative savings from `tailLength` + `chapterIndex` can exceed 90% of Token consumption.**

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
| AI writing assistant  | Cloud models + continuation/polishing + platform binding         | Authors seeking inspiration   |
| Editor + CLI combo    | Editor handles creation + CLI handles governance, file decoupled | Git users, developer-creators |
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
- Those who want freedom to choose their editor, AI tools, and writing workflow

### Doesn't fit

- Those who want everything in one piece of software (editor + management + publishing)
- Power writers needing cloud sync / real-time collaboration
- Authors needing one-click publishing to web-fiction platforms
- Those needing rich-media layout (illustrations, fonts, complex typesetting)

**story-cli doesn't aim to replace writing software. It provides a Git-deeply-integrated writing workflow for people who believe "file ownership is ownership".**
