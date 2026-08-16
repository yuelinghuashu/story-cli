import assert from "node:assert"
import { test } from "node:test"
import { extractNumericWordCount } from "../src/commands/stats.ts"

test("extractNumericWordCount 中文千字", () => {
  assert.strictEqual(extractNumericWordCount("约 3 千字", "zh"), 3000)
  assert.strictEqual(extractNumericWordCount("约 12 千字", "zh"), 12000)
})

test("extractNumericWordCount 中文字数（无单位）", () => {
  assert.strictEqual(extractNumericWordCount("约 500 字", "zh"), 500)
})

test("extractNumericWordCount 中文万字", () => {
  assert.strictEqual(extractNumericWordCount("约 18 万字", "zh"), 180000)
})

test("extractNumericWordCount 英文 K words", () => {
  assert.strictEqual(extractNumericWordCount("~5K words", "en"), 5000)
  assert.strictEqual(extractNumericWordCount("~25K words", "en"), 25000)
})

test("extractNumericWordCount 英文 words（无单位）", () => {
  assert.strictEqual(extractNumericWordCount("~500 words", "en"), 500)
})

test("extractNumericWordCount 无法解析时返回 null", () => {
  assert.strictEqual(extractNumericWordCount("字数待补充", "zh"), null)
  assert.strictEqual(extractNumericWordCount("Word count TBD", "en"), null)
})

test("extractNumericWordCount 小数解析", () => {
  assert.strictEqual(extractNumericWordCount("约 3.5 千字", "zh"), 3500)
  assert.strictEqual(extractNumericWordCount("~2.5K words", "en"), 2500)
})
