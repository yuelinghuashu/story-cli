import assert from "node:assert"
import { test } from "node:test"
import { normalizeConfig, validateConfig } from "../src/core/validate.ts"

test("validateConfig 有效配置通过", () => {
  const config = {
    title: "Test Story",
    type: "original",
    status: "completed",
    summary: "A test story.",
    created: "2026-01-01",
    language: "zh",
  }
  const result = validateConfig(config, "00-测试")
  assert.strictEqual(result.valid, true)
  assert.deepStrictEqual(result.issues, [])
})

test("normalizeConfig 保留英文值不变", () => {
  const config = {
    type: "fanfic",
    status: "ongoing",
  }
  const normalized = normalizeConfig(config)
  assert.strictEqual(normalized.type, "fanfic")
  assert.strictEqual(normalized.status, "ongoing")
})

test("normalizeConfig 返回原配置副本", () => {
  const config = { title: "测试" }
  const normalized = normalizeConfig(config)
  assert.notStrictEqual(normalized, config) // 浅拷贝，不是同一个引用
  assert.strictEqual(normalized.title, "测试")
})

test("validateConfig 缺少必填字段", () => {
  const result = validateConfig({ title: "无类型" }, "00-测试")
  assert.strictEqual(result.valid, false)
  assert.ok(result.issues.length >= 3)
})

test("validateConfig 结构化校验问题（code + field + message）", () => {
  const result = validateConfig(
    { title: "T", type: "unknown", status: "completed", summary: "S", created: "2026/01/01" },
    "00-测试",
  )
  assert.strictEqual(result.valid, false)
  // 非法 type 的 issue 应包含 code="enum" 和 field="type"
  const typeIssue = result.issues.find((i) => i.field === "type")
  assert.ok(typeIssue)
  assert.strictEqual(typeIssue?.code, "enum")
  assert.ok(typeIssue?.message.includes("type"))
  // 非法 created 格式的 issue 应包含 code="pattern" 和 field="created"
  const createdIssue = result.issues.find((i) => i.field === "created")
  assert.ok(createdIssue)
  assert.strictEqual(createdIssue?.code, "pattern")
  assert.ok(createdIssue?.message.includes("created"))
})

test("validateConfig 非法 type", () => {
  const result = validateConfig(
    { title: "T", type: "未知类型", status: "completed", summary: "S", created: "2026-01-01" },
    "00-测试",
  )
  assert.strictEqual(result.valid, false)
  assert.ok(result.issues.some((i) => i.message.includes("type")))
})

test("validateConfig 二创必须有原作信息", () => {
  const result = validateConfig(
    { title: "T", type: "fanfic", status: "completed", summary: "S", created: "2026-01-01" },
    "00-测试",
  )
  assert.strictEqual(result.valid, false)
  assert.ok(result.issues.some((i) => i.message.includes("originalWork")))
  assert.ok(result.issues.some((i) => i.message.includes("originalAuthor")))
})

test("validateConfig created 格式校验", () => {
  const result = validateConfig(
    { title: "T", type: "original", status: "completed", summary: "S", created: "2026/01/01" },
    "00-测试",
  )
  assert.strictEqual(result.valid, false)
  assert.ok(result.issues.some((i) => i.message.includes("created")))
})

test("validateConfig 非法语言", () => {
  const result = validateConfig(
    { title: "T", type: "original", status: "completed", summary: "S", created: "2026-01-01", language: "jp" },
    "00-测试",
  )
  assert.strictEqual(result.valid, false)
  assert.ok(result.issues.some((i) => i.message.includes("language")))
})

test("validateConfig isMultiChapter 类型校验", () => {
  const result = validateConfig(
    { title: "T", type: "original", status: "completed", summary: "S", created: "2026-01-01", isMultiChapter: "yes" },
    "00-测试",
  )
  assert.strictEqual(result.valid, false)
  assert.ok(result.issues.some((i) => i.message.includes("isMultiChapter")))
})

// 自定义枚举测试（仓库级配置）
const validConfig = {
  title: "Test Story",
  type: "original",
  status: "completed",
  summary: "A test story.",
  created: "2026-01-01",
  language: "zh",
}

test("validateConfig 自定义类型覆盖（仓库级）", () => {
  const overrides = { types: ["original", "fanfic", "translation"] }
  const customConfig = { ...validConfig, type: "translation" }
  const result = validateConfig(customConfig, "00-测试", overrides)
  assert.strictEqual(result.valid, true)
})

test("validateConfig 自定义类型覆盖 reject 未授权类型", () => {
  const overrides = { types: ["original", "fanfic", "translation"] }
  const customConfig = { ...validConfig, type: "review" }
  const result = validateConfig(customConfig, "00-测试", overrides)
  assert.strictEqual(result.valid, false)
  assert.ok(result.issues.some((i) => i.message.includes("type")))
})

test("validateConfig 自定义状态覆盖（仓库级）", () => {
  const overrides = { statuses: ["completed", "ongoing", "planned"] }
  const customConfig = { ...validConfig, status: "planned" }
  const result = validateConfig(customConfig, "00-测试", overrides)
  assert.strictEqual(result.valid, true)
})

test("validateConfig 自定义状态覆盖 reject 未授权状态", () => {
  const overrides = { statuses: ["completed", "ongoing", "planned"] }
  const customConfig = { ...validConfig, status: "dropped" }
  const result = validateConfig(customConfig, "00-测试", overrides)
  assert.strictEqual(result.valid, false)
  assert.ok(result.issues.some((i) => i.message.includes("status")))
})

test("validateConfig 未传 overrides 时默认枚举生效", () => {
  const customConfig = { ...validConfig, type: "translation" }
  const result = validateConfig(customConfig, "00-测试")
  assert.strictEqual(result.valid, false)
})

test("validateConfig series 字段类型校验", () => {
  const config = { ...validConfig, series: "三体" }
  const result = validateConfig(config, "00-测试")
  assert.strictEqual(result.valid, true)
})

test("validateConfig seriesOrder 类型校验（number）", () => {
  const config = { ...validConfig, series: "三体", seriesOrder: 2 }
  const result = validateConfig(config, "00-测试")
  assert.strictEqual(result.valid, true)
})

test("validateConfig seriesOrder 非法类型（字符串）", () => {
  const config = { ...validConfig, series: "三体", seriesOrder: "2" }
  const result = validateConfig(config, "00-测试")
  assert.strictEqual(result.valid, false)
  assert.ok(result.issues.some((i) => i.field === "seriesOrder"))
})

test("validateConfig volume 字段类型校验", () => {
  const config = { ...validConfig, series: "三体", volume: "第二部·黑暗森林" }
  const result = validateConfig(config, "00-测试")
  assert.strictEqual(result.valid, true)
})

test("validateConfig volume 类型校验失败", () => {
  const config = { ...validConfig, series: "三体", volume: 123 }
  const result = validateConfig(config, "00-测试")
  assert.strictEqual(result.valid, false)
  assert.ok(result.issues.some((i) => i.field === "volume"))
})
