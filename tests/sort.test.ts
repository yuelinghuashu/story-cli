import assert from "node:assert"
import { test } from "node:test"
import { groupAndSortStories, normalizeSeriesOrder, type SortableStory } from "../src/core/sort.ts"

/** 构造测试故事对象 */
function story(folder: string, series?: string, seriesOrder?: unknown): SortableStory {
  return { folder, series, seriesOrder }
}

test("groupAndSortStories 无系列字段时全部归入 ungrouped 并按文件夹序号排序", () => {
  const stories = [story("05-故事C"), story("01-故事A"), story("03-故事B")]
  const result = groupAndSortStories(stories)
  assert.strictEqual(result.groups.length, 0)
  assert.deepStrictEqual(
    result.ungrouped.map((s) => s.folder),
    ["01-故事A", "03-故事B", "05-故事C"],
  )
})

test("groupAndSortStories 有系列字段时正确分组", () => {
  const stories = [
    story("01-三体-地球往事", "三体", 1),
    story("03-朝闻道", undefined, undefined),
    story("02-三体-黑暗森林", "三体", 2),
    story("05-球状闪电", undefined, undefined),
  ]
  const result = groupAndSortStories(stories)
  assert.strictEqual(result.groups.length, 1)
  assert.strictEqual(result.groups[0].name, "三体")
  assert.deepStrictEqual(
    result.groups[0].stories.map((s) => s.folder),
    ["01-三体-地球往事", "02-三体-黑暗森林"],
  )
  assert.deepStrictEqual(
    result.ungrouped.map((s) => s.folder),
    ["03-朝闻道", "05-球状闪电"],
  )
})

test("groupAndSortStories 组内按 seriesOrder 数值升序", () => {
  const stories = [
    story("01-三体-地球往事", "三体", 1),
    story("02-三体-黑暗森林", "三体", 2),
    story("03-三体-死神永生", "三体", 3),
  ]
  const result = groupAndSortStories(stories)
  assert.deepStrictEqual(
    result.groups[0].stories.map((s) => s.folder),
    ["01-三体-地球往事", "02-三体-黑暗森林", "03-三体-死神永生"],
  )
})

test("groupAndSortStories seriesOrder 支持小数（分数索引）", () => {
  const stories = [
    story("01-故事A", "系列", 1),
    story("03-故事C", "系列", 3),
    story("02-故事B", "系列", 2.5), // 插入在 1 和 3 之间
  ]
  const result = groupAndSortStories(stories)
  assert.deepStrictEqual(
    result.groups[0].stories.map((s) => s.folder),
    ["01-故事A", "02-故事B", "03-故事C"],
  )
})

test("groupAndSortStories seriesOrder 缺失时回退文件夹序号", () => {
  const stories = [story("01-故事A", "系列"), story("02-故事B", "系列", 20), story("03-故事C", "系列")]
  const result = groupAndSortStories(stories)
  // A: 缺失 → 回退 1；C: 缺失 → 回退 3；B: 20
  assert.deepStrictEqual(
    result.groups[0].stories.map((s) => s.folder),
    ["01-故事A", "03-故事C", "02-故事B"],
  )
})

test("groupAndSortStories seriesOrder 相同时按文件夹序号确定顺序", () => {
  const stories = [
    story("01-故事A", "系列", 2),
    story("02-故事B", "系列", 2), // 与 A 相同
    story("03-故事C", "系列", 1),
  ]
  const result = groupAndSortStories(stories)
  assert.deepStrictEqual(
    result.groups[0].stories.map((s) => s.folder),
    ["03-故事C", "01-故事A", "02-故事B"],
  )
})

test("groupAndSortStories 空字符串 series 等同于未定义", () => {
  const stories = [story("01-故事A", "", 1), story("02-故事B", "  ", 2), story("03-故事C", "系列", 1)]
  const result = groupAndSortStories(stories)
  assert.strictEqual(result.groups.length, 1)
  assert.strictEqual(result.groups[0].name, "系列")
  assert.deepStrictEqual(
    result.ungrouped.map((s) => s.folder),
    ["01-故事A", "02-故事B"],
  )
})

test("groupAndSortStories 组间按组内最小文件夹序号排序", () => {
  const stories = [
    story("05-系列B-故事B", "系列B", 1),
    story("01-系列A-故事A", "系列A", 1),
    story("03-系列A-故事A2", "系列A", 2),
  ]
  const result = groupAndSortStories(stories)
  assert.deepStrictEqual(
    result.groups.map((g) => g.name),
    ["系列A", "系列B"],
  )
})

test("groupAndSortStories 独立故事排在系列组之后", () => {
  const stories = [story("01-系列A-故事", "系列A", 1), story("02-独立故事", undefined, undefined)]
  const result = groupAndSortStories(stories)
  assert.strictEqual(result.groups.length, 1)
  assert.strictEqual(result.ungrouped.length, 1)
})

test("groupAndSortStories 字符串形式的 seriesOrder 被宽容处理", () => {
  const stories = [story("01-故事A", "系列", "1"), story("02-故事B", "系列", "2.5"), story("03-故事C", "系列", "2")]
  const result = groupAndSortStories(stories)
  assert.deepStrictEqual(
    result.groups[0].stories.map((s) => s.folder),
    ["01-故事A", "03-故事C", "02-故事B"],
  )
})

test("groupAndSortStories 完全无效的 seriesOrder 回退文件夹序号", () => {
  const stories = [
    story("01-故事A", "系列", "abc"), // 无效值 → 回退文件夹序号 1
    story("02-故事B", "系列", 2),
  ]
  const result = groupAndSortStories(stories)
  assert.deepStrictEqual(
    result.groups[0].stories.map((s) => s.folder),
    ["01-故事A", "02-故事B"],
  )
})

test("groupAndSortStories 无效 seriesOrder 回退后与有效值相同按文件夹序号", () => {
  const stories = [
    story("01-故事A", "系列", "abc"), // 无效值 → 回退 1
    story("02-故事B", "系列", 1), // 有效值与 A 相同
  ]
  const result = groupAndSortStories(stories)
  assert.deepStrictEqual(
    result.groups[0].stories.map((s) => s.folder),
    ["01-故事A", "02-故事B"],
  )
})

test("normalizeSeriesOrder 返回数字或 null", () => {
  assert.strictEqual(normalizeSeriesOrder(2), 2)
  assert.strictEqual(normalizeSeriesOrder(2.5), 2.5)
  assert.strictEqual(normalizeSeriesOrder("2"), 2)
  assert.strictEqual(normalizeSeriesOrder("2.5"), 2.5)
  assert.strictEqual(normalizeSeriesOrder("abc"), null)
  assert.strictEqual(normalizeSeriesOrder(""), null)
  assert.strictEqual(normalizeSeriesOrder(undefined), null)
  assert.strictEqual(normalizeSeriesOrder(null), null)
})

test("groupAndSortStories 全局编号：系列组先遍历，独立故事延续编号（README 渲染数据）", () => {
  const stories = [story("01-三体-地球往事", "三体", 1), story("03-朝闻道"), story("02-三体-黑暗森林", "三体", 2)]

  const { groups, ungrouped } = groupAndSortStories(stories)

  // 模拟 render/readme.ts 中的全局编号逻辑
  let counter = 1
  const allRows = [
    ...groups.flatMap((g) => g.stories.map((s) => ({ ...s, num: String(counter++).padStart(2, "0") }))),
    ...ungrouped.map((s) => ({ ...s, num: String(counter++).padStart(2, "0") })),
  ]

  assert.deepStrictEqual(
    allRows.map((r) => r.num),
    ["01", "02", "03"],
  )
  assert.deepStrictEqual(
    allRows.map((r) => r.folder),
    ["01-三体-地球往事", "02-三体-黑暗森林", "03-朝闻道"],
  )
})
