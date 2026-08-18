# 📝 如何新增故事

> 📐 完整的仓库数据规范（目录结构、字段定义、版本策略）请参阅 [specification.md](specification.md)。📋 完整命令清单见 [commands.md](commands.md)。

只需 3 步即可完成：

1. 创建目录 `NN-故事名/`
2. 编写 `config.json`
3. 运行 `story build`（或使用 Makefile 工作流：`make build`）

---

## 📁 目录约定

故事就是文件夹，放在仓库根目录下：

```text
my-stories-repo/
├── config.original.json      # 原创故事模板（由 story init 生成）
├── config.fanfic.json        # 二创故事模板（由 story init 生成）
├── story-template.md         # 故事 README 的 Handlebars 模板
├── story.config.json         # 仓库级配置（自定义类型/状态，由 story init 生成）
├── Makefile                  # 工作流入口（由 story init 生成，make help 查看全部命令）
├── README.md                 # 自动生成的根目录索引
├── assets/                   # 全局素材目录（封面等）
│   └── sponsor/              # 赞助收款码专用目录（由 story init 创建）
│       ├── README.md         # 目录用途说明
│       └── .gitkeep          # 保持空目录可被 Git 追踪
│
└── 01-我的故事/              # 故事文件夹（需要 NN- 前缀）
    ├── config.json           # 故事元数据
    ├── text.md               # 正文内容（单文件）
    ├── chapter-*.md          # 可选：拆分到多个章节文件
    ├── assets/               # 可选：故事用到的图片（也可放根目录 assets/）
    └── README.md             # 自动生成的故事页面
```

> 💡 根目录的 `assets/` 是全局素材目录（封面等），`assets/sponsor/` 是赞助收款码的专用目录（详见下文）。
>
> 💡 `NN-` 前缀是至少两位数字序号（如 `01-`、`02-`、`100-`），**按数字大小排序**（`12-` 排在 `100-` 前），用于控制故事的显示顺序。**序号不能重复**，重复序号会在 `story build` 时给出警告。
>
> 💡 **物理坐标与逻辑坐标**：文件夹名中的 `NN-` 是故事的「物理坐标」，一旦创建永不修改（保证 Git 链接稳定）。如需调整展示顺序，请使用 `config.json` 中的 `series` / `seriesOrder` 字段（见下文「系列与排序」），两者互不冲突。
>
> ⚠️ **禁止重命名已有故事的文件夹**。重命名会导致：
>
> - 指向旧路径的链接（README、外部引用）变成 404
> - Git 普通 `git log` 显示为「删除 + 新增」，历史不连续
> - 虽然 `git log --follow` 仍可追溯，但外部链接无法自动恢复
>
> 如果 `story build` 检测到暂存区中有重命名（需要 `git add` 之后才会检测到），会输出温和的警示信息。

### 💰 赞助支持（可选）

如果你希望在根 README 中展示"☕ 赞助支持"区块（放收款码让读者打赏），在根目录 `assets/sponsor/` 中放置收款码图片即可：

```text
assets/
└── sponsor/           # 赞助收款码专用目录（文件名、数量可任意）
    ├── ali-pay.jpg
    └── wechat-pay.jpg
```

`story build` 检测到 `assets/sponsor/` 中存在图片后，会在根 README 中自动生成"☕ 赞助支持"折叠区块；目录不存在或为空时该区块自动隐藏。

**注意**：`assets/sponsor/` 是专用目录，请勿将小说配图放在这里——小说图片请放在 `assets/` 或各故事文件夹的 `assets/` 中。

### 序号生成规则

`story new "标题"` 自动生成的序号 = **当前最大序号 + 1**：

```text
01-故事A
02-故事B
03-故事C
```

- 删除 `02-故事B` 后新建故事 → 得到 `04-新故事`（**不会**复用 `02`）
- 删除 `03-故事C` 后新建故事 → 得到 `03-新故事`（会复用末尾空位）

**为什么这样设计**：序号的唯一目的是控制展示顺序，为了让已有故事的链接（README、EPUB 中的引用）永远保持稳定，不会因为增删操作导致中间序号整体前移。

**手动创建**：如果手动创建文件夹，`NN` 必须使用**至少两位数字**（如 `01-`、`05-`、`100-`）。一位数字（如 `5-`）不会被识别为故事目录。即使中间有"空号"也能正常构建（只需确保不重复），但 `story new` 不会主动复用空号。

---

## 📝 config.json 详解

```json
{
  "title": "故事标题",
  "type": "original", // "original" 或 "fanfic"
  "status": "ongoing", // "completed" 或 "ongoing"
  "isMultiChapter": false,
  "language": "zh", // "zh" 或 "en"
  "summary": "一句话概括故事核心冲突和结局。",
  "created": "2026-08-14", // YYYY-MM-DD
  "author": "作者名", // 可选，原创故事作者（EPUB 导出时使用）
  "originalWork": "原作名称", // 二创必填
  "originalAuthor": "原作者", // 二创必填
  "series": "三体", // 可选，系列名称
  "seriesOrder": 2, // 可选，系列内排序（支持小数）
  "volume": "第二部·黑暗森林" // 可选，卷/册名称（展示 + 分卷导出）
}
```

### 字段说明

| 字段             | 必填     | 类型      | 说明                                                        |
| ---------------- | -------- | --------- | ----------------------------------------------------------- |
| `title`          | ✅       | `string`  | 故事标题                                                    |
| `type`           | ✅       | `string`  | `"original"`（原创）或 `"fanfic"`（二创）                   |
| `status`         | ✅       | `string`  | `"completed"`（已完结）或 `"ongoing"`（连载中）             |
| `isMultiChapter` | 可选     | `boolean` | 是否为多章节故事（默认 `false`）                            |
| `language`       | 可选     | `string`  | `"zh"` 或 `"en"`，决定 README 本地化                        |
| `summary`        | ✅       | `string`  | 一句话概括故事核心冲突和结局                                |
| `created`        | ✅       | `string`  | 创建日期，格式 `YYYY-MM-DD`                                 |
| `author`         | 可选     | `string`  | 作者名称（原创故事使用，EPUB 导出时显示）                   |
| `originalWork`   | 二创必填 | `string`  | 原作名称（fanfic 必填）                                     |
| `originalAuthor` | 二创必填 | `string`  | 原作者（fanfic 必填）                                       |
| `cover`          | 可选     | `string`  | 封面图片路径（EPUB 导出时使用）                             |
| `series`         | 可选     | `string`  | 系列名称。有该字段的故事归入同一系列分组                    |
| `seriesOrder`    | 可选     | `number`  | 系列内排序键（支持小数，如 `2.5`）。缺失时回退文件夹序号    |
| `volume`         | 可选     | `string`  | 卷/册名称（展示 + `story epub --split-by-volume` 分卷导出） |
| `links`          | 可选     | `string[]`| 关联故事文件夹列表（弱关联，见下文「关联故事」）            |

### 关联故事（links，可选）

`links` 声明本故事与其他故事的人工关联（如共享角色、引申阅读），是一组指向同仓库内其他故事文件夹名的数组：

```json
{ "links": ["02-星海守望", "03-Starlight"] }
```

- **弱关联、零依赖**：只用文件夹名，不依赖图数据库/向量库
- **写入**：手动编辑 `config.json`，或运行 `story link A B` 添加（`--remove` 移除 / `--list` 列出）
- **自动建议**：`story build` 会检测同 `series` + 共享关键词的候选关联并提示（不写盘），用 `story link` 确认后落盘
- **展示**：故事 README 会自动渲染「关联故事」区块

> 📐 字段的完整规范见 [specification.md](specification.md#22-可选字段)。

### 校验规则

- `title`、`type`、`status`、`summary`、`created` 为必填字段，缺失会报错
- `type` 必须是 `original`、`fanfic` 或仓库配置中自定义的类型
- `status` 必须是 `completed`、`ongoing` 或仓库配置中自定义的状态
- `created` 必须匹配 `YYYY-MM-DD` 格式
- 当 `type` 为 `fanfic` 时，`originalWork` 和 `originalAuthor` 必填

### 自定义枚举与本地化

通过根目录的 `story.config.json` 不仅可扩展类型和状态枚举，还可为自定义枚举配置中英文标签：

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

- `typeLabels` / `statusLabels` 为可选字段
- 内置枚举已内置中文标签，无需重复配置
- 未配置标签的自定义枚举值在 README 中显示为原始代码字符串

---

## ⚠️ 文件编码要求

**所有故事文件（`config.json`、`text.md`、`chapter-*.md`）必须使用 UTF-8 编码保存。**

- **VS Code**：右下角点击编码按钮 → 「通过编码保存」→ 选择 `UTF-8`
- **Windows 记事本**：另存为 → 编码选择 `UTF-8`
- **macOS / Linux**：默认即 UTF-8，无需额外操作

> Windows 用户的记事本默认可能保存为 GBK/GB2312 编码，导致 `story build` 输出的 README 和 EPUB 中出现乱码。
> story-cli 会在检测到编码问题时输出警告提示，帮助定位问题文件。

---

## ✍️ 写作方式

### 方式一：单文件 `text.md`

直接在 `text.md` 中写作，这是最简单的方式：

```markdown
# 第一章

正文内容...

# 第二章

正文内容...
```

### 方式二：多章节文件 `chapter-*.md`

将正文拆分为多个章节文件：

```text
01-我的故事/
├── config.json
├── chapter-1-开场.md
├── chapter-2-发展.md
└── chapter-3-结局.md
```

当 `text.md` 不存在时，`story build` 会自动将 `chapter-*.md` 合并生成 `text.md`。

### 章节提取规则

`story build` 和 `story epub` 会自动从正文中提取章节（用于 README 章节列表和 EPUB 目录）：

- **`#` 和 `##`**：作为**章节分隔符**，每一级都会触发新章节的开始
- **`###` 及以下**：作为**章节内部的小节**，不会触发新章节

```markdown
# 第一章 ← 新章节

这是章节内容...

## 小节 ← 不触发新章节（作为章节内小节）

...

### 更深层小节 ← 不触发新章节

...
```

如果正文中没有 `#` / `##` 标题，则该故事作为「无章节」处理，EPUB 导出时使用故事标题作为唯一章节。

---

## 🚀 自动生成

运行：

```bash
story build
```

会为每个故事生成 `README.md`，并在根目录生成索引 `README.md`。构建时如果 `text.md` 不存在但存在 `chapter-*.md`，会自动合并并生成 `text.md`。

> 💡 **推荐使用 Makefile 工作流**：`story init` 会生成一个可编辑的 `Makefile`，封装了高频操作组合：
>
> ```bash
> make build                     # 等价于 story build
> make commit                    # 构建 + git add + git commit
> make push                      # 构建 + 提交 + 推送
> make stats                     # 查看创作统计
> make new TITLE="新故事"         # 创建故事 + 自动构建
> ```
>
> 更多命令请运行 `make help`。CLI（`story` 命令）是原子能力，Makefile 是工作流编排——两者互补。

---

## 🔄 系列与排序

### 设计原则

- **物理坐标永不更改**：文件夹名的 `NN-` 前缀是故事的「身份证号」，一旦创建永不修改（保证 Git 链接、EPUB 引用永久稳定）。
- **逻辑坐标自由调整**：展示顺序由 `config.json` 中的 `series` / `seriesOrder` 控制，无需修改文件夹名。

### 示例

```text
my-stories-repo/
├── 01-三体-地球往事/   # 物理坐标：01-
│   └── config.json     # series: "三体", seriesOrder: 1
├── 02-三体-黑暗森林/
│   └── config.json     # series: "三体", seriesOrder: 2
├── 03-三体-死神永生/
│   └── config.json     # series: "三体", seriesOrder: 3
├── 04-朝闻道/          # 未配置系列 → 独立故事
│   └── config.json
└── 05-球状闪电/        # 未配置系列 → 独立故事
    └── config.json
```

构建后根 README 展示效果：

```markdown
## 三体

| #   | 故事     | 类型 | 字数   | 状态   | 简介 |
| --- | -------- | ---- | ------ | ------ | ---- |
| 01  | 地球往事 | 原创 | 10万字 | 完结   | ...  |
| 02  | 黑暗森林 | 原创 | 12万字 | 完结   | ...  |
| 03  | 死神永生 | 原创 | 14万字 | 连载中 | ...  |

## 📌 独立故事

| #   | 故事     | 类型 | 字数  | 状态 | 简介 |
| --- | -------- | ---- | ----- | ---- | ---- |
| 04  | 朝闻道   | 原创 | 3万字 | 完结 | ...  |
| 05  | 球状闪电 | 原创 | 8万字 | 完结 | ...  |
```

### `seriesOrder` 支持小数（分数索引）

在系列中间插入新故事**无需调整其他故事**。假设系列现有排序 `1, 2, 3`，要在 `2` 和 `3` 之间插入：

```json
{
  "title": "新插入的故事",
  "series": "三体",
  "seriesOrder": 2.5
}
```

> 💡 使用小数（如 `.1`、`.5`、`.75`）可以无限次在任意位置插入，无需修改任何已存在的故事。

### 排序规则汇总

| 场景                     | 排序方式                             |
| ------------------------ | ------------------------------------ |
| 有 `seriesOrder`         | 按数值升序                           |
| `seriesOrder` 缺失或无效 | 回退到文件夹序号                     |
| `seriesOrder` 相同       | 按文件夹序号                         |
| 无 `series` 字段         | 归入「独立故事」，按文件夹序号排序   |
| 不同系列之间             | 按各组内最小文件夹序号，组名作二级键 |
| `series` 为空字符串/空白 | 等同于未定义                         |

### 与 `story new` 的配合

`story new` 目前**不支持** `--series` 参数。创建故事后，直接编辑 `config.json` 添加 `series` / `seriesOrder` / `volume` 即可。未来可根据用户反馈决定是否增加 CLI 参数。
