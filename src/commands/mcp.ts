/**
 * `story mcp-server` 命令入口
 * 启动 MCP stdio 服务器，供 AI 客户端（Claude Desktop / Cursor 等）连接
 * 遵循 ROADMAP「AI 只负责思考，CLI 负责治理」的设计原则
 */

import path from "node:path"
import { parseArgs } from "../args.ts"
import { startMcpServer } from "../mcp/server.ts"
import { registerTools } from "../mcp/tools.ts"

/**
 * 启动 MCP 服务器
 * @param rootDir 当前工作目录（回退根目录）
 * @param args CLI 参数（--root=<path> 显式指定仓库根目录）
 * @returns 退出码（0 成功）
 */
export function runMcpServer(rootDir: string, args: string[] = []): number {
  // --root=<path>：显式指定仓库根目录（AI 客户端可从任意目录启动）
  const { options } = parseArgs(args)
  const targetRoot = typeof options.root === "string" && options.root ? path.resolve(rootDir, options.root) : rootDir

  const tools = registerTools(targetRoot)
  startMcpServer(targetRoot, tools)
  return 0
}
