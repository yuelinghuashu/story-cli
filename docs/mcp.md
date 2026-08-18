# 🤖 MCP Server 指南

> 📋 完整命令清单见 [commands.md](commands.md)。

story-cli 内置 **MCP（Model Context Protocol）Server**，让 AI 客户端（如 Claude Desktop、Cursor、VSCode Copilot Chat）能直接读写你的故事仓库。

**核心理念**：AI 只负责思考，CLI 负责以最低成本提供思考所需的上下文。AI 通过 MCP 读写普通 Markdown 文件，版本控制（Git）与 README 生成（`story build`）仍由你来掌控。

**Token 经济性**：MCP 工具从设计之初就以「为 AI 消费做 Token 级优化」为核心原则。每一个参数、每一次默认行为都在为节省你的 AI 调用成本而设计。

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

## 🔌 连接到 VSCode

在项目根目录创建 `.vscode/mcp.json`：

```json
{
  "servers": {
    "story-cli": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/story-cli/dist/bin/index.js", "mcp-server"]
    }
  }
}
```

VSCode 内置 MCP 客户端（需启用 GitHub Copilot Chat），配置后：

1. 打开故事仓库作为 VSCode 工作区
2. 创建上述 `.vscode/mcp.json`（保存后自动识别）
3. 打开 Copilot Chat → 点击工具图标（锤子/插头标志）→ 确认 `story-cli` 服务器已连接
4. 在对话中让 AI 调用 MCP 工具读写故事仓库

> 💡 **注意**：MCP Server 的工作目录是 VSCode 当前打开的工作区。请在**故事仓库作为工作区**时使用完整功能。

---

## 🧪 快速验证 MCP Server

**方式 A：通过管道直接发 JSON-RPC 请求（不依赖任何客户端）**

```bash
# 1. 列出所有工具（应返回 8 个）
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node /path/to/story-cli/dist/bin/index.js mcp-server

# 2. 扫描故事（应返回故事列表）
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"scan_stories","arguments":{}}}' | node /path/to/story-cli/dist/bin/index.js mcp-server

# 3. 读取章节（替换为你的故事文件夹名）
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"read_chapter","arguments":{"folder":"01-我的故事"}}}' | node /path/to/story-cli/dist/bin/index.js mcp-server
```

**方式 B：通过 MCP Inspector（官方可视化调试工具）**

```bash
npx @modelcontextprotocol/inspector node /path/to/story-cli/dist/bin/index.js mcp-server
```

MCP Inspector 启动后在浏览器中打开，可以：

- 查看所有工具 / 参数 Schema
- 逐个调用工具并观察原始响应
- 检查协议层通信日志（握手失败 / 换行符问题）

---

## 🛠️ 暴露的 MCP 工具

| 工具名          | 说明                                                      | 参数                                                           | Token 节省               |
| --------------- | --------------------------------------------------------- | -------------------------------------------------------------- | ------------------------ |
| `scan_stories`  | 列出所有故事及元数据（默认精简版）                        | `verbose`（可选，true 返回完整元数据）                         | ✅ 默认精简输出 ~80-95%  |
| `read_chapter`  | 读取指定故事的章节内容（支持按需加载与末尾截断）          | `folder`（必填）+ `chapterIndex`（可选）+ `tailLength`（可选） | ✅ 按需/tailLength ~95%+ |
| `write_chapter` | 将正文原子写入指定故事                                    | `folder` + `content`                                           | —                        |
| `validate`      | 检查仓库合规性（目录命名/必需文件/UTF-8/重复序号/schema） | —                                                              | —                        |
| `build`         | **真正执行** README 重建（等效 `story build`）            | —                                                              | ✅ 结构化结果免解析      |
| `stats`         | 获取写作统计（总字数/章节数/系列/健康度）                 | —                                                              | ✅ 一次调用拿全数据 ~99% |
| `import_json`   | 从结构化 JSON 批量导入故事                                | `stories`（数组，可含 `links`）                                | —                        |
| `create_story`  | 创建新故事（文件夹 + config.json + text.md）              | `title`（必填）+ 可选字段（含 `links`）                        | —                        |

---

## 💬 示例对话（Claude / ChatGPT）

**1. AI 扫描故事库**

> **你**：看看我的故事库里有哪些故事？
>
> **AI（调用 scan_stories）**：
>
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
>
> ```
> 📖 星河入梦
> ## 第一章 梦的开始
> 深夜里，我推开了一扇从未见过的门...
> ```

**3. AI 写入章节**

> **你**：帮我写一段关于「星河入梦」第二章的草稿
>
> **AI（调用 write_chapter，folder="01-星河入梦"）**：
>
> ```
> ✅ 已写入 01-星河入梦/text.md。请运行 story build 更新 README。
> ```

**4. 你更新 README**

```bash
story build
```

**5. AI 完整创建 + 写作 + 构建闭环**

> **你**：帮我创建一个新故事，写一章内容，然后更新 README
>
> **AI 连续调用多个 MCP 工具**：
>
> ```
> ① create_story  → "AI 创作的故事"（自动生成 02-AI-创作的故事/ + config.json + text.md）
> ② write_chapter → 写入正文（原子写入 text.md）
> ③ build         → 真正执行 README 重建（等效 story build），返回结构化构建结果
> ④ scan_stories  → 查看最新故事列表（精简输出，节省 Token）
> ⑤ stats         → 获取写作统计
> ```
>
> 全程无需用户在终端手动执行任何命令——AI 可以独立完成「创建 → 写作 → 构建 → 查看 → 统计」的完整闭环。

---

## ⚠️ 注意事项

- **写在文件，不写在 README**：AI 的成果最终是 `text.md` 中的 Markdown。README 由 `story build` 统一生成。
- **不锁文件**：MCP 依赖文件系统原子写入，版本控制交给 Git。写入后建议检查 `git diff`。
- **输出不污染 stdout**：MCP 专注于 JSON-RPC 协议，所有内容通过 `result` 返回，不直接打印。
- **stdout 是协议专用通道**：MCP Server 的 stdout 只能包含 JSON-RPC 消息。任何 `console.log` 调试输出都会污染协议流，导致客户端无法解析。所有诊断日志应使用 `console.error` 输出到 stderr。
- **不使用 `process.exit()`**：MCP Server 是长期运行进程，`process.exit()` 会在读取到请求前终止服务器。进程退出必须由 `close` / `SIGINT` 事件控制。
- **等待异步 handler 完成**：MCP Server 内部会跟踪所有 in-flight 请求，确保 stdin 关闭时等待全部完成后再退出。

---

## 🔒 安全提示

- MCP Server 会读写当前工作目录下的所有文件，请确保在信任的仓库中运行。
- `write_chapter` 会覆盖目标故事的 `text.md`，建议在写之前先调用 `read_chapter` 确认内容。
