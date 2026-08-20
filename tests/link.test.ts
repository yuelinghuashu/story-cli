import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { after, test } from "node:test"
import { type SuggestStoryInput, suggestLinks } from "../src/core/link-suggestion.ts"
import { type ValidationOverrides, validateConfig } from "../src/core/validate.ts"
import { cleanupTempDirs, makeTemp, runCli } from "./helpers.ts"

after(() => {
  cleanupTempDirs(["link-test-"])
})

function makeStory(dir: string, folder: string, title: string, config: Record<string, unknown> = {}) {
  const story = path.join(dir, folder)
  fs.mkdirSync(story, { recursive: true })
  fs.writeFileSync(
    path.join(story, "config.json"),
    JSON.stringify(
      { title, type: "original", status: "ongoing", summary: "简介。", created: "2026-08-01", ...config },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(story, "text.md"), "# 第一章\n\n正文。", "utf-8")
}

function makeRepo(): string {
  const dir = makeTemp("link-test-")
  makeStory(dir, "01-故事A", "故事A")
  makeStory(dir, "02-故事B", "故事B")
  return dir
}

// ─── links schema 校验 ───────────────────────────────
test("validateConfig links 字段：合法字符串数组通过", () => {
  const config = {
    title: "测试",
    type: "original",
    status: "ongoing",
    summary: "简介。",
    created: "2026-08-01",
    links: ["01-故事A", "02-故事B"],
  }
  const overrides: ValidationOverrides = {}
  assert.strictEqual(validateConfig(config, "01-x", overrides).valid, true)
})

test("validateConfig links 字段：非法类型（非数组/含非字符串）拒绝", () => {
  const overrides: ValidationOverrides = {}
  const badArray = {
    title: "测试",
    type: "original",
    status: "ongoing",
    summary: "简介。",
    created: "2026-08-01",
    links: ["01-故事A", 123],
  }
  const result = validateConfig(badArray, "01-x", overrides)
  assert.strictEqual(result.valid, false)
  assert.ok(result.issues.some((i) => i.field === "links"))
})

// ─── story link 命令 ─────────────────────────────────
test("story link 添加关联并落盘（幂等）", () => {
  const dir = makeRepo()
  const { ok: ok1 } = runCli(["link", "01-故事A", "02-故事B"], dir)
  assert.ok(ok1, "应能添加关联")
  const config = JSON.parse(fs.readFileSync(path.join(dir, "01-故事A", "config.json"), "utf-8")) as { links: string[] }
  assert.deepStrictEqual(config.links, ["02-故事B"], "落盘后 links 应包含目标")

  // 幂等：重复添加不报错
  const { ok } = runCli(["link", "01-故事A", "02-故事B"], dir)
  assert.ok(ok, "重复添加应幂等成功")
})

test("story link 自关联拒绝", () => {
  const dir = makeRepo()
  const { ok } = runCli(["link", "01-故事A", "01-故事A"], dir)
  assert.ok(!ok, "自关联应失败")
})

test("story link 移除关联", () => {
  const dir = makeRepo()
  runCli(["link", "01-故事A", "02-故事B"], dir)
  const { ok } = runCli(["link", "--remove=02-故事B", "01-故事A"], dir)
  assert.ok(ok, "应能移除关联")
  const config = JSON.parse(fs.readFileSync(path.join(dir, "01-故事A", "config.json"), "utf-8")) as { links?: string[] }
  assert.deepStrictEqual(config.links ?? [], [], "移除后 links 应为空")
})

test("story link --list 列出关联", () => {
  const dir = makeRepo()
  runCli(["link", "01-故事A", "02-故事B"], dir)
  const { output } = runCli(["link", "--list"], dir)
  assert.ok(output.includes("01-故事A"), "应列出故事")
  assert.ok(output.includes("02-故事B"), "应列出关联目标")
})

test("story link 不存在的目标报错", () => {
  const dir = makeRepo()
  const { ok } = runCli(["link", "01-故事A", "99-不存在"], dir)
  assert.ok(!ok, "不存在的目标应报错")
})

test("story link 不存在的源报错", () => {
  const dir = makeRepo()
  const { ok } = runCli(["link", "99-不存在", "02-故事B"], dir)
  assert.ok(!ok, "不存在的源应报错")
})

test("story link 无参数报错", () => {
  const dir = makeRepo()
  const { ok } = runCli(["link"], dir)
  assert.ok(!ok, "无参数应报错")
})

test("story link 只有源无目标报错", () => {
  const dir = makeRepo()
  const { ok } = runCli(["link", "01-故事A"], dir)
  assert.ok(!ok, "只有源无目标应报错")
})

test("story link --remove 不存在的目标报错", () => {
  const dir = makeRepo()
  const { ok } = runCli(["link", "--remove=99-不存在", "01-故事A"], dir)
  assert.ok(!ok, "移除不存在的目标应报错")
})

test("story link --remove 关联不存在时报错", () => {
  const dir = makeRepo()
  const { ok } = runCli(["link", "--remove=02-故事B", "01-故事A"], dir)
  assert.ok(!ok, "移除未建立的关联应报错")
})

test("story link --list 指定源列出该源的关联", () => {
  const dir = makeRepo()
  runCli(["link", "01-故事A", "02-故事B"], dir)
  const { output } = runCli(["link", "--list", "01-故事A"], dir)
  assert.ok(output.includes("02-故事B"), "应列出该源的关联")
})

// ─── build 建议层 ────────────────────────────────────
test("suggestLinks 同 series + 共享关键词产生建议（不写盘）", () => {
  const stories: SuggestStoryInput[] = [
    {
      folder: "01-三体-地球往事",
      series: "三体",
      title: "地球往事",
      summary: "叶文洁",
      content: "# 一\n\n正文",
      lang: "zh",
    },
    {
      folder: "02-三体-黑暗森林",
      series: "三体",
      title: "黑暗森林",
      summary: "叶文洁",
      content: "# 二\n\n正文",
      lang: "zh",
    },
    { folder: "03-独立故事", series: undefined, title: "独立", summary: "叶文洁", content: "# 三\n\n正文", lang: "zh" },
  ]
  const suggestions = suggestLinks(stories)
  // 01 与 02 同系列共享关键词 → 有建议
  assert.ok(suggestions.some((s) => s.source === "01-三体-地球往事" && s.target === "02-三体-黑暗森林"))
  // 独立故事不参与
  assert.ok(!suggestions.some((s) => s.source === "03-独立故事"))
})

test("suggestLinks 不同系列不产生建议", () => {
  const stories: SuggestStoryInput[] = [
    { folder: "01-甲", series: "A", title: "共同", summary: "", content: "", lang: "zh" },
    { folder: "02-乙", series: "B", title: "共同", summary: "", content: "", lang: "zh" },
  ]
  assert.strictEqual(suggestLinks(stories).length, 0)
})

// ─── build 关联建议只在 build 报告出现，不写盘 ────────
test("story build 输出关联建议且不写盘", () => {
  const dir = makeTemp("link-test-")
  // 同系列 + 共享关键词摘要
  makeStory(dir, "01-系列-甲", "系列甲", { series: "S", summary: "共同主题关键词" })
  makeStory(dir, "02-系列-乙", "系列乙", { series: "S", summary: "共同主题关键词" })
  const before = fs.readFileSync(path.join(dir, "01-系列-甲", "config.json"), "utf-8")
  const { ok, output } = runCli(["build"], dir)
  assert.ok(ok, "build 应成功")
  assert.ok(output.includes("检测到可能的关联故事"), "应输出关联建议")
  const after = fs.readFileSync(path.join(dir, "01-系列-甲", "config.json"), "utf-8")
  assert.strictEqual(after, before, "建议层不应改写任何文件")
})

// ─── README 关联故事区块 ─────────────────────────────
test("story build 后 README 渲染关联故事区块", () => {
  const dir = makeRepo()
  runCli(["link", "01-故事A", "02-故事B"], dir)
  runCli(["build"], dir)
  const readme = fs.readFileSync(path.join(dir, "01-故事A", "README.md"), "utf-8")
  assert.ok(readme.includes("关联故事"), "应渲染关联故事标题")
  assert.ok(readme.includes("02-故事B"), "应包含关联目标文件夹链接")
})
