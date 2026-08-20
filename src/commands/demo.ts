import fs from "node:fs"
import path from "node:path"
import { getLocale } from "../i18n/index.ts"
import { detectCliLang } from "../utils/cli-utils.ts"
import { runBuild } from "./build.ts"
import { demoCoverPng, demoInlinePng } from "./demo-assets.ts"
import { initProject } from "./init.ts"

/**
 * 示例故事配置数据
 */
const DEMO_STORIES: Array<{
  folder: string
  config: Record<string, unknown>
  text: string
}> = [
  {
    folder: "01-星河入梦",
    config: {
      title: "星河入梦",
      type: "original",
      status: "ongoing",
      isMultiChapter: true,
      language: "zh",
      summary: "一个少年在梦中造访星河彼岸的故事。",
      created: "2026-08-15",
      author: "示例作者",
      series: "梦境宇宙",
      seriesOrder: 1,
      cover: "cover.png",
      links: ["02-星海守望"],
    },
    text: `# 第一章 梦的开始

深夜里，我推开了一扇从未见过的门。

![星图](images/stars.png)

门后是漫天的星河，每一颗星都像是有人在对我说着什么。

## 第二节 星的语言

那些星星在说话。我听不懂，但我知道它们在寻找一个倾听者。

# 第二章 彼岸

我踏上了星河彼岸，看到了住在梦里的旅人。`,
  },
  {
    folder: "02-星海守望",
    config: {
      title: "星海守望",
      type: "original",
      status: "completed",
      isMultiChapter: false,
      language: "zh",
      summary: "一场关于告别与守望的短篇。",
      created: "2026-08-15",
      author: "示例作者",
      series: "梦境宇宙",
      seriesOrder: 2,
    },
    text: `# 守望者

星海的尽头有一座灯塔，灯塔的看守人已经守了三百个年头。

他等的人，也许永远不会回来了。

但他说：等待本身就是答案。`,
  },
  {
    folder: "03-Starlight Dreams",
    config: {
      title: "Starlight Dreams",
      type: "original",
      status: "ongoing",
      isMultiChapter: false,
      language: "en",
      summary: "An English demo story about a dreamer and the stars.",
      created: "2026-08-15",
      author: "Demo Author",
    },
    text: `# Chapter 1: The Dreamer

Every night, she looked up at the stars and wondered.

What if the stars were looking back?

## The Answer

One night, a star fell — not from the sky, but into her window.

It spoke: "We've been waiting for you."`,
  },
]

/**
 * 生成演示故事仓库
 *
 * 在当前目录生成一个完整的示例故事仓库，包含：
 *  - 基础脚手架（story init 内容）
 *  - 3 个示例故事（含系列分组、双语、章节）
 *  - 自动运行 story build 生成 README
 *
 * @param rootDir 目标目录
 * @returns 退出码（0 成功，1 失败）
 */
export async function runDemo(rootDir: string): Promise<number> {
  const locale = getLocale(detectCliLang())
  console.log(locale.demoGenerating)

  // 1. 初始化基础脚手架
  initProject(rootDir, [])

  // 2. 创建示例故事
  for (const story of DEMO_STORIES) {
    const storyDir = path.join(rootDir, story.folder)
    fs.mkdirSync(storyDir, { recursive: true })
    fs.writeFileSync(path.join(storyDir, "config.json"), `${JSON.stringify(story.config, null, 2)}\n`, "utf-8")
    fs.writeFileSync(path.join(storyDir, "text.md"), story.text, "utf-8")
  }

  // 3. 示例图片（极简依赖赖生成纯色 PNG）：演示 EPUB 封面渲染与正文图片嵌入
  const firstStory = DEMO_STORIES[0]
  if (firstStory) {
    const firstStoryDir = path.join(rootDir, firstStory.folder)
    fs.writeFileSync(path.join(firstStoryDir, "cover.png"), demoCoverPng())
    fs.mkdirSync(path.join(firstStoryDir, "images"), { recursive: true })
    fs.writeFileSync(path.join(firstStoryDir, "images", "stars.png"), demoInlinePng())
  }

  // 4. 运行 build 生成 README
  const exitCode = await runBuild(rootDir, [])

  // 5. 打印说明
  console.log("")
  console.log(locale.demoDone)
  console.log(locale.demoExplain(DEMO_STORIES.length))

  return exitCode
}
