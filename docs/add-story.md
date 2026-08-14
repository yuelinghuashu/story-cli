# 📝 如何新增故事

只需 3 步即可完成：

1. 创建目录 `NN-故事名/`
2. 编写 `config.json`
3. 运行 `story build`

---

## 📁 目录约定

故事就是文件夹，放在仓库根目录下：

```text
my-stories-repo/
├── config.original.json      # 原创故事模板（由 story init 生成）
├── config.fanfic.json        # 二创故事模板（由 story init 生成）
├── story-template.md         # 故事 README 的 Handlebars 模板
├── story.config.json         # 仓库级配置（自定义类型/状态，由 story init 生成）
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
> 💡 `NN-` 前缀是至少两位数字序号（如 `01-`、`02-`、`100-`），用于控制故事的显示顺序。**序号不能重复**，重复序号会在 `story build` 时给出警告。

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
  "originalAuthor": "原作者" // 二创必填
}
```

### 字段说明

| 字段             | 必填     | 类型      | 说明                                            |
| ---------------- | -------- | --------- | ----------------------------------------------- |
| `title`          | ✅       | `string`  | 故事标题                                        |
| `type`           | ✅       | `string`  | `"original"`（原创）或 `"fanfic"`（二创）       |
| `status`         | ✅       | `string`  | `"completed"`（已完结）或 `"ongoing"`（连载中） |
| `isMultiChapter` | 可选     | `boolean` | 是否为多章节故事（默认 `false`）                |
| `language`       | 可选     | `string`  | `"zh"` 或 `"en"`，决定 README 本地化            |
| `summary`        | ✅       | `string`  | 一句话概括故事核心冲突和结局                    |
| `created`        | ✅       | `string`  | 创建日期，格式 `YYYY-MM-DD`                     |
| `author`         | 可选     | `string`  | 作者名称（原创故事使用，EPUB 导出时显示）       |
| `originalWork`   | 二创必填 | `string`  | 原作名称（fanfic 必填）                         |
| `originalAuthor` | 二创必填 | `string`  | 原作者（fanfic 必填）                           |
| `cover`          | 可选     | `string`  | 封面图片路径（EPUB 导出时使用）                 |

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

---

## 🚀 自动生成

运行：

```bash
story build
```

会为每个故事生成 `README.md`，并在根目录生成索引 `README.md`。构建时如果 `text.md` 不存在但存在 `chapter-*.md`，会自动合并并生成 `text.md`。
