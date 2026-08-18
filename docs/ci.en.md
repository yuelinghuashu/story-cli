# 🔄 GitHub Actions CI

> 📋 Full command list with aliases and subcommands: see [commands.en.md](commands.en.md).

story-cli is designed to be **CI-friendly** and integrates seamlessly with GitHub Actions.

This repository ships a complete CI workflow: [`.github/workflows/build.yml`](../.github/workflows/build.yml).

---

## 📦 Automated Build

The following workflow runs automatically on every push to the `main` branch:

```yaml
name: Build & Test
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install
      - name: Typecheck
        run: pnpm typecheck
      - name: Lint
        run: pnpm lint
      - name: Build package
        run: pnpm build
      - name: Run tests
        run: pnpm test

      - name: Test coverage
        run: pnpm test:coverage
```

---

## 📌 Step Breakdown

| Step                    | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `actions/checkout@v4`   | Check out the repository code                                   |
| `pnpm/action-setup@v4`  | Install pnpm (requires a `package.json` at the repository root) |
| `actions/setup-node@v4` | Configure Node.js, set version, and enable pnpm cache           |
| `pnpm install`          | Install dependencies                                            |
| `pnpm typecheck`        | **Type checking**: verify TypeScript types are correct          |
| `pnpm lint`             | **Code style**: Biome checks code style                         |
| `pnpm build`            | **Build phase**: compile TypeScript to `dist/`                  |
| `pnpm test`             | **Test phase**: run the full test suite                         |
| `pnpm test:coverage`    | **Coverage**: measure test coverage (~95% currently)            |

---

## 🛡️ Why CI Matters

1. **Type safety** — `tsc --noEmit` ensures TypeScript types are correct
2. **Code style** — Biome enforces consistent lint + format
3. **Quality assurance** — 519 tests cover scanning, validation, rendering, EPUB, CLI, MCP protocol, GitHub Action structure, and more, preventing regressions

---

## 💡 Advanced Usage

### Using story-cli in a story repository

The story-cli source repository is **not a story repository**, so `story build` is not run in its CI. To integrate CI in your **story repository**, the recommended way is to use the **story-cli Action**:

```yaml
- uses: actions/checkout@v4
- name: Build README
  uses: yuelinghuashu/story-cli@v1
  with:
    command: "build"
```

**Inputs:** `command` (required), `cli-version` (default `latest`), `working-directory` (default `.`).

> 💡 The `.github/workflows/example.yml` in this repo is a **manual-trigger demo workflow** showing typical usage of `build` / `epub --all`. It does NOT run automatically on push — copy and adapt it to your own story repository as needed.

Alternative: run the published npm package directly with `npx --yes @yuelinghuashu/story-cli build --validate-only`

### Multi-branch builds

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
```

---

## ⚠️ Notes

- Adjust the `node-version` in `actions/setup-node@v4` to match the `engines.node` in `package.json` (CI runs source tests directly, requiring Node 24+ for native .ts support; published runtime needs Node >= 22)
- If you use npm instead of pnpm, change `cache: pnpm` to `cache: npm` and `pnpm install` to `npm install`
