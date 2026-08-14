# 🔄 GitHub Actions CI

story-cli is designed to be **CI-friendly** and integrates seamlessly with GitHub Actions.

---

## 📦 Automated Build

The following workflow runs automatically on every push to the `main` branch:

```yaml
name: Build & Test
on:
  push:
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
      - run: story build --validate-only
      - run: story build
      - run: pnpm test
```

---

## 📌 Step Breakdown

| Step | Purpose |
|------|---------|
| `actions/checkout@v4` | Check out the repository code |
| `pnpm/action-setup@v4` | Install pnpm (requires a `package.json` at the repository root) |
| `actions/setup-node@v4` | Configure Node.js, set version, and enable pnpm cache |
| `pnpm install` | Install dependencies |
| `story build --validate-only` | **Validation phase**: check configs only, no README generation |
| `story build` | **Build phase**: generate all story READMEs + root index |
| `pnpm test` | **Test phase**: run the full test suite |

---

## 🛡️ Why CI Matters

1. **Early config error detection** — `--validate-only` validates configs before building, failing fast instead of producing partial output
2. **Auto-refreshed READMEs** — READMEs are regenerated on every push, keeping the story index and chapter word counts up to date
3. **Quality assurance** — 116 tests cover validation, rendering, EPUB, scanning, and more, preventing regressions

---

## 💡 Advanced Usage

### Persisting word counts with `--save-counts`

If your story `config.json` doesn't include a `wordCount` field, save it explicitly:

```yaml
- run: story build --save-counts
- run: git diff --exit-code  # Ensure no uncommitted changes
```

This writes word counts back into `config.json`, and `git diff` can detect whether there are changes to commit.

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

- Adjust the `node-version` in `actions/setup-node@v4` to match the `engines.node` in `package.json` (CI runs source tests directly, requiring Node 24+ for native .ts support; published runtime needs only Node >= 20)
- If you use npm instead of pnpm, change `cache: pnpm` to `cache: npm` and `pnpm install` to `npm install`