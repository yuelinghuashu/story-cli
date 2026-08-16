# 📦 story-cli Action

在 GitHub Actions 中运行 [@yuelinghuashu/story-cli](https://www.npmjs.com/package/@yuelinghuashu/story-cli) 命令。

## 用法

```yaml
- uses: yuelinghuashu/story-cli@v1
  with:
    command: "build"
```

## 输入参数

| 参数                | 必填 | 默认值   | 描述                                                    |
| :------------------ | :--- | :------- | :------------------------------------------------------ |
| `command`           | ✅   | —        | 要运行的 story-cli 命令（如 `"build"`、`"epub --all"`） |
| `cli-version`       | ❌   | `latest` | CLI 版本号（如 `"1.2.3"`）                              |
| `working-directory` | ❌   | `.`      | 运行命令的目录（相对于仓库根目录）                      |

## 完整示例

### 构建 README + 导出 EPUB

```yaml
name: Build & Deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build README
        uses: yuelinghuashu/story-cli@v1
        with:
          command: "build"

      - name: Export EPUB
        uses: yuelinghuashu/story-cli@v1
        with:
          command: "epub --all"
```

### 在子目录中运行

```yaml
- uses: yuelinghuashu/story-cli@v1
  with:
    command: "build"
    working-directory: "my-stories"
```

### 指定 CLI 版本

```yaml
- uses: yuelinghuashu/story-cli@v1
  with:
    command: "stats --json"
    cli-version: "1.2.3"
```

## 发布说明

- `@v1` — 跟随最新的 v1.x 版本
- `@v1.2.3` — 锁定到具体版本
- 更多信息参见 [docs/ci.md](../../../docs/ci.md)
