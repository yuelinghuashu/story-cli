import assert from "node:assert"
import { Buffer } from "node:buffer"
import { test } from "node:test"
import { detectEncodingIssue, isLikelyGb18030, isUtf8 } from "../src/utils/encoding.ts"

/** 构造 GBK 编码字节（当前 Node 构建不支持时返回 null） */
function createGbkBytes(text: string): Buffer | null {
  try {
    // "gbk" 不在 TypeScript 的 BufferEncoding 类型中，但 Node full-ICU 构建运行时支持
    return Buffer.from(text, "gbk" as BufferEncoding)
  } catch {
    return null
  }
}

const GBK_SUPPORTED = createGbkBytes("中文测试") !== null

/** 安全获取 GBK 字节（需先检查 GBK_SUPPORTED） */
function gbkBytes(text: string): Buffer {
  const buf = createGbkBytes(text)
  if (!buf) throw new Error("GBK encoding not supported in this Node build")
  return buf
}

test("isUtf8 识别合法 UTF-8", () => {
  const buf = Buffer.from("# 第一章\n\n这是正文。", "utf-8")
  assert.strictEqual(isUtf8(buf), true)
})

test("isUtf8 识别纯 ASCII", () => {
  const buf = Buffer.from("# Chapter 1\n\nHello world.", "utf-8")
  assert.strictEqual(isUtf8(buf), true)
})

test("isUtf8 接受空字节", () => {
  assert.strictEqual(isUtf8(new Uint8Array(0)), true)
})

test("isUtf8 拒绝非法 UTF-8 序列", () => {
  // 0xFF 不是合法的 UTF-8 首字节
  const buf = Buffer.from([0xff, 0xfe, 0x00, 0x01])
  assert.strictEqual(isUtf8(buf), false)
})

test("isUtf8 拒绝 GBK 编码", (t) => {
  if (!GBK_SUPPORTED) {
    t.skip("当前 Node 构建不支持 gbk 编码（small-ICU）")
    return
  }
  const buf = gbkBytes("中文测试")
  assert.strictEqual(isUtf8(buf), false)
})

test("isLikelyGb18030 识别 GBK 中文", (t) => {
  if (!GBK_SUPPORTED) {
    t.skip("当前 Node 构建不支持 gbk 编码（small-ICU）")
    return
  }
  const buf = gbkBytes("中文测试")
  assert.strictEqual(isLikelyGb18030(buf), true)
})

test("isLikelyGb18030 拒绝纯 ASCII", () => {
  const buf = Buffer.from("# Chapter 1\n\nHello world.", "utf-8")
  assert.strictEqual(isLikelyGb18030(buf), false)
})

// 注意：isLikelyGb18030 是纯函数，无法独立区分 UTF-8 中文和 GBK 中文
// （GB18030 解码 UTF-8 字节也可能产生汉字）。但它在 detectEncodingIssue 中
// 只会对「已确认非法 UTF-8」的缓冲区调用，因此不会误判。
test("isLikelyGb18030 对 UTF-8 中文的响应（已知限制，不做断言）", () => {
  const buf = Buffer.from("# 第一章\n\n这是正文。", "utf-8")
  // document the behavior: GB18030 decoding UTF-8 Chinese bytes may produce Chinese chars
  // This is expected — detectEncodingIssue gates this via isUtf8 first
  const result = isLikelyGb18030(buf)
  // Just verify it doesn't throw; the result is not asserted because it depends on byte patterns
  assert.doesNotThrow(() => result)
})

test("detectEncodingIssue 对合法 UTF-8 中文返回 null（先经过 isUtf8 检查）", () => {
  const buf = Buffer.from("# 第一章\n\n这是正文。", "utf-8")
  // 合法 UTF-8 先通过 isUtf8 检查，不会走到 isLikelyGb18030
  assert.strictEqual(detectEncodingIssue("test.md", buf), null)
})

test("detectEncodingIssue 合法 UTF-8 返回 null", () => {
  const buf = Buffer.from("# 合法内容", "utf-8")
  assert.strictEqual(detectEncodingIssue("test.md", buf), null)
})

test("detectEncodingIssue 纯 ASCII 返回 null", () => {
  const buf = Buffer.from("plain ascii text", "utf-8")
  assert.strictEqual(detectEncodingIssue("test.md", buf), null)
})

test("detectEncodingIssue 检测 GBK 文件", (t) => {
  if (!GBK_SUPPORTED) {
    t.skip("当前 Node 构建不支持 gbk 编码（small-ICU）")
    return
  }
  const buf = gbkBytes("中文测试")
  const issue = detectEncodingIssue("01-故事/text.md", buf)
  assert.ok(issue)
  assert.strictEqual(issue?.encoding, "GBK/GB18030")
})

test("detectEncodingIssue 随机二进制返回 unknown", () => {
  // 0x00-0x1F 控制字符 + 无效序列，不应被 gb18030 识别为中文
  const buf = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x1f])
  const issue = detectEncodingIssue("bad.md", buf)
  assert.ok(issue)
  assert.strictEqual(issue?.encoding, "unknown")
})
