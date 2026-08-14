import assert from "node:assert"
import { test } from "node:test"
import { ErrorCode, formatError, isStoryError, StoryError } from "../src/utils/errors.ts"

test("StoryError 包含错误码", () => {
  const err = new StoryError("config missing", ErrorCode.CONFIG_MISSING)
  assert.strictEqual(err.name, "StoryError")
  assert.strictEqual(err.code, ErrorCode.CONFIG_MISSING)
  assert.deepStrictEqual(err.context, {})
})

test("StoryError 支持上下文", () => {
  const err = new StoryError("story not found", ErrorCode.STORY_NOT_FOUND, { title: "标题" })
  assert.strictEqual(err.code, "STORY_NOT_FOUND")
  assert.deepStrictEqual(err.context, { title: "标题" })
})

test("isStoryError 判断错误类型", () => {
  const storyErr = new StoryError("x", ErrorCode.INVALID_ARGS)
  const plainErr = new Error("plain")
  assert.strictEqual(isStoryError(storyErr), true)
  assert.strictEqual(isStoryError(plainErr), false)
  assert.strictEqual(isStoryError(null), false)
  assert.strictEqual(isStoryError("string"), false)
})

test("formatError 格式化 StoryError", () => {
  const err = new StoryError("配置缺失", ErrorCode.CONFIG_MISSING)
  assert.strictEqual(formatError(err), "❌ [CONFIG_MISSING] 配置缺失")
})

test("formatError 格式化普通 Error", () => {
  const err = new Error("普通错误")
  assert.strictEqual(formatError(err), "❌ 普通错误")
})

test("formatError 格式化非 Error 值", () => {
  assert.strictEqual(formatError("just a string"), "❌ just a string")
  assert.strictEqual(formatError(42), "❌ 42")
})

test("ErrorCode 包含所有错误码", () => {
  const codes = Object.values(ErrorCode)
  assert.ok(codes.includes("CONFIG_MISSING"))
  assert.ok(codes.includes("CONFIG_PARSE"))
  assert.ok(codes.includes("CONFIG_INVALID"))
  assert.ok(codes.includes("STORY_NOT_FOUND"))
  assert.ok(codes.includes("EMPTY_CONTENT"))
  assert.ok(codes.includes("EPUB_EXPORT"))
  assert.ok(codes.includes("IMAGE_MISSING"))
  assert.ok(codes.includes("IMAGE_READ"))
  assert.ok(codes.includes("INVALID_ARGS"))
  assert.ok(codes.includes("WATCH_ERROR"))
})
