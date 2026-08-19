import { parseArgs, parseCommand } from "./args.ts"
import { runBuild } from "./commands/build.ts"
import { runDemo } from "./commands/demo.ts"
import { exportEpub } from "./commands/epub.ts"
import { exportEmbeddings } from "./commands/export-embeddings.ts"
import { exportHtml } from "./commands/export-html.ts"
import { exportJson } from "./commands/export-json.ts"
import { exportMd } from "./commands/export-md.ts"
import { exportTxt } from "./commands/export-txt.ts"
import { importJson } from "./commands/import-json.ts"
import { initProject } from "./commands/init.ts"
import { runLink } from "./commands/link.ts"
import { runMcpServer } from "./commands/mcp.ts"
import { createNewStory } from "./commands/new-story.ts"
import { runStats } from "./commands/stats.ts"
import { runValidate } from "./commands/validate.ts"
import { CATEGORIES, getCommandsByCategory, type CommandDef, COMMANDS } from "./core/command-registry.ts"
import { formatError } from "./utils/errors.ts"
import { getPackageVersion } from "./utils/paths.ts"

// 从 package.json 动态读取版本号
const VERSION: string = getPackageVersion()

/**
 * 打印帮助信息（从命令注册表驱动，保持与 docs/commands.md 同步）
 */
function printHelp(): void {
  const lines: string[] = []

  lines.push(`story-cli v${VERSION} - Zero-deploy, Git-native content management for Markdown stories`)
  lines.push("")
  lines.push("Usage:")
  lines.push("  story <command> [options]   Run a command")
  lines.push("")

  for (const cat of CATEGORIES) {
    const cmds = getCommandsByCategory(cat.id)
    if (cmds.length === 0) continue

    lines.push(`── ${cat.labelZh} ──`)
    for (const cmd of cmds) {
      lines.push(`  ${cmd.usage}`)
      lines.push(`      ${cmd.descriptionZh}`)
    }
    lines.push("")
  }

  lines.push("Options:")
  lines.push('  story new "Title" --type=original|fanfic --author="Work" --creator="Author" --lang=zh|en')
  lines.push("  story init --template=story|knowledge|tech")
  lines.push("")
  lines.push("Global flags (work after any command):")
  lines.push("  --help, -h          显示帮助信息")
  lines.push("  --version, -v       显示版本号")
  lines.push("")
  lines.push("Examples:")
  lines.push("  story init")
  lines.push("  story init --template=knowledge    # 知识库模式（论文/访谈/博客/笔记）")
  lines.push("  story init --template=tech         # 技术文档模式（教程/API 文档/变更日志）")
  lines.push('  story new "My First Story"')
  lines.push('  story new "Fan Work" --type=fanfic --author="Original Work" --creator="Author" --lang=en')
  lines.push("  story build")
  lines.push("  story build --watch")
  lines.push('  story epub "My First Story"')
  lines.push("")

  console.log(lines.join("\n"))
}

/**
 * 打印版本号
 */
function printVersion(): void {
  console.log(`story-cli ${VERSION}`)
}

/**
 * 根据命令名或别名查找 CommandDef
 */
function findCommandDef(name: string): CommandDef | undefined {
  return COMMANDS.find((cmd) => cmd.name === name || cmd.aliases?.includes(name))
}

/**
 * 打印单个命令的专项帮助（子命令级 --help）
 * 输出：usage + description + 子命令列表 + 全局 flags 提示
 */
function printSubcommandHelp(cmd: CommandDef): void {
  console.log(`story-cli v${VERSION}`)
  console.log("")
  console.log("Usage:")
  console.log(`  ${cmd.usage}`)
  console.log("")
  console.log(`  ${cmd.descriptionZh}`)
  console.log("")

  if (cmd.subcommands && cmd.subcommands.length > 0) {
    console.log("Available subcommands:")
    for (const sub of cmd.subcommands) {
      console.log(`  ${sub.usage}`)
      console.log(`      ${sub.description}`)
    }
    console.log("")
  }

  console.log("Global flags (work after any command):")
  console.log("  --help, -h          显示帮助信息")
  console.log("  --version, -v       显示版本号")
}

/**
 * 主入口
 * @param argv 命令行参数
 * @returns 退出码（0 成功，1 失败）
 */
export async function run(argv: string[]): Promise<number> {
  const { command, args } = parseCommand(argv)
  const rootDir = process.cwd()

  // 全局标志：在任何命令后都生效（GNU CLI 惯例）
  // parseArgs 处理子命令级标志（如 story build --help）；command 检查处理第一参数为标志的情况（如 story --version）
  const { options } = parseArgs(args)
  if (options.help || command === "--help" || command === "-h") {
    // 子命令级 --help：command 是已知命令（非 --help/-h 标志本身），输出该命令专项帮助
    if (options.help && command !== "--help" && command !== "-h") {
      const cmdDef = findCommandDef(command)
      if (cmdDef) {
        printSubcommandHelp(cmdDef)
        return 0
      }
    }
    printHelp()
    return 0
  }
  if (options.version || command === "--version" || command === "-v") {
    printVersion()
    return 0
  }

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

      case "export": // export 命令支持子命令：html / txt / json / md
        {
          const subcommand = args[0]
          if (subcommand === "txt") {
            return exportTxt(rootDir, args.slice(1))
          }
          if (subcommand === "json") {
            return exportJson(rootDir, args.slice(1))
          }
          if (subcommand === "md") {
            return exportMd(rootDir, args.slice(1))
          }
          if (subcommand === "html") {
            return exportHtml(rootDir, args.slice(1))
          }
          if (subcommand === "embeddings") {
            return exportEmbeddings(rootDir, args.slice(1))
          }
          console.log("❌ Unknown export subcommand. Use: story export html | txt | json | md | embeddings")
          return 1
        }

      case "stats":
      case "s":
        return runStats(rootDir, args)

      case "validate":
      case "check":
        return runValidate(rootDir, args)

      case "link":
        return runLink(rootDir, args)

      case "import":
        // import 命令支持子命令：json
        if (args[0] === "json") {
          return importJson(rootDir, args.slice(1))
        }
        console.log("❌ Unknown import subcommand. Use: story import json")
        return 1

      case "mcp-server":
      case "mcp":
        // MCP stdio 服务器（AI 客户端连接入口；支持 --root=<path> 指定仓库根）
        runMcpServer(rootDir, args)
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
      case "-v":
        printVersion()
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
