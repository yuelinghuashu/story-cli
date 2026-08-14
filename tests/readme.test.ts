import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { generateRootReadme, generateStoryReadme } from "../src/render/readme.ts"

function setupTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "readme-test-"))
}

const sampleStories = [
  {
    folder: "01-故事一",
    title: "故事一",
    typeDisplay: "原创",
    wordCount: "约 3 千字",
    statusDisplay: "连载中",
    summary: "这是一个测试故事。",
    rawWordCount: 3000,
    lang: "zh",
  },
  {
    folder: "02-故事二",
    title: "故事二",
    typeDisplay: "二创",
    wordCount: "约 5 千字",
    statusDisplay: "已完结",
    summary: "这是另一个测试故事。",
    rawWordCount: 5000,
    lang: "zh",
  },
]

test("generateRootReadme 生成根 README", () => {
  const dir = setupTempDir()
  generateRootReadme(dir, sampleStories)

  const content = fs.readFileSync(path.join(dir, "README.md"), "utf-8")
  assert.ok(content.includes("📚 我的故事集"))
  assert.ok(content.includes("故事一"))
  assert.ok(content.includes("故事二"))
  assert.ok(content.includes("共 **2** 个故事"))
})

test("generateRootReadme 表格表头和数据行之间无空行", () => {
  const dir = setupTempDir()
  generateRootReadme(dir, sampleStories)

  const content = fs.readFileSync(path.join(dir, "README.md"), "utf-8")
  // 查找表格起始位置
  const tableStart = content.indexOf("| # | 故事 |")
  assert.ok(tableStart !== -1, "表头应存在")

  // 提取完整的表格区块（从表头到数据行结束）
  const tableBlock = content.slice(tableStart, content.indexOf("\n\n", tableStart))
  const lines = tableBlock.split("\n").filter((l) => l.trim() !== "")

  // 应包含：表头、分隔行、数据行（没有空行间隔）
  assert.strictEqual(lines.length, 2 + sampleStories.length, "表头 + 分隔行 + 数据行 = 2 + N 行")
  assert.ok(lines[0].startsWith("| # |"), "第一行是表头")
  assert.ok(lines[1].startsWith("|---"), "第二行是分隔行")
  assert.ok(lines[2].includes("[故事一]"), "第三行是第一条数据")
})

test("generateRootReadme 无赞助图片时不生成赞助区块", () => {
  const dir = setupTempDir()
  generateRootReadme(dir, sampleStories)

  const content = fs.readFileSync(path.join(dir, "README.md"), "utf-8")
  // 没有 assets 目录，不应生成赞助区块（图片引用）
  assert.ok(!content.includes("ali-pay"))
  assert.ok(!content.includes("wechat-pay"))
  assert.ok(!content.includes("<details>"))
})

test("generateRootReadme 约定目录 assets/sponsor/ 中有图片时生成赞助区块", () => {
  const dir = setupTempDir()
  fs.mkdirSync(path.join(dir, "assets", "sponsor"), { recursive: true })
  fs.writeFileSync(path.join(dir, "assets", "sponsor", "收款码.png"), "fake-image-data")
  generateRootReadme(dir, sampleStories)

  const content = fs.readFileSync(path.join(dir, "README.md"), "utf-8")
  assert.ok(content.includes("收款码"))
  assert.ok(content.includes("<details>"))
})

test("generateRootReadme 无 sponsor 目录但有旧文件名时不生成赞助区块", () => {
  const dir = setupTempDir()
  // assets/ 中存在旧约定的文件名，但没有 assets/sponsor/ 目录
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true })
  fs.writeFileSync(path.join(dir, "assets", "ali-pay.jpg"), "fake-image-data")
  generateRootReadme(dir, sampleStories)

  const content = fs.readFileSync(path.join(dir, "README.md"), "utf-8")
  assert.ok(!content.includes("<details>"), "无 sponsor 目录时不应生成赞助区块")
  assert.ok(!content.includes("ali-pay"), "旧文件名不应触发赞助区块")
})

test("generateRootReadme 同时存在 sponsor 目录和同名旧文件时只使用 sponsor", () => {
  const dir = setupTempDir()
  // 同时存在新约定目录和同名的旧文件
  fs.mkdirSync(path.join(dir, "assets", "sponsor"), { recursive: true })
  fs.writeFileSync(path.join(dir, "assets", "sponsor", "ali-pay.jpg"), "new")
  fs.writeFileSync(path.join(dir, "assets", "ali-pay.jpg"), "legacy")
  generateRootReadme(dir, sampleStories)

  const content = fs.readFileSync(path.join(dir, "README.md"), "utf-8")
  // 只使用 sponsor 目录中的图片，assets/ 根的 ali-pay 不被当作赞助
  assert.ok(content.includes("<details>"), "sponsor 目录存在时应生成赞助区块")
  assert.ok(!content.includes("./assets/ali-pay.jpg"), "不应引用 assets/ 根目录的同名文件")
})

test("generateRootReadme 全英文故事时使用英文", () => {
  const dir = setupTempDir()
  const englishStories = sampleStories.map((s) => ({
    folder: s.folder,
    title: s.title,
    typeDisplay: "Original",
    wordCount: "~3K words",
    statusDisplay: "Ongoing",
    summary: s.summary,
    rawWordCount: s.rawWordCount,
    lang: "en",
  }))
  generateRootReadme(dir, englishStories)

  const content = fs.readFileSync(path.join(dir, "README.md"), "utf-8")
  assert.ok(content.includes("📚 My Stories"))
  assert.ok(content.includes("stories"))
})

test("generateRootReadme 空故事列表仍生成 README", () => {
  const dir = setupTempDir()
  generateRootReadme(dir, [])

  const content = fs.readFileSync(path.join(dir, "README.md"), "utf-8")
  assert.ok(content.includes("README"))
})

test("generateStoryReadme 生成故事 README", () => {
  const dir = setupTempDir()
  fs.mkdirSync(path.join(dir, "01-故事一"), { recursive: true })
  const templatePath = path.join(dir, "template.md")
  fs.writeFileSync(templatePath, "# 《{{title}}》\n\n{{summary}}", "utf-8")

  generateStoryReadme(path.join(dir, "01-故事一"), templatePath, { title: "测试", summary: "故事简介" })

  const content = fs.readFileSync(path.join(dir, "01-故事一", "README.md"), "utf-8")
  assert.ok(content.includes("《测试》"))
  assert.ok(content.includes("故事简介"))
})

test("generateRootReadme 多行简介折叠为单行", () => {
  const dir = setupTempDir()
  const multiLineSummary = "这是一个跨行的简介。\n第二行内容继续。\n第三行结束。"
  generateRootReadme(dir, [{ ...sampleStories[0], summary: multiLineSummary }])

  const content = fs.readFileSync(path.join(dir, "README.md"), "utf-8")
  // 表格行中不应包含换行符
  const storyRow = content.split("\n").find((line) => line.includes("故事一")) ?? ""
  assert.ok(storyRow, "表格行应存在")
  assert.ok(!storyRow.includes("\n"), "表格行不应包含换行")
  assert.strictEqual(
    storyRow,
    "| 01 | [故事一](./01-故事一) | 原创 | 约 3 千字 | 连载中 | 这是一个跨行的简介。 第二行内容继续。 第三行结束。 |",
    "换行应被折叠为空格",
  )
})

test("generateRootReadme 简介含管道符时正确转义", () => {
  const dir = setupTempDir()
  const pipeSummary = "包含 | 管道符的简介"
  generateRootReadme(dir, [{ ...sampleStories[0], summary: pipeSummary }])

  const content = fs.readFileSync(path.join(dir, "README.md"), "utf-8")
  const storyRow = content.split("\n").find((line) => line.includes("故事一")) ?? ""
  assert.ok(storyRow, "表格行应存在")
  assert.ok(storyRow.includes("包含 \\| 管道符的简介"), "管道符应被转义")
  const pipes = (storyRow.match(/\|/g) || []).length
  assert.strictEqual(pipes, 8, "表格行应有 8 个管道符（7 个表格分隔 + 1 个转义管道符）")
})

test("generateRootReadme 超长简介正确截断", () => {
  const dir = setupTempDir()
  const longSummary = `这是一段非常长的简介，${"内容重复。".repeat(50)}` // 远超 120 字符
  generateRootReadme(dir, [{ ...sampleStories[0], summary: longSummary }])

  const content = fs.readFileSync(path.join(dir, "README.md"), "utf-8")
  const storyRow = content.split("\n").find((line) => line.includes("故事一")) ?? ""
  assert.ok(storyRow, "表格行应存在")
  assert.ok(storyRow.includes("..."), "超长简介应添加省略号")
})

test("generateRootReadme 反引号不转为 HTML 实体", () => {
  const dir = setupTempDir()
  generateRootReadme(dir, sampleStories)

  const content = fs.readFileSync(path.join(dir, "README.md"), "utf-8")
  // 根 README 中应包含原始反引号，而不是 &#x60; 实体
  assert.ok(!content.includes("&#x60;"), "不应该出现 &#x60; HTML 实体")
  assert.ok(content.includes("`text.md`"), "应保留原始反引号")
  assert.ok(content.includes("`NN-故事名/`"), "如何新增故事步骤中应保留反引号")
  assert.ok(content.includes("`config.json`"), "如何新增故事步骤中应保留反引号")
  assert.ok(content.includes("`pnpm build`"), "如何新增故事步骤中应保留反引号")
})

test("generateRootReadme 锚点前后有空行", () => {
  const dir = setupTempDir()
  fs.mkdirSync(path.join(dir, "assets", "sponsor"), { recursive: true })
  fs.writeFileSync(path.join(dir, "assets", "sponsor", "码.png"), "fake-image-data")
  generateRootReadme(dir, sampleStories)

  const content = fs.readFileSync(path.join(dir, "README.md"), "utf-8")
  const lines = content.split("\n")

  // 检查所有 <a id=...> 锚点前一行是空行
  for (const line of lines) {
    const anchorMatch = line.match(/^<a id="([^"]+)"><\/a>$/)
    if (anchorMatch) {
      const lineIdx = lines.indexOf(line)
      assert.ok(lineIdx > 0, `${anchorMatch[1]} 锚点不应在第一行`)
      assert.strictEqual(lines[lineIdx - 1].trim(), "", `${anchorMatch[1]} 锚点前应为空行`)
    }
  }

  // 检查 "自动生成" 行使用 * 而不是 _
  const autoGenLine = lines.find((l) => l.includes("本 README 由脚本自动生成")) ?? ""
  assert.ok(autoGenLine, "应找到自动生成行")
  assert.ok(autoGenLine.startsWith("*"), "自动生成行应以 * 开头")
  assert.ok(autoGenLine.endsWith("*"), "自动生成行应以 * 结尾")
  assert.ok(!autoGenLine.includes("_"), "自动生成行不应包含下划线")
})
