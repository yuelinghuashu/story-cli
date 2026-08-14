import assert from "node:assert"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const binPath = fileURLToPath(new URL("../bin/index.ts", import.meta.url))

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
  assert.ok(fs.existsSync(path.join(dir, "README.md")), "默认应生成 README.md")

  // 约定目录结构
  assert.ok(fs.existsSync(path.join(dir, "assets")))
  assert.ok(fs.existsSync(path.join(dir, "assets", "sponsor")))
  assert.ok(fs.existsSync(path.join(dir, "assets", "sponsor", "README.md")))
  assert.ok(fs.existsSync(path.join(dir, "assets", "sponsor", ".gitkeep")))
})

test("story init --full 额外生成 LICENSE/docs/CHANGELOG", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
  runCli(["init", "--full"], dir)

  // 默认文件也应生成
  assert.ok(fs.existsSync(path.join(dir, "config.original.json")))
  assert.ok(fs.existsSync(path.join(dir, ".gitignore")))
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
