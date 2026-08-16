import assert from "node:assert"
import { test } from "node:test"
import { sanitizeFileName } from "../src/utils/cli-utils.ts"

test("sanitizeFileName 正常标题保持不变", () => {
  assert.strictEqual(sanitizeFileName("我的新故事"), "我的新故事")
  assert.strictEqual(sanitizeFileName("My First Story"), "My First Story")
})

test("sanitizeFileName 替换 Windows 非法字符", () => {
  assert.strictEqual(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j'), "a_b_c_d_e_f_g_h_i_j")
})

test("sanitizeFileName 折叠连续空格", () => {
  assert.strictEqual(sanitizeFileName("标题   带空格"), "标题 带空格")
})

test("sanitizeFileName 去除首尾空格", () => {
  assert.strictEqual(sanitizeFileName("  前后有空格  "), "前后有空格")
})

test("sanitizeFileName 超长标题截断到 120 字符", () => {
  const longTitle = "很".repeat(150)
  const result = sanitizeFileName(longTitle)
  assert.strictEqual(result.length, 120)
})

test("sanitizeFileName 中文和特殊 Unicode 字符保留", () => {
  assert.strictEqual(sanitizeFileName("🌟 星海 ✨"), "🌟 星海 ✨")
  assert.strictEqual(sanitizeFileName("𠀀𠀁 扩展区"), "𠀀𠀁 扩展区")
})
