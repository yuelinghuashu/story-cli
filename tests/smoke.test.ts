import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { after, test } from "node:test"
import { cleanupTempDirs, makeTemp, runCli } from "./helpers.ts"

// 清理本次测试创建的临时目录
after(() => {
  cleanupTempDirs(["smoke-"])
})

/** 断言命令成功执行且输出包含指定内容 */
function assertCli(ok: boolean, output: string, include?: string, label = "命令执行成功"): void {
  assert.ok(ok, `${label}：退出码非零`)
  if (include) {
    assert.ok(output.includes(include), `${label}：输出中缺少 "${include}"`)
  }
}

// ─── 基础命令 ───────────────────────────────────────────────

test("SMOKE: story version 输出版本号", () => {
  const dir = makeTemp("smoke-")
  const { ok, output } = runCli(["version"], dir)
  assertCli(ok, output, "story-cli", "story version")
})

test("SMOKE: story help 输出使用说明", () => {
  const dir = makeTemp("smoke-")
  const { ok, output } = runCli(["help"], dir)
  assertCli(ok, output, "Usage:", "story help")
  assert.ok(output.includes("story init"), "help 应包含 init 命令")
  assert.ok(output.includes("story build"), "help 应包含 build 命令")
  assert.ok(output.includes("story mcp-server"), "help 应包含 mcp-server 命令")
})

test("SMOKE: story -v / --version 别名输出版本号", () => {
  const dir = makeTemp("smoke-")
  const a = runCli(["-v"], dir)
  assertCli(a.ok, a.output, "story-cli", "story -v")
  const b = runCli(["--version"], dir)
  assertCli(b.ok, b.output, "story-cli", "story --version")
})

test("SMOKE: story -h / --help 别名输出帮助", () => {
  const dir = makeTemp("smoke-")
  const a = runCli(["-h"], dir)
  assertCli(a.ok, a.output, "Usage:", "story -h")
  const b = runCli(["--help"], dir)
  assertCli(b.ok, b.output, "Usage:", "story --help")
})

// ─── init 命令 ───────────────────────────────────────────────

test("SMOKE: story init 初始化默认故事仓库", () => {
  const dir = makeTemp("smoke-")
  const { ok } = runCli(["init"], dir)
  assertCli(ok, "", "", "story init")

  // 验证脚手架文件
  assert.ok(fs.existsSync(path.join(dir, "config.original.json")))
  assert.ok(fs.existsSync(path.join(dir, "config.fanfic.json")))
  assert.ok(fs.existsSync(path.join(dir, "story-template.md")))
  assert.ok(fs.existsSync(path.join(dir, "story.config.json")))
  assert.ok(fs.existsSync(path.join(dir, ".gitignore")))
  assert.ok(fs.existsSync(path.join(dir, ".storyignore")))
  assert.ok(fs.existsSync(path.join(dir, "Makefile")))
  assert.ok(fs.existsSync(path.join(dir, "README.md")))
  assert.ok(fs.existsSync(path.join(dir, "assets", "sponsor", ".gitkeep")))

  // 默认类型为故事模式
  const config = JSON.parse(fs.readFileSync(path.join(dir, "story.config.json"), "utf-8")) as { types: string[] }
  assert.deepStrictEqual(config.types, ["original", "fanfic"])
})

test("SMOKE: story i 别名初始化仓库", () => {
  const dir = makeTemp("smoke-")
  const { ok } = runCli(["i"], dir)
  assertCli(ok, "", "", "story i")
  assert.ok(fs.existsSync(path.join(dir, "story.config.json")), "别名 init 应生成配置文件")
})

test("SMOKE: story init --full 额外生成 LICENSE/docs/CHANGELOG", () => {
  const dir = makeTemp("smoke-")
  const { ok } = runCli(["init", "--full"], dir)
  assertCli(ok, "", "", "story init --full")

  assert.ok(fs.existsSync(path.join(dir, "LICENSE")), "应生成 LICENSE")
  assert.ok(fs.existsSync(path.join(dir, "CHANGELOG.md")), "应生成 CHANGELOG.md")
  assert.ok(fs.existsSync(path.join(dir, "docs", "add-story.md")), "应生成 docs/add-story.md")
})

test("SMOKE: story init --template=story 显式指定默认模板", () => {
  const dir = makeTemp("smoke-")
  const { ok } = runCli(["init", "--template=story"], dir)
  assertCli(ok, "", "", "story init --template=story")

  const config = JSON.parse(fs.readFileSync(path.join(dir, "story.config.json"), "utf-8")) as { types: string[] }
  assert.deepStrictEqual(config.types, ["original", "fanfic"])
})

test("SMOKE: story init --template=knowledge 知识库模式", () => {
  const dir = makeTemp("smoke-")
  const { ok } = runCli(["init", "--template=knowledge"], dir)
  assertCli(ok, "", "", "story init --template=knowledge")

  // 不生成故事模板
  assert.ok(!fs.existsSync(path.join(dir, "config.original.json")))
  assert.ok(!fs.existsSync(path.join(dir, "config.fanfic.json")))

  // 知识库类型
  const config = JSON.parse(fs.readFileSync(path.join(dir, "story.config.json"), "utf-8")) as { types: string[] }
  assert.deepStrictEqual(config.types, ["paper", "interview", "blog", "note"])
})

test("SMOKE: story init --template=tech 技术文档模式", () => {
  const dir = makeTemp("smoke-")
  const { ok } = runCli(["init", "--template=tech"], dir)
  assertCli(ok, "", "", "story init --template=tech")

  const config = JSON.parse(fs.readFileSync(path.join(dir, "story.config.json"), "utf-8")) as { types: string[] }
  assert.deepStrictEqual(config.types, ["tutorial", "api-doc", "changelog"])
})

// ─── new 命令 ───────────────────────────────────────────────

test("SMOKE: story n 别名创建故事", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)

  const { ok } = runCli(["n", "别名创建的故事"], dir)
  assertCli(ok, "", "", "story n")

  const storyDir = path.join(dir, "01-别名创建的故事")
  assert.ok(fs.existsSync(storyDir), "别名创建的故事目录应存在")
})

test("SMOKE: story new 创建故事", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)

  const { ok } = runCli(["new", "冒烟测试故事"], dir)
  assertCli(ok, "", "", "story new")

  // 验证故事目录结构
  const storyDir = path.join(dir, "01-冒烟测试故事")
  assert.ok(fs.existsSync(storyDir), "故事目录应存在")
  assert.ok(fs.existsSync(path.join(storyDir, "config.json")))
  assert.ok(fs.existsSync(path.join(storyDir, "text.md")))

  // 验证 config.json 内容
  const config = JSON.parse(fs.readFileSync(path.join(storyDir, "config.json"), "utf-8")) as {
    title: string
    type: string
    status: string
  }
  assert.strictEqual(config.title, "冒烟测试故事")
  assert.strictEqual(config.type, "original")
  assert.strictEqual(config.status, "ongoing")
})

test("SMOKE: story new --type=fanfic 创建二创故事", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)

  const { ok } = runCli(["new", "测试二创", "--type=fanfic", "--author=原作", "--creator=作者"], dir)
  assertCli(ok, "", "", "story new fanfic")

  const storyDir = path.join(dir, "01-测试二创")
  assert.ok(fs.existsSync(storyDir), "二创故事目录应存在")
  const config = JSON.parse(fs.readFileSync(path.join(storyDir, "config.json"), "utf-8")) as {
    type: string
    originalWork: string
    originalAuthor: string
  }
  assert.strictEqual(config.type, "fanfic")
  assert.strictEqual(config.originalWork, "原作")
  assert.strictEqual(config.originalAuthor, "作者")
})

test("SMOKE: story new --lang=en 创建英文故事", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)

  const { ok } = runCli(["new", "English Story", "--lang=en"], dir)
  assertCli(ok, "", "", "story new --lang=en")

  const storyDir = path.join(dir, "01-English-Story")
  assert.ok(fs.existsSync(storyDir), "英文故事目录应存在")
  const config = JSON.parse(fs.readFileSync(path.join(storyDir, "config.json"), "utf-8")) as {
    language: string
  }
  assert.strictEqual(config.language, "en")
})

// ─── build 命令 ───────────────────────────────────────────────

test("SMOKE: story b 别名构建 README", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)

  const { ok } = runCli(["b"], dir)
  assertCli(ok, "", "", "story b")
  assert.ok(fs.existsSync(path.join(dir, "README.md")), "别名 build 应生成根 README")
})

test("SMOKE: story build 生成 README", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)

  const { ok, output } = runCli(["build"], dir)
  assertCli(ok, output, "构建完成", "story build")

  // 验证 README 生成
  assert.ok(fs.existsSync(path.join(dir, "README.md")), "根 README 应生成")
  assert.ok(fs.existsSync(path.join(dir, "01-冒烟测试故事", "README.md")), "故事 README 应生成")
})

test("SMOKE: story build --validate-only 仅校验", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)

  const { ok, output } = runCli(["build", "--validate-only"], dir)
  assertCli(ok, output, "校验通过", "story build --validate-only")

  // 不应生成故事 README
  assert.ok(!fs.existsSync(path.join(dir, "01-冒烟测试故事", "README.md")), "validate-only 不应生成故事 README")
})

test("SMOKE: story build --save-counts 写回字数", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)

  const { ok } = runCli(["build", "--save-counts"], dir)
  assertCli(ok, "", "", "story build --save-counts")

  // 验证 config.json 中已写回 wordCount
  const config = JSON.parse(fs.readFileSync(path.join(dir, "01-冒烟测试故事", "config.json"), "utf-8")) as {
    wordCount?: string
  }
  assert.ok(config.wordCount, "应写回 wordCount")
})

// ─── export 命令 ───────────────────────────────────────────────

test("SMOKE: story export txt 导出纯文本", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)
  runCli(["build"], dir)

  const { ok, output } = runCli(["export", "txt"], dir)
  assertCli(ok, output, "纯文本导出完成", "story export txt")

  // 验证 .txt 文件
  const txtFiles = fs.readdirSync(path.join(dir, "dist", "txt"))
  assert.ok(
    txtFiles.some((f) => f.endsWith(".txt")),
    "应生成 .txt 文件",
  )
})

test("SMOKE: story export txt --stdout 管道输出", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)

  const { ok, output } = runCli(["export", "txt", "--stdout"], dir)
  assertCli(ok, output, "冒烟测试故事", "story export txt --stdout")
})

test("SMOKE: story export json 导出结构化 JSON", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)
  runCli(["build"], dir)

  const { ok, output } = runCli(["export", "json"], dir)
  assertCli(ok, output, "JSON 导出完成", "story export json")

  // 验证 stories.json 存在且格式正确
  const jsonPath = path.join(dir, "dist", "json", "stories.json")
  assert.ok(fs.existsSync(jsonPath), "stories.json 应存在")
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as { stories: Array<{ title: string }> }
  assert.ok(data.stories.length >= 1, "应有至少 1 个故事")
  assert.ok(
    data.stories.some((s) => s.title === "冒烟测试故事"),
    "故事标题应匹配",
  )
})

test("SMOKE: story export json --stdout 输出 JSON 流", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)

  const { ok, output } = runCli(["export", "json", "--stdout"], dir)
  assertCli(ok, output, '"stories"', "story export json --stdout")
  // 验证输出是合法 JSON
  const parsed = JSON.parse(output) as { stories: unknown[] }
  assert.ok(Array.isArray(parsed.stories), "应输出 stories 数组")
})

test("SMOKE: story export md 导出 Markdown", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)
  runCli(["build"], dir)

  const { ok, output } = runCli(["export", "md"], dir)
  assertCli(ok, output, "Markdown 导出完成", "story export md")

  // 验证 .md 文件
  const mdFiles = fs.readdirSync(path.join(dir, "dist", "md"))
  assert.ok(
    mdFiles.some((f) => f.endsWith(".md")),
    "应生成 .md 文件",
  )
})

test("SMOKE: story export md --stdout 输出 Markdown 流", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)

  const { ok, output } = runCli(["export", "md", "--stdout"], dir)
  assertCli(ok, output, "title", "story export md --stdout")
  assert.ok(output.includes("冒烟测试故事"), "stdout 应包含故事标题")
})

test("SMOKE: story export html 导出静态站点", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)
  runCli(["build"], dir)

  const { ok, output } = runCli(["export", "html"], dir)
  assertCli(ok, output, "HTML 导出完成", "story export html")

  // 验证 index.html
  assert.ok(fs.existsSync(path.join(dir, "dist", "html", "index.html")), "index.html 应存在")
})

// ─── epub 命令 ───────────────────────────────────────────────

test("SMOKE: story e 别名导出 EPUB", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)
  runCli(["build"], dir)

  const { ok } = runCli(["e", "--all"], dir)
  assertCli(ok, "", "", "story e")
  const epubFiles = fs.readdirSync(path.join(dir, "dist", "epub"))
  assert.ok(
    epubFiles.some((f) => f.endsWith(".epub")),
    "别名 epub 应生成 .epub 文件",
  )
})

test("SMOKE: story epub --all 导出全部 EPUB", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)
  runCli(["build"], dir)

  const { ok, output } = runCli(["epub", "--all"], dir)
  assertCli(ok, output, "导出完成", "story epub --all")

  // 验证 .epub 文件
  const epubDir = path.join(dir, "dist", "epub")
  const epubFiles = fs.readdirSync(epubDir)
  assert.ok(
    epubFiles.some((f) => f.endsWith(".epub")),
    "应生成 .epub 文件",
  )
})

test("SMOKE: story epub 单个故事导出", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)
  runCli(["build"], dir)

  const { ok, output } = runCli(["epub", "冒烟测试故事"], dir)
  assertCli(ok, output, "✅", "story epub 单本")

  const epubDir = path.join(dir, "dist", "epub")
  const epubFiles = fs.readdirSync(epubDir)
  assert.ok(
    epubFiles.some((f) => f.includes("冒烟测试") && f.endsWith(".epub")),
    "应生成单本 .epub 文件",
  )
})

test("SMOKE: story epub --split-by-volume 分卷导出", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)
  // 为故事配置 volume 字段
  const storyDir = path.join(dir, "01-冒烟测试故事")
  const configPath = path.join(storyDir, "config.json")
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>
  config.volume = "第一卷"
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8")
  runCli(["build"], dir)

  const { ok, output } = runCli(["epub", "冒烟测试故事", "--split-by-volume"], dir)
  assertCli(ok, output, "✅", "story epub --split-by-volume")

  const epubDir = path.join(dir, "dist", "epub")
  const epubFiles = fs.readdirSync(epubDir)
  assert.ok(
    epubFiles.some((f) => f.includes("第一卷") && f.endsWith(".epub")),
    "应生成带卷名的 .epub 文件",
  )
})

// ─── stats 命令 ───────────────────────────────────────────────

test("SMOKE: story s 别名输出统计", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)

  const { ok, output } = runCli(["s"], dir)
  assertCli(ok, output, "", "story s")
  assert.ok(output.includes("故事") || output.includes("Story"), "别名 stats 应输出统计")
})

test("SMOKE: story stats 输出统计", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)

  const { ok, output } = runCli(["stats"], dir)
  assertCli(ok, output, "", "story stats")
  assert.ok(output.includes("故事") || output.includes("Story"), "stats 应输出故事统计")
})

test("SMOKE: story stats --json 输出 JSON", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)
  runCli(["new", "冒烟测试故事"], dir)

  const { ok, output } = runCli(["stats", "--json"], dir)
  assertCli(ok, output, '"storyCount"', "story stats --json")
  const parsed = JSON.parse(output) as { storyCount: number }
  assert.strictEqual(parsed.storyCount, 1, "应有 1 个故事")
})

// ─── import 命令 ───────────────────────────────────────────────

test("SMOKE: story import json 批量导入", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)

  // 创建待导入的 JSON 文件
  const importFile = path.join(dir, "import.json")
  fs.writeFileSync(
    importFile,
    JSON.stringify({
      stories: [
        {
          title: "导入故事A",
          type: "original",
          status: "ongoing",
          summary: "冒烟测试导入。",
          chapters: [{ title: "第一章", content: "A 的正文。" }],
        },
      ],
    }),
    "utf-8",
  )

  const { ok, output } = runCli(["import", "json", `--file=${importFile}`], dir)
  assertCli(ok, output, "导入完成", "story import json")

  // 验证导入的故事目录
  const storyDirs = fs.readdirSync(dir).filter((f) => /^\d{2,}-/.test(f))
  assert.ok(storyDirs.length >= 1, "应至少导入 1 个故事")
})

test("SMOKE: story import json 支持 stdin 管道输入", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)

  const stdinJson = JSON.stringify({
    stories: [
      {
        title: "stdin导入故事",
        type: "original",
        status: "ongoing",
        summary: "通过 stdin 导入。",
        chapters: [{ title: "第一章", content: "stdin 正文。" }],
      },
    ],
  })

  const { ok, output } = runCli(["import", "json"], dir, stdinJson)
  assertCli(ok, output, "导入完成", "story import json (stdin)")

  // 验证导入的故事目录
  const storyDir = path.join(dir, "01-stdin导入故事")
  assert.ok(fs.existsSync(storyDir), "stdin 导入的故事目录应存在")
})

test("SMOKE: story import json --output=xxx 指定输出目录", () => {
  const dir = makeTemp("smoke-")
  runCli(["init"], dir)

  // 创建待导入的 JSON 文件
  const importFile = path.join(dir, "import.json")
  fs.writeFileSync(
    importFile,
    JSON.stringify({
      stories: [
        {
          title: "输出目录导入",
          type: "original",
          status: "ongoing",
          summary: "导入到指定目录。",
          chapters: [{ title: "第一章", content: "正文。" }],
        },
      ],
    }),
    "utf-8",
  )

  const { ok, output } = runCli(["import", "json", `--file=${importFile}`, "--output=my-stories"], dir)
  assertCli(ok, output, "导入完成", "story import json --output")

  // 验证指定输出目录
  const outDir = path.join(dir, "my-stories")
  assert.ok(fs.existsSync(outDir), "指定输出目录应存在")
  const storyDirs = fs.readdirSync(outDir).filter((f) => /^\d{2,}-/.test(f))
  assert.ok(storyDirs.length >= 1, "输出目录中应有导入的故事")
})

// ─── demo / 其他 ───────────────────────────────────────────────

test("SMOKE: story demo 生成示例仓库", () => {
  const dir = makeTemp("smoke-")

  const { ok, output } = runCli(["demo"], dir)
  assertCli(ok, output, "示例故事仓库已生成", "story demo")

  // 验证示例故事
  assert.ok(fs.existsSync(path.join(dir, "01-星河入梦", "config.json")), "示例故事 01 应存在")
  assert.ok(fs.existsSync(path.join(dir, "02-星海守望", "config.json")), "示例故事 02 应存在")
  assert.ok(fs.existsSync(path.join(dir, "README.md")), "根 README 应生成")
})

test("SMOKE: 未知命令返回非零退出码", () => {
  const dir = makeTemp("smoke-")
  const { ok, output } = runCli(["not-a-real-command"], dir)
  assert.ok(!ok, "未知命令应返回非零退出码")
  assert.ok(output.includes("Unknown command"), "应输出 Unknown command 错误")
})

test("SMOKE: import 未知子命令返回错误", () => {
  const dir = makeTemp("smoke-")
  const { ok, output } = runCli(["import", "xml"], dir)
  assert.ok(!ok, "未知 import 子命令应返回非零退出码")
  assert.ok(output.includes("Unknown import subcommand"), "应输出未知子命令提示")
})
