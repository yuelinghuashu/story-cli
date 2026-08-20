import assert from "node:assert"
import { test } from "node:test"
import {
  ErrorCollector,
  handleFileSystemError,
  handleJsonParseError,
  isNodeError,
  normalizeError,
} from "../src/utils/error-handler.ts"
import { ErrorCode, StoryError } from "../src/utils/errors.ts"

test("normalizeError 保留已有的 StoryError", () => {
  const original = new StoryError("原始错误", ErrorCode.CONFIG_MISSING, { folder: "test" })
  const result = normalizeError(original)
  assert.strictEqual(result, original)
  assert.strictEqual(result.code, ErrorCode.CONFIG_MISSING)
})

test("normalizeError 合并额外上下文到已有的 StoryError", () => {
  const original = new StoryError("原始错误", ErrorCode.CONFIG_MISSING, { folder: "test" })
  const result = normalizeError(original, { operation: "读取" })
  assert.strictEqual(result.message, "原始错误")
  assert.strictEqual(result.context.operation, "读取")
  assert.strictEqual(result.context.folder, "test")
})

test("normalizeError 将普通 Error 转为 StoryError", () => {
  const result = normalizeError(new Error("普通错误"))
  assert.ok(result instanceof StoryError)
  assert.strictEqual(result.message, "普通错误")
  assert.strictEqual(result.code, ErrorCode.CONFIG_PARSE)
})

test("normalizeError 将非 Error 值转为 StoryError", () => {
  const result = normalizeError("字符串错误")
  assert.ok(result instanceof StoryError)
  assert.strictEqual(result.message, "字符串错误")
})

test("isNodeError 检测 Node.js 文件系统错误", () => {
  const nodeError = Object.assign(new Error("ENOENT"), { code: "ENOENT" })
  assert.strictEqual(isNodeError(nodeError), true)
  assert.strictEqual(isNodeError(new Error("普通错误")), false)
  assert.strictEqual(isNodeError(null), false)
  assert.strictEqual(isNodeError("string"), false)
})

test("handleFileSystemError 处理 ENOENT 错误", () => {
  const nodeError = Object.assign(new Error("no such file"), { code: "ENOENT" })
  const result = handleFileSystemError(nodeError, "/path/to/file", "读取配置")
  assert.strictEqual(result.code, ErrorCode.FILE_NOT_FOUND)
  assert.ok(result.message.includes("文件不存在"))
  assert.ok(result.message.includes("/path/to/file"))
})

test("handleFileSystemError 处理 EACCES 错误", () => {
  const nodeError = Object.assign(new Error("permission denied"), { code: "EACCES" })
  const result = handleFileSystemError(nodeError, "/path/to/file", "写入文件")
  assert.strictEqual(result.code, ErrorCode.FILE_READ)
  assert.ok(result.message.includes("权限不足"))
})

test("handleFileSystemError 处理其他 Node 错误", () => {
  const nodeError = Object.assign(new Error("some error"), { code: "EIO" })
  const result = handleFileSystemError(nodeError, "/path/to/file", "读取")
  assert.strictEqual(result.code, ErrorCode.FILE_READ)
  assert.ok(result.message.includes("文件系统错误"))
})

test("handleFileSystemError 处理非 Node 错误", () => {
  const result = handleFileSystemError(new Error("普通错误"), "/path", "操作")
  assert.strictEqual(result.code, ErrorCode.CONFIG_PARSE)
})

test("handleJsonParseError 处理 SyntaxError", () => {
  const result = handleJsonParseError(new SyntaxError("Unexpected token"), "/config.json")
  assert.strictEqual(result.code, ErrorCode.JSON_PARSE)
  assert.ok(result.message.includes("JSON 解析失败"))
  assert.ok(result.message.includes("/config.json"))
})

test("handleJsonParseError 处理文件系统错误", () => {
  const nodeError = Object.assign(new Error("no such file"), { code: "ENOENT" })
  const result = handleJsonParseError(nodeError, "/config.json")
  assert.strictEqual(result.code, ErrorCode.FILE_NOT_FOUND)
})

test("handleJsonParseError 处理非 SyntaxError 非 NodeError", () => {
  const result = handleJsonParseError(new RangeError("out of range"), "/config.json")
  assert.ok(result instanceof StoryError)
  assert.strictEqual(result.message, "out of range")
})

test("ErrorCollector 收集多个错误", () => {
  const collector = new ErrorCollector({ operation: "批量处理" })
  assert.strictEqual(collector.hasErrors(), false)

  collector.add(new Error("错误1"))
  collector.add(new Error("错误2"))

  assert.strictEqual(collector.hasErrors(), true)
  assert.strictEqual(collector.getErrors().length, 2)
  assert.strictEqual(collector.getFirstError()?.message, "错误1")
})

test("ErrorCollector 转换为 ValidationIssue 格式", () => {
  const collector = new ErrorCollector({ operation: "校验" })
  collector.add(new StoryError("字段缺失", ErrorCode.CONFIG_MISSING))

  const issues = collector.toValidationIssues()
  assert.strictEqual(issues.length, 1)
  assert.strictEqual(issues[0].code, ErrorCode.CONFIG_MISSING)
  assert.strictEqual(issues[0].field, "校验")
  assert.strictEqual(issues[0].message, "字段缺失")
})

test("ErrorCollector clear 清空错误", () => {
  const collector = new ErrorCollector({ operation: "测试" })
  collector.add(new Error("错误"))
  assert.strictEqual(collector.hasErrors(), true)

  collector.clear()
  assert.strictEqual(collector.hasErrors(), false)
  assert.strictEqual(collector.getErrors().length, 0)
})
