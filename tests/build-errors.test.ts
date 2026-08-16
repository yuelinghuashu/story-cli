import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { after, test } from "node:test"
import { cleanupTempDirs, makeTemp, runCli } from "./helpers.ts"

after(() => {
  cleanupTempDirs(["build-errors-"])
})

function makeStoryDir(dir: string, folder: string, config?: Record<string, unknown>): string {
  const storyDir = path.join(dir, folder)
  fs.mkdirSync(storyDir, { recursive: true })
  if (config) {
    fs.writeFileSync(path.join(storyDir, "config.json"), JSON.stringify(config, null, 2), "utf-8")
  }
  return storyDir
}

function validConfig(title = "测试故事"): Record<string, unknown> {
  return {
    title,
    type: "original",
    status: "ongoing",
    summary: "故事简介。",
    created: "2026-08-16",
  }
}

// ─── build 失败路径测试 ─────────────────────────────────

test("build 缺少 config.json 时返回错误", () => {
  const dir = makeTemp("build-errors-")
  // 故事目录没有 config.json
  makeStoryDir(dir, "01-无配置")
  fs.writeFileSync(path.join(dir, "01-无配置", "text.md"), "# 第一章\n\n正文。", "utf-8")

  const { ok, output } = runCli(["build"], dir)
  assert.ok(!ok, "缺少 config.json 的 build 应返回非零退出码")
  assert.ok(output.includes("missing config.json"), `应提示缺少配置，实际输出: ${output}`)
})

test("build config.json 是非法 JSON 时返回错误", () => {
  const dir = makeTemp("build-errors-")
  const storyDir = makeStoryDir(dir, "01-非法JSON")
  fs.writeFileSync(path.join(storyDir, "config.json"), "{ invalid json", "utf-8")
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n正文。", "utf-8")

  const { ok, output } = runCli(["build"], dir)
  assert.ok(!ok, "非法 JSON 的 build 应返回非零退出码")
  assert.ok(output.includes("read failed") || output.includes("parse"), `应提示解析失败，实际输出: ${output}`)
})

test("build config.json 校验失败（非法 type）时返回错误", () => {
  const dir = makeTemp("build-errors-")
  makeStoryDir(dir, "01-非法类型", { ...validConfig("非法类型"), type: "invalid-type" })
  fs.writeFileSync(path.join(dir, "01-非法类型", "text.md"), "# 第一章\n\n正文。", "utf-8")

  const { ok, output } = runCli(["build"], dir)
  assert.ok(!ok, "非法 type 的 build 应返回非零退出码")
  assert.ok(output.includes("type"), `应提示类型错误，实际输出: ${output}`)
})

test("build config.json 缺少必填字段时返回错误", () => {
  const dir = makeTemp("build-errors-")
  // 缺少 title/summary/created
  makeStoryDir(dir, "01-缺字段", { type: "original", status: "ongoing" })
  fs.writeFileSync(path.join(dir, "01-缺字段", "text.md"), "# 第一章\n\n正文。", "utf-8")

  const { ok, output } = runCli(["build"], dir)
  assert.ok(!ok, "缺少必填字段的 build 应返回非零退出码")
  assert.ok(output.includes("missing required field"), `应提示缺少字段，实际输出: ${output}`)
})

test("build 空故事目录（无正文）不阻断其他故事", () => {
  const dir = makeTemp("build-errors-")
  // 空故事目录：没有 text.md 也没有 chapter-*.md
  makeStoryDir(dir, "01-空故事", validConfig("空故事"))
  // 正常故事
  makeStoryDir(dir, "02-正常故事", validConfig("正常故事"))
  fs.writeFileSync(path.join(dir, "02-正常故事", "text.md"), "# 第一章\n\n正文内容。", "utf-8")

  const { ok, output } = runCli(["build"], dir)
  assert.ok(ok, `build 不应因空故事目录而失败，实际输出: ${output}`)
  assert.ok(fs.existsSync(path.join(dir, "README.md")), "根 README 应生成")
})

test("build 多故事中有坏配置时只报告失败的故事", () => {
  const dir = makeTemp("build-errors-")
  // 坏配置的故事
  makeStoryDir(dir, "01-坏配置", { title: "坏" })
  // 正常故事
  const goodDir = makeStoryDir(dir, "02-好故事", validConfig("好故事"))
  fs.writeFileSync(path.join(goodDir, "text.md"), "# 第一章\n\n正常正文。", "utf-8")

  const { ok, output } = runCli(["build"], dir)
  assert.ok(!ok, "存在坏配置的 build 应返回非零退出码")
  assert.ok(output.includes("01-坏配置"), "应报告坏配置的故事")
  assert.ok(output.includes("missing required field"), "应提示具体错误")
})

test("build --validate-only 时同样检测到错误", () => {
  const dir = makeTemp("build-errors-")
  makeStoryDir(dir, "01-无配置")
  fs.writeFileSync(path.join(dir, "01-无配置", "text.md"), "# 第一章\n\n正文。", "utf-8")

  const { ok, output } = runCli(["build", "--validate-only"], dir)
  assert.ok(!ok, "validate-only 模式也应检测到错误")
  assert.ok(output.includes("missing config.json"), `应提示缺少配置，实际输出: ${output}`)
})
