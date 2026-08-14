import assert from "node:assert"
import { test } from "node:test"
import {
  countChineseChars,
  countEnglishWords,
  countWords,
  formatTotalWordCount,
  formatWordCount,
} from "../src/utils/word-count.ts"

test("countChineseChars 统计中文字符数", () => {
  assert.strictEqual(countChineseChars("你好世界"), 4)
  assert.strictEqual(countChineseChars("Hello, 世界!"), 2)
  assert.strictEqual(countChineseChars(""), 0)
  assert.strictEqual(countChineseChars(" 你好，世界！"), 4)
  assert.strictEqual(countChineseChars("12345"), 0)
})

test("countChineseChars 去除标点符号", () => {
  assert.strictEqual(countChineseChars("你好，世界！"), 4)
  assert.strictEqual(countChineseChars("他说：“你好”"), 4)
  assert.strictEqual(countChineseChars("（测试）【示例】"), 4)
})

test("countEnglishWords 统计英文单词数", () => {
  assert.strictEqual(countEnglishWords("Hello world"), 2)
  assert.strictEqual(countEnglishWords("Hello world, this is a test!"), 6)
  assert.strictEqual(countEnglishWords(""), 0)
  assert.strictEqual(countEnglishWords("你好世界"), 0)
  assert.strictEqual(countEnglishWords("well-known story"), 2)
})

test("countWords 根据语言统计", () => {
  assert.strictEqual(countWords("你好世界", "zh"), 4)
  assert.strictEqual(countWords("Hello world", "en"), 2)
  assert.strictEqual(countWords("你好世界 Hello world", "zh"), 4)
  assert.strictEqual(countWords("你好世界 Hello world", "en"), 2)
})

test("formatWordCount 中文格式化", () => {
  assert.strictEqual(formatWordCount(500, "zh"), "约 500 字")
  assert.strictEqual(formatWordCount(1500, "zh"), "约 2 千字")
  assert.strictEqual(formatWordCount(25000, "zh"), "约 25 千字")
  assert.strictEqual(formatWordCount(0, "zh"), "字数待补充")
})

test("formatWordCount 英文格式化", () => {
  assert.strictEqual(formatWordCount(500, "en"), "~500 words")
  assert.strictEqual(formatWordCount(1500, "en"), "~2K words")
  assert.strictEqual(formatWordCount(25000, "en"), "~25K words")
  assert.strictEqual(formatWordCount(0, "en"), "Word count TBD")
})

test("formatTotalWordCount 中文总字数", () => {
  assert.strictEqual(formatTotalWordCount(180000, "zh"), "约 18 万字")
  assert.strictEqual(formatTotalWordCount(5000, "zh"), "约 5 千字")
  assert.strictEqual(formatTotalWordCount(500, "zh"), "约 500 字")
})

test("formatTotalWordCount 英文总字数", () => {
  assert.strictEqual(formatTotalWordCount(180000, "en"), "~180.0K words")
  assert.strictEqual(formatTotalWordCount(5000, "en"), "~5.0K words")
  assert.strictEqual(formatTotalWordCount(500, "en"), "~500 words")
})
