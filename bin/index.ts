#!/usr/bin/env node
import { run } from "../src/cli.ts"

const exitCode = await run(process.argv)

// 长期运行的进程需要保持存活，进程退出由内部 close/SIGINT 事件处理：
// - MCP server：持续监听 stdin，退出由 server.ts 的 close/SIGINT 控制
// - build --watch：持续监听文件变更，退出由 build.ts 的 SIGINT 控制
const isLongRunning =
  process.argv[2] === "mcp-server" ||
  process.argv[2] === "mcp" ||
  (process.argv[2] === "build" && process.argv[3] === "--watch") ||
  (process.argv[2] === "b" && process.argv[3] === "--watch")

if (!isLongRunning) {
  process.exit(exitCode)
}
