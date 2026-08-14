import assert from "node:assert"
import { test } from "node:test"
import { parseArgs } from "../src/args.ts"

test("parseArgs 解析位置参数", () => {
  const { positional, options } = parseArgs(["Title", "Another"])
  assert.deepStrictEqual(positional, ["Title", "Another"])
  assert.deepStrictEqual(options, {})
})

test("parseArgs 解析 --key=value", () => {
  const { positional, options } = parseArgs(["Title", "--type=fanfic", "--author=Work"])
  assert.deepStrictEqual(positional, ["Title"])
  assert.deepStrictEqual(options, { type: "fanfic", author: "Work" })
})

test("parseArgs 解析 --flag", () => {
  const { positional, options } = parseArgs(["--all"])
  assert.deepStrictEqual(positional, [])
  assert.deepStrictEqual(options, { all: true })
})

test("parseArgs 混用位置参数和选项", () => {
  const { positional, options } = parseArgs(["My Story", "--type=original", "--validate-only", "--lang=zh"])
  assert.deepStrictEqual(positional, ["My Story"])
  assert.deepStrictEqual(options, { type: "original", "validate-only": true, lang: "zh" })
})

test("parseArgs 空参数", () => {
  const { positional, options } = parseArgs([])
  assert.deepStrictEqual(positional, [])
  assert.deepStrictEqual(options, {})
})
