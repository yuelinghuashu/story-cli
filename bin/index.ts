#!/usr/bin/env node
import { parseArgs, parseCommand } from "../src/args.ts"
import { run } from "../src/cli.ts"

const exitCode = await run(process.argv)

// 长期运行的进程需要保持存活，进程退出由内部 close/SIGINT 事件处理：
// - MCP server：持续监听 stdin，退出由 server.ts 的 close/SIGINT 控制
// - build --watch：持续监听文件变更，退出由 build.ts 的 SIGINT 控制
// 通过解析后的命令与参数判断，而非猜测 argv 位置，避免 `build --validate-only --watch`
// 等标志顺序变化时误杀 watch 进程。
const { command, args } = parseCommand(process.argv)
const { options } = parseArgs(args)
const isLongRunning =
  command === "mcp-server" ||
  command === "mcp" ||
  ((command === "build" || command === "b") && (options.watch === true || options.watch === "true"))

if (!isLongRunning) {
  process.exit(exitCode)
}
