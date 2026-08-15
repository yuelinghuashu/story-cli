import assert from "node:assert"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { importJson } from "../src/commands/import-json.ts"

const binPath = fileURLToPath(new URL("../bin/index.ts", import.meta.url))

/** 运行 CLI 并返回 stdout + stderr 合并输出 */
function runCli(args: string[], cwd: string): string {
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    encoding: "utf-8",
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || `Command failed with code ${result.status}`)
  }
  return `${result.stdout || ""}${result.stderr || ""}`
}

/** 创建临时目录 */
function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

/** 构造有效的导入 JSON */
function makeImportJson(stories: unknown[]): string {
  return JSON.stringify({ version: "1.0.0", stories }, null, 2)
}

test("importJson 从文件导入单故事（单章节 → text.md）", () => {
  const dir = tempDir("import-json-test-")
  const jsonFile = path.join(dir, "stories.json")
  fs.writeFileSync(
    jsonFile,
    makeImportJson([
      {
        title: "导入的故事",
        type: "original",
        status: "completed",
        language: "zh",
        summary: "通过 JSON 导入的故事。",
        created: "2026-08-15",
        chapters: [{ title: "第一章", content: "这是导入的正文内容。" }],
      },
    ]),
    "utf-8",
  )

  const code = importJson(dir, ["--file=stories.json"])
  assert.strictEqual(code, 0)

  // 验证目录结构
  const storyDir = path.join(dir, "01-导入的故事")
  assert.ok(fs.existsSync(storyDir), "应创建故事目录")
  assert.ok(fs.existsSync(path.join(storyDir, "config.json")), "应创建 config.json")
  assert.ok(fs.existsSync(path.join(storyDir, "text.md")), "单章节应生成 text.md")

  // 验证 config.json 内容
  const config = JSON.parse(fs.readFileSync(path.join(storyDir, "config.json"), "utf-8"))
  assert.strictEqual(config.title, "导入的故事")
  assert.strictEqual(config.type, "original")
  assert.strictEqual(config.status, "completed")
  assert.strictEqual(config.summary, "通过 JSON 导入的故事。")
  assert.strictEqual(config.created, "2026-08-15")

  // 验证正文内容
  const text = fs.readFileSync(path.join(storyDir, "text.md"), "utf-8")
  assert.ok(text.includes("第一章"))
  assert.ok(text.includes("这是导入的正文内容。"))
})

test("importJson 多章节 → chapter-*.md", () => {
  const dir = tempDir("import-json-multi-")
  const jsonFile = path.join(dir, "stories.json")
  fs.writeFileSync(
    jsonFile,
    makeImportJson([
      {
        title: "多章节故事",
        type: "original",
        status: "ongoing",
        language: "zh",
        summary: "多章节故事。",
        created: "2026-08-15",
        chapters: [
          { title: "第一章", content: "第一章内容。" },
          { title: "第二章", content: "第二章内容。" },
        ],
      },
    ]),
    "utf-8",
  )

  const code = importJson(dir, ["--file=stories.json"])
  assert.strictEqual(code, 0)

  const storyDir = path.join(dir, "01-多章节故事")
  assert.ok(fs.existsSync(storyDir))
  // 多章节应生成 chapter-*.md，而非 text.md
  assert.ok(!fs.existsSync(path.join(storyDir, "text.md")), "多章节不应生成 text.md")
  assert.ok(fs.existsSync(path.join(storyDir, "chapter-01.md")), "应生成 chapter-01.md")
  assert.ok(fs.existsSync(path.join(storyDir, "chapter-02.md")), "应生成 chapter-02.md")

  const ch1 = fs.readFileSync(path.join(storyDir, "chapter-01.md"), "utf-8")
  assert.ok(ch1.includes("第一章"))
  assert.ok(ch1.includes("第一章内容。"))
})

test("importJson 从 stdin 导入", () => {
  const dir = tempDir("import-json-stdin-")

  // 通过管道传递 JSON 到 CLI
  const input = makeImportJson([
    {
      title: "管道故事",
      type: "original",
      status: "ongoing",
      language: "zh",
      summary: "从 stdin 导入。",
      created: "2026-08-15",
      chapters: [{ title: "第一篇", content: "管道导入的内容。" }],
    },
  ])
  const result = spawnSync(process.execPath, [binPath, "import", "json"], {
    cwd: dir,
    encoding: "utf-8",
    input,
  })
  assert.strictEqual(result.status, 0, `stdin 导入应成功: ${result.stderr}`)

  assert.ok(fs.existsSync(path.join(dir, "01-管道故事")), "应从 stdin 创建故事目录")
  assert.ok(fs.existsSync(path.join(dir, "01-管道故事", "text.md")))
})

test("importJson 自动分配序号（递增）", () => {
  const dir = tempDir("import-json-seq-")

  // 写入两份 JSON
  const jsonFile = path.join(dir, "stories.json")
  fs.writeFileSync(
    jsonFile,
    makeImportJson([
      {
        title: "第一个故事",
        type: "original",
        status: "ongoing",
        language: "zh",
        summary: "一。",
        created: "2026-08-15",
        chapters: [{ title: "章", content: "内容一。" }],
      },
      {
        title: "第二个故事",
        type: "original",
        status: "ongoing",
        language: "zh",
        summary: "二。",
        created: "2026-08-15",
        chapters: [{ title: "章", content: "内容二。" }],
      },
    ]),
    "utf-8",
  )

  const code = importJson(dir, ["--file=stories.json"])
  assert.strictEqual(code, 0)
  assert.ok(fs.existsSync(path.join(dir, "01-第一个故事")), "第一个故事序号应为 01")
  assert.ok(fs.existsSync(path.join(dir, "02-第二个故事")), "第二个故事序号应为 02")
})

test("importJson 目录已存在时跳过（幂等性）", () => {
  const dir = tempDir("import-json-idempotent-")
  const jsonFile = path.join(dir, "stories.json")
  fs.writeFileSync(
    jsonFile,
    makeImportJson([
      {
        title: "已存在故事",
        type: "original",
        status: "ongoing",
        summary: "重复导入。",
        created: "2026-08-15",
        chapters: [{ title: "章", content: "内容。" }],
      },
    ]),
    "utf-8",
  )

  // 第一次导入
  const code1 = importJson(dir, ["--file=stories.json"])
  assert.strictEqual(code1, 0)

  // 删除故事内容后再次导入（应因为目录已存在而跳过）
  const storyDir = path.join(dir, "01-已存在故事")
  const originalContent = fs.readFileSync(path.join(storyDir, "text.md"), "utf-8")

  const code2 = importJson(dir, ["--file=stories.json"])
  assert.strictEqual(code2, 1)

  // 内容不应被覆盖
  assert.strictEqual(fs.readFileSync(path.join(storyDir, "text.md"), "utf-8"), originalContent)
})

test("importJson 缺少 title 字段时跳过", () => {
  const dir = tempDir("import-json-missing-title-")
  const jsonFile = path.join(dir, "stories.json")
  fs.writeFileSync(
    jsonFile,
    makeImportJson([
      {
        type: "original",
        status: "ongoing",
        summary: "缺少标题。",
        created: "2026-08-15",
        chapters: [{ title: "章", content: "内容。" }],
      },
    ]),
    "utf-8",
  )

  const code = importJson(dir, ["--file=stories.json"])
  assert.strictEqual(code, 1)

  // 不应创建任何目录
  const items = fs.readdirSync(dir).filter((f) => /^\d{2,}-/.test(f))
  assert.strictEqual(items.length, 0, "缺少标题不应创建目录")
})

test("importJson 无效 JSON 时返回错误", () => {
  const dir = tempDir("import-json-invalid-")
  const jsonFile = path.join(dir, "bad.json")
  fs.writeFileSync(jsonFile, "not-json{", "utf-8")

  const code = importJson(dir, ["--file=bad.json"])
  assert.strictEqual(code, 1)
})

test("importJson 文件不存在时返回错误", () => {
  const dir = tempDir("import-json-not-found-")
  const code = importJson(dir, ["--file=missing.json"])
  assert.strictEqual(code, 1)
})

test("importJson 支持 --output 指定输出目录", () => {
  const dir = tempDir("import-json-output-")
  const jsonFile = path.join(dir, "stories.json")
  fs.writeFileSync(
    jsonFile,
    makeImportJson([
      {
        title: "输出到子目录的故事",
        type: "original",
        status: "ongoing",
        summary: "输出目录测试。",
        created: "2026-08-15",
        chapters: [{ title: "章", content: "内容。" }],
      },
    ]),
    "utf-8",
  )

  const code = importJson(dir, ["--file=stories.json", "--output=stories/"])
  assert.strictEqual(code, 0)

  const storyDir = path.join(dir, "stories", "01-输出到子目录的故事")
  assert.ok(fs.existsSync(storyDir), "故事应在指定输出目录中创建")
  assert.ok(fs.existsSync(path.join(storyDir, "config.json")))
})

test("importJson CLI 端到端测试", () => {
  const dir = tempDir("import-json-cli-")
  const jsonFile = path.join(dir, "stories.json")
  fs.writeFileSync(
    jsonFile,
    makeImportJson([
      {
        title: "CLI 导入的故事",
        type: "original",
        status: "completed",
        language: "zh",
        summary: "通过 CLI 命令导入。",
        created: "2026-08-15",
        chapters: [{ title: "第一章", content: "CLI 导入的正文内容。" }],
      },
    ]),
    "utf-8",
  )

  const stdout = runCli(["import", "json", "--file=stories.json"], dir)
  assert.ok(stdout.includes("导入"), "应输出导入相关提示")

  const storyDir = path.join(dir, "01-CLI-导入的故事")
  assert.ok(fs.existsSync(storyDir))
  assert.ok(fs.existsSync(path.join(storyDir, "config.json")))
  assert.ok(fs.existsSync(path.join(storyDir, "text.md")))
})
