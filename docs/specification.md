# 📐 Story Repository Specification v1.0

> **版本策略**：本文档版本（v1.0）独立于 CLI 版本。
> 新增可选字段时递增 minor 版本（v1.0 → v1.1）；
> 破坏性变更（移除/重命名字段）时递增 major 版本（v1.x → v2.0）。
>
> **非目标**：本规范不覆盖 CLI 命令接口、UI 交互、
> EPUB 导出细节、README 模板设计。

---

## 1. 目录结构

### 1.1 仓库根

一个符合规范的故事仓库使用以下目录结构：

```text
repo/
├── 01-story-a/           # 故事目录（NN- 前缀）
├── 02-story-b/
├── docs/                 # 文档（可选）
├── assets/
│   └── sponsor/          # 赞助收款码（可选）
├── config.original.json  # 原创故事模板（可选）
├── config.fanfic.json    # 二创故事模板（可选）
├── story-template.md     # 故事 README 模板（可选）
├── story.config.json     # 仓库级配置（可选）
├── Makefile              # 工作流入口（可选，story init 生成）
├── .storyignore          # story-cli 扫描排除规则（可选）
└── .gitignore            # Git 忽略规则（可选）
```

### 1.2 故事目录识别规则

- 目录名以 `NN-` 开头（**至少两位数字** + 连字符）即为故事目录
- 数字前缀用于物理排序（`01-` < `02-` < ... < `12-` < `100-`，数值序）
- 数字前缀一旦创建**不应修改**（它是故事的"身份证号"）
- 展示顺序通过 `config.json` 中的 `series` / `seriesOrder` 调整（逻辑坐标）

### 1.3 保留目录

以下目录**不应**被识别为故事目录：

- `.git` — Git 内部目录
- `node_modules` — 依赖目录
- `dist` — 构建产物
- `assets` — 资源目录（赞助收款码等）

### 1.4 排除规则（.storyignore）

可选文件 `.storyignore` 使用 `.gitignore` 的简化子集语法：

- 注释行以 `#` 开头
- `name/` 仅匹配目录
- `*` 匹配任意字符（不跨越目录分隔符）
- 明确**不支持**：`!` 取反、`**` 递归、`/` 锚定

示例：

```text
# 草稿目录
_draft/

# 临时文件
*.tmp
```

---

## 2. config.json 规范

每个故事目录必须包含 `config.json` 文件。

### 2.1 必填字段

| 字段      | 类型   | 说明                                         |
| --------- | ------ | -------------------------------------------- |
| `title`   | string | 故事标题                                     |
| `type`    | string | 故事类型（`original` / `fanfic` / 自定义）   |
| `status`  | string | 故事状态（`completed` / `ongoing` / 自定义） |
| `summary` | string | 一句话简介                                   |
| `created` | string | 创建日期（`YYYY-MM-DD` 格式）                |

### 2.2 可选字段

| 字段             | 类型    | 说明                                                 |
| ---------------- | ------- | ---------------------------------------------------- |
| `author`         | string  | 作者名称（原创故事可选）                             |
| `originalWork`   | string  | 原作名称（fanfic 必填）                              |
| `originalAuthor` | string  | 原作者（fanfic 必填）                                |
| `isMultiChapter` | boolean | 是否为多章节（自动推断，可省略）                     |
| `language`       | string  | 语言（`zh` / `en`，默认 `zh`）                       |
| `wordCount`      | string  | 字数描述（格式化文本，如 `约 3 千字`）               |
| `cover`          | string  | 封面图片路径                                         |
| `series`         | string  | 系列名称（有值则归入对应系列分组）                   |
| `seriesOrder`    | number  | 系列内排序键（支持整数和小数，缺失时回退文件夹序号） |
| `volume`         | string  | 卷/册名称（仅用于展示）                              |

### 2.3 验证规则

- `created` 必须匹配 `YYYY-MM-DD` 格式
- `type` 和 `status` 的合法值由内置枚举或仓库级 `story.config.json` 定义
- `fanfic` 类型必须同时提供 `originalWork` 和 `originalAuthor`
- 未知字段应被读取器忽略（不报错）

---

## 3. 正文文件规范

### 3.1 text.md

故事正文的标准文件，使用 Markdown 格式。

```markdown
# 第一章

正文内容...

## 第二节

更多内容...
```

### 3.2 chapter-\*.md（可选分章）

当故事采用分章写作时，使用 `chapter-*.md` 模式：

- 文件名按字典序排序后合并（`chapter-01.md` < `chapter-02.md`）
- 每个文件以第一个 `#` 标题作为章节名
- 所有章节之间用 `---` 分隔合并

#### 3.2.1 推荐命名模式

根据创作类型选择适合的命名模式：

```text
# 模式 A：简单顺序（篇幅短，无分卷）
chapter-01.md
chapter-02.md
...

# 模式 B：分卷分章（长篇小说）
chapter-1-01.md          # 第 1 卷 第 1 章
chapter-1-02.md          # 第 1 卷 第 2 章
chapter-2-01.md          # 第 2 卷 第 1 章

# 模式 C：剧本分场（卷-幕-场）
chapter-1-1-开场.md       # 第 1 卷 第 1 幕 · 开场
chapter-1-2-发展.md       # 第 1 卷 第 2 幕 · 发展
chapter-2-1-转折.md       # 第 2 卷 第 1 幕 · 转折
```

#### 3.2.2 命名规则

- **匹配规则**：只要以 `chapter-` 开头、以 `.md` 结尾的文件都会被识别为章节
- **排序规则**：文件名按**字典序**排序，**不是数值序**
- **补零要求**：每级编号 ≥10 时必须以 `0` 补足两位，保证字典序 = 数值序
  - ✅ `chapter-1-02.md` / `chapter-1-10.md`（字典序正确：02 < 10）
  - ❌ `chapter-1-2.md` / `chapter-1-10.md`（字典序错误：10 < 2）
- **层级分隔**：使用短横线 `-` 分隔各级编号（卷-章 或 卷-幕-场）
- **语义辅助**：编号后可用 `-` 附加可读名称（如 `-开场`、`-发展`），不影响解析，便于文件导航
- **章节标题**：合并时优先使用文件内第一个 `#` 标题；无标题时回退使用完整文件名

#### 3.2.3 命名示例对照

| 文件名                | 推荐场景   | 合并后章节标题                       |
| --------------------- | ---------- | ------------------------------------ |
| `chapter-01.md`       | 无分卷短篇 | 文件内 `#` 标题或 `chapter-01`       |
| `chapter-1-01.md`     | 长篇分卷   | 文件内 `#` 标题或 `chapter-1-01`     |
| `chapter-1-1-开场.md` | 剧本分场   | 文件内 `#` 标题或 `chapter-1-1-开场` |
| `chapter-2-3-结局.md` | 剧本分场   | 文件内 `#` 标题或 `chapter-2-3-结局` |

### 3.3 章节边界规则

- `#` 或 `##` 标题作为章节的边界
- 标题后无实际内容的空章节应被跳过
- 章节字数按语言计数（中文按汉字、英文按单词）

---

## 4. 仓库级配置（story.config.json）

`story.config.json` 自定义故事类型和状态枚举及本地化标签：

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

- `typeLabels` / `statusLabels` 为可选，用于自定义枚举的本地化显示
- 内置枚举（`original` / `fanfic` / `completed` / `ongoing`）已有内置标签
- 未配置标签的枚举值显示为原始代码字符串
- 文件缺失时回退到内置默认值

---

## 5. 扫描与排序规则

### 5.1 目录识别

1. 读取 `.storyignore` 规则
2. 遍历根目录
3. 排除保留目录（`.git` / `node_modules` / `dist` / `assets`）
4. 排除 `.storyignore` 匹配的目录
5. 匹配 `NN-` 前缀（至少两位数字）

### 5.2 排序

- 故事文件夹按数字前缀**数值序**排序（`12-` < `100-`）
- 同一系列内按 `seriesOrder` 数值升序（支持小数）
- 缺失或无效 `seriesOrder` 时回退文件夹数字前缀
- 排序键相同时按文件夹数字前缀保证确定性

### 5.3 系列分组

- `series` 字段有值的归入系列分组
- 空字符串 / 空白等同于未定义
- 组间顺序按组内最小文件夹序号，组名作为二级键
- 未归入系列的故事按文件夹序号排序，置于所有系列之后

---

## 6. 编码约定

所有文件必须使用 **UTF-8 编码**：

| 文件                 | 编码       | 说明                               |
| -------------------- | ---------- | ---------------------------------- |
| `config.json`        | UTF-8 强制 | JSON 标准要求                      |
| `story.config.json`  | UTF-8 强制 | JSON 标准要求                      |
| `text.md`            | UTF-8 强制 | 避免中文字符乱码                   |
| `chapter-*.md`       | UTF-8 强制 | 同上                               |
| `.storyignore`       | UTF-8 建议 | 包含中文目录名时必须一致           |

> story-cli 使用 Node 内置 `TextDecoder(fatal: true)` 检测非法 UTF-8 序列，
> 并用 `gb18030` 反检测识别 GBK/GB2312 文件。检测到编码问题时输出警告，
> **不阻断构建**。
>
> 第三方实现如需兼容本规范，应按 UTF-8 解码所有文件；无法解码时应给出明确错误提示。

---

## 7. 赞助目录

`assets/sponsor/` 中的图片（`.png` / `.jpg` / `.jpeg` / `.gif` / `.webp` / `.bmp`）用于生成赞助区块：

- 图片按文件名排序
- 渲染为折叠区块（展示在根 README 中）

---

## 8. 版本与兼容性

### 8.1 版本演进

- 本文档版本号**独立于** CLI 包版本
- 新增可选字段 → minor 版本递增（如 v1.0 → v1.1）
- 移除/重命名字段等破坏性变更 → major 版本递增（如 v1.x → v2.0）

### 8.2 向后兼容

- 新增可选字段不应破坏旧版读取器
- 读取器应**忽略**未知字段
- 示例：v1.0 定义的 `series` 字段，v1.1 新增 `seriesOrder` 时旧读取器仍可正常读取

---

## 附录 A：参考实现

- schema 定义：[`src/core/schema.ts`](../src/core/schema.ts)
- 扫描逻辑：[`src/core/scanner.ts`](../src/core/scanner.ts)
- 排序逻辑：[`src/core/sort.ts`](../src/core/sort.ts)
- 测试行为基准：[`tests/`](../tests/)
