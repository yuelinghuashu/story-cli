import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { after, test } from "node:test"
import { chunkContent } from "../src/commands/export-embeddings.ts"
import type { StoryConfig } from "../src/core/types.ts"
import { cleanupTempDirs, makeTemp, runCli } from "./helpers.ts"

after(() => {
  cleanupTempDirs(["embed-test-"])
})

function makeRepo(): string {
  const dir = makeTemp("embed-test-")
  const storyA = path.join(dir, "01-故事A")
  fs.mkdirSync(storyA, { recursive: true })
  fs.writeFileSync(
    path.join(storyA, "config.json"),
    JSON.stringify({ title: "故事A", type: "original", status: "ongoing", summary: "简介。", created: "2026-08-01" }),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyA, "text.md"), "# 第一章\n\n第一章内容。\n\n# 第二章\n\n第二章内容。", "utf-8")
  const storyB = path.join(dir, "02-故事B")
  fs.mkdirSync(storyB, { recursive: true })
  fs.writeFileSync(
    path.join(storyB, "config.json"),
    JSON.stringify({ title: "故事B", type: "original", status: "ongoing", summary: "简介。", created: "2026-08-01" }),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyB, "text.md"), "# 第一章\n\n故事B正文。", "utf-8")
  return dir
}

const baseConfig: StoryConfig = {
  title: "测试",
  type: "original",
  status: "ongoing",
  summary: "",
  created: "2026-08-01",
}

test("chunkContent 按章节切分为多个文本块", () => {
  const chunks = chunkContent("01-x", baseConfig, "# 第一章\n\n内容一。\n\n# 第二章\n\n内容二。")
  assert.strictEqual(chunks.length, 2)
  assert.strictEqual(chunks[0].chapter, "第一章")
  assert.ok(chunks[0].text.includes("内容一"))
  assert.strictEqual(chunks[1].chapter, "第二章")
  assert.strictEqual(chunks[0].chunkIndex, 0)
  assert.strictEqual(chunks[1].chunkIndex, 1)
  assert.strictEqual(chunks[0].folder, "01-x")
  assert.strictEqual(chunks[0].title, "测试")
  assert.strictEqual(chunks[0].type, "original")
})

test("chunkContent 无章节标题时整体为一块", () => {
  const chunks = chunkContent("01-x", baseConfig, "没有标题的正文内容。")
  assert.strictEqual(chunks.length, 1)
  assert.strictEqual(chunks[0].chapter, undefined)
  assert.ok(chunks[0].text.includes("没有标题"))
})

test("export embeddings --stdout 输出 JSONL", () => {
  const dir = makeRepo()
  const { ok, output } = runCli(["export", "embeddings", "--stdout"], dir)
  assert.ok(ok, "export embeddings --stdout 应成功")
  const lines = output.trim().split("\n")
  // 故事A 2 章 + 故事B 1 章 = 3 块
  assert.strictEqual(lines.length, 3)
  for (const line of lines) {
    const obj = JSON.parse(line) as { folder: string; text: string }
    assert.ok(obj.folder)
    assert.ok(typeof obj.text === "string")
  }
})

test("export embeddings 文件模式输出到 dist/embeddings.jsonl", () => {
  const dir = makeRepo()
  const { ok, output } = runCli(["export", "embeddings"], dir)
  assert.ok(ok, `export embeddings 应成功: ${output}`)
  assert.ok(fs.existsSync(path.join(dir, "dist", "embeddings.jsonl")), "应生成 embeddings.jsonl")
  const content = fs.readFileSync(path.join(dir, "dist", "embeddings.jsonl"), "utf-8")
  const lines = content.trim().split("\n")
  assert.ok(lines.length >= 1)
  assert.ok(lines.every((l) => l.trim() !== ""))
})
