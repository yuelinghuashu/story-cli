import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import {
  checkDuplicateNumbers,
  extractChapters,
  getSponsorImages,
  readStoryText,
  resolveRawWordCount,
  resolveWordCount,
  scanStoryFolders,
  splitContentByChapters,
} from "../src/core/scanner.ts"

function setupTempDir(structure: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-test-"))
  for (const [relPath, content] of Object.entries(structure)) {
    const fullPath = path.join(dir, relPath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, "utf-8")
  }
  return dir
}

test("scanStoryFolders 只扫描数字前缀目录", () => {
  const dir = setupTempDir({
    "01-故事/config.json": "{}",
    "02-小说/config.json": "{}",
    "README.md": "# test",
    "assets/a.jpg": "xx",
    "scripts/x.js": "// x",
    "dist/bundle.js": "// bundle",
  })
  const folders = scanStoryFolders(dir)
  assert.deepStrictEqual(folders, ["01-故事", "02-小说"])
})

test("scanStoryFolders 至少两位数字前缀目录", () => {
  const dir = setupTempDir({
    "01-故事/config.json": "{}",
    "5-故事/config.json": "{}", // 一位数字，不应被扫描
    "100-小说/config.json": "{}",
    "12-短文/config.json": "{}",
  })
  const folders = scanStoryFolders(dir)
  // 字典序排序：字符串比较中 "100" < "12"（因为 "0" < "2"）
  assert.deepStrictEqual(folders, ["01-故事", "100-小说", "12-短文"])
})

test("scanStoryFolders 排除基础设施目录但不排除用户自定义目录", () => {
  const dir = setupTempDir({
    "01-故事/config.json": "{}",
    "02-tests/config.json": "{}", // 用户故事目录，不应被排除
    "03-docs/config.json": "{}",
    "node_modules/pkg/index.js": "// x",
  })
  const folders = scanStoryFolders(dir)
  assert.deepStrictEqual(folders, ["01-故事", "02-tests", "03-docs"])
})

test("checkDuplicateNumbers 检测序号重复", () => {
  const dir = setupTempDir({
    "01-故事A/config.json": "{}",
    "01-故事B/config.json": "{}",
    "02-故事C/config.json": "{}",
  })
  const duplicates = checkDuplicateNumbers(dir)
  assert.deepStrictEqual(duplicates, ["01"])
})

test("checkDuplicateNumbers 无重复时返回空数组", () => {
  const dir = setupTempDir({
    "01-故事A/config.json": "{}",
    "02-故事B/config.json": "{}",
    "03-故事C/config.json": "{}",
  })
  const duplicates = checkDuplicateNumbers(dir)
  assert.deepStrictEqual(duplicates, [])
})

test("readStoryText 优先使用 text.md", () => {
  const dir = setupTempDir({
    "text.md": "这是完整正文。",
    "chapter-1.md": "第一章",
  })
  const { content, merged } = readStoryText(dir)
  assert.strictEqual(content, "这是完整正文。")
  assert.strictEqual(merged, false)
})

test("readStoryText 无 text.md 时合并 chapter 文件", () => {
  const dir = setupTempDir({
    "chapter-1-开场.md": "# 开场\n\n第一章内容。",
    "chapter-2-发展.md": "# 发展\n\n第二章内容。",
  })
  const { content, merged } = readStoryText(dir)
  assert.strictEqual(merged, true)
  assert.ok(content.includes("# 开场"))
  assert.ok(content.includes("第一章内容。"))
  assert.ok(content.includes("# 发展"))
  assert.ok(content.includes("第二章内容。"))
  assert.ok(content.includes("---"))
})

test("readStoryText 无任何正文文件", () => {
  const dir = setupTempDir({ "config.json": "{}" })
  const { content, merged } = readStoryText(dir)
  assert.strictEqual(content, "")
  assert.strictEqual(merged, false)
})

test("resolveWordCount 优先使用配置中的字数", () => {
  const result = resolveWordCount({ wordCount: "约 10 千字" }, "一些内容内容")
  assert.strictEqual(result, "约 10 千字")
})

test("resolveWordCount 无配置时自动计算", () => {
  const result = resolveWordCount({}, "你好世界")
  assert.strictEqual(result, "约 4 字")
})

test("resolveRawWordCount 返回原始字符数", () => {
  assert.strictEqual(resolveRawWordCount("你好世界"), 4)
  assert.strictEqual(resolveRawWordCount(""), 0)
  assert.strictEqual(resolveRawWordCount("Hello, 世界!"), 2)
})

test("extractChapters 提取 # 和 ## 标题及字数", () => {
  const content = `# 第一幕：种子

## 一、信号

第一章内容。

## 二、觉醒

第二章内容。

# 第二幕：进化

## 三、决战

第三章内容。`
  const chapters = extractChapters(content)
  assert.strictEqual(chapters.length, 5)
  assert.strictEqual(chapters[0].title, "第一幕：种子")
  assert.ok(chapters[0].wordCount.includes("字"))
  assert.strictEqual(chapters[1].title, "一、信号")
  assert.strictEqual(chapters[4].title, "三、决战")
})

test("extractChapters 每章字数正确累计", () => {
  const content = `# 第一章

你好世界，这里是第一章的正文内容。

## 第二章

这是第二章的正文，字数应该比第一章少。`
  const chapters = extractChapters(content)
  assert.strictEqual(chapters.length, 2)
  assert.ok(chapters[0].wordCount.includes("千字") || chapters[0].wordCount.includes("字"))
  assert.ok(chapters[1].wordCount.includes("字"))
})

test("extractChapters 空内容返回空数组", () => {
  assert.deepStrictEqual(extractChapters(""), [])
  assert.deepStrictEqual(extractChapters("没有标题的纯文本"), [])
})

test("splitContentByChapters 按标题切分章节", () => {
  const content = `# 第一章

这是第一章的内容。

## 第一节

更多内容。

# 第二章

第二章的内容。`
  const sections = splitContentByChapters(content)
  assert.strictEqual(sections.length, 3)
  assert.strictEqual(sections[0].title, "第一章")
  assert.ok(sections[0].content.includes("这是第一章的内容。"))
  assert.strictEqual(sections[1].title, "第一节")
  assert.ok(sections[1].content.includes("更多内容。"))
  assert.strictEqual(sections[2].title, "第二章")
  assert.ok(sections[2].content.includes("第二章的内容。"))
})

test("splitContentByChapters 无标题时返回空数组", () => {
  assert.deepStrictEqual(splitContentByChapters("纯文本没有标题"), [])
  assert.deepStrictEqual(splitContentByChapters(""), [])
})

test("splitContentByChapters 标题前的内容被忽略（保持与旧行为一致）", () => {
  const content = `前言内容\n\n# 第一章\n\n正文。`
  const sections = splitContentByChapters(content)
  assert.strictEqual(sections.length, 1)
  assert.strictEqual(sections[0].title, "第一章")
  assert.ok(sections[0].content.includes("正文。"))
})

test("getSponsorImages 无 assets/sponsor/ 目录时返回空数组", () => {
  const dir = setupTempDir({})
  assert.deepStrictEqual(getSponsorImages(dir), [])
})

test("getSponsorImages 读取 assets/sponsor/ 中的图片", () => {
  const dir = setupTempDir({
    "assets/sponsor/ali-pay.jpg": "xx",
    "assets/sponsor/wechat-pay.png": "yy",
    "assets/sponsor/note.txt": "not image",
  })
  const images = getSponsorImages(dir)
  // 只包含图片格式，且路径以 assets/sponsor/ 开头
  assert.ok(images.includes("assets/sponsor/ali-pay.jpg"))
  assert.ok(images.includes("assets/sponsor/wechat-pay.png"))
  assert.ok(!images.some((f) => f.includes("note.txt")), "非图片文件应被过滤")
})

test("getSponsorImages 支持多种图片格式", () => {
  const dir = setupTempDir({
    "assets/sponsor/a.jpeg": "1",
    "assets/sponsor/b.gif": "2",
    "assets/sponsor/c.webp": "3",
    "assets/sponsor/d.bmp": "4",
  })
  const images = getSponsorImages(dir)
  assert.strictEqual(images.length, 4)
})

test("getSponsorImages 空 sponsor 目录返回空数组", () => {
  const dir = setupTempDir({ "assets/sponsor/.gitkeep": "" })
  const images = getSponsorImages(dir)
  assert.deepStrictEqual(images, [])
})
