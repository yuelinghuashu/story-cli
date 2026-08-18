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

test("registerTools 注册了 9 个 MCP 工具", () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  assert.strictEqual(tools.length, 9)
  const names = tools.map((t) => t.tool.name).sort()
  assert.deepStrictEqual(names, [
    "build",
    "create_story",
    "edit_config",
    "import_json",
    "read_chapter",
    "scan_stories",
    "stats",
    "validate",
    "write_chapter",
  ])
})

test("scan_stories 返回精简故事列表", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const scan = tools.find((t) => t.tool.name === "scan_stories")
  assert.ok(scan)
  const result = await scan.handler({}, dir)
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as {
    stories: Array<{ folder: string; title: string; status: string; wordCount: string }>
  }
  assert.ok(data.stories.length >= 1)
  assert.ok(data.stories.some((s) => s.folder === "01-测试故事"))
  // 精简版不包含 content/chapters 等大字段
  assert.ok(!("chapters" in data.stories[0]))
  assert.ok(!("content" in data.stories[0]))
})

test("scan_stories verbose=true 返回完整数据", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const scan = tools.find((t) => t.tool.name === "scan_stories")
  assert.ok(scan)
  const result = await scan.handler({ verbose: true }, dir)
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as {
    stories: Array<{ folder: string; content: string; chapters: unknown[] }>
  }
  assert.ok(data.stories.some((s) => s.folder === "01-测试故事"))
  // verbose 模式包含完整 content 和 chapters
  assert.ok("content" in data.stories[0])
  assert.ok("chapters" in data.stories[0])
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

test("read_chapter 指定 chapterIndex 读取单章", async () => {
  const dir = setupRepo()
  // 创建多章节内容
  fs.writeFileSync(
    path.join(dir, "01-测试故事", "text.md"),
    "# 第一章\n\n第一章内容。\n\n# 第二章\n\n第二章内容。",
    "utf-8",
  )
  const tools = registerTools(dir)
  const read = tools.find((t) => t.tool.name === "read_chapter")
  assert.ok(read)
  const result = await read.handler({ folder: "01-测试故事", chapterIndex: 1 }, dir)
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as { folder: string; chapter: { title: string; content: string } }
  assert.strictEqual(data.chapter.title, "第二章")
  assert.ok(data.chapter.content.includes("第二章内容"))
})

test("read_chapter 支持 tailLength 截断返回章节末尾", async () => {
  const dir = setupRepo()
  // 创建较长章节内容
  const longContent = "这是一段很长很长的内容。".repeat(20)
  fs.writeFileSync(path.join(dir, "01-测试故事", "text.md"), `# 第一章\n\n${longContent}`, "utf-8")
  const tools = registerTools(dir)
  const read = tools.find((t) => t.tool.name === "read_chapter")
  assert.ok(read)
  const result = await read.handler({ folder: "01-测试故事", chapterIndex: 0, tailLength: 10 }, dir)
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as {
    truncated: boolean
    totalLength: number
    content: string
    chapterTitle: string
  }
  assert.strictEqual(data.truncated, true)
  assert.ok(data.totalLength > 10)
  assert.ok(data.content.length <= 10)
  assert.strictEqual(data.chapterTitle, "第一章")
})

test("read_chapter tailLength 大于内容长度时返回完整内容", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const read = tools.find((t) => t.tool.name === "read_chapter")
  assert.ok(read)
  const result = await read.handler({ folder: "01-测试故事", chapterIndex: 0, tailLength: 9999 }, dir)
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as { folder: string; chapter: { content: string } }
  assert.ok(data.chapter.content.includes("这是正文内容"))
})

test("write_chapter 原子写入正文", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const write = tools.find((t) => t.tool.name === "write_chapter")
  assert.ok(write)
  const result = await write.handler({ folder: "01-测试故事", content: "# 新章节\n\n新内容。" }, dir)
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as { written: string }
  assert.ok(data.written.includes("01-测试故事"), "应返回写入路径")
  const text = fs.readFileSync(path.join(dir, "01-测试故事", "text.md"), "utf-8")
  assert.ok(text.includes("新内容"))
})

test("write_chapter 支持空格/连字符变体匹配（safeFolder）", async () => {
  const dir = setupRepo()
  // 先创建一个标题含空格的文件夹（实际目录名会用连字符替换空格）
  const storyDir = path.join(dir, "02-AI-创作的故事")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify({
      title: "AI 创作的故事",
      type: "original",
      status: "ongoing",
      summary: "带空格标题。",
      created: "2026-08-16",
    }),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n原始内容。", "utf-8")

  const tools = registerTools(dir)
  const write = tools.find((t) => t.tool.name === "write_chapter")
  assert.ok(write)
  // LLM 回传的是带空格的标题（而不是实际目录名 02-AI-创作的故事）
  const result = await write.handler({ folder: "02-AI 创作的故事", content: "# 第一章\n\n变体匹配成功。" }, dir)
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as { written: string }
  assert.ok(data.written.includes("02-AI-创作的故事"), "应返回实际目录的写入路径")
  // 验证内容确实写入了实际目录
  const text = fs.readFileSync(path.join(dir, "02-AI-创作的故事", "text.md"), "utf-8")
  assert.ok(text.includes("变体匹配成功"))
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

test("build 真正生成 README", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const build = tools.find((t) => t.tool.name === "build")
  assert.ok(build)
  const result = await build.handler({}, dir)
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as {
    success: boolean
    storyCount: number
    readmeCount: number
    logs: string[]
  }
  assert.strictEqual(data.success, true)
  assert.strictEqual(data.storyCount, 1)
  assert.ok(data.readmeCount >= 1)
  // 验证 README 确实被生成
  assert.ok(fs.existsSync(path.join(dir, "README.md")), "根 README 应被生成")
  assert.ok(fs.existsSync(path.join(dir, "01-测试故事", "README.md")), "故事 README 应被生成")
})

test("stats 返回写作统计", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const stats = tools.find((t) => t.tool.name === "stats")
  assert.ok(stats)
  const result = await stats.handler({}, dir)
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as {
    storyCount: number
    totalWords: number
    totalChapters: number
    completedCount: number
    ongoingCount: number
    series: Array<{ name: string; count: number }>
    health: { warnings: number; items: Array<{ code: string; message: string }> }
    repeated: Array<{ phrase: string; count: number }>
  }
  assert.strictEqual(data.storyCount, 1)
  assert.ok(data.totalWords > 0)
  assert.ok(data.totalChapters >= 1)
  assert.strictEqual(data.ongoingCount, 1)
  // 与 CLI stats --json 口径一致：结构化 health + 重复短语
  assert.ok(Array.isArray(data.series), "应包含系列统计")
  assert.ok(Array.isArray(data.health.items), "health.items 应为结构化数组")
  assert.ok(Array.isArray(data.repeated), "应包含重复短语")
})

test("create_story 创建新故事", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const create = tools.find((t) => t.tool.name === "create_story")
  assert.ok(create)
  const result = await create.handler(
    { title: "新故事", summary: "这是一个新故事。", content: "第一章草稿内容。" },
    dir,
  )
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as { success: boolean; folder: string }
  assert.strictEqual(data.success, true)
  assert.ok(data.folder.startsWith("02-"))
  // 验证目录和文件确实创建
  assert.ok(fs.existsSync(path.join(dir, data.folder, "config.json")))
  assert.ok(fs.existsSync(path.join(dir, data.folder, "text.md")))
})

test("create_story 缺少 title 返回错误", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const create = tools.find((t) => t.tool.name === "create_story")
  assert.ok(create)
  const result = await create.handler({}, dir)
  assert.strictEqual(result.isError, true)
  assert.ok(result.content[0].text.includes("title 不能为空"))
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

test("read_chapter 不带 chapterIndex 时返回章节标题列表", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const read = tools.find((t) => t.tool.name === "read_chapter")
  assert.ok(read)
  const result = await read.handler({ folder: "01-测试故事" }, dir)
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as {
    folder: string
    chapterCount: number
    chapters: Array<{ title: string }>
  }
  assert.strictEqual(data.folder, "01-测试故事")
  assert.strictEqual(data.chapterCount, 1)
  assert.strictEqual(data.chapters[0].title, "第一章")
})

test("read_chapter 章节索引越界返回错误", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const read = tools.find((t) => t.tool.name === "read_chapter")
  assert.ok(read)
  const result = await read.handler({ folder: "01-测试故事", chapterIndex: 99 }, dir)
  assert.strictEqual(result.isError, true)
  assert.ok(result.content[0].text.includes("章节索引超出范围"))
})

test("read_chapter 故事正文为空时返回错误", async () => {
  const dir = setupRepo()
  // 清空正文
  fs.writeFileSync(path.join(dir, "01-测试故事", "text.md"), "", "utf-8")
  const tools = registerTools(dir)
  const read = tools.find((t) => t.tool.name === "read_chapter")
  assert.ok(read)
  const result = await read.handler({ folder: "01-测试故事" }, dir)
  assert.strictEqual(result.isError, true)
  assert.ok(result.content[0].text.includes("故事正文为空"))
})

test("write_chapter 内容为空时返回错误", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const write = tools.find((t) => t.tool.name === "write_chapter")
  assert.ok(write)
  const result = await write.handler({ folder: "01-测试故事", content: "   " }, dir)
  assert.strictEqual(result.isError, true)
  assert.ok(result.content[0].text.includes("内容不能为空"))
})

test("write_chapter 不存在的文件夹返回错误", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const write = tools.find((t) => t.tool.name === "write_chapter")
  assert.ok(write)
  const result = await write.handler({ folder: "99-不存在", content: "内容" }, dir)
  assert.strictEqual(result.isError, true)
  assert.ok(result.content[0].text.includes("文件夹不存在"))
})

test("import_json 包含缺少 title 的故事时部分成功", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const imp = tools.find((t) => t.tool.name === "import_json")
  assert.ok(imp)
  const result = await imp.handler(
    {
      stories: [
        {
          title: "有效故事",
          type: "original",
          status: "ongoing",
          summary: "有效。",
          chapters: [{ title: "章", content: "内容" }],
        },
        { type: "original", status: "ongoing" }, // 缺少 title
      ],
    },
    dir,
  )
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as { success: number; failed: number; errors: string[] }
  assert.strictEqual(data.success, 1)
  assert.strictEqual(data.failed, 1)
  assert.ok(data.errors.some((e) => e.includes("缺少 title")))
})

// ─── edit_config 治理工具 ──────────────────────────
test("edit_config 合法修改元数据字段", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const edit = tools.find((t) => t.tool.name === "edit_config")
  assert.ok(edit)
  const result = await edit.handler(
    { folder: "01-测试故事", fields: { status: "completed", summary: "新简介", series: "测试系列" } },
    dir,
  )
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as { success: boolean; config: Record<string, unknown> }
  assert.strictEqual(data.success, true)
  assert.strictEqual(data.config.status, "completed")
  assert.strictEqual(data.config.summary, "新简介")
  assert.strictEqual(data.config.series, "测试系列")
  // 写盘验证
  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, "01-测试故事", "config.json"), "utf-8")) as Record<
    string,
    unknown
  >
  assert.strictEqual(onDisk.status, "completed")
  // 无残留 tmp 文件
  assert.ok(!fs.existsSync(path.join(dir, "01-测试故事", "config.json.tmp")))
})

test("edit_config null 值移除可选字段", async () => {
  const dir = setupRepo()
  const storyDir = path.join(dir, "01-测试故事")
  const config = JSON.parse(fs.readFileSync(path.join(storyDir, "config.json"), "utf-8")) as Record<string, unknown>
  config.series = "要移除的系列"
  fs.writeFileSync(path.join(storyDir, "config.json"), JSON.stringify(config, null, 2), "utf-8")

  const tools = registerTools(dir)
  const edit = tools.find((t) => t.tool.name === "edit_config")
  assert.ok(edit)
  const result = await edit.handler({ folder: "01-测试故事", fields: { series: null } }, dir)
  const data = JSON.parse(result.content[0].text) as { success: boolean; config: Record<string, unknown> }
  assert.strictEqual(data.success, true)
  assert.strictEqual(data.config.series, undefined, "series 应被移除")
  const onDisk = JSON.parse(fs.readFileSync(path.join(storyDir, "config.json"), "utf-8")) as Record<string, unknown>
  assert.strictEqual(onDisk.series, undefined, "写盘后 series 应不存在")
})

test("edit_config 非法枚举被拒绝且不写盘", async () => {
  const dir = setupRepo()
  const before = fs.readFileSync(path.join(dir, "01-测试故事", "config.json"), "utf-8")
  const tools = registerTools(dir)
  const edit = tools.find((t) => t.tool.name === "edit_config")
  assert.ok(edit)
  const result = await edit.handler({ folder: "01-测试故事", fields: { status: "not-a-status" } }, dir)
  assert.strictEqual(result.isError, true)
  const data = JSON.parse(result.content[0].text) as { success: boolean; issues: Array<{ field: string }> }
  assert.strictEqual(data.success, false)
  assert.ok(data.issues.some((i) => i.field === "status"))
  const after = fs.readFileSync(path.join(dir, "01-测试故事", "config.json"), "utf-8")
  assert.strictEqual(after, before, "校验失败不应写盘")
})

test("edit_config 身份/审计字段被拒绝", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const edit = tools.find((t) => t.tool.name === "edit_config")
  assert.ok(edit)
  const result = await edit.handler({ folder: "01-测试故事", fields: { title: "改名" } }, dir)
  assert.strictEqual(result.isError, true)
  const data = JSON.parse(result.content[0].text) as { rejected: { fields: string[] } }
  assert.deepStrictEqual(data.rejected.fields, ["title"])
})

test("edit_config 不存在的文件夹返回错误", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const edit = tools.find((t) => t.tool.name === "edit_config")
  assert.ok(edit)
  const result = await edit.handler({ folder: "99-不存在", fields: { summary: "x" } }, dir)
  assert.strictEqual(result.isError, true)
  assert.ok(result.content[0].text.includes("文件夹不存在"))
})

test("edit_config fields 非对象返回错误", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const edit = tools.find((t) => t.tool.name === "edit_config")
  assert.ok(edit)
  const result = await edit.handler({ folder: "01-测试故事", fields: "bad" }, dir)
  assert.strictEqual(result.isError, true)
  assert.ok(result.content[0].text.includes("fields 必须是一个对象"))
})

test("write_chapter validate=true 返回合规检查结果", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const write = tools.find((t) => t.tool.name === "write_chapter")
  assert.ok(write)
  const result = await write.handler({ folder: "01-测试故事", content: "# 新章\n\n内容。", validate: true }, dir)
  assert.strictEqual(result.isError, false)
  const data = JSON.parse(result.content[0].text) as { compliance: { valid: boolean; errorCount: number } }
  assert.ok("compliance" in data, "validate=true 应返回合规检查")
  assert.strictEqual(data.compliance.errorCount, 0)
  // 写入确实生效
  const written = fs.readFileSync(path.join(dir, "01-测试故事", "text.md"), "utf-8")
  assert.ok(written.includes("新章"))
})

test("write_chapter 默认（无 validate）不返回合规检查", async () => {
  const dir = setupRepo()
  const tools = registerTools(dir)
  const write = tools.find((t) => t.tool.name === "write_chapter")
  assert.ok(write)
  const result = await write.handler({ folder: "01-测试故事", content: "# 新章\n\n内容。", validate: false }, dir)
  const data = JSON.parse(result.content[0].text) as Record<string, unknown>
  assert.ok(!("compliance" in data), "validate=false 不应返回合规检查")
})
