# 📚 我的故事集

欢迎来到我的创作仓库。

## 快速开始

运行以下命令开始管理你的故事：

```bash
# 创建第一个故事
story new "我的新故事"

# 构建所有 README + 根索引
story build
```

## 目录结构

- `NN-故事名/` — 每个故事是一个文件夹（config.json + text.md）
- `assets/sponsor/` — 赞助收款码（可选）
- `config.original.json` / `config.fanfic.json` — 故事配置模板

## 系列与排序（可选）

在故事的 `config.json` 中添加以下字段，可将故事归入系列并在根 README 中分组展示：

```json
{
  "series": "系列名称",
  "seriesOrder": 1,
  "volume": "卷/册名称"
}
```

- `seriesOrder` 支持小数（如 `2.5`），任意位置插入无需重排其他故事
- 未配置系列的故事自动归入「独立故事」，按文件夹序号排序

> 本文档由 `story init` 生成，运行 `story build` 后会自动更新。