import assert from "node:assert"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"
import { avgChapterLength, chapterLengthStdDev, countDialogues, dialogueRatio } from "../src/commands/stats.ts"

const binPath = fileURLToPath(new URL("../bin/index.ts", import.meta.url))

// 测试结束后清理本文件创建的所有临时目录（前缀统一 "stats-"）
after(() => {
  try {
    const tmpDir = os.tmpdir()
    for (const entry of fs.readdirSync(tmpDir)) {
      if (entry.startsWith("stats-") && fs.statSync(path.join(tmpDir, entry)).isDirectory()) {
        try {
          fs.rmSync(path.join(tmpDir, entry), { recursive: true, force: true })
        } catch {
          // 清理失败静默忽略
        }
      }
    }
  } catch {
    // 忽略
  }
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

/** 创建故事配置 */
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

test("story stats 输出创作统计", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stats-"))
  createStory(dir, "01-故事A", createStoryConfig("故事A"))
  createStory(dir, "02-故事B", createStoryConfig("故事B", { status: "ongoing" }))

  const stdout = runCli(["stats"], dir)

  // 应包含故事数统计
  assert.ok(stdout.includes("📚"), "应输出故事统计")
  assert.ok(stdout.includes("2"), "应包含故事数量")
  // 应包含字数统计
  assert.ok(stdout.includes("📝"), "应输出字数统计")
  // 应包含健康度检查
  assert.ok(stdout.includes("健康度") || stdout.includes("Health"), "应输出健康度检查")
})

test("story stats 输出系列进度", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stats-"))
  createStory(dir, "01-三体-地球往事", createStoryConfig("地球往事", { series: "三体", seriesOrder: 1 }))
  createStory(
    dir,
    "02-三体-黑暗森林",
    createStoryConfig("黑暗森林", { series: "三体", seriesOrder: 2, status: "ongoing" }),
  )
  createStory(dir, "03-独立故事", createStoryConfig("独立故事"))

  const stdout = runCli(["stats"], dir)

  // 应输出系列信息
  assert.ok(stdout.includes("三体"), "应输出系列名称")
  assert.ok(stdout.includes("50%"), "部分完成时应显示完成率")
})

test("story stats --json 输出结构化数据", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stats-"))
  createStory(dir, "01-故事A", createStoryConfig("故事A", { wordCount: "约 5 千字" }))

  const stdout = runCli(["stats", "--json"], dir)

  const data = JSON.parse(stdout)
  assert.strictEqual(data.storyCount, 1)
  assert.strictEqual(data.completedCount, 1)
  assert.strictEqual(data.ongoingCount, 0)
  assert.ok(data.totalWords > 0)
  assert.strictEqual(data.stories.length, 1)
  assert.strictEqual(data.stories[0].title, "故事A")
  assert.ok(Array.isArray(data.series))
  // 新增章节明细与结构指标
  assert.ok(Array.isArray(data.stories[0].chapters), "应包含章节明细")
  assert.ok(typeof data.stories[0].paragraphs === "number", "应包含段落数")
  assert.ok(typeof data.stories[0].dialogues === "number", "应包含对话数")
  // 章节应包含原始字数（数值分析原料）
  assert.ok(typeof data.stories[0].chapters[0].rawWordCount === "number", "章节应包含 rawWordCount")
  assert.ok(data.stories[0].chapters[0].rawWordCount > 0)
  // 创作健康看板派生指标（供 AI 审视创作节奏/结构）
  assert.ok(typeof data.stories[0].avgChapterLen === "number", "应包含平均章节字数")
  assert.ok(data.stories[0].avgChapterLen >= 0, "平均章节字数应为非负")
  assert.ok(typeof data.stories[0].chapterLenStdDev === "number", "应包含章节字数标准差")
  assert.ok(data.stories[0].chapterLenStdDev >= 0, "章节字数标准差应为非负")
  assert.ok(typeof data.stories[0].dialogueRatio === "number", "应包含对话占比")
  assert.ok(data.stories[0].dialogueRatio >= 0 && data.stories[0].dialogueRatio <= 1, "对话占比应在 0~1")
  // 分析原料：重复短语
  assert.ok(Array.isArray(data.analysis.repeated), "应包含 analysis.repeated")
})

test("story stats --json 输出重复短语", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stats-"))
  // 重复短语：星光闪烁 出现多次
  createStory(dir, "01-重复", createStoryConfig("重复"), `# 第一章\n\n星光闪烁，星光闪烁，星光闪烁。`)

  const stdout = runCli(["stats", "--json"], dir)
  const data = JSON.parse(stdout)

  const repeated = data.analysis.repeated
  assert.ok(
    repeated.some((p: { phrase: string }) => p.phrase === "星光"),
    "重复短语应包含 星光",
  )
})

test("story stats --json health 项为结构化对象（code + folder + message）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stats-"))
  // 字数过期（config 声称约 1 千字，实际远超 2500 字 → 触发 stale-word-count 健康项）
  const storyDir = path.join(dir, "01-字数过期")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify({
      title: "字数过期",
      type: "original",
      status: "completed",
      summary: "测试字数过期。",
      created: "2026-08-01",
      wordCount: "约 1 千字",
      language: "zh",
    }),
    "utf-8",
  )
  fs.writeFileSync(
    path.join(storyDir, "text.md"),
    `# 第一章\n\n${"写作内容写作内容写作内容写作内容写作内容写作内容写作内容写作内容写作内容写作内容".repeat(300)}`,
    "utf-8",
  )

  const stdout = runCli(["stats", "--json"], dir)
  const data = JSON.parse(stdout)
  assert.ok(data.health.warnings >= 1, "字数过期应有健康警告")
  const stale = data.health.items.find((item: { code: string }) => item.code === "stale-word-count")
  assert.ok(stale, "应包含 stale-word-count 项")
  assert.strictEqual(stale.folder, "01-字数过期")
  assert.strictEqual(typeof stale.message, "string", "message 字段应保留（人类可读）")
  assert.ok(stale.message.length > 0)
})

test("story stats 忽略无效配置的故事但不崩溃", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stats-"))
  // 创建 summary 为空的故事（配置无效，应被跳过）
  const storyDir = path.join(dir, "01-无效配置")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify({
      title: "无效配置",
      type: "original",
      status: "completed",
      summary: "",
      created: "2026-08-01",
    }),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n正文内容。", "utf-8")

  // 有效故事
  createStory(dir, "02-有效故事", createStoryConfig("有效故事"))

  // stats 不应崩溃，且应输出有效故事的统计
  const stdout = runCli(["stats"], dir)
  assert.ok(stdout.includes("1"), "应只统计 1 个有效故事")
})

test("story stats 检测字数过期", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stats-"))
  // config 声称 1 千字，但实际内容远多于此
  const storyDir = path.join(dir, "01-字数过期")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify({
      title: "字数过期",
      type: "original",
      status: "completed",
      summary: "测试字数过期。",
      created: "2026-08-01",
      wordCount: "约 1 千字",
    }),
    "utf-8",
  )
  // 写入大量中文内容（> 5000 字）
  const longText = `# 第一章\n\n${"写作内容写作内容写作内容写作内容写作内容写作内容写作内容写作内容写作内容写作内容".repeat(200)}`
  fs.writeFileSync(path.join(storyDir, "text.md"), longText, "utf-8")

  const stdout = runCli(["stats"], dir)

  // 应输出字数过期警告
  assert.ok(stdout.includes("过期字数") || stdout.includes("Stale word count"), "应检测字数过期")
})

test("story stats 非 git 仓库不崩溃", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stats-"))
  createStory(dir, "01-故事A", createStoryConfig("故事A"))

  // 非 git 目录运行 stats 不报错
  const stdout = runCli(["stats"], dir)
  assert.ok(stdout.includes("📊") || stdout.includes("📚"), "应输出统计信息")
})

test("story stats 是 Git 仓库但最近无提交时正确识别", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stats-"))
  createStory(dir, "01-故事A", createStoryConfig("故事A"))

  // 初始化 git 仓库并创建旧提交（3 个月前 → 最近 2 个月无提交）
  const git = (args: string[]) =>
    spawnSync("git", args, { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] })

  git(["init", "-q"])
  git(["config", "user.email", "test@example.com"])
  git(["config", "user.name", "Test User"])
  git(["add", "."])
  // 使用 --date 创建 3 个月前的提交（git log --since=2 months ago 将无输出）
  git(["commit", "-q", "-m", "initial", "--date=3 months ago"])

  const stdout = runCli(["stats"], dir)

  // 应显示「写作活跃度」而非「非 Git 仓库」
  assert.ok(stdout.includes("写作活跃度") || stdout.includes("Writing activity"), "应正确识别为 Git 仓库")
  assert.ok(!stdout.includes("非 Git 仓库"), "不应误报非 Git 仓库")
})

// ─── 创作健康看板派生指标单元测试 ─────────────────────────

test("avgChapterLength 计算平均章节字数", () => {
  assert.strictEqual(avgChapterLength([100, 200, 300]), 200)
  assert.strictEqual(avgChapterLength([1000]), 1000)
  assert.strictEqual(avgChapterLength([]), 0, "空数组返回 0")
})

test("chapterLengthStdDev 计算章节字数标准差", () => {
  // [100,100] → 均 100，标准差 0
  assert.strictEqual(chapterLengthStdDev([100, 100]), 0)
  // [100, 300] → 均 200，方差 10000，标准差 100
  assert.strictEqual(chapterLengthStdDev([100, 300]), 100)
  // 少于 2 章 → 0（无意义）
  assert.strictEqual(chapterLengthStdDev([100]), 0)
  assert.strictEqual(chapterLengthStdDev([]), 0)
  // 均衡与不均衡的区分
  assert.strictEqual(chapterLengthStdDev([100, 100, 100]), 0)
  assert.ok(chapterLengthStdDev([50, 150, 400]) > chapterLengthStdDev([100, 100, 150]))
})

test("dialogueRatio 计算对话字数占比（中文）", () => {
  // 全部是对话 → 占比 ~1（“...” 内字数/总字数，含引号字符，接近但略小于 1）
  const allDialogue = "“你好吗？”“我很好。”"
  const r = dialogueRatio(allDialogue, "zh")
  assert.ok(r > 0 && r <= 1, "全对话占比应在 (0,1]")
  // 无对话 → 0
  assert.strictEqual(dialogueRatio("这是纯叙述文字，没有引号对话。", "zh"), 0)
  // 空内容 → 0
  assert.strictEqual(dialogueRatio("", "zh"), 0)
  // 有对话有叙述 → 介于 0 和 1 之间
  const mixed = "他走进房间。“你来了？”她说。房间里很安静。"
  const rm = dialogueRatio(mixed, "zh")
  assert.ok(rm > 0 && rm < 1, "混合内容对话占比应介于 0~1")
})

test("dialogueRatio 计算对话字数占比（英文）", () => {
  const enDialogue = '"Hello there," she said quietly.'
  const r = dialogueRatio(enDialogue, "en")
  assert.ok(r > 0 && r <= 1, "英文对话占比应在 (0,1]")
  assert.strictEqual(dialogueRatio("pure narration no quotes", "en"), 0)
})

test("countDialogues 中文引号计数", () => {
  assert.strictEqual(countDialogues("“你好吗？”“我很好。”"), 2)
  assert.strictEqual(countDialogues("他说「明天见」。"), 1)
  assert.strictEqual(countDialogues("没有引号的叙述。"), 0)
  assert.strictEqual(countDialogues(""), 0)
})

test("countDialogues 英文引号计数", () => {
  assert.strictEqual(countDialogues('"Hello," she said. "Hi," he replied.'), 2)
  assert.strictEqual(countDialogues('He said "just one" here.'), 1)
})

test("countDialogues 中文引号内嵌英文引号不重复计数", () => {
  // 英文引号嵌套在中文引号内：只应计 1 段对话（中文引号），内嵌的英文引号不应被重复计数
  assert.strictEqual(countDialogues('他说：“我听到了"hello"这个词。”'), 1)
  assert.strictEqual(countDialogues('「他问"你好吗"之后离开。」之后他小声说"还行"。'), 2)
})

test("story stats --json 包含 errors 字段（坏故事不静默吞掉）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stats-"))
  createStory(dir, "01-好故事", createStoryConfig("好故事"))
  // 坏故事：config.json 是非法 JSON → 加载时报 CONFIG_PARSE
  const badDir = path.join(dir, "02-坏故事")
  fs.mkdirSync(badDir, { recursive: true })
  fs.writeFileSync(path.join(badDir, "config.json"), "{ invalid json", "utf-8")

  const stdout = runCli(["stats", "--json"], dir)
  const data = JSON.parse(stdout) as {
    storyCount: number
    stories: unknown[]
    errors: Array<{ folder: string; message: string }>
  }

  assert.strictEqual(data.storyCount, 1, "坏故事不应计入统计")
  assert.strictEqual(data.stories.length, 1, "只应包含好故事")
  assert.ok(Array.isArray(data.errors), "JSON 输出应包含 errors 数组")
  assert.ok(
    data.errors.some((e) => e.folder === "02-坏故事"),
    "errors 应包含坏故事文件夹",
  )
  assert.ok(
    data.errors.some((e) => e.message.length > 0),
    "errors 应包含错误消息",
  )
})
