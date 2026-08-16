# 🤖 MCP Server Guide

story-cli includes a built-in **MCP (Model Context Protocol)** server that lets AI clients (Claude Desktop, Cursor, VSCode Copilot Chat) read and write your story repository directly.

**Core philosophy**: AI thinks; the CLI provides the context it needs at the lowest possible cost. The AI reads/writes plain Markdown files via MCP; version control (Git) and README generation (`story build`) remain yours to control.

**Token economics**: MCP tools are designed from the ground up with "Token-level optimization for AI consumption" as a core principle. Every parameter and every default behavior is designed to reduce your AI invocation costs.

---

## 🚀 Quick Start

```bash
# Start in the story repository root
story mcp-server
```

The server provides JSON-RPC 2.0 over stdio, waiting for MCP clients.

---

## 🔌 Connect to Claude Desktop

1. Open `/path/to/claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`)
2. Add the MCP server config:

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

3. Restart Claude Desktop. The story-cli tools will appear in the tools list.

---

## 🔌 Connect to Cursor

Create `.cursor/mcp.json` in your project root:

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

Restart Cursor (or run `MCP: Reload Servers` from the command palette).

---

## 🔌 Connect to VSCode

Create `.vscode/mcp.json` in your project root:

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

VSCode has a built-in MCP client (requires GitHub Copilot Chat). After configuring:

1. Open your story repository as the VSCode workspace
2. Create the `.vscode/mcp.json` above (auto-detected on save)
3. Open Copilot Chat → click the tools icon (hammer/plug) → confirm the `story-cli` server is connected
4. Ask AI to use MCP tools to read/write your stories

> 💡 **Note**: The MCP Server's working directory is the VSCode workspace. Use the full functionality with a **story repository** as the workspace.

---

## 🧪 Quick Verification

**Method A: Send JSON-RPC requests directly via pipe (no client needed)**

```bash
# 1. List all tools (should return 8)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node /path/to/story-cli/dist/bin/index.js mcp-server

# 2. Scan stories (should return story list)
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"scan_stories","arguments":{}}}' | node /path/to/story-cli/dist/bin/index.js mcp-server

# 3. Read a chapter (replace with your story folder)
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"read_chapter","arguments":{"folder":"01-My-Story"}}}' | node /path/to/story-cli/dist/bin/index.js mcp-server
```

**Method B: Use MCP Inspector (official visual debugging tool)**

```bash
npx @modelcontextprotocol/inspector node /path/to/story-cli/dist/bin/index.js mcp-server
```

MCP Inspector opens in your browser and lets you:

- View all tools / parameter schemas
- Call tools one by one and inspect raw responses
- Check protocol-level communication logs (handshake failures / newline issues)

---

## 🛠️ Exposed MCP Tools

| Tool            | Description                                                                      | Params                                                                    | Token Savings                    |
| --------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| `scan_stories`  | List all stories with metadata (compact by default)                              | `verbose` (optional, true for full metadata)                              | ✅ Compact default ~80-95%       |
| `read_chapter`  | Read chapter content of a story (supports on-demand loading and tail truncation) | `folder` (required) + `chapterIndex` (optional) + `tailLength` (optional) | ✅ On-demand/tailLength ~95%+    |
| `write_chapter` | Atomically write content to a story                                              | `folder` + `content`                                                      | —                                |
| `validate`      | Validate all stories' config.json                                                | —                                                                         | —                                |
| `build`         | **Actually executes** README rebuild (equivalent to `story build`)               | —                                                                         | ✅ Structured result, no parsing |
| `stats`         | Get writing statistics (total words/chapters/series/health)                      | —                                                                         | ✅ All data in one call ~99%     |
| `import_json`   | Batch import stories from structured JSON                                        | `stories` (array)                                                         | —                                |
| `create_story`  | Create a new story (folder + config.json + text.md)                              | `title` (required) + optional fields                                      | —                                |

---

## 💬 Example Conversation

**1. AI scans the library**

> **You**: Look at my story library.
>
> **AI (calls scan_stories)**:
>
> ```
> 📖 3 stories:
> 01-星河入梦 (Original · Ongoing · ~3K chars)
> 02-星海守望 (Original · Completed)
> ```

**2. AI reads a chapter**

> **You**: Read chapter 1 of 星河入梦.
>
> **AI (calls read_chapter, folder="01-星河入梦")**:
>
> ```
> 📖 星河入梦
> ## Chapter 1 ...
> ```

**3. AI writes a chapter**

> **You**: Draft chapter 2 for me.
>
> **AI (calls write_chapter, folder="01-星河入梦")**:
>
> ```
> ✅ Written to 01-星河入梦/text.md. Run story build to update README.
> ```

**4. You rebuild READMEs**

```bash
story build
```

**5. Full AI loop: create + write + build**

> **You**: Create a new story, write a chapter, then update the READMEs.
>
> **AI calls multiple MCP tools in sequence**:
>
> ```
> ① create_story  → "AI Creation" (auto-generates 02-AI-Creation/ + config.json + text.md)
> ② write_chapter → writes content (atomic write to text.md)
> ③ build         → actually executes README rebuild (equivalent to `story build`), returns structured result
> ④ scan_stories  → views the latest story list (compact output, saves tokens)
> ⑤ stats         → gets writing statistics
> ```
>
> No manual terminal commands needed — the AI handles the complete loop "create → write → build → view → stats" independently.

---

## ⚠️ Notes

- **Write to files, not README**: AI's work goes into `text.md` as Markdown. README is generated by `story build`.
- **No file locking**: MCP relies on atomic writes; version control is delegated to Git. Check `git diff` after writes.
- **No stdout pollution**: MCP responds via JSON-RPC `result`, never prints directly.
- **stdout is protocol-only**: MCP Server's stdout must contain only JSON-RPC messages. Any `console.log` debug output will pollute the protocol stream and cause the client to fail parsing. All diagnostic logs should use `console.error` (stderr).
- **No `process.exit()`**: MCP Server is a long-running process. Calling `process.exit()` kills the server before it reads any request. Process exit must be controlled by `close` / `SIGINT` events.
- **Wait for async handlers**: MCP Server tracks all in-flight requests internally and waits for them to complete before exiting when stdin closes.

---

## 🔒 Security

- MCP Server reads/writes files in the current working directory. Run it only in trusted repositories.
- `write_chapter` overwrites `text.md`; call `read_chapter` first to confirm content before overwriting.
