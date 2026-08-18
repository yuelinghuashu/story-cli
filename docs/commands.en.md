# 📋 Command Reference

Complete list of all story-cli commands, organized by purpose.

> 💡 Quick start: see [README.md](../README.md); detailed usage for each command is in the linked topic docs.

---

## 📦 Initialize

| Command | Alias | Usage                                                     | Description                                                                                                        | Docs                         |
| ------- | ----- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| `init`  | `i`   | `story init [--template=story\|knowledge\|tech] [--full]` | Initialize a repository (default / knowledge base / tech docs); `--full` also generates LICENSE / docs / CHANGELOG | [add-story](add-story.en.md) |
| `demo`  |       | `story demo`                                              | Generate a complete demo repository for previewing                                                                 | —                            |

## ✍️ Content

| Command | Alias | Usage                                                                                                | Description                                                                                                | Docs                         |
| ------- | ----- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `new`   | `n`   | `story new "Title" [--type=original\|fanfic] [--author="Work"] [--creator="Author"] [--lang=zh\|en]` | Create a new story (generates config.json + text.md); fan fiction requires both `--author` and `--creator` | [add-story](add-story.en.md) |
| `link`  |       | `story link <source> <target>`                                                                       | Add relation; `--remove=<target>` to remove; `--list` to list all or a specific story                      | [add-story](add-story.en.md) |

## 🔨 Build & Validate

| Command    | Alias   | Usage                                                     | Description                                                                                                                                     | Docs                                 |
| ---------- | ------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `build`    | `b`     | `story build [--validate-only] [--save-counts] [--watch]` | Generate READMEs; `--validate-only` validates without writing; `--save-counts` writes back word counts; `--watch` auto-rebuilds on file changes | [add-story](add-story.en.md)         |
| `validate` | `check` | `story validate [--json]`                                 | Compliance check (folder naming / required files / UTF-8 / duplicate numbers / schema); supports `--json` structured output                     | [specification](specification.en.md) |
| `stats`    | `s`     | `story stats [--json]`                                    | Writing statistics (words / series / health / repeated phrases)                                                                                 | [design](design.en.md)               |

## 📤 Export

| Command             | Alias | Usage                                               | Description                                                                         | Docs                   |
| ------------------- | ----- | --------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------- |
| `export html`       |       | `story export html [--output=dir]`                  | Static HTML site (browser print to PDF)                                             | [export](export.en.md) |
| `export txt`        |       | `story export txt [--stdout] [--output=dir]`        | Plain text export (`--stdout` pipe-friendly)                                        | [export](export.en.md) |
| `export json`       |       | `story export json [--stdout] [--output=dir]`       | Structured JSON (`--stdout` pipe-friendly)                                          | [export](export.en.md) |
| `export md`         |       | `story export md [--stdout] [--output=dir]`         | Merged Markdown with YAML frontmatter                                               | [export](export.en.md) |
| `export embeddings` |       | `story export embeddings [--stdout] [--output=dir]` | Text chunks as JSONL (for external vector retrieval)                                | [export](export.en.md) |
| `epub`              | `e`   | `story epub "Title" [--all] [--split-by-volume]`    | EPUB 3 e-book (supports split-volume / cover / images); `--all` exports all stories | [epub](epub.en.md)     |

## 📥 Import

| Command       | Usage                                                  | Description                                                   | Docs                   |
| ------------- | ------------------------------------------------------ | ------------------------------------------------------------- | ---------------------- |
| `import json` | `story import json --file=stories.json [--output=dir]` | Batch import stories from JSON (symmetric with `export json`) | [export](export.en.md) |

## 🤖 AI Integration

| Command      | Alias | Usage              | Description                                                                           | Docs             |
| ------------ | ----- | ------------------ | ------------------------------------------------------------------------------------- | ---------------- |
| `mcp-server` | `mcp` | `story mcp-server` | Start MCP stdio server for AI clients (Claude Desktop / Cursor / VSCode Copilot Chat) | [mcp](mcp.en.md) |

## 🖥️ System

| Command   | Alias | Usage           | Description  |
| --------- | ----- | --------------- | ------------ |
| `help`    | `h`   | `story help`    | Show help    |
| `version` |       | `story version` | Show version |

> **Global flags** (work after any command): `--help` / `-h` to show help · `--version` / `-v` to show version

---

## ⚠️ Common Options

| Option              | Commands                              | Description                                    |
| ------------------- | ------------------------------------- | ---------------------------------------------- |
| `--json`            | `stats`, `validate`                   | Output structured JSON (for `jq` or scripting) |
| `--stdout`          | `export txt`/`json`/`md`/`embeddings` | Write to stdout (no disk, pipe-friendly)       |
| `--output=dir`      | `export *`, `import json`             | Custom output directory                        |
| `--file=path`       | `import json`                         | Path to JSON file (or pipe from stdin)         |
| `--all`             | `epub`, `export embeddings`           | Process all stories                            |
| `--split-by-volume` | `epub`                                | Split by `volume` field in config.json         |
