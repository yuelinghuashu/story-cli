import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { after, test } from "node:test"
import { buildStoryData, loadStories, loadStoryConfigAsync, loadStoryContentAsync } from "../src/core/loader.ts"
import type { StoryConfig } from "../src/core/types.ts"
import { getLocale } from "../src/i18n/index.ts"
import { cleanupTempDirs, makeTemp } from "./helpers.ts"

after(() => {
  cleanupTempDirs(["loader-test-"])
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

function validStoryConfig(title = "测试故事"): StoryConfig {
  return {
    title,
    type: "original",
    status: "ongoing",
    summary: "故事简介。",
    created: "2026-08-16",
  }
}

test("loadStoryConfigAsync 读取有效配置", async () => {
  const dir = makeTemp("loader-test-")
  const storyDir = makeStoryDir(dir, "01-测试故事", validConfig())
  const { config, issues } = await loadStoryConfigAsync(storyDir, "01-测试故事", {})
  assert.strictEqual(issues.length, 0)
  assert.strictEqual(config?.title, "测试故事")
  assert.strictEqual(config?.type, "original")
})

test("loadStoryConfigAsync 缺少 config.json 返回问题", async () => {
  const dir = makeTemp("loader-test-")
  const storyDir = makeStoryDir(dir, "01-无配置")
  const { config, issues } = await loadStoryConfigAsync(storyDir, "01-无配置", {})
  assert.strictEqual(config, null)
  assert.ok(issues.some((i) => i.code === "missing" && i.field === "config.json"))
})

test("loadStoryConfigAsync 非法 JSON 返回 parse 问题", async () => {
  const dir = makeTemp("loader-test-")
  const storyDir = makeStoryDir(dir, "01-非法JSON")
  fs.writeFileSync(path.join(storyDir, "config.json"), "{ invalid", "utf-8")
  const { config, issues } = await loadStoryConfigAsync(storyDir, "01-非法JSON", {})
  assert.strictEqual(config, null)
  assert.ok(issues.some((i) => i.code === "parse"))
})

test("loadStoryContentAsync 读取 text.md", async () => {
  const dir = makeTemp("loader-test-")
  const storyDir = makeStoryDir(dir, "01-测试故事", validConfig())
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n正文内容。", "utf-8")
  const { content, warnings } = await loadStoryContentAsync(storyDir, false, getLocale("zh"))
  assert.strictEqual(content, "# 第一章\n\n正文内容。")
  assert.strictEqual(warnings.length, 0)
})

test("loadStoryContentAsync 合并 chapter 文件并生成 text.md", async () => {
  const dir = makeTemp("loader-test-")
  const storyDir = makeStoryDir(dir, "01-多章节", validConfig())
  fs.writeFileSync(path.join(storyDir, "chapter-1.md"), "# 第一章\n\n第一章内容。", "utf-8")
  fs.writeFileSync(path.join(storyDir, "chapter-2.md"), "# 第二章\n\n第二章内容。", "utf-8")
  const { content, warnings } = await loadStoryContentAsync(storyDir, false, getLocale("zh"))
  assert.strictEqual(warnings.length, 1, "应有一个合并警告")
  assert.ok(content.includes("第一章内容"))
  assert.ok(content.includes("第二章内容"))
  assert.ok(fs.existsSync(path.join(storyDir, "text.md")), "应生成 text.md")
})

test("loadStoryContentAsync validateOnly 模式不生成 text.md", async () => {
  const dir = makeTemp("loader-test-")
  const storyDir = makeStoryDir(dir, "01-多章节", validConfig())
  fs.writeFileSync(path.join(storyDir, "chapter-1.md"), "# 第一章\n\n内容。", "utf-8")
  const { warnings } = await loadStoryContentAsync(storyDir, true, getLocale("zh"))
  assert.strictEqual(warnings.length, 1)
  assert.ok(!fs.existsSync(path.join(storyDir, "text.md")), "validateOnly 无副作用")
})

test("buildStoryData 组装完整故事数据", () => {
  const config = validStoryConfig("构建故事")
  const content = "# 第一章\n\n正文内容。"
  const data = buildStoryData("01-构建故事", config, content)
  assert.strictEqual(data.folder, "01-构建故事")
  assert.strictEqual(data.content, content)
  assert.strictEqual(data.lang, "zh")
  assert.strictEqual(data.rawWordCount, 7)
  assert.ok(data.wordCount.length > 0)
  assert.strictEqual(data.chapters.length, 1)
  assert.strictEqual(data.chapters[0].title, "第一章")
  assert.strictEqual(data.typeDisplay, "原创")
  assert.strictEqual(data.statusDisplay, "连载中")
})

test("buildStoryData 支持仓库级自定义标签", () => {
  const config = validStoryConfig("翻译故事")
  config.type = "translation"
  config.status = "planned"
  const typeLabels = { translation: { zh: "翻译", en: "Translation" } }
  const statusLabels = { planned: { zh: "计划中", en: "Planned" } }
  const data = buildStoryData("01-翻译故事", config, "# 第一章\n\n内容", typeLabels, statusLabels)
  assert.strictEqual(data.typeDisplay, "翻译")
  assert.strictEqual(data.statusDisplay, "计划中")
})

test("loadStories 扫描并加载所有有效故事", async () => {
  const dir = makeTemp("loader-test-")
  makeStoryDir(dir, "01-故事A", validConfig("故事A"))
  fs.writeFileSync(path.join(dir, "01-故事A", "text.md"), "# 第一章\n\nA 的内容。", "utf-8")
  makeStoryDir(dir, "02-故事B", validConfig("故事B"))
  fs.writeFileSync(path.join(dir, "02-故事B", "text.md"), "# 第一章\n\nB 的内容。", "utf-8")
  const { stories, issues, warnings } = await loadStories(dir)
  assert.strictEqual(issues.length, 0)
  assert.strictEqual(stories.length, 2)
  assert.strictEqual(warnings.length, 0)
})

test("loadStories 跳过配置无效的故事", async () => {
  const dir = makeTemp("loader-test-")
  // 只有 title 缺少 4 个必填字段 → 应产生 4 个校验问题
  makeStoryDir(dir, "01-坏配置", { title: "坏" })
  makeStoryDir(dir, "02-好故事", validConfig("好故事"))
  fs.writeFileSync(path.join(dir, "02-好故事", "text.md"), "# 第一章\n\n正文。", "utf-8")
  const { stories, issues } = await loadStories(dir)
  assert.ok(issues.length >= 1, "应至少有一个配置错误")
  assert.strictEqual(stories.length, 1, "只加载有效故事")
  assert.strictEqual(stories[0]?.config.title, "好故事")
})

test("loadStories 检测重复序号并输出警告", async () => {
  const dir = makeTemp("loader-test-")
  makeStoryDir(dir, "01-故事A", validConfig("故事A"))
  fs.writeFileSync(path.join(dir, "01-故事A", "text.md"), "# 第一章\n\n内容。", "utf-8")
  makeStoryDir(dir, "01-故事B", validConfig("故事B"))
  fs.writeFileSync(path.join(dir, "01-故事B", "text.md"), "# 第一章\n\n内容。", "utf-8")
  makeStoryDir(dir, "02-故事C", validConfig("故事C"))
  fs.writeFileSync(path.join(dir, "02-故事C", "text.md"), "# 第一章\n\n内容。", "utf-8")
  const { warnings } = await loadStories(dir)
  assert.ok(
    warnings.some((w) => w.includes("01")),
    "应输出重复序号警告",
  )
})

test("loadStories saveCounts 写回 wordCount 到 config.json", async () => {
  const dir = makeTemp("loader-test-")
  const storyDir = makeStoryDir(dir, "01-测试故事", validConfig())
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n你好世界内容内容", "utf-8")
  await loadStories(dir, true)
  const configAfter = JSON.parse(fs.readFileSync(path.join(storyDir, "config.json"), "utf-8")) as {
    wordCount?: string
  }
  assert.ok(configAfter.wordCount, "saveCounts 应写回 wordCount")
})

test("loadStories saveCounts=false 不写回 config.json", async () => {
  const dir = makeTemp("loader-test-")
  const storyDir = makeStoryDir(dir, "01-测试故事", validConfig())
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n你好世界内容内容", "utf-8")
  await loadStories(dir, false)
  const configAfter = JSON.parse(fs.readFileSync(path.join(storyDir, "config.json"), "utf-8")) as {
    wordCount?: string
  }
  assert.strictEqual(configAfter.wordCount, undefined, "saveCounts=false 不应写回")
})

test("loadStories validateOnly 不生成 text.md（无副作用）", async () => {
  const dir = makeTemp("loader-test-")
  const storyDir = makeStoryDir(dir, "01-多章节", validConfig())
  fs.writeFileSync(path.join(storyDir, "chapter-1.md"), "# 第一章\n\n内容。", "utf-8")
  const { stories } = await loadStories(dir, false, "zh", true)
  assert.strictEqual(stories.length, 1)
  assert.ok(!fs.existsSync(path.join(storyDir, "text.md")), "validateOnly 不应生成 text.md")
})
