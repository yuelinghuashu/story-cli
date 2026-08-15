# 📚 如何新增故事

## 方式一：使用 CLI（推荐）

```bash
story new "我的新故事"
```

## 方式二：手动创建

1. 创建目录 `NN-故事名/`（如 `01-我的新故事/`）
2. 编写 `config.json`（可参考根目录的 `config.original.json`）
3. 编写 `text.md` 正文
4. 运行 `story build` 生成 README

## 目录约定

```
01-故事名/
├── config.json   # 元数据（标题/类型/状态/简介）
└── text.md       # 正文（或 chapter-*.md 分章）
```

## 系列与排序（可选）

在 `config.json` 中添加以下字段，可将故事归入系列并在 README 中分组展示：

```json
{
  "series": "三体",
  "seriesOrder": 1,
  "volume": "第一部·地球往事"
}
```

- `series` — 系列名称，同一系列的故事归为一组
- `seriesOrder` — 系列内排序（支持小数如 `2.5`，任意位置插入无需重排）
- `volume` — 卷/册名称（仅用于展示）

未配置系列的故事自动归入「独立故事」，按文件夹序号排序。
