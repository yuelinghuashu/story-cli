# 📐 Story Repository Specification v1.0

> **Versioning Policy**: This document's version (v1.0) is independent of the CLI version.
> Adding optional fields increments the minor version (v1.0 → v1.1);
> breaking changes (removing/renaming fields) increment the major version (v1.x → v2.0).
>
> **Non-Goals**: This specification does not cover CLI command interfaces, UI interactions,
> EPUB export details, or README template design.

---

## 1. Directory Structure

### 1.1 Repository Root

A conforming story repository uses the following structure:

```text
repo/
├── 01-story-a/           # Story directory (NN- prefix)
├── 02-story-b/
├── docs/                 # Documentation (optional)
├── assets/
│   └── sponsor/          # Sponsor QR codes (optional)
├── config.original.json  # Original story template (optional)
├── config.fanfic.json    # Fan fiction template (optional)
├── story-template.md     # Story README template (optional)
├── story.config.json     # Repository-level config (optional)
├── .storyignore          # story-cli scan exclusion rules (optional)
└── .gitignore            # Git ignore rules (optional)
```

### 1.2 Story Directory Identification

- A directory starting with `NN-` (at least two digits + hyphen) is a story directory
- The numeric prefix is used for physical sorting (`01-` < `02-` < ... < `12-` < `100-`, numeric order)
- The numeric prefix should **never be modified** once created (it's the story's "ID number")
- Display order is controlled by `series` / `seriesOrder` in `config.json` (logical coordinates)

### 1.3 Reserved Directories

The following directories **must not** be identified as story directories:

- `.git` — Git internal directory
- `node_modules` — dependencies
- `dist` — build output
- `assets` — resources (sponsor QR codes, etc.)

### 1.4 Exclusion Rules (.storyignore)

The optional `.storyignore` file uses a simplified subset of `.gitignore` syntax:

- Comment lines start with `#`
- `name/` matches directories only
- `*` matches any characters (not crossing directory separators)
- Explicitly **not supported**: `!` negation, `**` recursion, `/` anchoring

Example:

```text
# Draft directories
_draft/

# Temporary files
*.tmp
```

---

## 2. config.json Specification

Every story directory must contain a `config.json` file.

### 2.1 Required Fields

| Field     | Type   | Description                                     |
| --------- | ------ | ----------------------------------------------- |
| `title`   | string | Story title                                     |
| `type`    | string | Story type (`original` / `fanfic` / custom)     |
| `status`  | string | Story status (`completed` / `ongoing` / custom) |
| `summary` | string | One-sentence summary                            |
| `created` | string | Creation date (`YYYY-MM-DD` format)             |

### 2.2 Optional Fields

| Field            | Type    | Description                                                                                 |
| ---------------- | ------- | ------------------------------------------------------------------------------------------- |
| `author`         | string  | Author name (optional for originals)                                                        |
| `originalWork`   | string  | Original work name (required for fanfic)                                                    |
| `originalAuthor` | string  | Original author (required for fanfic)                                                       |
| `isMultiChapter` | boolean | Multi-chapter flag (auto-inferred, can be omitted)                                          |
| `language`       | string  | Language (`zh` / `en`, default `zh`)                                                        |
| `wordCount`      | string  | Word count description (formatted text, e.g. `~3K words`)                                   |
| `cover`          | string  | Cover image path                                                                            |
| `series`         | string  | Series name (groups stories into a series)                                                  |
| `seriesOrder`    | number  | In-series sort key (supports integers and decimals; falls back to folder number if missing) |
| `volume`         | string  | Volume name (display only)                                                                  |

### 2.3 Validation Rules

- `created` must match `YYYY-MM-DD` format
- Valid `type` and `status` values are defined by built-in enums or the repository-level `story.config.json`
- `fanfic` type requires both `originalWork` and `originalAuthor`
- Unknown fields should be ignored by readers (no error)

---

## 3. Content File Specification

### 3.1 text.md

The standard story content file, using Markdown format.

```markdown
# Chapter One

Content...

## Section Two

More content...
```

### 3.2 chapter-\*.md (Optional Chapter Files)

When writing chapter-by-chapter, use the `chapter-*.md` pattern:

- Files are merged in lexicographic order (`chapter-01.md` < `chapter-02.md`)
- Each file's first `#` heading becomes the chapter title
- All chapters are joined with `---` separators

#### 3.2.1 Recommended Naming Patterns

Choose a naming pattern based on your writing style:

```text
# Pattern A: Simple sequential (short works, no volumes)
chapter-01.md
chapter-02.md
...

# Pattern B: Volume + Chapter (long novels)
chapter-1-01.md          # Volume 1, Chapter 1
chapter-1-02.md          # Volume 1, Chapter 2
chapter-2-01.md          # Volume 2, Chapter 1

# Pattern C: Script scenes (Volume-Act-Scene)
chapter-1-1-opening.md    # Volume 1, Act 1, Scene: Opening
chapter-1-2-development.md # Volume 1, Act 2, Scene: Development
chapter-2-1-twist.md      # Volume 2, Act 1, Scene: Twist
```

#### 3.2.2 Naming Rules

- **Matching**: Any file starting with `chapter-` and ending with `.md` is recognized as a chapter
- **Sorting**: Files are sorted by **lexicographic order**, not numeric order
- **Zero-padding**: When a level reaches 10+, pad to two digits so lexicographic order = numeric order
  - ✅ `chapter-1-02.md` / `chapter-1-10.md` (correct: 02 < 10)
  - ❌ `chapter-1-2.md` / `chapter-1-10.md` (wrong: 10 < 2)
- **Level separator**: Use hyphens `-` to separate number levels (volume-chapter or volume-act-scene)
- **Semantic suffix**: Append readable names after numbers (e.g. `-opening`, `-development`) — doesn't affect parsing, aids navigation
- **Chapter title**: First `#` heading in each file is used as the chapter title; falls back to the full filename if absent

#### 3.2.3 Naming Examples

| Filename                 | Recommended for             | Merged chapter title                       |
| ------------------------ | --------------------------- | ------------------------------------------ |
| `chapter-01.md`          | Short works without volumes | First `#` heading or `chapter-01`          |
| `chapter-1-01.md`        | Long novels with volumes    | First `#` heading or `chapter-1-01`        |
| `chapter-1-1-opening.md` | Script scenes               | First `#` heading or `chapter-1-1-opening` |
| `chapter-2-3-ending.md`  | Script scenes               | First `#` heading or `chapter-2-3-ending`  |

### 3.3 Chapter Boundary Rules

- `#` or `##` headings define chapter boundaries
- Empty chapters (heading with no content after) should be skipped
- Chapter word counts are language-aware (Chinese characters for zh, English words for en)

---

## 4. Repository Configuration (story.config.json)

`story.config.json` customizes story type/status enums and localization labels:

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

- `typeLabels` / `statusLabels` are optional, for localized display of custom enums
- Built-in enums (`original` / `fanfic` / `completed` / `ongoing`) have built-in labels
- Enum values without configured labels display as raw code strings
- Missing file falls back to built-in defaults

---

## 5. Scanning and Sorting Rules

### 5.1 Directory Identification

1. Read `.storyignore` rules
2. Iterate root directory
3. Exclude reserved directories (`.git` / `node_modules` / `dist` / `assets`)
4. Exclude directories matched by `.storyignore`
5. Match `NN-` prefix (at least two digits)

### 5.2 Sorting

- Story folders sort by numeric prefix order (`12-` < `100-`)
- Within the same series, sort by `seriesOrder` ascending (supports decimals)
- Missing or invalid `seriesOrder` falls back to the folder numeric prefix
- When sort keys are equal, folder numeric prefix ensures determinism

### 5.3 Series Grouping

- Stories with a `series` value are grouped into series
- Empty string / whitespace is treated as undefined
- Group order follows the group's minimum folder number, with group name as secondary key
- Ungrouped stories sort by folder number and come after all series groups

---

## 6. Sponsor Directory

Images in `assets/sponsor/` (`.png` / `.jpg` / `.jpeg` / `.gif` / `.webp` / `.bmp`) are used to generate the sponsor block:

- Images are sorted by filename
- Rendered as a collapsible section (displayed in the root README)

---

## 7. Versioning and Compatibility

### 7.1 Version Evolution

- This document's version number is **independent of** the CLI package version
- Adding optional fields → minor version increment (e.g. v1.0 → v1.1)
- Breaking changes (removing/renaming fields) → major version increment (e.g. v1.x → v2.0)

### 7.2 Backward Compatibility

- New optional fields should not break older readers
- Readers should **ignore** unknown fields
- Example: when v1.1 adds `seriesOrder` alongside the v1.0-valid `series` field, older readers can still read normally

---

## Appendix A: Reference Implementation

- Schema definitions: [`src/core/schema.ts`](../src/core/schema.ts)
- Scanning logic: [`src/core/scanner.ts`](../src/core/scanner.ts)
- Sorting logic: [`src/core/sort.ts`](../src/core/sort.ts)
- Test behavior baseline: [`tests/`](../tests/)
