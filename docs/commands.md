# 📋 命令参考

story-cli 所有可用命令的完整列表。按用途分类。

> 💡 快速上手见 [README.md](../README.md)；各命令的详细用法见对应主题文档（下方链接列）。

---

## 📦 初始化

| 命令   | 别名 | 用法                                                      | 说明                                                                                     | 文档                      |
| ------ | ---- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------- |
| `init` | `i`  | `story init [--template=story\|knowledge\|tech] [--full]` | 初始化仓库（默认故事/知识库/技术文档模式）；`--full` 额外生成 LICENSE / docs / CHANGELOG | [add-story](add-story.md) |
| `demo` |      | `story demo`                                              | 生成一个完整示例仓库，用于预览效果                                                       | —                         |

## ✍️ 内容

| 命令   | 别名 | 用法                                                                                                  | 说明                                                                                 | 文档                      |
| ------ | ---- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------- |
| `new`  | `n`  | `story new "标题" [--type=original\|fanfic] [--author="原作"] [--creator="原作者"] [--lang=zh\|en]`   | 创建新故事（生成 config.json + text.md）；二创必须同时指定 `--author` 与 `--creator` | [add-story](add-story.md) |
| `link` |      | `story link <source> <target> \| story link --remove=<target> <source> \| story link --list [source]` | 添加关联；`--remove=<target>` 移除；`--list` 列出全部或指定故事                      | [add-story](add-story.md) |

## 🔨 构建与校验

| 命令       | 别名    | 用法                                                      | 说明                                                                                                  | 文档                              |
| ---------- | ------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------- |
| `build`    | `b`     | `story build [--validate-only] [--save-counts] [--watch]` | 生成 README；`--validate-only` 只校验不写盘；`--save-counts` 回写字数；`--watch` 监听文件变更自动重建 | [add-story](add-story.md)         |
| `validate` | `check` | `story validate [--json]`                                 | 合规检查（目录命名 / 必需文件 / UTF-8 / 重复序号 / schema），支持 `--json` 结构化输出                 | [specification](specification.md) |
| `stats`    | `s`     | `story stats [--json]`                                    | 创作数据统计（字数/系列/健康度/重复短语）                                                             | [design](design.md)               |

## 📤 导出

| 命令                | 别名 | 用法                                                                        | 说明                                                                  | 文档                |
| ------------------- | ---- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------- |
| `export html`       |      | `story export html [--output=dir]`                                          | 静态 HTML 站点（浏览器打印为 PDF）                                    | [export](export.md) |
| `export txt`        |      | `story export txt [--stdout] [--output=dir]`                                | 纯文本导出（支持 `--stdout` 管道）                                    | [export](export.md) |
| `export json`       |      | `story export json [--stdout] [--output=dir]`                               | 结构化 JSON（支持 `--stdout` 管道）                                   | [export](export.md) |
| `export md`         |      | `story export md [--stdout] [--output=dir]`                                 | 合并 Markdown + YAML frontmatter                                      | [export](export.md) |
| `export embeddings` |      | `story export embeddings [--stdout] [--output=dir]`                         | 文本块 JSONL（供外部向量检索服务使用）                                | [export](export.md) |
| `epub`              | `e`  | `story epub "标题" [--all] [--split-by-volume] [--output=dir] [--css=path]` | EPUB 3 电子书（分卷/封面/图片）；`--all` 导出全部；`--css` 自定义样式 | [epub](epub.md)     |

## 📥 导入

| 命令          | 用法                                                   | 说明                                          | 文档                |
| ------------- | ------------------------------------------------------ | --------------------------------------------- | ------------------- |
| `import json` | `story import json --file=stories.json [--output=dir]` | 从 JSON 批量导入故事（与 `export json` 对称） | [export](export.md) |

## 🤖 AI 集成

| 命令         | 别名  | 用法               | 说明                                                                                     | 文档          |
| ------------ | ----- | ------------------ | ---------------------------------------------------------------------------------------- | ------------- |
| `mcp-server` | `mcp` | `story mcp-server` | 启动 MCP stdio 服务器，供 Claude Desktop / Cursor / VSCode Copilot Chat 等 AI 客户端连接 | [mcp](mcp.md) |

## 🖥️ 系统

| 命令      | 别名 | 用法            | 说明         |
| --------- | ---- | --------------- | ------------ |
| `help`    | `h`  | `story help`    | 显示帮助信息 |
| `version` |      | `story version` | 显示版本号   |

> **全局标志**（在任何命令后均可使用）：`--help` / `-h` 显示帮助 · `--version` / `-v` 显示版本号

---

## ⚠️ 常见参数说明

| 参数                | 适用命令                              | 说明                                      |
| ------------------- | ------------------------------------- | ----------------------------------------- |
| `--json`            | `stats`、`validate`                   | 输出结构化 JSON（便于 `jq` 或脚本处理）   |
| `--stdout`          | `export txt`/`json`/`md`/`embeddings` | 输出到标准输出（不写磁盘，适合管道）      |
| `--output=dir`      | `export *`、`import json`、`epub`     | 自定义输出目录                            |
| `--css=path`        | `epub`                                | 自定义 EPUB 排版样式（缺失时回退内置）    |
| `--file=path`       | `import json`                         | 指定 JSON 文件路径（也可从 stdin 传入）   |
| `--all`             | `epub`、`export embeddings`           | 处理全部故事                              |
| `--split-by-volume` | `epub`                                | 按 `config.json` 的 `volume` 字段分卷导出 |
