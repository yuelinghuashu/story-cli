import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { after, test } from "node:test"
import {
  checkDuplicateNumbers,
  extractChapters,
  getSponsorImages,
  isIgnored,
  loadStoryIgnore,
  mergeChapters,
  parseIgnoreRules,
  readStoryText,
  resolveRawWordCount,
  resolveWordCount,
  scanStoryFolders,
  splitContentByChapters,
} from "../src/core/scanner.ts"

/** 创建的临时目录列表（测试结束后统一清理） */
const tempDirs: string[] = []

function setupTempDir(structure: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-test-"))
  tempDirs.push(dir)
  for (const [relPath, content] of Object.entries(structure)) {
    const fullPath = path.join(dir, relPath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, "utf-8")
  }
  return dir
}

// 测试结束后递归清理所有临时目录
after(() => {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      // 清理失败静默忽略
    }
  }
})

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
  // 数值序排序：数字前缀升序（12 < 100）
  assert.deepStrictEqual(folders, ["01-故事", "12-短文", "100-小说"])
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

test("readStoryText 单个章节文件不可读时跳过（与异步版本一致）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-test-"))
  tempDirs.push(dir)
  fs.writeFileSync(path.join(dir, "chapter-1.md"), "# 第一章\n\n可读内容。", "utf-8")
  // 坏链接：指向不存在目标，读取会抛 ENOENT
  fs.symlinkSync(path.join(dir, "nonexistent-target.md"), path.join(dir, "chapter-2.md"))

  const { content, merged } = readStoryText(dir)
  assert.strictEqual(merged, true, "仍有可读章节，应合并")
  assert.ok(content.includes("第一章"), "可读章节内容应保留")
  assert.ok(content.includes("可读内容"))
  assert.ok(!content.includes("chapter-2"), "不可读章节应被跳过而非导致整个合并失败")
})

test("readStoryText 全部章节不可读时返回空内容而非抛错", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-test-"))
  tempDirs.push(dir)
  // 坏链接目录：指向不存在目标
  fs.symlinkSync(path.join(dir, "nonexistent.md"), path.join(dir, "chapter-1.md"))

  // 不应抛错（修复前同步版本会因 readFileSync 失败而抛异常终止）
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

第一幕内容。

## 一、信号

第一章内容。

## 二、觉醒

第二章内容。

# 第二幕：进化

第二幕内容。

## 三、决战

第三章内容。`
  const chapters = extractChapters(content)
  // 所有章节都有实际内容，应全部保留
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

test("extractChapters 空章节（标题后无内容）被跳过", () => {
  // 模拟「# 书名\n\n## 第一章」的模式——标题后紧跟下一个标题
  const content = `# 《兄与弟》

## 【开场】

*黑屏。*

这是正文内容。

## 【第一章·信】

他走了七年。`
  const chapters = extractChapters(content)
  // 空章节《兄与弟》应被跳过，只保留有实际内容的章节
  assert.strictEqual(chapters.length, 2)
  assert.strictEqual(chapters[0].title, "【开场】")
  assert.strictEqual(chapters[1].title, "【第一章·信】")
  // 不应出现「字数待补充」
  for (const c of chapters) {
    assert.ok(!c.wordCount.includes("待补充"), `${c.title} 不应显示字数待补充`)
  }
})

test("splitContentByChapters 空章节（标题后无内容）被跳过", () => {
  const content = `# 《书名》

## 第一章

正文章节内容。`
  const sections = splitContentByChapters(content)
  assert.strictEqual(sections.length, 1)
  assert.strictEqual(sections[0].title, "第一章")
  assert.ok(sections[0].content.includes("正文章节内容。"))
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

// ---- 纯函数 parseIgnoreRules 测试 ----

test("parseIgnoreRules 解析注释、空行和规则", () => {
  const rules = parseIgnoreRules(`# 草稿目录

_draft/
*~
`)
  assert.strictEqual(rules.length, 2)
  assert.strictEqual(rules[0].pattern, "_draft")
  assert.strictEqual(rules[0].isDirOnly, true)
  assert.strictEqual(rules[1].pattern, "*~")
  assert.strictEqual(rules[1].isDirOnly, false)
})

test("parseIgnoreRules 空内容返回空数组", () => {
  assert.deepStrictEqual(parseIgnoreRules(""), [])
  assert.deepStrictEqual(parseIgnoreRules("# 只有注释"), [])
  assert.deepStrictEqual(parseIgnoreRules("\n\n"), [])
})

test("parseIgnoreRules 目录规则末尾 / 被去除", () => {
  const rules = parseIgnoreRules("_notes/\n")
  assert.strictEqual(rules.length, 1)
  assert.strictEqual(rules[0].pattern, "_notes")
  assert.strictEqual(rules[0].isDirOnly, true)
})

test("parseIgnoreRules 通配符转正则正确", () => {
  const rules = parseIgnoreRules("*.tmp\n")
  assert.strictEqual(rules.length, 1)
  // * 不应跨目录分隔符
  assert.ok(rules[0].regex.test("file.tmp"))
  assert.ok(!rules[0].regex.test("dir/file.tmp"))
})

// ---- 纯函数 mergeChapters 测试 ----

test("mergeChapters 合并多章节", () => {
  const files = [
    { name: "chapter-1-开场.md", content: "# 开场\n\n第一章内容。" },
    { name: "chapter-2-发展.md", content: "# 发展\n\n第二章内容。" },
  ]
  const result = mergeChapters(files)
  assert.ok(result.includes("# 开场"))
  assert.ok(result.includes("第一章内容。"))
  assert.ok(result.includes("# 发展"))
  assert.ok(result.includes("第二章内容。"))
  assert.ok(result.includes("---"))
})

test("mergeChapters 跳过空内容", () => {
  const files = [
    { name: "chapter-1.md", content: "# 第一章\n\n内容。" },
    { name: "chapter-2.md", content: "   " },
  ]
  const result = mergeChapters(files)
  assert.ok(result.includes("# 第一章"))
  assert.ok(!result.includes("chapter-2"))
})

test("mergeChapters 无标题时回退文件名", () => {
  const files = [{ name: "chapter-01.md", content: "没有标题的正文。" }]
  const result = mergeChapters(files)
  assert.ok(result.includes("# chapter-01"))
  assert.ok(result.includes("没有标题的正文。"))
})

test("mergeChapters 空输入返回空字符串", () => {
  assert.strictEqual(mergeChapters([]), "")
  assert.strictEqual(mergeChapters([{ name: "a.md", content: "" }]), "")
})

// ---- .storyignore 测试 ----

test("loadStoryIgnore 无 .storyignore 文件时返回空数组", () => {
  const dir = setupTempDir({})
  assert.deepStrictEqual(loadStoryIgnore(dir), [])
})

test("loadStoryIgnore 解析注释和空行", () => {
  const dir = setupTempDir({
    ".storyignore": `# 草稿目录

_draft/
*~
`,
  })
  const rules = loadStoryIgnore(dir)
  assert.strictEqual(rules.length, 2)
  assert.strictEqual(rules[0].pattern, "_draft")
  assert.strictEqual(rules[0].isDirOnly, true)
  assert.strictEqual(rules[1].pattern, "*~")
  assert.strictEqual(rules[1].isDirOnly, false)
})

test("loadStoryIgnore 目录规则末尾 / 被去除", () => {
  const dir = setupTempDir({ ".storyignore": "_notes/\n" })
  const rules = loadStoryIgnore(dir)
  assert.strictEqual(rules.length, 1)
  assert.strictEqual(rules[0].pattern, "_notes")
  assert.strictEqual(rules[0].isDirOnly, true)
})

test("isIgnored 精确匹配目录名", () => {
  const dir = setupTempDir({ ".storyignore": "_draft/\n" })
  const rules = loadStoryIgnore(dir)
  assert.strictEqual(isIgnored("_draft", true, rules), true)
  // 目录规则不匹配同名文件（isDir=false）
  assert.strictEqual(isIgnored("_draft", false, rules), false)
  assert.strictEqual(isIgnored("01-故事", true, rules), false)
})

test("isIgnored 通配符匹配", () => {
  const dir = setupTempDir({ ".storyignore": "*.tmp\n" })
  const rules = loadStoryIgnore(dir)
  assert.strictEqual(isIgnored("file.tmp", false, rules), true)
  assert.strictEqual(isIgnored("chapter-1~", false, rules), false)
  assert.strictEqual(isIgnored("story.md", false, rules), false)
})

test("scanStoryFolders 应用 .storyignore 排除目录", () => {
  const dir = setupTempDir({
    "01-故事/config.json": "{}",
    "02-小说/config.json": "{}",
    "_draft/config.json": "{}",
    ".storyignore": "_draft/\n",
  })
  const folders = scanStoryFolders(dir)
  assert.deepStrictEqual(folders, ["01-故事", "02-小说"])
})

test("scanStoryFolders .storyignore 不存在时行为不变", () => {
  const dir = setupTempDir({
    "01-故事/config.json": "{}",
    "02-草稿/config.json": "{}",
  })
  const folders = scanStoryFolders(dir)
  assert.deepStrictEqual(folders, ["01-故事", "02-草稿"])
})

test("scanStoryFolders .storyignore 支持通配符排除", () => {
  const dir = setupTempDir({
    "01-故事/config.json": "{}",
    "99-番外-草稿/config.json": "{}",
    ".storyignore": "*-草稿/\n",
  })
  const folders = scanStoryFolders(dir)
  assert.deepStrictEqual(folders, ["01-故事"])
})
