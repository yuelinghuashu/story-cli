import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { after, test } from "node:test"
import {
  JsonRpcErrorCode,
  makeErrorResponse,
  makeResponse,
  parseRequest,
  serializeMessage,
} from "../src/mcp/protocol.ts"
import { registerTools } from "../src/mcp/tools.ts"

const tempDirs: string[] = []

function setupRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-test-"))
  tempDirs.push(dir)
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

test("parseRequest 解析合法请求", () => {
  const req = parseRequest('{"jsonrpc":"2.0","id":1,"method":"tools/list"}')
  assert.strictEqual(req.method, "tools/list")
  assert.strictEqual(req.id, 1)
})

test("parseRequest 非法 JSON 抛出 ParseError", () => {
  assert.throws(
    () => parseRequest("not-json"),
    (e: Error & { code?: number }) => e.code === JsonRpcErrorCode.ParseError,
  )
})

test("parseRequest 非法 jsonrpc 版本抛出 InvalidRequest", () => {
  assert.throws(
    () => parseRequest('{"jsonrpc":"1.0","id":1,"method":"tools/list"}'),
    (e: Error & { code?: number }) => e.code === JsonRpcErrorCode.InvalidRequest,
  )
})

test("makeResponse 构建成功响应", () => {
  const resp = makeResponse(1, { ok: true })
  assert.deepStrictEqual(resp, { jsonrpc: "2.0", id: 1, result: { ok: true } })
})

test("makeErrorResponse 构建错误响应", () => {
  const resp = makeErrorResponse(1, JsonRpcErrorCode.InvalidParams, "参数错误")
  assert.strictEqual(resp.error?.code, JsonRpcErrorCode.InvalidParams)
  assert.strictEqual(resp.error?.message, "参数错误")
})

test("serializeMessage 输出带换行的 JSON", () => {
  const str = serializeMessage(makeResponse(1, { x: 1 }))
  assert.strictEqual(str, '{"jsonrpc":"2.0","id":1,"result":{"x":1}}\n')
})

test("registerTools 注册了 6 个 MCP 工具", () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  assert.strictEqual(tools.length, 6)
  const names = tools.map((t) => t.tool.name).sort()
  assert.deepStrictEqual(names, ["build", "import_json", "read_chapter", "scan_stories", "validate", "write_chapter"])
})

test("scan_stories 返回故事列表", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const scan = tools.find((t) => t.tool.name === "scan_stories")
  assert.ok(scan)
  const result = await scan.handler({}, dir)
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as { stories: Array<{ folder: string }> }
  assert.ok(data.stories.length >= 1)
  assert.ok(data.stories.some((s) => s.folder === "01-测试故事"))
})

test("read_chapter 读取指定故事章节", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const read = tools.find((t) => t.tool.name === "read_chapter")
  assert.ok(read)
  const result = await read.handler({ folder: "01-测试故事" }, dir)
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as { folder: string; chapters: Array<{ title: string }> }
  assert.strictEqual(data.folder, "01-测试故事")
  assert.strictEqual(data.chapters.length, 1)
  assert.strictEqual(data.chapters[0].title, "第一章")
})

test("read_chapter 不存在的文件夹返回错误", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const read = tools.find((t) => t.tool.name === "read_chapter")
  assert.ok(read)
  const result = await read.handler({ folder: "99-不存在" }, dir)
  assert.strictEqual(result.isError, true)
})

test("write_chapter 原子写入正文", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const write = tools.find((t) => t.tool.name === "write_chapter")
  assert.ok(write)
  const result = await write.handler({ folder: "01-测试故事", content: "# 新章节\n\n新内容。" }, dir)
  assert.strictEqual(result.isError, false)
  assert.ok(result.content[0].text.includes("已写入"))
  const text = fs.readFileSync(path.join(dir, "01-测试故事", "text.md"), "utf-8")
  assert.ok(text.includes("新内容"))
})

test("validate 校验配置合法性", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const validate = tools.find((t) => t.tool.name === "validate")
  assert.ok(validate)
  const result = await validate.handler({}, dir)
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as { valid: boolean }
  assert.strictEqual(data.valid, true)
})

test("import_json 从结构化 JSON 批量导入故事", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const imp = tools.find((t) => t.tool.name === "import_json")
  assert.ok(imp)
  const result = await imp.handler(
    {
      stories: [
        {
          title: "导入的故事A",
          type: "original",
          status: "ongoing",
          summary: "批量导入 A。",
          chapters: [{ title: "第一章", content: "A 的正文。" }],
        },
        {
          title: "导入的故事B",
          type: "original",
          status: "completed",
          summary: "批量导入 B。",
          chapters: [{ title: "第一章", content: "B 的正文。" }],
        },
      ],
    },
    dir,
  )
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as { success: number; failed: number; created: string[] }
  assert.strictEqual(data.success, 2)
  assert.strictEqual(data.failed, 0)
  assert.strictEqual(data.created.length, 2)
  assert.ok(fs.existsSync(path.join(dir, data.created[0] ?? "")), "导入的故事目录应存在")
})

test("import_json 空数组返回错误", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const imp = tools.find((t) => t.tool.name === "import_json")
  assert.ok(imp)
  const result = await imp.handler({ stories: [] }, dir)
  assert.strictEqual(result.isError, true)
  assert.ok(result.content[0].text.includes("非空数组"))
})
