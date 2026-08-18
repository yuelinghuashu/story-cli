/**
 * 基准测试仓库生成器
 * 生成指定数量（默认 100）的故事仓库，用于性能基准测试
 *
 * 用法：
 *   node bench/generate.ts               # 在当前目录生成 100 个故事
 *   node bench/generate.ts 200           # 生成 200 个故事
 *   node bench/generate.ts 100 /tmp/bench # 指定输出目录
 */
import fs from "node:fs"
import path from "node:path"

/** 生成单个故事的 config.json 内容 */
function makeConfig(title: string): Record<string, unknown> {
  return {
    title,
    type: "original",
    status: Math.random() > 0.5 ? "completed" : "ongoing",
    isMultiChapter: false,
    language: Math.random() > 0.5 ? "zh" : "en",
    summary: "这是一个基准测试故事，用于测量 story-cli 在大规模仓库下的性能表现。",
    created: "2026-08-15",
    author: "Benchmark Author",
    series: Math.random() > 0.7 ? "基准系列" : undefined,
    seriesOrder: Math.random() > 0.7 ? 1 : undefined,
  }
}

/** 生成单个故事的正文内容 */
function makeText(title: string): string {
  const lang = Math.random() > 0.5 ? "zh" : "en"
  if (lang === "zh") {
    return [
      "# 第一章 开始",
      "",
      title + "的故事从这里开始。",
      "",
      "夜色如水，远方的星河在无声流淌。",
      "",
      "## 第二节 旅程",
      "",
      "他踏上了漫长的旅程，每一步都坚定而从容。",
      "",
      "# 第二章 发展",
      "",
      "故事继续展开，更多的细节逐渐浮现。",
      "",
      "## 第二节 转折",
      "",
      "命运在这里开始转折。",
      "",
      "# 第三章 高潮",
      "",
      "故事进入高潮部分。",
      "",
      "## 结局",
      "",
      "一切终于尘埃落定。",
    ].join("\n")
  }
  return [
    "# Chapter 1: The Beginning",
    "",
    "The story of " + title + " begins here.",
    "",
    "The night was quiet, and distant stars flowed silently.",
    "",
    "## The Journey",
    "",
    "He embarked on a long journey, each step firm and steady.",
    "",
    "# Chapter 2: Development",
    "",
    "The story unfolds with more details emerging.",
    "",
    "## The Turning Point",
    "",
    "Fate begins to turn here.",
    "",
    "# Chapter 3: Climax",
    "",
    "The story reaches its climax.",
    "",
    "## The Ending",
    "",
    "Everything finally comes to rest.",
  ].join("\n")
}

/** 生成基准测试仓库 */
export function generateBenchRepo(count = 100, outputDir = "."): void {
  const rootDir = path.resolve(outputDir)
  fs.mkdirSync(path.join(rootDir, "assets", "sponsor"), { recursive: true })

  for (let i = 1; i <= count; i++) {
    const num = String(i).padStart(2, "0")
    const folder = Math.random() > 0.5 ? num + "-测试故事" + i : num + "-Story " + i
    const storyDir = path.join(rootDir, folder)
    fs.mkdirSync(storyDir, { recursive: true })

    const title = Math.random() > 0.5 ? "测试故事 " + i : "Story " + i
    const config = makeConfig(title)
    fs.writeFileSync(path.join(storyDir, "config.json"), JSON.stringify(config, null, 2) + "\n", "utf-8")
    fs.writeFileSync(path.join(storyDir, "text.md"), makeText(title), "utf-8")
  }
}

// CLI 直接运行时生成仓库
// 用 import.meta.filename 比较（跨平台）："file://" + process.argv[1] 在 Windows 上
// 因 file:/// 三斜杠与反斜杠路径不一致而永远不成立，导致直接运行时静默不生成
if (import.meta.filename === process.argv[1]) {
  const countArg = Number(process.argv[2] ?? "100")
  const dirArg = process.argv[3] ?? "."
  generateBenchRepo(countArg, dirArg)
  console.log("已生成 " + countArg + " 个故事到 " + path.resolve(dirArg))
  console.log("下一步：运行 node bench/bench.ts <目录> 测量性能")
}