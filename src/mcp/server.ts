/**
 * MCP stdio 服务器适配层
 * 通过 stdin/stdout 提供 JSON-RPC 2.0 协议，供 MCP 客户端（Claude Desktop / Cursor 等）连接
 */
import { createInterface } from "node:readline"
import {
  JsonRpcErrorCode,
  type JsonRpcRequest,
  type JsonRpcResponse,
  makeErrorResponse,
  makeResponse,
  parseRequest,
  type RegisteredTool,
  serializeMessage,
} from "./protocol.ts"

/**
 * 启动 MCP stdio 服务器
 * @param rootDir 故事仓库根目录
 * @param tools 已注册的 MCP 工具列表
 */
export function startMcpServer(rootDir: string, tools: RegisteredTool[]): void {
  const rl = createInterface({ input: process.stdin, terminal: false })

  rl.on("line", async (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let request: JsonRpcRequest
    try {
      request = parseRequest(trimmed)
    } catch (e) {
      const code = (e as Error & { code?: number }).code ?? JsonRpcErrorCode.InternalError
      process.stdout.write(serializeMessage(makeErrorResponse(null, code, (e as Error).message)))
      return
    }
    const response = await handleRequest(request, rootDir, tools)
    if (response) process.stdout.write(serializeMessage(response))
  })

  rl.on("close", () => {
    // 等待 stdout 刷新后再退出（避免输出被截断）
    process.stdout.write("", () => process.exit(0))
  })
  process.on("SIGINT", () => {
    rl.close()
    process.stdout.write("", () => process.exit(0))
  })
}

/**
 * 处理单个 JSON-RPC 请求
 * @param request 解析后的请求
 * @param rootDir 仓库根目录
 * @param tools 工具列表
 * @returns 响应（通知时返回 null）
 */
async function handleRequest(
  request: JsonRpcRequest,
  rootDir: string,
  tools: RegisteredTool[],
): Promise<JsonRpcResponse | null> {
  const { id, method, params } = request

  try {
    if (method === "tools/list") {
      return makeResponse(id, { tools: tools.map((t) => t.tool) })
    }
    if (method === "initialize") {
      return makeResponse(id, {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "story-cli-mcp", version: "1.3.0" },
      })
    }
    if (method === "tools/call") {
      const callParams = params as { name?: string; arguments?: Record<string, unknown> }
      const tool = tools.find((t) => t.tool.name === callParams?.name)
      if (!tool) {
        return makeErrorResponse(id, JsonRpcErrorCode.MethodNotFound, `Unknown tool: ${callParams?.name}`)
      }
      const args = callParams?.arguments ?? {}
      const result = await tool.handler(args, rootDir)
      return makeResponse(id, result)
    }
    return makeErrorResponse(id, JsonRpcErrorCode.MethodNotFound, `Method not found: ${method}`)
  } catch (e) {
    return makeErrorResponse(id, JsonRpcErrorCode.InternalError, (e as Error).message)
  }
}
