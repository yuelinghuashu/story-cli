# 🤝 Contributing

story-cli is a **zero-dependency, Git-native, AI-friendly** content governance CLI. Before changing code, please understand the project's positioning philosophy (see [ROADMAP.en.md](ROADMAP.en.md)) and make sure your change aligns with it.

## 🧰 Development Environment

| Dependency | Version | Notes                                              |
| ---------- | ------- | -------------------------------------------------- |
| Node.js    | >= 24   | Dev runs `.ts` directly (native type stripping)    |
| pnpm       | >= 9    | Package manager (`corepack enable` to activate)    |
| Git        | any     | The project is a Git-native workflow               |

```bash
git clone https://github.com/yuelinghuashu/story-cli.git
cd story-cli
pnpm install
```

> ⚠️ The published package runs on Node >= 22 (compiled `dist/`); **development** needs Node 24+ native TS support.

## 🏃 Common Commands

```bash
pnpm typecheck   # TypeScript type checking
pnpm lint        # biome code style checks
pnpm lint:fix    # auto-fix fixable style issues
pnpm test        # full test suite (node:test, parallel)
pnpm build       # compile to dist/
make verify      # typecheck + lint + test + build in one command
make demo        # generate a demo repo in ./demo/ (try the full flow)
```

## 🧪 Testing Conventions

- Uses Node's built-in `node:test` + `node:assert` (**zero additional test dependencies**, keeping the project's philosophy)
- Each core module has its own test file (`tests/<module>.test.ts`)
- Behavior changes require corresponding tests; new features should cover pure logic with unit tests first
- CLI-level behavior is integration-tested via `spawnSync` running real commands (see `runCli` in `tests/helpers.ts`)
- Make sure `pnpm test` is green before committing (run it once first to confirm the baseline)

## 💬 How to Contribute

The project is currently developed by a single maintainer, and **Issues are the primary contribution channel**:

- **Report bugs / suggest features**: open an [Issue](https://github.com/yuelinghuashu/story-cli/issues) directly (form templates are provided — fill them out)
- **Interested in submitting code**:
  1. Open an Issue to discuss the direction first (especially for new features), confirm it fits the project's positioning, and avoid rework
  2. Branch from `main`: `git checkout -b feat/xxx` or `fix/xxx`; commit in small steps (Chinese commit messages, following existing history)
  3. Sync docs: user-visible changes must update `[Unreleased]` in `CHANGELOG.md` / `CHANGELOG.en.md`; docs (README / docs/) stay bilingual
  4. Run the full validation: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
  5. Open a PR describing the change and validation results

## 🧭 Project Structure at a Glance

```text
src/
├── cli.ts           # command dispatch entry
├── commands/        # CLI command implementations
├── core/            # domain core (scan/load/validate/stats/cache)
├── render/          # output rendering (README/EPUB/Markdown→HTML)
├── mcp/             # MCP Server (AI client access)
├── utils/           # pure utilities
└── i18n/            # zh/en locale strings
tests/               # node:test tests
bench/               # performance benchmarks (generate.ts + bench.ts)
docs/                # documentation (all bilingual)
```

> 💡 Module design details: [docs/architecture.en.md](docs/architecture.en.md); design philosophy: [docs/design.en.md](docs/design.en.md).

## ⚠️ Positioning Red Lines (review focus)

- **Zero dependencies**: runtime is only `fflate` + `handlebars`; new features must not add runtime dependencies
- **Git-native**: no databases / locks / server-side state; destructive operations follow Git semantics
- **Unix philosophy**: the CLI provides atomic capabilities, `--stdout` emits raw material, and orchestration is left to external tools
- **Bilingual**: user-visible text goes through `src/i18n/` (zh/en); docs stay synced in both languages
