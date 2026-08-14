import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { loadRepoConfig } from "../src/core/config.ts"

function setupTempDir(files: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"))
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relPath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, "utf-8")
  }
  return dir
}

test("loadRepoConfig 无配置时回退默认值", () => {
  const dir = setupTempDir()
  const config = loadRepoConfig(dir)
  assert.deepStrictEqual(config.types, ["original", "fanfic"])
  assert.deepStrictEqual(config.statuses, ["completed", "ongoing"])
})

test("loadRepoConfig 读取自定义类型和状态", () => {
  const dir = setupTempDir({
    "story.config.json": JSON.stringify({
      types: ["original", "fanfic", "translation"],
      statuses: ["completed", "ongoing", "planned"],
    }),
  })
  const config = loadRepoConfig(dir)
  assert.deepStrictEqual(config.types, ["original", "fanfic", "translation"])
  assert.deepStrictEqual(config.statuses, ["completed", "ongoing", "planned"])
})

test("loadRepoConfig 配置缺失字段时使用默认值", () => {
  const dir = setupTempDir({
    "story.config.json": JSON.stringify({
      types: ["original", "fanfic", "translation"],
    }),
  })
  const config = loadRepoConfig(dir)
  assert.deepStrictEqual(config.types, ["original", "fanfic", "translation"])
  assert.deepStrictEqual(config.statuses, ["completed", "ongoing"])
})

test("loadRepoConfig 配置解析失败时回退默认值", () => {
  const dir = setupTempDir({
    "story.config.json": "{ invalid json",
  })
  const config = loadRepoConfig(dir)
  assert.deepStrictEqual(config.types, ["original", "fanfic"])
  assert.deepStrictEqual(config.statuses, ["completed", "ongoing"])
})

test("loadRepoConfig 过滤非字符串值", () => {
  const dir = setupTempDir({
    "story.config.json": JSON.stringify({
      types: ["original", 42, null, "fanfic"],
      statuses: ["completed", true],
    }),
  })
  const config = loadRepoConfig(dir)
  assert.deepStrictEqual(config.types, ["original", "fanfic"])
  assert.deepStrictEqual(config.statuses, ["completed"])
})

test("loadRepoConfig 无配置时内置标签回退", () => {
  const dir = setupTempDir()
  const config = loadRepoConfig(dir)
  assert.strictEqual(config.typeLabels.original.zh, "原创")
  assert.strictEqual(config.typeLabels.original.en, "Original")
  assert.strictEqual(config.typeLabels.fanfic.zh, "二创")
  assert.strictEqual(config.statusLabels.completed.zh, "已完结")
  assert.strictEqual(config.statusLabels.ongoing.en, "Ongoing")
})

test("loadRepoConfig 读取自定义类型和状态的本地化标签", () => {
  const dir = setupTempDir({
    "story.config.json": JSON.stringify({
      types: ["original", "fanfic", "translation"],
      statuses: ["completed", "ongoing", "planned"],
      typeLabels: {
        translation: { zh: "翻译", en: "Translation" },
      },
      statusLabels: {
        planned: { zh: "计划中", en: "Planned" },
      },
    }),
  })
  const config = loadRepoConfig(dir)
  assert.strictEqual(config.typeLabels.translation.zh, "翻译")
  assert.strictEqual(config.typeLabels.translation.en, "Translation")
  assert.strictEqual(config.statusLabels.planned.zh, "计划中")
  assert.strictEqual(config.statusLabels.planned.en, "Planned")
  // 内置标签不受影响
  assert.strictEqual(config.typeLabels.original.zh, "原创")
  assert.strictEqual(config.statusLabels.completed.zh, "已完结")
})

test("loadRepoConfig 无效标签格式被忽略", () => {
  const dir = setupTempDir({
    "story.config.json": JSON.stringify({
      types: ["original", "fanfic", "translation"],
      typeLabels: {
        translation: { zh: "翻译" }, // 缺少 en
        fanfic: "not-an-object", // 不是对象
        original: { zh: "自定原创", en: "Custom Original" }, // 有效，覆盖内置
      },
    }),
  })
  const config = loadRepoConfig(dir)
  // 无效标签被忽略
  assert.strictEqual(config.typeLabels.translation, undefined)
  assert.strictEqual(config.typeLabels.fanfic.zh, "二创") // 回退内置
  // 有效标签覆盖内置
  assert.strictEqual(config.typeLabels.original.zh, "自定原创")
  assert.strictEqual(config.typeLabels.original.en, "Custom Original")
})

test("loadRepoConfig 标签仅接受合法枚举值", () => {
  const dir = setupTempDir({
    "story.config.json": JSON.stringify({
      types: ["original", "fanfic"],
      typeLabels: {
        nonexistent: { zh: "不存在", en: "Not Exist" }, // 不在 types 中
      },
    }),
  })
  const config = loadRepoConfig(dir)
  assert.strictEqual(config.typeLabels.nonexistent, undefined)
})
