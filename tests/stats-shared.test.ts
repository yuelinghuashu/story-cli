import assert from "node:assert"
import { test } from "node:test"
import { computeStoryStats, type StatsStoryInput } from "../src/core/stats-shared.ts"
import { getLocale } from "../src/i18n/index.ts"

/** 构造参与统计的故事输入 */
function story(folder: string, overrides: Partial<StatsStoryInput> = {}): StatsStoryInput {
  return {
    folder,
    status: "ongoing",
    rawWordCount: 1000,
    lang: "zh",
    content: `# 第一章\n\n${"写作内容写作内容写作内容写作内容写作内容写作内容写作内容写作内容写作内容写作内容".repeat(10)}`,
    ...overrides,
  }
}

const zh = getLocale("zh")

test("computeStoryStats 汇总总量与计数", () => {
  const result = computeStoryStats(
    [
      story("01-故事A", { status: "completed", rawWordCount: 3000 }),
      story("02-故事B", { status: "ongoing", rawWordCount: 2000 }),
    ],
    zh,
  )
  assert.strictEqual(result.storyCount, 2)
  assert.strictEqual(result.totalWords, 5000)
  assert.strictEqual(result.completedCount, 1)
  assert.strictEqual(result.ongoingCount, 1)
  assert.strictEqual(result.standaloneCount, 2)
})

test("computeStoryStats 系列分组统计", () => {
  const result = computeStoryStats(
    [
      story("01-三体-地球往事", { series: "三体", status: "completed", rawWordCount: 3000 }),
      story("02-三体-黑暗森林", { series: "三体", status: "ongoing", rawWordCount: 2000 }),
      story("03-独立故事", { rawWordCount: 1000 }),
    ],
    zh,
  )
  assert.strictEqual(result.standaloneCount, 1)
  assert.strictEqual(result.series.length, 1)
  const series = result.series[0]
  assert.strictEqual(series.name, "三体")
  assert.strictEqual(series.count, 2)
  assert.strictEqual(series.completed, 1)
  assert.strictEqual(series.totalWords, 5000)
})

test("computeStoryStats 字数过期健康检查", () => {
  const result = computeStoryStats([story("01-字数过期", { configWordCount: "约 1 千字", rawWordCount: 6000 })], zh)
  const stale = result.health.find((h) => h.code === "stale-word-count")
  assert.ok(stale, "应有 stale-word-count 警告")
  assert.strictEqual(stale?.folder, "01-字数过期")
  assert.strictEqual(typeof stale?.message, "string")
  assert.strictEqual(stale?.detail?.actualWordCount, 6000)
})

test("computeStoryStats 字数未过期时不产生警告", () => {
  const result = computeStoryStats([story("01-正常", { configWordCount: "约 3 千字", rawWordCount: 3000 })], zh)
  assert.ok(!result.health.some((h) => h.code === "stale-word-count"))
})

test("computeStoryStats 输出全局重复短语", () => {
  const content = "# 第一章\n\n星光闪烁，星光闪烁，星光闪烁。\n\n第二章。"
  const result = computeStoryStats([story("01-重复", { content })], zh)
  assert.ok(Array.isArray(result.repeated), "应包含 repeated 数组")
  assert.ok(result.repeated.length > 0, "重复短语列表不应为空")
  // 星光闪烁 ×3 → 星光/光闪/闪烁 各计 3 次，均应在 top 列表
  const xingguang = result.repeated.find((p) => p.phrase === "星光")
  assert.ok(xingguang, "星光 应进入重复短语列表")
  assert.strictEqual(xingguang?.count, 3)
  assert.strictEqual(result.repeated[0].count, 3, "最高次数应为 3")
})

test("computeStoryStats 空输入不报错", () => {
  const result = computeStoryStats([], zh)
  assert.strictEqual(result.storyCount, 0)
  assert.strictEqual(result.totalWords, 0)
  assert.strictEqual(result.totalChapters, 0)
  assert.deepStrictEqual(result.series, [])
  assert.deepStrictEqual(result.health, [])
  assert.deepStrictEqual(result.repeated, [])
})

test("computeStoryStats totalChapters 按章节切分统计", () => {
  const content = "# 第一章\n\n正文。\n\n# 第二章\n\n更多。\n\n# 第三章\n\n更多。"
  const result = computeStoryStats([story("01-三章", { content })], zh)
  assert.strictEqual(result.totalChapters, 3)
})
