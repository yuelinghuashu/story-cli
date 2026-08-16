/**
 * `story mcp-server` 命令入口
 * 启动 MCP stdio 服务器，供 AI 客户端（Claude Desktop / Cursor 等）连接
 * 遵循 ROADMAP「AI 只负责思考，CLI 负责治理」的设计原则
 */

import { startMcpServer } from "../mcp/server.ts"
import { registerTools } from "../mcp/tools.ts"

/**
 * 启动 MCP 服务器
 * @param rootDir 故事仓库根目录
 * @returns 退出码（0 成功）
 */
export function runMcpServer(rootDir: string): number {
  const tools = registerTools(rootDir)
  startMcpServer(rootDir, tools)
  return 0
}
