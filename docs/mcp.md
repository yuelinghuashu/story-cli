# 🤖 MCP Server 指南

story-cli 内置 **MCP（Model Context Protocol）Server**，让 AI 客户端（如 Claude Desktop、Cursor）能直接读写你的故事仓库。

**核心理念**：AI 只负责思考，CLI 负责治理。AI 通过 MCP 读写普通 Markdown 文件，版本控制（Git）与 README 生成（`story build`）仍由你来掌控。

---

## 🚀 快速开始

```bash
# 在故事仓库根目录启动
story mcp-server
```

启动后，服务器通过 stdin/stdout 提供 JSON-RPC 2.0 协议，等待 MCP 客户端连接。

---

## 🔌 连接到 Claude Desktop

1. 打开 `/path/to/claude_desktop_config.json`（macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`）
2. 添加 MCP 服务器配置：

```json
{
  "mcpServers": {
    "story": {
      "command": "node",
      "args": ["/absolute/path/to/story-cli/dist/bin/index.js", "mcp-server"]
    }
  }
}
```

3. 重启 Claude Desktop，即可在工具列表中看到 story-cli 暴露的工具。

---

## 🔌 连接到 Cursor

在项目根目录创建 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "story": {
      "command": "node",
      "args": ["/absolute/path/to/story-cli/dist/bin/index.js", "mcp-server"]
    }
  }
}
```

然后重启 Cursor（或命令面板执行 `MCP: Reload Servers`）。

---

## 🛠️ 暴露的 MCP 工具

| 工具名 | 说明 | 参数 |
|--------|------|------|
| `scan_stories` | 列出所有故事及元数据 | — |
| `read_chapter` | 读取指定故事的章节正文 | `folder`（故事文件夹名） |
| `write_chapter` | 将正文原子写入指定故事 | `folder` + `content` |
| `validate` | 校验所有故事的 config.json | — |
| `build` | 提示运行 `story build`（返回提示） | — |

---

## 💬 示例对话（Claude / ChatGPT）

**1. AI 扫描故事库**

> **你**：看看我的故事库里有哪些故事？
>
> **AI（调用 scan_stories）**：
> ```
> 📖 共 3 个故事：
> 01-星河入梦（原创 · 连载中 · 约 3 千字）
> 02-星海守望（原创 · 已完结）
> 03-Starlight Dreams（Original · Ongoing）
> ```

**2. AI 读取指定章节**

> **你**：帮我读一下「星河入梦」的第一章
>
> **AI（调用 read_chapter，folder="01-星河入梦"）**：
> ```
> 📖 星河入梦
> ## 第一章 梦的开始
> 深夜里，我推开了一扇从未见过的门...
> ```

**3. AI 写入章节**

> **你**：帮我写一段关于「星河入梦」第二章的草稿
>
> **AI（调用 write_chapter，folder="01-星河入梦"）**：
> ```
> ✅ 已写入 01-星河入梦/text.md。请运行 story build 更新 README。
> ```

**4. 你更新 README**

```bash
story build
```

---

## ⚠️ 注意事项

- **写在文件，不写在 README**：AI 的成果最终是 `text.md` 中的 Markdown。README 由 `story build` 统一生成。
- **不锁文件**：MCP 依赖文件系统原子写入，版本控制交给 Git。写入后建议检查 `git diff`。
- **输出不污染 stdout**：MCP 专注于 JSON-RPC 协议，所有内容通过 `result` 返回，不直接打印。

---

## 🔒 安全提示

- MCP Server 会读写当前工作目录下的所有文件，请确保在信任的仓库中运行。
- `write_chapter` 会覆盖目标故事的 `text.md`，建议在写之前先调用 `read_chapter` 确认内容。