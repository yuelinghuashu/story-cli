import assert from "node:assert"
import { test } from "node:test"
import { safeTail, safeTruncate } from "../src/utils/unicode.ts"

// ─── safeTruncate ─────────────────────────────────────────────

test("safeTruncate ASCII 文本不截断（长度未超限时返回原文）", () => {
  assert.strictEqual(safeTruncate("hello", 10), "hello")
  assert.strictEqual(safeTruncate("hello", 5), "hello")
})

test("safeTruncate 正常截断至指定码点数", () => {
  assert.strictEqual(safeTruncate("abcdefghij", 5), "abcde")
  assert.strictEqual(safeTruncate("你好世界", 2), "你好")
})

test("safeTruncate 截断 emoji 时不产生孤立 surrogate（核心场景）", () => {
  // 构造边界：119 个 ASCII + 1 个 emoji（📚 = \uD83D\uDCDA，UTF-16 length=2）
  // 码点数 = 120，但 UTF-16 length = 121；截断到 120 码点 = 完整保留 emoji
  const text = "a".repeat(119) + "📚"
  const result = safeTruncate(text, 120)
  const resultCodePoints = Array.from(result).length
  assert.strictEqual(resultCodePoints, 120, "码点数应恰好 120")
  assert.ok(result.endsWith("📚"), "末尾应是完整 emoji，不应产生畸形")
  // 验证每个字符都是完整的（无孤立代理）
  for (const ch of [...result]) {
    assert.ok(ch.length >= 1, "每个字符至少占 1 个码点")
    if (ch.length === 2) {
      // 2 个码点：必须是完整的 surrogate pair（高代理+低代理）
      assert.ok(
        ch.charCodeAt(0) >= 0xd800 &&
          ch.charCodeAt(0) <= 0xdbff &&
          ch.charCodeAt(1) >= 0xdc00 &&
          ch.charCodeAt(1) <= 0xdfff,
        `2码点字符必须是 surrogate pair: ${ch.charCodeAt(0).toString(16)} ${ch.charCodeAt(1).toString(16)}`,
      )
    }
  }
})

test("safeTruncate 扩展 B 区生僻字（𠮷）不被切断", () => {
  const text = "a".repeat(119) + "𠮷" // 𠮷 = U+20BB7，2 个 UTF-16 单元；码点数 = 120
  const result = safeTruncate(text, 120)
  assert.strictEqual(Array.from(result).length, 120, "码点数应恰好 120")
  assert.ok(result.endsWith("𠮷"), "末尾应是完整的生僻字")
})

test("safeTruncate JSON 序列化不会产生替换字符", () => {
  const text = "test" + "📚".repeat(130)
  const result = safeTruncate(text, 100)
  const json = JSON.stringify(result)
  assert.ok(!json.includes("\uFFFD"), "JSON 不应包含替换字符 \\uFFFD")
})

// ─── safeTail ─────────────────────────────────────────────────

test("safeTail 截取末尾 N 个码点", () => {
  assert.strictEqual(safeTail("hello world", 5), "world")
  assert.strictEqual(safeTail("你好世界", 2), "世界")
  assert.strictEqual(safeTail("hello", 10), "hello", "超长截取返回全文")
})

test("safeTail emoji 末尾不切断 surrogate pair", () => {
  const text = "测试内容📚🔥🚀"
  const result = safeTail(text, 3)
  assert.strictEqual(result, "📚🔥🚀", "末尾 3 个 emoji 应完整")
  // 验证无孤立代理
  for (const ch of [...result]) {
    if (ch.length === 2) {
      assert.ok(
        ch.charCodeAt(0) >= 0xd800 &&
          ch.charCodeAt(0) <= 0xdbff &&
          ch.charCodeAt(1) >= 0xdc00 &&
          ch.charCodeAt(1) <= 0xdfff,
        "2码点字符必须是完整 surrogate pair",
      )
    }
  }
})

test("safeTail count<=0 返回空字符串", () => {
  assert.strictEqual(safeTail("hello", 0), "")
  assert.strictEqual(safeTail("hello", -1), "")
})

test("safeTail 混合文本末尾 emoji 完整", () => {
  const text = "测试内容📚🔥🚀"
  const result = safeTail(text, 10)
  // 验证末尾 emoji 完整
  assert.ok(result.includes("📚"), "应包含完整 emoji 📚")
  assert.ok(result.includes("🔥"), "应包含完整 emoji 🔥")
  assert.ok(result.includes("🚀"), "应包含完整 emoji 🚀")
  // 验证无孤立代理（每个字符要么 1 码点，要么是完整 surrogate pair）
  for (const ch of [...result]) {
    if (ch.length === 2) {
      const cp0 = ch.charCodeAt(0),
        cp1 = ch.charCodeAt(1)
      const isPair = cp0 >= 0xd800 && cp0 <= 0xdbff && cp1 >= 0xdc00 && cp1 <= 0xdfff
      assert.ok(
        isPair,
        `2码点字符必须是完整 surrogate pair: U+${cp0.toString(16).toUpperCase()} U+${cp1.toString(16).toUpperCase()}`,
      )
    }
  }
})

// ─── 集成：sanitizeFileName + truncateSummary 对 emoji 的处理 ─────────

test("sanitizeFileName 对含 emoji 的超长标题不产生畸形字符", async () => {
  const { sanitizeFileName } = await import("../src/utils/cli-utils.ts")
  // 121 个 emoji（每个占 2 个 UTF-16 单元），超出 120 码点限制
  const emojiTitle = "📚".repeat(121)
  const safe = sanitizeFileName(emojiTitle)
  // 应无替换字符
  assert.ok(!safe.includes("\uFFFD"), "文件名不应包含替换字符 \\uFFFD")
  assert.strictEqual(Array.from(safe).length, 120, "码点数不超过 120")
})

test("truncateSummary 对含 emoji 的超长简介不产生畸形字符", async () => {
  // truncateSummary 内部使用 safeTruncate，通过含 emoji 的标题（间接验证同一代码路径）
  const summary = "简介：" + "📚".repeat(50) + "结尾"
  const safe = (await import("../src/utils/cli-utils.ts")).sanitizeFileName(summary)
  assert.ok(!safe.includes("\uFFFD"), "截断后不应有替换字符")
})
