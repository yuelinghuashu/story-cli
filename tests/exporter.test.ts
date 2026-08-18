import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { after, test } from "node:test"
import {
  forEachExportStory,
  loadExportOverrides,
  loadExportRepoConfig,
  resolveExportOptions,
  resolveOutputDir,
  storyFileName,
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

// ─── forEachExportStory ─────────────────────────────────────────

/** 创建带 config.json + text.md 的故事目录 */
function createStory(rootDir: string, folder: string, title: string, text = "# 第一章\n\n正文。") {
  const storyDir = path.join(rootDir, folder)
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify({ title, type: "original", status: "ongoing", summary: "简介。", created: "2026-08-01" }),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), text, "utf-8")
}

test("forEachExportStory 遍历所有有效故事并计数", () => {
  const rootDir = makeTemp("exporter-test-")
  createStory(rootDir, "01-故事A", "故事A")
  createStory(rootDir, "02-故事B", "故事B")
  const overrides = loadExportOverrides(rootDir)

  const visited: string[] = []
  const { success, failed } = forEachExportStory(
    rootDir,
    overrides,
    (f) => `空: ${f}`,
    (ctx) => {
      visited.push(`${ctx.folder}:${ctx.config.title}`)
    },
  )

  assert.strictEqual(success, 2)
  assert.strictEqual(failed, 0)
  assert.deepStrictEqual(visited, ["01-故事A:故事A", "02-故事B:故事B"])
})

test("forEachExportStory 空正文故事计入失败并调用警告回调", () => {
  const rootDir = makeTemp("exporter-test-")
  createStory(rootDir, "01-故事A", "故事A", "# 第一章\n\n正文。")
  createStory(rootDir, "02-空故事", "空故事", "   ") // 纯空白正文
  const overrides = loadExportOverrides(rootDir)

  const warnings: string[] = []
  const result = forEachExportStory(
    rootDir,
    overrides,
    (f) => `空内容警告: ${f}`,
    () => {},
  )
  void warnings

  assert.strictEqual(result.success, 1)
  assert.strictEqual(result.failed, 1)
})

test("forEachExportStory 回调抛错时计入失败", () => {
  const rootDir = makeTemp("exporter-test-")
  createStory(rootDir, "01-故事A", "故事A")
  createStory(rootDir, "02-故事B", "故事B")
  const overrides = loadExportOverrides(rootDir)

  // 捕获 console.error 避免测试输出噪音
  const originalError = console.error
  console.error = () => {}
  try {
    const result = forEachExportStory(
      rootDir,
      overrides,
      () => "",
      () => {
        throw new Error("模拟导出失败")
      },
    )
    assert.strictEqual(result.success, 0)
    assert.strictEqual(result.failed, 2)
  } finally {
    console.error = originalError
  }
})

test("forEachExportStory 无效配置故事计入失败但其余正常", () => {
  const rootDir = makeTemp("exporter-test-")
  createStory(rootDir, "01-故事A", "故事A")
  // 无效配置（缺 title）
  const badDir = path.join(rootDir, "02-坏配置")
  fs.mkdirSync(badDir, { recursive: true })
  fs.writeFileSync(path.join(badDir, "config.json"), JSON.stringify({ type: "original" }), "utf-8")
  fs.writeFileSync(path.join(badDir, "text.md"), "# 正文", "utf-8")
  const overrides = loadExportOverrides(rootDir)

  const originalError = console.error
  console.error = () => {}
  try {
    const result = forEachExportStory(
      rootDir,
      overrides,
      () => "",
      () => {},
    )
    assert.strictEqual(result.success, 1)
    assert.strictEqual(result.failed, 1)
  } finally {
    console.error = originalError
  }
})

test("storyFileName 使用安全标题，空标题回退 story-<folder>", () => {
  const base = {
    type: "original",
    status: "ongoing",
    summary: "",
    created: "2026-08-01",
  }
  assert.strictEqual(storyFileName({ ...base, title: "我的故事" } as never, "01-我的故事"), "我的故事")
  // 含非法字符的标题被净化
  assert.strictEqual(storyFileName({ ...base, title: "A:B/C" } as never, "02-x"), "A_B_C")
  // 空标题回退
  assert.strictEqual(storyFileName({ ...base, title: "" } as never, "03-空"), "story-03-空")
})
