import assert from "node:assert"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"
import { cleanupTempDirs } from "./helpers.ts"

const binPath = fileURLToPath(new URL("../bin/index.ts", import.meta.url))

// 测试结束后清理本文件创建的所有临时目录（精确前缀匹配，避免误删其他测试文件的目录）
after(() => {
  cleanupTempDirs([
    "cli-test-",
    "cli-demo-test-",
    "cli-txt-multi-",
    "cli-json-",
    "cli-md-",
    "cli-md-stdout-",
    "cli-txt-stdout-",
    "cli-sort-test-",
    "cli-fractional-test-",
    "cli-series-info-test-",
    "cli-rename-test-",
  ])
})

/** 运行 CLI 并返回 stdout + stderr 合并输出 */
function runCli(args: string[], cwd: string): string {
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    encoding: "utf-8",
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || `Command failed with code ${result.status}`)
  }
  return `${result.stdout || ""}${result.stderr || ""}`
}

test("story version 输出版本号", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const stdout = runCli(["version"], dir)
  assert.match(stdout, /^story-cli \d+\.\d+\.\d+/)
})

test("story help 输出帮助信息", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const stdout = runCli(["help"], dir)
  assert.ok(stdout.includes("Usage:"))
  assert.ok(stdout.includes("story build"))
})

test("story build --validate-only 不生成 text.md（无副作用）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const storyDir = path.join(dir, "01-测试故事")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify(
      {
        title: "测试故事",
        type: "original",
        status: "completed",
        summary: "一个测试故事。",
        created: "2026-01-01",
      },
      null,
      2,
    ),
    "utf-8",
  )
  // 只有 chapter 文件，没有 text.md
  fs.writeFileSync(path.join(storyDir, "chapter-1.md"), "# 第一章\n\n你好世界，这是测试内容。", "utf-8")

  // 运行 validate-only 模式
  runCli(["build", "--validate-only"], dir)

  // validate-only 不应生成 text.md
  assert.ok(!fs.existsSync(path.join(storyDir, "text.md")), "validate-only 模式不应写入 text.md")
  // 不应生成 README.md
  assert.ok(!fs.existsSync(path.join(storyDir, "README.md")), "validate-only 模式不应生成 README.md")
  assert.ok(!fs.existsSync(path.join(dir, "README.md")), "validate-only 模式不应生成根 README.md")
})

test("story build --save-counts 持久化字数", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const storyDir = path.join(dir, "01-测试故事")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify(
      {
        title: "测试故事",
        type: "original",
        status: "completed",
        summary: "一个测试故事。",
        created: "2026-01-01",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 开始\n\n你好世界，这是测试内容。", "utf-8")

  // 先验证 build 不会写回 wordCount
  runCli(["build"], dir)
  let config = JSON.parse(fs.readFileSync(path.join(storyDir, "config.json"), "utf-8"))
  assert.strictEqual(config.wordCount, undefined)

  // 再验证 --save-counts 会写回
  runCli(["build", "--save-counts"], dir)
  config = JSON.parse(fs.readFileSync(path.join(storyDir, "config.json"), "utf-8"))
  assert.ok(typeof config.wordCount === "string" && config.wordCount.length > 0)
})

test("story init 创建模板文件和目录结构", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  runCli(["init"], dir)

  // 4 个模板文件
  assert.ok(fs.existsSync(path.join(dir, "config.original.json")))
  assert.ok(fs.existsSync(path.join(dir, "config.fanfic.json")))
  assert.ok(fs.existsSync(path.join(dir, "story-template.md")))
  assert.ok(fs.existsSync(path.join(dir, "story.config.json")))

  // 默认生成的仓库文件
  assert.ok(fs.existsSync(path.join(dir, ".gitignore")), "默认应生成 .gitignore")
  assert.ok(fs.existsSync(path.join(dir, ".storyignore")), "默认应生成 .storyignore")
  assert.ok(fs.existsSync(path.join(dir, "Makefile")), "默认应生成 Makefile")
  assert.ok(fs.existsSync(path.join(dir, "README.md")), "默认应生成 README.md")

  // 约定目录结构
  assert.ok(fs.existsSync(path.join(dir, "assets")))
  assert.ok(fs.existsSync(path.join(dir, "assets", "sponsor")))
  assert.ok(fs.existsSync(path.join(dir, "assets", "sponsor", "README.md")))
  assert.ok(fs.existsSync(path.join(dir, "assets", "sponsor", ".gitkeep")))
})

test("项目根目录 Makefile 存在且包含开发工作流", () => {
  // 项目根目录的 Makefile（开发工作流）应该存在
  const rootDir = fileURLToPath(new URL("..", import.meta.url))
  const makefilePath = path.join(rootDir, "Makefile")
  assert.ok(fs.existsSync(makefilePath), "项目根目录应存在 Makefile")

  const makefile = fs.readFileSync(makefilePath, "utf-8")
  // 应包含开发工作流 target
  assert.ok(makefile.includes("help"), "应包含 help target")
  assert.ok(makefile.includes("build"), "应包含 build target")
  assert.ok(makefile.includes("test"), "应包含 test target")
  assert.ok(makefile.includes("typecheck"), "应包含 typecheck target")
  assert.ok(makefile.includes("lint"), "应包含 lint target")
  assert.ok(makefile.includes("pnpm"), "应使用 pnpm 命令")
})

test("story init 生成的 Makefile 包含工作流入口", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const stdout = runCli(["init"], dir)

  const makefile = fs.readFileSync(path.join(dir, "Makefile"), "utf-8")
  // 应包含核心 target
  assert.ok(makefile.includes("help"), "应包含 help target")
  assert.ok(makefile.includes("new"), "应包含 new target")
  assert.ok(makefile.includes("build"), "应包含 build target")
  assert.ok(makefile.includes("commit"), "应包含 commit target")
  assert.ok(makefile.includes("push"), "应包含 push target")
  assert.ok(makefile.includes("stats"), "应包含 stats target")
  assert.ok(makefile.includes("story"), "应包含 story 命令")

  // 应输出 alias 快速入口建议
  assert.ok(stdout.includes("快速入口"), "应提示 alias 快速入口")
  assert.ok(stdout.includes("alias sm="), "应包含 alias 示例")
})

test("story init 不覆盖已存在的 Makefile", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  // 用户已有自定义 Makefile
  const custom = "# custom makefile\n"
  fs.writeFileSync(path.join(dir, "Makefile"), custom, "utf-8")

  runCli(["init"], dir)

  assert.strictEqual(fs.readFileSync(path.join(dir, "Makefile"), "utf-8"), custom, "不应覆盖用户文件")
})

test("story demo 生成包含 Makefile 的示例仓库", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-demo-test-"))
  runCli(["demo"], dir)

  assert.ok(fs.existsSync(path.join(dir, "Makefile")), "demo 应生成 Makefile")
})

test("story init --full 额外生成 LICENSE/docs/CHANGELOG", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  runCli(["init", "--full"], dir)

  // 默认文件也应生成
  assert.ok(fs.existsSync(path.join(dir, "config.original.json")))
  assert.ok(fs.existsSync(path.join(dir, ".gitignore")))
  assert.ok(fs.existsSync(path.join(dir, ".storyignore")))
  assert.ok(fs.existsSync(path.join(dir, "README.md")))

  // --full 额外生成
  assert.ok(fs.existsSync(path.join(dir, "LICENSE")), "--full 应生成 LICENSE")
  assert.ok(fs.existsSync(path.join(dir, "CHANGELOG.md")), "--full 应生成 CHANGELOG.md")
  assert.ok(fs.existsSync(path.join(dir, "docs", "add-story.md")), "--full 应生成 docs/add-story.md")

  // LICENSE 包含 CC BY-NC-SA
  const license = fs.readFileSync(path.join(dir, "LICENSE"), "utf-8")
  assert.ok(license.includes("CC BY-NC-SA 4.0"))
})

test("story init 已存在的模板文件不被覆盖", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  fs.mkdirSync(dir, { recursive: true })

  // 用户已有的自定义配置不应被覆盖
  const customContent = JSON.stringify({ custom: true, userOwned: true }, null, 2)
  fs.writeFileSync(path.join(dir, "story.config.json"), customContent, "utf-8")
  fs.writeFileSync(path.join(dir, "config.original.json"), "custom-original", "utf-8")

  // 运行 init 后，用户文件内容应保持不变
  const stdout = runCli(["init"], dir)
  assert.strictEqual(fs.readFileSync(path.join(dir, "story.config.json"), "utf-8"), customContent)
  assert.strictEqual(fs.readFileSync(path.join(dir, "config.original.json"), "utf-8"), "custom-original")
  // 未存在的文件应正常生成
  assert.ok(fs.existsSync(path.join(dir, "config.fanfic.json")))
  assert.ok(fs.existsSync(path.join(dir, "story-template.md")))
  // 应输出跳过提示
  assert.ok(stdout.includes("Skipped existing files"))
})

test("story new 创建故事脚手架", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  runCli(["new", "我的新故事"], dir)

  const storyDir = path.join(dir, "01-我的新故事")
  assert.ok(fs.existsSync(storyDir))
  assert.ok(fs.existsSync(path.join(storyDir, "config.json")))
  assert.ok(fs.existsSync(path.join(storyDir, "text.md")))

  const config = JSON.parse(fs.readFileSync(path.join(storyDir, "config.json"), "utf-8"))
  assert.strictEqual(config.title, "我的新故事")
  assert.strictEqual(config.type, "original")
})

test("story export html 导出静态站点", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const storyDir = path.join(dir, "01-测试故事")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify(
      {
        title: "测试故事",
        type: "original",
        status: "completed",
        summary: "一个测试故事。",
        created: "2026-01-01",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n正文内容。", "utf-8")

  runCli(["export", "html"], dir)

  assert.ok(fs.existsSync(path.join(dir, "dist", "html", "index.html")))
  assert.ok(fs.existsSync(path.join(dir, "dist", "html", "01-测试故事.html")))
})

test("story export 无子命令时报错并给出用法", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  // 本地 runCli 对非零状态会抛异常，这里直接用 spawnSync 捕获退出码
  const result = spawnSync(process.execPath, [binPath, "export"], { cwd: dir, encoding: "utf-8" })
  const output = `${result.stdout || ""}${result.stderr || ""}`
  assert.notStrictEqual(result.status, 0, "无子命令的 export 应返回非零退出码")
  assert.ok(output.includes("Unknown export subcommand"), "应提示未知子命令")
  assert.ok(output.includes("html"), "应列出可用的子命令")
})

test("story export 未知子命令时报错", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const result = spawnSync(process.execPath, [binPath, "export", "pdf"], { cwd: dir, encoding: "utf-8" })
  const output = `${result.stdout || ""}${result.stderr || ""}`
  assert.notStrictEqual(result.status, 0, "未知子命令应返回非零退出码")
  assert.ok(output.includes("Unknown export subcommand"), "应提示未知子命令")
})

test("story export txt 导出纯文本", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const storyDir = path.join(dir, "01-测试故事")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify(
      {
        title: "测试故事",
        type: "original",
        status: "completed",
        summary: "一个测试故事。",
        created: "2026-01-01",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n正文内容。", "utf-8")

  runCli(["export", "txt"], dir)

  // 生成以标题命名的 .txt 文件
  assert.ok(fs.existsSync(path.join(dir, "dist", "txt", "测试故事.txt")))
  // 内容与原 text.md 一致
  const content = fs.readFileSync(path.join(dir, "dist", "txt", "测试故事.txt"), "utf-8")
  assert.ok(content.includes("正文内容"))
})

test("story export txt 多故事导出（中英混合）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-txt-multi-"))

  // 中文故事
  const cnDir = path.join(dir, "01-中文故事")
  fs.mkdirSync(cnDir, { recursive: true })
  fs.writeFileSync(
    path.join(cnDir, "config.json"),
    JSON.stringify(
      {
        title: "中文故事",
        type: "original",
        status: "completed",
        summary: "一个中文故事。",
        created: "2026-01-01",
        language: "zh",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(cnDir, "text.md"), "# 第一回\n\n这里是中文正文内容。", "utf-8")

  // 英文故事
  const enDir = path.join(dir, "02-english-story")
  fs.mkdirSync(enDir, { recursive: true })
  fs.writeFileSync(
    path.join(enDir, "config.json"),
    JSON.stringify(
      {
        title: "English Story",
        type: "original",
        status: "ongoing",
        summary: "An English story.",
        created: "2026-01-01",
        language: "en",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(enDir, "text.md"), "# Chapter 1\n\nThis is English content.", "utf-8")

  runCli(["export", "txt"], dir)

  // 两个故事都生成 .txt 文件
  const cnPath = path.join(dir, "dist", "txt", "中文故事.txt")
  const enPath = path.join(dir, "dist", "txt", "English Story.txt")
  assert.ok(fs.existsSync(cnPath), "中文故事文件应存在")
  assert.ok(fs.existsSync(enPath), "英文故事文件应存在")

  // 内容各自独立且正确
  const cnContent = fs.readFileSync(cnPath, "utf-8")
  assert.ok(cnContent.includes("这里是中文正文内容"))
  assert.ok(!cnContent.includes("English"))

  const enContent = fs.readFileSync(enPath, "utf-8")
  assert.ok(enContent.includes("This is English content"))
  assert.ok(!enContent.includes("中文正文"))
})

test("story export json 导出结构化数据", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-json-"))
  const storyDir = path.join(dir, "01-测试故事")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify(
      {
        title: "测试故事",
        type: "original",
        status: "completed",
        summary: "一个测试故事。",
        created: "2026-01-01",
        series: "测试系列",
        seriesOrder: 1,
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(
    path.join(storyDir, "text.md"),
    "# 第一章\n\n你好世界，这是测试内容。\n\n# 第二章\n\n第二段测试内容。",
    "utf-8",
  )

  runCli(["export", "json"], dir)

  // JSON 文件存在
  const jsonPath = path.join(dir, "dist", "json", "stories.json")
  assert.ok(fs.existsSync(jsonPath), "stories.json 应被生成")

  // 解析 JSON 并验证结构
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"))
  assert.strictEqual(data.storyCount, 1)
  assert.strictEqual(data.stories.length, 1)
  const story = data.stories[0]
  assert.strictEqual(story.title, "测试故事")
  assert.strictEqual(story.type, "original")
  assert.strictEqual(story.status, "completed")
  assert.strictEqual(story.series, "测试系列")
  assert.strictEqual(story.seriesOrder, 1)
  assert.strictEqual(story.chapters.length, 2, "应提取出两个章节")
  assert.strictEqual(story.chapters[0].title, "第一章")
  assert.ok(story.chapters[0].content.includes("你好世界"))
  assert.strictEqual(story.chapters[1].title, "第二章")
  assert.ok(story.chapters[1].content.includes("第二段"))
  assert.ok(story.wordCount.length > 0, "wordCount 应为格式化字符串（如 约 X 字）")
  assert.ok(!story.wordCount.includes("待补充"), "wordCount 不应为待补充状态")
})

test("story export md 导出合并 Markdown（含 YAML Frontmatter）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-md-"))
  const storyDir = path.join(dir, "01-测试故事")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify(
      {
        title: "测试故事",
        type: "original",
        status: "ongoing",
        language: "zh",
        summary: "一个测试故事。",
        created: "2026-01-01",
        author: "作者名",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n这是正文内容。", "utf-8")

  runCli(["export", "md"], dir)

  // 合并 Markdown 文件存在
  const mdPath = path.join(dir, "dist", "md", "测试故事.md")
  assert.ok(fs.existsSync(mdPath), "合并 Markdown 文件应被生成")

  const content = fs.readFileSync(mdPath, "utf-8")
  // YAML Frontmatter
  assert.ok(content.startsWith("---"), "应以 YAML Frontmatter 开头")
  assert.ok(content.includes('title: "测试故事"'), "应包含标题元数据")
  assert.ok(content.includes('type: "original"'), "应包含类型元数据")
  assert.ok(content.includes('author: "作者名"'), "应包含作者元数据")
  assert.ok(content.includes('language: "zh"'), "应包含语言元数据")
  // 正文内容
  assert.ok(content.includes("# 第一章"), "应包含正文章节标题")
  assert.ok(content.includes("这是正文内容。"), "应包含正文内容")
})

test("story export md --stdout 输出管道友好的合并 Markdown", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-md-stdout-"))

  // 创建两个故事，验证分隔符与多故事输出
  const storyDirA = path.join(dir, "01-故事A")
  fs.mkdirSync(storyDirA, { recursive: true })
  fs.writeFileSync(
    path.join(storyDirA, "config.json"),
    JSON.stringify(
      {
        title: "故事A",
        type: "original",
        status: "ongoing",
        language: "zh",
        summary: "故事A的简介。",
        created: "2026-01-01",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDirA, "text.md"), "# 第一章\n\n故事A正文内容。", "utf-8")

  const storyDirB = path.join(dir, "02-故事B")
  fs.mkdirSync(storyDirB, { recursive: true })
  fs.writeFileSync(
    path.join(storyDirB, "config.json"),
    JSON.stringify(
      {
        title: "故事B",
        type: "original",
        status: "completed",
        language: "zh",
        summary: "故事B的简介。",
        created: "2026-01-01",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDirB, "text.md"), "# 第一章\n\n故事B正文内容。", "utf-8")

  const stdout = runCli(["export", "md", "--stdout"], dir)

  // 应包含两个故事的 Frontmatter 和正文
  assert.ok(stdout.includes('title: "故事A"'), "应包含故事A的标题元数据")
  assert.ok(stdout.includes('title: "故事B"'), "应包含故事B的标题元数据")
  assert.ok(stdout.includes("故事A正文内容"), "应包含故事A正文")
  assert.ok(stdout.includes("故事B正文内容"), "应包含故事B正文")
  // 应包含分隔符
  assert.ok(stdout.includes("<!-- story-separator -->"), "多故事应使用分隔符连接")
  // 不应创建输出目录（--stdout 不落盘）
  assert.ok(!fs.existsSync(path.join(dir, "dist", "md")), "--stdout 模式不应创建 dist/md 目录")
})

test("story export txt --stdout 输出带标题行的纯文本", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-txt-stdout-"))

  // 创建两个故事，验证标题行 + 分隔符
  const storyDirA = path.join(dir, "01-故事A")
  fs.mkdirSync(storyDirA, { recursive: true })
  fs.writeFileSync(
    path.join(storyDirA, "config.json"),
    JSON.stringify(
      {
        title: "故事A",
        type: "original",
        status: "ongoing",
        language: "zh",
        summary: "故事A的简介。",
        created: "2026-01-01",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDirA, "text.md"), "# 第一章\n\n故事A正文内容。", "utf-8")

  const storyDirB = path.join(dir, "02-故事B")
  fs.mkdirSync(storyDirB, { recursive: true })
  fs.writeFileSync(
    path.join(storyDirB, "config.json"),
    JSON.stringify(
      {
        title: "故事B",
        type: "original",
        status: "completed",
        language: "zh",
        summary: "故事B的简介。",
        created: "2026-01-01",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDirB, "text.md"), "# 第一章\n\n故事B正文内容。", "utf-8")

  const stdout = runCli(["export", "txt", "--stdout"], dir)

  // 应包含标题行
  assert.ok(stdout.includes("================\n故事A\n================"), "应包含故事A的标题行")
  assert.ok(stdout.includes("================\n故事B\n================"), "应包含故事B的标题行")
  assert.ok(stdout.includes("故事A正文内容"), "应包含故事A正文")
  assert.ok(stdout.includes("故事B正文内容"), "应包含故事B正文")
  // 应包含分隔符（纯文本使用 = 号分隔，而非 HTML 注释）
  assert.ok(stdout.includes("\n\n====\n\n"), "多故事应使用 = 号分隔符连接")
  // 不应创建输出目录
  assert.ok(!fs.existsSync(path.join(dir, "dist", "txt")), "--stdout 模式不应创建 dist/txt 目录")
})

test("story epub --all 导出全部故事", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const storyDir = path.join(dir, "01-测试故事")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify(
      {
        title: "测试故事",
        type: "original",
        status: "completed",
        summary: "一个测试故事。",
        created: "2026-01-01",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 开始\n\n你好世界，这是测试内容。", "utf-8")

  runCli(["epub", "--all"], dir)

  const epubPath = path.join(dir, "dist", "epub", "测试故事.epub")
  assert.ok(fs.existsSync(epubPath))
})

test("story epub 导出带封面的故事", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const storyDir = path.join(dir, "01-带封面故事")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify(
      {
        title: "带封面故事",
        type: "original",
        status: "completed",
        summary: "有封面的故事。",
        created: "2026-01-01",
        cover: "cover.jpg",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n正文内容。", "utf-8")
  // 创建封面图片（最小 JPEG）
  fs.writeFileSync(path.join(storyDir, "cover.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "binary")

  runCli(["epub", "带封面故事"], dir)

  const epubPath = path.join(dir, "dist", "epub", "带封面故事.epub")
  assert.ok(fs.existsSync(epubPath))

  // 验证 EPUB 中包含封面
  const epubData = fs.readFileSync(epubPath)
  assert.ok(epubData.length > 0)
})

test("story epub 按 config.title 精确匹配（与文件夹名不一致时）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const storyDir = path.join(dir, "01-内部文件夹名")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify(
      {
        title: "用户看到的标题",
        type: "original",
        status: "completed",
        summary: "title 与文件夹名不一致的故事。",
        created: "2026-01-01",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n正文内容。", "utf-8")

  // 用 config.title 的值导出（用户从 README 看到的标题）
  runCli(["epub", "用户看到的标题"], dir)

  const epubPath = path.join(dir, "dist", "epub", "用户看到的标题.epub")
  assert.ok(fs.existsSync(epubPath), "应按 config.title 精确匹配并导出 EPUB")
})

test("story epub 文件夹名子串匹配有歧义时提示错误", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  // 创建两个文件夹名都包含"星河入梦"的故事
  const storyDirA = path.join(dir, "01-星河入梦")
  fs.mkdirSync(storyDirA, { recursive: true })
  fs.writeFileSync(
    path.join(storyDirA, "config.json"),
    JSON.stringify(
      {
        title: "星河入梦·上",
        type: "original",
        status: "completed",
        summary: "歧义测试 A。",
        created: "2026-01-01",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDirA, "text.md"), "# 第一章\n\n正文内容 A。", "utf-8")

  const storyDirB = path.join(dir, "02-星河入梦")
  fs.mkdirSync(storyDirB, { recursive: true })
  fs.writeFileSync(
    path.join(storyDirB, "config.json"),
    JSON.stringify(
      {
        title: "星河入梦·下",
        type: "original",
        status: "completed",
        summary: "歧义测试 B。",
        created: "2026-01-01",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDirB, "text.md"), "# 第一章\n\n正文内容 B。", "utf-8")

  // 运行 story epub "星河入梦" → 应报歧义错误（退出码非 0）
  const result = spawnSync(process.execPath, [binPath, "epub", "星河入梦"], {
    cwd: dir,
    encoding: "utf-8",
  })
  // 歧义匹配应失败（非 0 退出码）
  assert.notStrictEqual(result.status, 0, "歧义匹配应报错而不是静默导出第一个")
  assert.ok(result.stderr.includes("ambiguous match"), "应输出歧义错误消息")
  assert.ok(result.stderr.includes("01-星河入梦"), "歧义错误应列出第一个候选")
  assert.ok(result.stderr.includes("02-星河入梦"), "歧义错误应列出第二个候选")
})

test("story epub 按文件夹名子串匹配（向后兼容）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const storyDir = path.join(dir, "01-星河入梦")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify(
      {
        title: "另一个名字",
        type: "original",
        status: "completed",
        summary: "验证文件夹名匹配回退。",
        created: "2026-01-01",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n正文内容。", "utf-8")

  // 用文件夹名部分匹配（旧行为）
  runCli(["epub", "星河入梦"], dir)

  const epubPath = path.join(dir, "dist", "epub", "另一个名字.epub")
  assert.ok(fs.existsSync(epubPath), "应按文件夹名子串匹配回退并导出 EPUB")
})

test("story epub 封面图片不存在时警告但不失败", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const storyDir = path.join(dir, "01-无封面")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify(
      {
        title: "无封面",
        type: "original",
        status: "completed",
        summary: "没有封面文件但配置了 cover。",
        created: "2026-01-01",
        cover: "missing.png",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n正文内容。", "utf-8")

  // 不应抛异常，应输出警告并仍导出 EPUB
  const stdout = runCli(["epub", "无封面"], dir)
  assert.ok(stdout.includes("封面图片不存在"))
  const epubPath = path.join(dir, "dist", "epub", "无封面.epub")
  assert.ok(fs.existsSync(epubPath))
})

test("story build 渲染自定义类型和状态标签", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const storyDir = path.join(dir, "01-翻译故事")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify(
      {
        title: "翻译故事",
        type: "translation",
        status: "planned",
        summary: "一个翻译故事。",
        created: "2026-01-01",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n这是翻译内容。", "utf-8")

  // 仓库级配置：自定义类型/状态 + 本地化标签
  fs.writeFileSync(
    path.join(dir, "story.config.json"),
    JSON.stringify(
      {
        types: ["original", "fanfic", "translation"],
        statuses: ["completed", "ongoing", "planned"],
        typeLabels: {
          translation: { zh: "翻译", en: "Translation" },
        },
        statusLabels: {
          planned: { zh: "计划中", en: "Planned" },
        },
      },
      null,
      2,
    ),
    "utf-8",
  )

  runCli(["build"], dir)

  // 验证故事 README 中正确渲染自定义标签
  const storyReadme = fs.readFileSync(path.join(storyDir, "README.md"), "utf-8")
  assert.ok(storyReadme.includes("翻译"), "故事 README 应渲染自定义类型标签")
  assert.ok(storyReadme.includes("计划中"), "故事 README 应渲染自定义状态标签")

  // 验证根 README 中正确渲染自定义标签
  const rootReadme = fs.readFileSync(path.join(dir, "README.md"), "utf-8")
  assert.ok(rootReadme.includes("翻译"), "根 README 应渲染自定义类型标签")
  assert.ok(rootReadme.includes("计划中"), "根 README 应渲染自定义状态标签")
})

test("story build --validate-only 接受自定义类型", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const storyDir = path.join(dir, "01-翻译故事")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify(
      {
        title: "翻译故事",
        type: "translation",
        status: "planned",
        summary: "一个翻译故事。",
        created: "2026-01-01",
      },
      null,
      2,
    ),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n这是翻译内容。", "utf-8")

  fs.writeFileSync(
    path.join(dir, "story.config.json"),
    JSON.stringify({
      types: ["original", "fanfic", "translation"],
      statuses: ["completed", "ongoing", "planned"],
    }),
    "utf-8",
  )

  // 应通过校验（自定义类型已被仓库配置接受）
  const stdout = runCli(["build", "--validate-only"], dir)
  assert.ok(stdout.includes("校验通过"))
})

/** 构造故事 config.json 的辅助函数 */
function createStoryConfig(title: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title,
    type: "original",
    status: "completed",
    summary: `${title} 的简介。`,
    created: "2026-08-01",
    ...extra,
  }
}

/** 在临时目录中创建故事文件夹 + config.json + text.md */
function createStory(
  dir: string,
  folder: string,
  config: Record<string, unknown>,
  text = "# 第一章\n\n这是测试内容。",
): string {
  const storyDir = path.join(dir, folder)
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(path.join(storyDir, "config.json"), JSON.stringify(config, null, 2), "utf-8")
  fs.writeFileSync(path.join(storyDir, "text.md"), text, "utf-8")
  return storyDir
}

test("story build 系列分组排序集成测试", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-sort-test-"))

  // 三体系列 3 个故事
  const series = [
    ["01-三体-地球往事", createStoryConfig("地球往事", { series: "三体", seriesOrder: 1 })],
    ["02-三体-黑暗森林", createStoryConfig("黑暗森林", { series: "三体", seriesOrder: 2 })],
    ["03-三体-死神永生", createStoryConfig("死神永生", { series: "三体", seriesOrder: 3 })],
  ] as const
  // 独立故事（含 12- / 100- 验证数值序）
  const standalone = [
    ["05-球状闪电", createStoryConfig("球状闪电")],
    ["12-朝闻道", createStoryConfig("朝闻道")],
    ["100-烧火工", createStoryConfig("烧火工")],
  ] as const

  for (const [folder, config] of series) createStory(dir, folder, config)
  for (const [folder, config] of standalone) createStory(dir, folder, config)

  // 运行 build
  runCli(["build"], dir)

  const rootReadme = fs.readFileSync(path.join(dir, "README.md"), "utf-8")

  // 1. 包含三体系列区块
  assert.ok(rootReadme.includes("### 三体"), "应包含三体系列区块")

  // 2. 三体系列按 seriesOrder 排序：地球往事 → 黑暗森林 → 死神永生
  const threeBodyIndex = rootReadme.indexOf("### 三体")
  const standaloneIndex = rootReadme.indexOf("### 📌 独立故事")
  assert.ok(threeBodyIndex !== -1 && standaloneIndex !== -1, "应同时包含系列和独立故事区块")
  const threeBodySection = rootReadme.slice(threeBodyIndex, standaloneIndex)
  const earthIndex = threeBodySection.indexOf("地球往事")
  const darkIndex = threeBodySection.indexOf("黑暗森林")
  const deathIndex = threeBodySection.indexOf("死神永生")
  assert.ok(earthIndex !== -1 && darkIndex !== -1 && deathIndex !== -1, "三体系列应包含全部故事")
  assert.ok(earthIndex < darkIndex && darkIndex < deathIndex, "三体系列按 seriesOrder 排序")

  // 3. 包含独立故事区块
  assert.ok(rootReadme.includes("📌 独立故事"), "应包含独立故事区块")

  // 4. 独立故事按文件夹数值序：球状闪电(05) → 朝闻道(12) → 烧火工(100)
  const standaloneSection = rootReadme.slice(standaloneIndex)
  const ballIndex = standaloneSection.indexOf("球状闪电")
  const morningIndex = standaloneSection.indexOf("朝闻道")
  const fireIndex = standaloneSection.indexOf("烧火工")
  assert.ok(ballIndex !== -1 && morningIndex !== -1 && fireIndex !== -1, "独立故事区块应包含全部故事")
  assert.ok(ballIndex < morningIndex && morningIndex < fireIndex, "独立故事按文件夹序号排序")
})

test("story build 分数索引 seriesOrder 2.5 插入排序", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-fractional-test-"))

  // 先创建 1、2、3 三个系列故事
  createStory(dir, "01-三体-地球往事", createStoryConfig("地球往事", { series: "三体", seriesOrder: 1 }))
  createStory(dir, "02-三体-黑暗森林", createStoryConfig("黑暗森林", { series: "三体", seriesOrder: 2 }))
  createStory(dir, "03-三体-死神永生", createStoryConfig("死神永生", { series: "三体", seriesOrder: 3 }))
  runCli(["build"], dir)

  // 再创建 seriesOrder: 2.5 的故事（模拟在 2 和 3 之间插入）
  createStory(dir, "04-三体-球状闪电", createStoryConfig("三体·球状闪电前传", { series: "三体", seriesOrder: 2.5 }))
  runCli(["build"], dir)

  const rootReadme = fs.readFileSync(path.join(dir, "README.md"), "utf-8")
  const threeBodyIndex = rootReadme.indexOf("### 三体")
  const standaloneIndex = rootReadme.indexOf("### 📌 独立故事")
  const threeBodySection = rootReadme.slice(threeBodyIndex, standaloneIndex)

  // 断言顺序：地球往事(1) → 黑暗森林(2) → 球状闪电前传(2.5) → 死神永生(3)
  const earthIndex = threeBodySection.indexOf("地球往事")
  const darkIndex = threeBodySection.indexOf("黑暗森林")
  const lightningIndex = threeBodySection.indexOf("球状闪电前传")
  const deathIndex = threeBodySection.indexOf("死神永生")
  assert.ok(
    earthIndex < darkIndex && darkIndex < lightningIndex && lightningIndex < deathIndex,
    `分数索引 2.5 应插入在 2 和 3 之间，实际顺序：${threeBodySection}`,
  )
})

test("story build 故事 README 显示系列信息", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-series-info-test-"))

  createStory(
    dir,
    "01-三体-地球往事",
    createStoryConfig("地球往事", {
      series: "三体",
      seriesOrder: 1,
      volume: "第一部·地球往事",
    }),
  )
  runCli(["build"], dir)

  const storyReadme = fs.readFileSync(path.join(dir, "01-三体-地球往事", "README.md"), "utf-8")

  // 应包含系列标签、系列名、顺序、卷名
  assert.ok(storyReadme.includes("系列"), "应包含系列标签")
  assert.ok(storyReadme.includes("三体"), "应包含系列名称")
  assert.ok(storyReadme.includes("第 1 部"), "应包含系列顺序")
  assert.ok(storyReadme.includes("第一部·地球往事"), "应包含卷名")
})

test("story demo 生成示例故事仓库", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-demo-test-"))
  runCli(["demo"], dir)

  // 基础脚手架文件
  assert.ok(fs.existsSync(path.join(dir, "config.original.json")))
  assert.ok(fs.existsSync(path.join(dir, "story.config.json")))
  assert.ok(fs.existsSync(path.join(dir, ".gitignore")))

  // 3 个示例故事
  assert.ok(fs.existsSync(path.join(dir, "01-星河入梦", "config.json")))
  assert.ok(fs.existsSync(path.join(dir, "01-星河入梦", "text.md")))
  assert.ok(fs.existsSync(path.join(dir, "02-星海守望", "config.json")))
  assert.ok(fs.existsSync(path.join(dir, "02-星海守望", "text.md")))
  assert.ok(fs.existsSync(path.join(dir, "03-Starlight Dreams", "config.json")))
  assert.ok(fs.existsSync(path.join(dir, "03-Starlight Dreams", "text.md")))

  // build 后生成了 README
  assert.ok(fs.existsSync(path.join(dir, "README.md")))
  assert.ok(fs.existsSync(path.join(dir, "01-星河入梦", "README.md")))
})

test("story build 检测到文件夹重命名时输出警示", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-rename-test-"))

  // 创建初始 Git 仓库
  const git = (args: string[]) =>
    spawnSync("git", args, { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] })

  // 初始化 git 仓库并提交初始内容
  git(["init", "-q"])
  git(["config", "user.email", "test@example.com"])
  git(["config", "user.name", "Test User"])

  // 创建初始故事
  createStory(dir, "01-故事A", createStoryConfig("故事A"))
  createStory(dir, "02-故事B", createStoryConfig("故事B"))
  git(["add", "."])
  git(["commit", "-q", "-m", "initial"])

  // 重命名 02-故事B → 03-故事B（模拟用户临时起意）
  fs.renameSync(path.join(dir, "02-故事B"), path.join(dir, "03-故事B"))
  git(["add", "-A"])

  // 运行 build，应检测到重命名并输出警示
  const stdout = runCli(["build"], dir)

  // 验证警示输出
  assert.ok(stdout.includes("检测到文件夹重命名"), "应输出重命名警示")
  assert.ok(stdout.includes("02-故事B"), "警示应包含旧文件夹名")
  assert.ok(stdout.includes("03-故事B"), "警示应包含新文件夹名")
  assert.ok(stdout.includes("series / seriesOrder"), "警示应提示使用系列字段")
})

// ─── 边界情况测试：epub / export / init ─────────────────────

test("story epub 无参数无 --all 时报错", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  createStory(dir, "01-测试故事", createStoryConfig("测试故事"))

  const result = spawnSync(process.execPath, [binPath, "epub"], {
    cwd: dir,
    encoding: "utf-8",
  })
  assert.notStrictEqual(result.status, 0, "无参数的 epub 应返回非零退出码")
})

test("story epub 不存在的标题返回错误", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  createStory(dir, "01-测试故事", createStoryConfig("测试故事"))

  const result = spawnSync(process.execPath, [binPath, "epub", "不存在的故事"], {
    cwd: dir,
    encoding: "utf-8",
  })
  assert.notStrictEqual(result.status, 0, "不存在的标题应返回非零退出码")
})

test("story export html 空故事列表生成空站点", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  runCli(["export", "html"], dir)

  const indexHtml = fs.readFileSync(path.join(dir, "dist", "html", "index.html"), "utf-8")
  assert.ok(indexHtml.includes("暂无故事") || indexHtml.includes("No stories yet"), "应显示暂无故事")
})

test("story init --template=invalid 回退默认并警告", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const stdout = runCli(["init", "--template=invalid"], dir)

  assert.ok(fs.existsSync(path.join(dir, "config.original.json")), "应生成 config.original.json")
  assert.ok(fs.existsSync(path.join(dir, "config.fanfic.json")), "应生成 config.fanfic.json")
  assert.ok(stdout.includes("未知模板类型"), "应输出未知模板警告")
})

// ─── 全局标志 --help/--version 测试 ─────────────────────────

function runCliRaw(args: string[], cwd: string): { status: number; output: string } {
  const result = spawnSync(process.execPath, [binPath, ...args], { cwd, encoding: "utf-8" })
  return { status: result.status ?? -1, output: `${result.stdout || ""}${result.stderr || ""}` }
}

test("story build --help 显示帮助且不执行构建（无副作用）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  // 创建空仓库（无故事）
  const { status, output } = runCliRaw(["build", "--help"], dir)
  assert.strictEqual(status, 0, "--help 应返回退出码 0")
  assert.ok(output.includes("Usage:"), "--help 应显示帮助")
  assert.ok(!output.includes("构建完成"), "--help 不应执行构建")
  assert.ok(!fs.existsSync(path.join(dir, "README.md")), "空仓库 --help 后不应生成根 README（无故事可生成）")
})

test("story stats --help 显示帮助", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const { status, output } = runCliRaw(["stats", "--help"], dir)
  assert.strictEqual(status, 0)
  assert.ok(output.includes("Usage:"), "stats --help 应显示帮助")
  assert.ok(!output.includes("📚"), "stats --help 不应执行统计命令（不应输出统计图标）")
})

test("story new --help 显示帮助", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const { status, output } = runCliRaw(["new", "--help"], dir)
  assert.strictEqual(status, 0)
  assert.ok(output.includes("Usage:"), "new --help 应显示帮助")
  assert.ok(!output.includes("请指定故事标题"), "new --help 不应执行创建命令")
})

test("story export --help 显示帮助", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const { status, output } = runCliRaw(["export", "--help"], dir)
  assert.strictEqual(status, 0)
  assert.ok(output.includes("Usage:"), "export --help 应显示帮助")
  assert.ok(!output.includes("Unknown export subcommand"), "export --help 不应报错")
})

test("story validate --help 显示帮助", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const { status, output } = runCliRaw(["validate", "--help"], dir)
  assert.strictEqual(status, 0)
  assert.ok(output.includes("Usage:"), "validate --help 应显示帮助")
})

test("story --version 显示版本号", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const { status, output } = runCliRaw(["--version"], dir)
  assert.strictEqual(status, 0)
  assert.ok(output.includes("story-cli"), "--version 应输出版本")
  assert.ok(!output.includes("Usage:"), "--version 不应显示帮助")
})

test("story export json --help 显示帮助（子命令级也生效）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const { status, output } = runCliRaw(["export", "json", "--help"], dir)
  assert.strictEqual(status, 0)
  assert.ok(output.includes("Usage:"), "export json --help 应显示帮助")
})

test('story new "标题" --help 标题不被误判为全局标志', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  const { status, output } = runCliRaw(["new", "测试标题", "--help"], dir)
  assert.strictEqual(status, 0)
  assert.ok(
    output.includes("Usage:"),
    "new 标题 --help 应显示帮助（-h 在 -- 之后才安全，但 --help 在 parseArgs 里是 options.help=true，全局拦截器会先命中）",
  )
})
