import assert from "node:assert"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"

const binPath = fileURLToPath(new URL("../bin/index.ts", import.meta.url))
const tempDirs: string[] = []

function setupRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-server-test-"))
  tempDirs.push(dir)
  // 创建有效故事
  const storyDir = path.join(dir, "01-测试故事")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify({
      title: "测试故事",
      type: "original",
      status: "ongoing",
      summary: "测试故事。",
      created: "2026-08-16",
    }),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n这是正文内容。", "utf-8")
  return dir
}

after(() => {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
})

/** 发送 JSON-RPC 请求到 MCP server 并获取完整 stdout */
function sendRequests(dir: string, requests: string[]): { stdout: string; stderr: string; status: number } {
  const input = `${requests.join("\n")}\n`
  const result = spawnSync(process.execPath, [binPath, "mcp-server"], {
    cwd: dir,
    input,
    encoding: "utf-8",
    timeout: 5000,
  })
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    status: result.status ?? -1,
  }
}

test("MCP server 能响应 tools/list 请求", () => {
  const dir = setupRepo()
  const { stdout, status } = sendRequests(dir, ['{"jsonrpc":"2.0","id":1,"method":"tools/list"}'])
  assert.strictEqual(status, 0, "退出码应为 0")
  const lines = stdout.trim().split("\n")
  assert.strictEqual(lines.length, 1, "应恰好返回一条 JSON-RPC 响应")
  const response = JSON.parse(lines[0] ?? "{}") as { id: number; result: { tools: unknown[] } }
  assert.strictEqual(response.id, 1)
  assert.ok(Array.isArray(response.result?.tools), "应包含 tools 数组")
  assert.strictEqual(response.result.tools.length, 9, "应有 9 个工具")
})

test("MCP server 能响应 initialize 请求", () => {
  const dir = setupRepo()
  const { stdout } = sendRequests(dir, ['{"jsonrpc":"2.0","id":2,"method":"initialize","params":{}}'])
  const response = JSON.parse(stdout.trim()) as {
    id: number
    result: { protocolVersion: string; serverInfo: { name: string } }
  }
  assert.strictEqual(response.id, 2)
  assert.strictEqual(response.result.protocolVersion, "2025-03-26")
  assert.strictEqual(response.result.serverInfo.name, "story-cli-mcp")
})

test("MCP server 能响应异步 tools/call（scan_stories）", () => {
  const dir = setupRepo()
  const { stdout, stderr } = sendRequests(dir, [
    '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"scan_stories","arguments":{}}}',
  ])
  // stderr 不应包含 JsonRpcResponse 内容
  assert.ok(!stderr.includes("jsonrpc"), "stderr 不应包含 JSON-RPC 响应的日志污染")
  const response = JSON.parse(stdout.trim()) as {
    id: number
    result: { content: Array<{ type: string; text: string }> }
  }
  assert.strictEqual(response.id, 3)
  assert.strictEqual(response.result.content[0].type, "text")
  const data = JSON.parse(response.result.content[0].text) as { stories: Array<{ folder: string }> }
  assert.ok(data.stories.some((s) => s.folder === "01-测试故事"))
})

test("MCP server 能响应异步 tools/call（build）", () => {
  const dir = setupRepo()
  const { stdout } = sendRequests(dir, [
    '{"jsonrpc":"2.0","id":13,"method":"tools/call","params":{"name":"build","arguments":{}}}',
  ])
  const response = JSON.parse(stdout.trim()) as {
    id: number
    result: { content: Array<{ type: string; text: string }> }
  }
  assert.strictEqual(response.id, 13)
  const data = JSON.parse(response.result.content[0].text) as {
    success: boolean
    storyCount: number
    readmeCount: number
  }
  assert.strictEqual(data.success, true)
  assert.strictEqual(data.storyCount, 1)
  assert.ok(data.readmeCount >= 1)
  // 验证 README 确实被生成
  assert.ok(fs.existsSync(path.join(dir, "README.md")), "根 README 应被生成")
  assert.ok(fs.existsSync(path.join(dir, "01-测试故事", "README.md")), "故事 README 应被生成")
})

test("MCP server 能响应异步 tools/call（create_story）", () => {
  const dir = setupRepo()
  const { stdout } = sendRequests(dir, [
    '{"jsonrpc":"2.0","id":14,"method":"tools/call","params":{"name":"create_story","arguments":{"title":"MCP 新故事","summary":"通过 MCP 创建。"}}}',
  ])
  const response = JSON.parse(stdout.trim()) as {
    id: number
    result: { content: Array<{ type: string; text: string }> }
  }
  assert.strictEqual(response.id, 14)
  const data = JSON.parse(response.result.content[0].text) as { success: boolean; folder: string }
  assert.strictEqual(data.success, true)
  assert.ok(data.folder.startsWith("02-"))
  assert.ok(fs.existsSync(path.join(dir, data.folder, "config.json")), "新故事的 config.json 应存在")
})

test("MCP server 能响应异步 tools/call（write_chapter）", () => {
  const dir = setupRepo()
  const { stdout } = sendRequests(dir, [
    '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"write_chapter","arguments":{"folder":"01-测试故事","content":"# 新章节\\n\\nMCP 写入内容。"}}}',
  ])
  const response = JSON.parse(stdout.trim()) as {
    id: number
    result: { content: Array<{ type: string; text: string }> }
  }
  assert.strictEqual(response.id, 4)
  const result = JSON.parse(response.result.content[0].text) as { written: string }
  assert.ok(result.written.includes("01-测试故事"), "应返回写入路径")
  // 验证文件确实被修改
  const text = fs.readFileSync(path.join(dir, "01-测试故事", "text.md"), "utf-8")
  assert.ok(text.includes("MCP 写入内容"))
})

test("MCP server 未知工具返回错误", () => {
  const dir = setupRepo()
  const { stdout } = sendRequests(dir, [
    '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"unknown_tool","arguments":{}}}',
  ])
  const response = JSON.parse(stdout.trim()) as { id: number; error: { code: number; message: string } }
  assert.strictEqual(response.id, 5)
  assert.strictEqual(response.error.code, -32601)
  assert.ok(response.error.message.includes("Unknown tool"))
})

test("MCP server 非法 JSON 返回 ParseError", () => {
  const dir = setupRepo()
  const { stdout } = sendRequests(dir, ["not-json"])
  const response = JSON.parse(stdout.trim()) as { error: { code: number } }
  assert.strictEqual(response.error.code, -32700)
})

test("MCP server 多个请求顺序响应（包含异步）", () => {
  const dir = setupRepo()
  const { stdout } = sendRequests(dir, [
    '{"jsonrpc":"2.0","id":10,"method":"initialize","params":{}}',
    '{"jsonrpc":"2.0","id":11,"method":"tools/call","params":{"name":"validate","arguments":{}}}',
    '{"jsonrpc":"2.0","id":12,"method":"tools/call","params":{"name":"scan_stories","arguments":{}}}',
  ])
  const lines = stdout.trim().split("\n").filter(Boolean)
  assert.strictEqual(lines.length, 3, "应收到 3 条响应")
  // 按 id 验证（无序但都在）
  const ids = lines.map((l) => (JSON.parse(l) as { id: number }).id).sort()
  assert.deepStrictEqual(ids, [10, 11, 12])
})

test("MCP server --root 显式指定仓库根目录", () => {
  const dir = setupRepo()
  // 从无关目录（/tmp）启动，用 --root 指向仓库
  const input = '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"scan_stories","arguments":{}}}\n'
  const result = spawnSync(process.execPath, [binPath, "mcp-server", `--root=${dir}`], {
    cwd: os.tmpdir(),
    input,
    encoding: "utf-8",
    timeout: 5000,
  })
  assert.strictEqual(result.status, 0, "退出码应为 0")
  const response = JSON.parse((result.stdout || "").trim()) as {
    id: number
    result: { content: Array<{ type: string; text: string }> }
  }
  assert.strictEqual(response.id, 1)
  const data = JSON.parse(response.result.content[0].text) as { stories: Array<{ folder: string }> }
  assert.ok(
    data.stories.some((s) => s.folder === "01-测试故事"),
    "--root 应指向指定仓库",
  )
})
