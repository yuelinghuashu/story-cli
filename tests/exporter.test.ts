import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { after, test } from "node:test"
import {
  loadExportOverrides,
  loadExportRepoConfig,
  resolveExportOptions,
  resolveOutputDir,
} from "../src/core/exporter.ts"
import { cleanupTempDirs, makeTemp } from "./helpers.ts"

after(() => {
  cleanupTempDirs(["exporter-test-"])
})

test("resolveExportOptions 使用默认输出目录", () => {
  const opts = resolveExportOptions([], "dist/txt")
  assert.strictEqual(opts.outputDir, "dist/txt")
  assert.strictEqual(opts.toStdout, false)
})

test("resolveExportOptions 支持 --output 自定义目录", () => {
  const opts = resolveExportOptions(["--output=my-out"], "dist/txt")
  assert.strictEqual(opts.outputDir, "my-out")
})

test("resolveExportOptions 支持 --stdout 标志", () => {
  const opts = resolveExportOptions(["--stdout"], "dist/txt")
  assert.strictEqual(opts.toStdout, true)
})

test("resolveExportOptions 同时支持 --output 和 --stdout", () => {
  const opts = resolveExportOptions(["--output=out", "--stdout"], "dist/json")
  assert.strictEqual(opts.outputDir, "out")
  assert.strictEqual(opts.toStdout, true)
})

test("resolveOutputDir 将相对路径解析为绝对路径", () => {
  const rootDir = makeTemp("exporter-test-")
  const resolved = resolveOutputDir(rootDir, "dist/html")
  assert.ok(path.isAbsolute(resolved))
  assert.strictEqual(resolved, path.join(rootDir, "dist/html"))
})

test("loadExportOverrides 无 story.config.json 时返回默认枚举", () => {
  const rootDir = makeTemp("exporter-test-")
  const overrides = loadExportOverrides(rootDir)
  assert.deepStrictEqual(overrides.types, ["original", "fanfic"])
  assert.deepStrictEqual(overrides.statuses, ["completed", "ongoing"])
})

test("loadExportOverrides 读取自定义枚举", () => {
  const rootDir = makeTemp("exporter-test-")
  fs.writeFileSync(
    path.join(rootDir, "story.config.json"),
    JSON.stringify({
      types: ["original", "fanfic", "translation"],
      statuses: ["completed", "ongoing", "planned"],
    }),
    "utf-8",
  )
  const overrides = loadExportOverrides(rootDir)
  assert.deepStrictEqual(overrides.types, ["original", "fanfic", "translation"])
  assert.deepStrictEqual(overrides.statuses, ["completed", "ongoing", "planned"])
})

test("loadExportRepoConfig 返回校验覆盖和本地化标签", () => {
  const rootDir = makeTemp("exporter-test-")
  fs.writeFileSync(
    path.join(rootDir, "story.config.json"),
    JSON.stringify({
      types: ["original", "fanfic", "translation"],
      typeLabels: { translation: { zh: "翻译", en: "Translation" } },
    }),
    "utf-8",
  )
  const repoConfig = loadExportRepoConfig(rootDir)
  assert.deepStrictEqual(repoConfig.overrides.types, ["original", "fanfic", "translation"])
  assert.strictEqual(repoConfig.typeLabels.translation.zh, "翻译")
  assert.strictEqual(repoConfig.typeLabels.original.zh, "原创")
  assert.strictEqual(repoConfig.statusLabels.completed.zh, "已完结")
})
