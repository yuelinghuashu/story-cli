# 🗺️ story-cli Roadmap

> **Core philosophy**: story-cli is more than a novel-management tool — it is a **zero-dependency, Git-native, AI-friendly engine for governing structured content**. It manages not just stories but any text asset that can be normalized — papers, interviews, weekly reports, tech tutorials, personal retrospectives.

---

## 1. Strategic Positioning: Our Moat vs. Existing Tools

Before writing any code, we decided what we **don't do** and **why we win**:

| Dimension           | Existing tools                                              | **story-cli's differentiator**                                                   |
| :------------------ | :---------------------------------------------------------- | :------------------------------------------------------------------------------- |
| **Core ability**    | **Semantic search (RAG)** + vector DB + bidirectional links | **Content governance** + normalized intake + multi-format publishing (EPUB/HTML) |
| **Data philosophy** | "Throw it in, AI will find it"                              | "Normalize first, then keep it as a permanent asset"                             |
| **Dependency load** | SQLite, vector DBs, Python ecosystem                        | **Only 2 runtime dependencies** (fflate + handlebars)                            |
| **Output**          | Markdown / JSON only, for AI consumption                    | **Final products directly** (ebooks, static sites, plain-text drafts)            |
| **Token cost**      | Full loads or complex RAG retrieval                         | **MCP tool-level Token optimization**, 95%+ savings for continuation             |
| **Analogy**         | A **"search engine"** (broad search & association)          | A **"formatting factory"** (deep governance & standardized output)               |

**Conclusion**: we are not their competitor — we are **upstream/downstream**. We don't do "broad retrieval"; we do the dirty work of washing messy information into high-grade standard parts.

### Core Design Principles (canonical quotes cited by source comments)

These principles run through every implementation and are the exact phrases `src/` module comments cite from this roadmap:

- **「AI 只负责思考，CLI 负责治理」("AI thinks, CLI governs")** — AI obtains context at minimal cost; governance actions are executed by the CLI in verifiable, revertible ways (`src/commands/mcp.ts` / `src/mcp/protocol.ts`)
- **「CLI 做原子能力，MCP 做适配层」("CLI provides atomic capabilities, MCP is the adapter layer")** — the CLI exposes deterministic commands; MCP only adapts the protocol and never re-implements domain logic (`src/mcp/tools.ts`)
- **「我们负责格式化，他们负责检索」("We format, they retrieve")** — no bundled vector DB; data is cleaned and handed to external retrieval services (`src/commands/export-embeddings.ts`)
- **「确认落盘」("Confirm before persisting")** — `build` only suggests relations (zero writes); `story link` persists only after confirmation, keeping the Git tree clean (`src/commands/link.ts`)
- **「复杂中文 NLP 以可选依赖外挂」("complex Chinese NLP stays an optional dependency")** — the core stays zero-dependency; accurate tokenizers like jieba are adopted on demand (`src/utils/phrase-frequency.ts`, see "Optional Dependency Strategy" below)

---

## 2. 🧩 Toolchain Composition (applies to all development)

### Core Principle

story-cli does not enumerate every output format. Instead it combines `--stdout` + enhanced `--json` output with external specialist tools (yq / jq / pandoc / awk). **The CLI provides atomic capabilities; the user orchestrates.**

### Why It Matters

| Dimension               | Assessment                                                                         |
| :---------------------- | :--------------------------------------------------------------------------------- |
| **Unix philosophy**     | ✅ Standard raw output only; conversion is left to specialist tools                |
| **Zero maintenance**    | ✅ No need to write parsers, handle edge cases, or fix bugs per format             |
| **Ecosystem potential** | ✅ Users are not limited by the CLI's command set                                  |
| **MCP complementarity** | ✅ MCP handles AI real-time read/write; `--stdout` handles offline data processing |

### `--stdout` Coverage

| Command                | Status      | Notes                                       |
| :--------------------- | :---------- | :------------------------------------------ |
| `export json --stdout` | ✅ Done     | —                                           |
| `export md --stdout`   | ✅ Done     | Most generic; pandoc converts to any format |
| `export txt --stdout`  | ✅ Done     | Plain-text pipeline                         |
| `export html --stdout` | ⚠️ Optional | Requires handling image asset references    |

### Relationship with MCP / Plugins (complementary, not competing)

| Scenario                                    | Recommended approach       |
| :------------------------------------------ | :------------------------- |
| One-off format conversion                   | `--stdout` + external tool |
| Frequent conversion                         | Plugin wrapper             |
| AI reading/writing the library in real time | MCP Server                 |
| Offline data processing                     | `--stdout` + jq/yq/pandoc  |

---

## 3. ✅ Completed Milestones (Phase 1: 2026-08 product foundation)

> See [CHANGELOG.en.md](CHANGELOG.en.md) and the `docs/` guides for the full delivery history; this table keeps only direction-level conclusions.

| Direction                                   | Core deliverables                                                                                  | Completed  |
| :------------------------------------------ | :------------------------------------------------------------------------------------------------- | :--------- |
| **MCP Server**                              | `story mcp-server` + 9 tools (Token optimization / `edit_config` governance / `--root`)            | 2026-08-16 |
| **General-purpose content platform**        | `story init` three templates (story / knowledge / tech)                                            | 2026-08-16 |
| **GitHub Action**                           | Zero-config Composite Action (Push → Build → Release)                                              | 2026-08-16 |
| **Analysis toolchain**                      | `stats --json` enhancements + `make analyze` (chapter trends / health / repeated phrases)          | 2026-08-17 |
| **Spec standardization**                    | Story-Repo spec v2.0 + `story validate` compliance checker                                         | 2026-08-17 |
| **Extended capabilities (links/embedding)** | `links` weak relations (suggest / persist / README section) + `export embeddings` JSONL            | 2026-08-17 |
| **Scale-ready builds**                      | Incremental build cache (`.story-cache.json`, 22×) + `suggestLinks` de-O(n²)                       | 2026-08-19 |
| **EPUB productization**                     | Cover rendering / built-in styles (`--css`) / NCX compatibility TOC / series metadata / `--output` | 2026-08-19 |
| **Toolchain composition (--stdout)**        | `export md/txt/json --stdout` + Makefile toolchain reference                                       | 2026-08-16 |

### Optional Dependency Strategy (可选依赖策略, design decision record)

- **Complex Chinese NLP (e.g. jieba tokenization) stays an "optional dependency" and is never forced** — `stats` repeated-phrase detection uses zero-dependency n-grams (deterministic statistics, sufficient as a "writing repetition reminder"); the exact-tokenization trade-off is documented in [docs/design.en.md](docs/design.en.md#known-limitation-repeated-phrase-detection) (this section is the anchor referenced by `docs/design.md` / `docs/design.en.md` as "see ROADMAP").

---

## 4. 🔜 Next-Phase Planning

> Phase 1 features are fully shipped. Current reality: the project is 5 days old with zero community (0 stars / 0 issues), and EPUB + MCP governance just landed — the focus shifts from "building features" to "finding users, guarding quality, deepening the ecosystem."

### P0 Ecosystem Validation: Build a User Feedback Loop

- **Goal**: with zero community, every feature decision is "design in a vacuum" — we need real users and real long-form workflows to validate and correct course
- **Deliverables**:
  - Polish `story demo` (one command generates a showcase repo with cover / series / multi-chapter, demonstrating capabilities at a glance)
  - Quick-start docs (streamlined README + docs examples)
  - GitHub Issue templates + `CONTRIBUTING.md` / `CONTRIBUTING.en.md` contribution guides
- **Acceptance criteria**: an external user (not the author) can complete the full flow "init → new → write → build → epub → MCP conversation" within 10 minutes following the docs, and file the first real issue

### P1 Product Deepening

- **EPUB theme switching**: `--css` already supports single-file replacement; add built-in themes (`--theme=paper|sepia`, etc.) to lower the customization barrier for non-technical users
- **MCP governance completion**: `edit_config` already covers metadata governance; `delete_story` / `rename_story` are scoped as **a separate decision** (Git-native semantics: rely on `git mv` / archive instead of physical deletion), prioritized by community feedback
- **Acceptance criteria**: EPUB theme flags are test-covered; destructive MCP operations have an explicit decision record (do / don't / how)

### P1 Engineering: Guard the Quality We've Delivered

- **Performance regression gate**: the incremental cache brought a 22× win and must not regress — wire `bench` into CI and fail when cold/warm build times exceed thresholds
- **Doc sync script**: `docs/commands.md` risks drifting from the command registry; add `scripts/sync-docs.ts` or a CI check
- **Coverage gate**: `test:coverage` exists; add a minimum coverage line
- **Acceptance criteria**: the CI pipeline includes a bench regression check; command docs are derived from the registry (or CI-verified consistent)

### P2 Community: From a Personal Tool to an Open Project

- **Publish the GitHub Action**: tag the Composite Action v1 and list it on the Marketplace
- **Automate the release flow**: versioning / CHANGELOG / npm publish / GitHub Release in one command
- **Story-Repo ecosystem adoption**: the v2.0 spec is already standalone; attract third-party tools (Obsidian plugins, VS Code extensions) to adopt it, making the file format an API
- **Acceptance criteria**: `story-cli@v1` is usable directly in third-party workflows; at least one third-party tool declares Story-Repo spec compatibility
