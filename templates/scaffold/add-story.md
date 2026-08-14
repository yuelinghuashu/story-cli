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
