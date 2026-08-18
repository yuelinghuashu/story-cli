import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { after, test } from "node:test"
import { checkRepoCompliance } from "../src/core/compliance.ts"
import { getLocale } from "../src/i18n/index.ts"
import { cleanupTempDirs, makeTemp, runCli } from "./helpers.ts"

after(() => {
  cleanupTempDirs(["comp-test-"])
})

function makeRepo(): string {
  const dir = makeTemp("comp-test-")
  const story = path.join(dir, "01-测试故事")
  fs.mkdirSync(story, { recursive: true })
  fs.writeFileSync(
    path.join(story, "config.json"),
    JSON.stringify({
      title: "测试故事",
      type: "original",
      status: "ongoing",
      summary: "简介。",
      created: "2026-08-01",
    }),
    "utf-8",
  )
  fs.writeFileSync(path.join(story, "text.md"), "# 第一章\n\n正文。", "utf-8")
  return dir
}

const zh = getLocale("zh")

test("checkRepoCompliance 完全合规", () => {
  const dir = makeRepo()
  const result = checkRepoCompliance(dir, zh)
  assert.strictEqual(result.valid, true)
  assert.strictEqual(result.storyCount, 1)
  assert.strictEqual(result.issues.length, 0)
})

test("checkRepoCompliance 目录命名不符合规范（warning）", () => {
  const dir = makeRepo()
  // 单数字前缀（不符合 NN- 至少两位），且内含 config.json（"看起来像故事"）→ 报命名警告
  fs.mkdirSync(path.join(dir, "5-坏目录"), { recursive: true })
  fs.writeFileSync(
    path.join(dir, "5-坏目录", "config.json"),
    JSON.stringify({ title: "坏目录", type: "original", status: "ongoing", summary: "简介。", created: "2026-08-01" }),
    "utf-8",
  )
  const result = checkRepoCompliance(dir, zh)
  assert.strictEqual(result.valid, true, "目录命名问题是 warning，不算 error")
  assert.ok(result.issues.some((i) => i.code === "invalid-folder-name"))
})

test("checkRepoCompliance 普通项目文件夹不被误报为命名问题", () => {
  const dir = makeRepo()
  // 常规项目文件夹（.github / docs / 用户自定义目录），不含故事特征文件 → 不应报 invalid-folder-name
  fs.mkdirSync(path.join(dir, ".github"), { recursive: true })
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true })
  fs.writeFileSync(path.join(dir, "docs", "guide.md"), "# 使用指南", "utf-8")
  fs.mkdirSync(path.join(dir, "my-notes"), { recursive: true })

  const result = checkRepoCompliance(dir, zh)
  assert.strictEqual(result.valid, true)
  assert.ok(!result.issues.some((i) => i.code === "invalid-folder-name"), "普通项目文件夹不应被误报为命名问题")
})

test("checkRepoCompliance 缺少 config.json（error）", () => {
  const dir = makeRepo()
  fs.mkdirSync(path.join(dir, "02-无配置"), { recursive: true })
  fs.writeFileSync(path.join(dir, "02-无配置", "text.md"), "# 正文", "utf-8")
  const result = checkRepoCompliance(dir, zh)
  assert.strictEqual(result.valid, false)
  assert.ok(result.issues.some((i) => i.code === "missing-config"))
})

test("checkRepoCompliance config.json 无效（error）", () => {
  const dir = makeRepo()
  fs.mkdirSync(path.join(dir, "02-坏配置"), { recursive: true })
  fs.writeFileSync(path.join(dir, "02-坏配置", "config.json"), "{broken", "utf-8")
  fs.writeFileSync(path.join(dir, "02-坏配置", "text.md"), "# 正文", "utf-8")
  const result = checkRepoCompliance(dir, zh)
  assert.strictEqual(result.valid, false)
  assert.ok(result.issues.some((i) => i.code === "invalid-config"))
})

test("checkRepoCompliance 缺少正文（error）", () => {
  const dir = makeRepo()
  const story = path.join(dir, "02-无正文")
  fs.mkdirSync(story, { recursive: true })
  fs.writeFileSync(
    path.join(story, "config.json"),
    JSON.stringify({ title: "无正文", type: "original", status: "ongoing", summary: "简介。", created: "2026-08-01" }),
    "utf-8",
  )
  const result = checkRepoCompliance(dir, zh)
  assert.strictEqual(result.valid, false)
  assert.ok(result.issues.some((i) => i.code === "missing-content"))
})

test("checkRepoCompliance 重复序号（warning）", () => {
  const dir = makeRepo()
  const story = path.join(dir, "01-重复")
  fs.mkdirSync(story, { recursive: true })
  fs.writeFileSync(
    path.join(story, "config.json"),
    JSON.stringify({ title: "重复", type: "original", status: "ongoing", summary: "简介。", created: "2026-08-01" }),
    "utf-8",
  )
  fs.writeFileSync(path.join(story, "text.md"), "# 正文", "utf-8")
  const result = checkRepoCompliance(dir, zh)
  assert.strictEqual(result.valid, true)
  assert.ok(result.issues.some((i) => i.code === "duplicate-number"))
})

test("story validate 退出码：合法仓库返回 0", () => {
  const dir = makeRepo()
  const { ok, output } = runCli(["validate"], dir)
  assert.ok(ok, `合法仓库 validate 应成功，输出: ${output}`)
  assert.ok(output.includes("合规检查通过"))
})

test("story validate 退出码：有 error 返回 1", () => {
  const dir = makeRepo()
  fs.mkdirSync(path.join(dir, "02-无配置"), { recursive: true })
  const { ok, output } = runCli(["validate"], dir)
  assert.ok(!ok, "有 error 时 validate 应返回非零退出码")
  assert.ok(output.includes("合规检查未通过"))
})

test("story validate --json 输出结构化", () => {
  const dir = makeRepo()
  const { ok, output } = runCli(["validate", "--json"], dir)
  assert.ok(ok)
  const data = JSON.parse(output) as { valid: boolean; storyCount: number; issues: unknown[]; stories: unknown[] }
  assert.strictEqual(data.valid, true)
  assert.strictEqual(data.storyCount, 1)
  assert.ok(Array.isArray(data.issues))
  assert.ok(Array.isArray(data.stories))
})
