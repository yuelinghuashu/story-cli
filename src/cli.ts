import { parseCommand } from "./args.ts"
import { runBuild } from "./commands/build.ts"
import { runDemo } from "./commands/demo.ts"
import { exportEpub } from "./commands/epub.ts"
import { exportHtml } from "./commands/export-html.ts"
import { exportJson } from "./commands/export-json.ts"
import { exportMd } from "./commands/export-md.ts"
import { exportTxt } from "./commands/export-txt.ts"
import { importJson } from "./commands/import-json.ts"
import { initProject } from "./commands/init.ts"
import { runMcpServer } from "./commands/mcp.ts"
import { createNewStory } from "./commands/new-story.ts"
import { runStats } from "./commands/stats.ts"
import { formatError } from "./utils/errors.ts"
import { getPackageVersion } from "./utils/paths.ts"

// 从 package.json 动态读取版本号
const VERSION: string = getPackageVersion()

/**
 * 打印帮助信息
 */
function printHelp(): void {
  console.log(`
story-cli v${VERSION} - Zero-deploy, Git-native content management for Markdown stories

Usage:
  story init                Initialize a story repository
  story new "Title"         Create a new story (with config)
  story build               Generate all READMEs
  story build --save-counts Save auto-calculated word counts to config.json
  story build --watch       Watch for changes and auto-rebuild
  story epub "Title"        Export a story to epub
  story epub --all          Export all stories to epub
  story export html         Export as static HTML site
  story export txt          Export all stories as plain text
  story export txt --stdout Export all stories as text stream (pipe-friendly)
  story export json         Export all stories as structured JSON
  story export json --stdout Export all stories as JSON stream (pipe-friendly)
  story export md           Export all stories as merged Markdown
  story export md --stdout  Export all stories as Markdown stream (pipe-friendly)
  story stats               Show writing statistics
  story demo                Generate a demo story repository
  story help                Show this help
  story version             Show version

Options:
  story new "Title" --type=original|fanfic --author="Work" --creator="Author" --lang=zh|en

Examples:
  story init
  story new "My First Story"
  story new "Fan Work" --type=fanfic --author="Original Work" --creator="Author" --lang=en
  story build
  story build --watch
  story epub "My First Story"
`)
}

/**
 * 主入口
 * @param argv 命令行参数
 * @returns 退出码（0 成功，1 失败）
 */
export async function run(argv: string[]): Promise<number> {
  const { command, args } = parseCommand(argv)
  const rootDir = process.cwd()

  try {
    switch (command) {
      case "build":
      case "b":
        // build 命令内部处理批量错误并返回退出码
        return runBuild(rootDir, args)

      case "new":
      case "n":
        await createNewStory(rootDir, args)
        return 0

      case "epub":
      case "e":
        return exportEpub(rootDir, args)

      case "export":
        // export 命令支持子命令：html / txt / json / md
        if (args[0] === "txt") {
          return exportTxt(rootDir, args.slice(1))
        }
        if (args[0] === "json") {
          return exportJson(rootDir, args.slice(1))
        }
        if (args[0] === "md") {
          return exportMd(rootDir, args.slice(1))
        }
        return exportHtml(rootDir, args)

      case "stats":
      case "s":
        return runStats(rootDir, args)

      case "import":
        // import 命令支持子命令：json
        if (args[0] === "json") {
          return importJson(rootDir, args.slice(1))
        }
        console.log("❌ Unknown import subcommand. Use: story import json")
        return 1

      case "mcp-server":
      case "mcp":
        // MCP stdio 服务器（AI 客户端连接入口）
        runMcpServer(rootDir)
        return 0

      case "demo":
        return runDemo(rootDir)

      case "init":
      case "i":
        initProject(rootDir, args)
        return 0

      case "help":
      case "h":
      case "--help":
      case "-h":
        printHelp()
        return 0

      case "version":
      case "--version":
      case "-v":
        console.log(`story-cli ${VERSION}`)
        return 0

      default:
        console.log(`❌ Unknown command: "${command}"`)
        printHelp()
        return 1
    }
  } catch (e) {
    console.error(formatError(e))
    if (process.env.DEBUG && e instanceof Error && e.stack) {
      console.error(e.stack)
    }
    return 1
  }
}
