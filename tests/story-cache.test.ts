import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { after, test } from "node:test"
import { loadStories } from "../src/core/loader.ts"
import {
  contentFingerprint,
  loadStoryCache,
  STORY_CACHE_FILE,
  saveStoryCache,
  storyFingerprint,
} from "../src/core/story-cache.ts"
import { cleanupTempDirs, makeTemp } from "./helpers.ts"

after(() => {
  cleanupTempDirs(["story-cache-test-"])
})

/** 创建包含单个 text.md 故事的仓库 */
function makeTextMdRepo(dir: string, folder = "01-故事A"): string {
  const storyDir = path.join(dir, folder)
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify(
      { title: "测试", type: "original", status: "ongoing", summary: "简介", created: "2026-08-19" },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n夜色如水，星河无声。\n", "utf-8")
  return folder
}

// ─── 指纹计算 ───────────────────────────────────────
test("contentFingerprint text.md 返回 mtime+size 指纹", () => {
  const dir = makeTemp("story-cache-test-")
  const storyDir = path.join(dir, "01-故事A")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(path.join(storyDir, "text.md"), "内容", "utf-8")
  const fp = contentFingerprint(storyDir)
  assert.ok(fp?.startsWith("t:"), "text.md 来源应以 t: 开头")
})

test("contentFingerprint 无正文返回 empty 标记", () => {
  const dir = makeTemp("story-cache-test-")
  const storyDir = path.join(dir, "01-空故事")
  fs.mkdirSync(storyDir, { recursive: true })
  assert.strictEqual(contentFingerprint(storyDir), "empty")
})

test("contentFingerprint 多章节合并来源返回 null（不参与缓存）", () => {
  const dir = makeTemp("story-cache-test-")
  const storyDir = path.join(dir, "01-多章节")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(path.join(storyDir, "chapter-1.md"), "内容", "utf-8")
  assert.strictEqual(contentFingerprint(storyDir), null)
})

test("storyFingerprint 相同输入指纹稳定，输入变化指纹变化", () => {
  const config = { title: "A", type: "original", status: "ongoing", summary: "s", created: "2026-01-01" }
  const fp1 = storyFingerprint(config, "t:1:2", "r")
  const fp2 = storyFingerprint(config, "t:1:2", "r")
  assert.strictEqual(fp1, fp2)
  assert.notStrictEqual(storyFingerprint(config, "t:1:3", "r"), fp1, "正文指纹变化应使指纹变化")
  assert.notStrictEqual(storyFingerprint({ ...config, title: "B" }, "t:1:2", "r"), fp1, "config 变化应使指纹变化")
})

// ─── 缓存读写 ───────────────────────────────────────
test("saveStoryCache/loadStoryCache 版本或 CLI 版本不匹配时忽略缓存", () => {
  const dir = makeTemp("story-cache-test-")
  saveStoryCache(dir, "1.0.0", { "01-A": { fp: "x", data: {} as never } })
  assert.deepStrictEqual(loadStoryCache(dir, "1.0.1"), {}, "CLI 版本不同应忽略")
  saveStoryCache(dir, "1.0.0", { "01-A": { fp: "x", data: {} as never } })
  assert.deepStrictEqual(loadStoryCache(dir, "1.0.0"), { "01-A": { fp: "x", data: {} as never } }, "匹配时应读回")
})

// ─── loadStories 集成 ───────────────────────────────
test("loadStories useCache 第二次命中缓存（content 为空）", async () => {
  const dir = makeTemp("story-cache-test-")
  makeTextMdRepo(dir)

  const first = await loadStories(dir, false, "zh", false, true)
  assert.strictEqual(first.stories.length, 1)
  assert.ok(first.stories[0].content.length > 0, "首次应读取正文")
  assert.ok(fs.existsSync(path.join(dir, STORY_CACHE_FILE)), "应生成缓存文件")

  const second = await loadStories(dir, false, "zh", false, true)
  assert.strictEqual(second.stories[0].content, "", "缓存命中时不应读取正文")
  assert.strictEqual(second.stories[0].wordCount, first.stories[0].wordCount, "字数应与首次一致")
  assert.strictEqual(second.stories[0].rawWordCount, first.stories[0].rawWordCount)
  assert.deepStrictEqual(second.stories[0].chapters, first.stories[0].chapters, "章节应与首次一致")
  assert.strictEqual(second.stories[0].typeDisplay, first.stories[0].typeDisplay)
})

test("正文变化使缓存失效并重新计算", async () => {
  const dir = makeTemp("story-cache-test-")
  const folder = makeTextMdRepo(dir)

  const first = await loadStories(dir, false, "zh", false, true)
  const storyDir = path.join(dir, folder)
  fs.appendFileSync(path.join(storyDir, "text.md"), "# 第二章\n\n新增的一章内容。\n", "utf-8")

  const second = await loadStories(dir, false, "zh", false, true)
  assert.ok(second.stories[0].content.length > 0, "正文变化后应重新读取")
  assert.ok(second.stories[0].rawWordCount > first.stories[0].rawWordCount, "字数应随正文增长")
})

test("config 变化使缓存失效并重新计算", async () => {
  const dir = makeTemp("story-cache-test-")
  const folder = makeTextMdRepo(dir)

  await loadStories(dir, false, "zh", false, true)
  const configPath = path.join(dir, folder, "config.json")
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>
  config.summary = "修改后的简介"
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8")

  const second = await loadStories(dir, false, "zh", false, true)
  assert.ok(second.stories[0].content.length > 0, "config 变化后应重新读取正文")
  assert.strictEqual(second.stories[0].config.summary, "修改后的简介")
})

test("多章节合并故事不写入缓存（每次完整读取）", async () => {
  const dir = makeTemp("story-cache-test-")
  const storyDir = path.join(dir, "01-多章节")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify(
      { title: "多章节", type: "original", status: "ongoing", summary: "简介", created: "2026-08-19" },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "chapter-1.md"), "# 第一章\n\n内容。", "utf-8")

  await loadStories(dir, false, "zh", false, true)
  const cache = JSON.parse(fs.readFileSync(path.join(dir, STORY_CACHE_FILE), "utf-8")) as {
    stories: Record<string, unknown>
  }
  assert.ok(!("01-多章节" in cache.stories), "多章节故事不应进入缓存")

  const second = await loadStories(dir, false, "zh", false, true)
  assert.ok(second.stories[0].content.length > 0, "多章节故事每次都应完整读取")
})

test("useCache=false 不写缓存文件", async () => {
  const dir = makeTemp("story-cache-test-")
  makeTextMdRepo(dir)
  await loadStories(dir, false, "zh", false, false)
  assert.ok(!fs.existsSync(path.join(dir, STORY_CACHE_FILE)), "未启用缓存时不应生成缓存文件")
})

test("缓存文件损坏时静默降级为全量构建", async () => {
  const dir = makeTemp("story-cache-test-")
  makeTextMdRepo(dir)
  fs.writeFileSync(path.join(dir, STORY_CACHE_FILE), "{ broken json", "utf-8")
  const result = await loadStories(dir, false, "zh", false, true)
  assert.strictEqual(result.stories.length, 1)
  assert.ok(result.stories[0].content.length > 0, "缓存损坏时仍应完整读取正文")
})

test("saveCounts 在缓存命中时仍正确写回 wordCount", async () => {
  const dir = makeTemp("story-cache-test-")
  const folder = makeTextMdRepo(dir)
  // 首次不带 saveCounts 构建并生成缓存
  await loadStories(dir, false, "zh", false, true)
  // 第二次 saveCounts=true 且缓存命中（config 未变）
  await loadStories(dir, true, "zh", false, true)
  const config = JSON.parse(fs.readFileSync(path.join(dir, folder, "config.json"), "utf-8")) as { wordCount?: string }
  assert.ok(config.wordCount, "saveCounts 在缓存命中时也应写回 wordCount")
})
