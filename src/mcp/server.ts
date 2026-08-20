/**
 * MCP stdio 服务器适配层
 * 通过 stdin/stdout 提供 JSON-RPC 2.0 协议，供 MCP 客户端（Claude Desktop / Cursor 等）连接
 */
import { createInterface } from "node:readline"
import { getPackageVersion } from "../utils/paths.ts"
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
  // stdout 是 MCP JSON-RPC 协议专用通道；任何 console.log 都会污染协议流导致客户端解析失败。
  // 启动时将 console.log 统一重定向到 stderr，防止未来调试语句意外破坏协议。
  console.log = (...args: unknown[]) => process.stderr.write(`${args.map(String).join(" ")}\n`)

  const rl = createInterface({ input: process.stdin, terminal: false })
  const pending = new Set<Promise<void>>()

  rl.on("line", (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let request: JsonRpcRequest | null
    try {
      request = parseRequest(trimmed)
    } catch (e) {
      const code =
        (e instanceof Error && "code" in e ? (e as { code?: number }).code : undefined) ??
        JsonRpcErrorCode.InternalError
      const msg = e instanceof Error ? e.message : String(e)
      process.stdout.write(serializeMessage(makeErrorResponse(null, code, msg)))
      return
    }
    // 通知（无 id，如 notifications/initialized）：fire-and-forget，不产生任何响应（JSON-RPC 2.0 §4.2）
    if (request === null) return
    // 跟踪 in-flight 请求，确保 stdin 关闭时异步 handler 已完成
    const task = (async () => {
      const response = await handleRequest(request, rootDir, tools)
      if (response) process.stdout.write(serializeMessage(response))
    })()
    pending.add(task)
    task.finally(() => pending.delete(task))
  })

  rl.on("close", () => {
    // 等待所有 in-flight 请求完成后刷新 stdout 再退出（避免输出被截断）
    void Promise.allSettled([...pending]).then(() => {
      process.stdout.write("", () => process.exit(0))
    })
  })
  process.on("SIGINT", () => {
    rl.close()
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
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "story-cli-mcp", version: getPackageVersion() },
      })
    }
    if (method === "tools/call") {
      const p = params as Record<string, unknown> | undefined
      const toolName = typeof p?.name === "string" ? p.name : undefined
      const tool = tools.find((t) => t.tool.name === toolName)
      if (!tool) {
        return makeErrorResponse(id, JsonRpcErrorCode.MethodNotFound, `Unknown tool: ${toolName}`)
      }
      const args = (typeof p?.arguments === "object" && p.arguments !== null ? p.arguments : {}) as Record<
        string,
        unknown
      >
      const result = await tool.handler(args, rootDir)
      return makeResponse(id, result)
    }
    return makeErrorResponse(id, JsonRpcErrorCode.MethodNotFound, `Method not found: ${method}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return makeErrorResponse(id, JsonRpcErrorCode.InternalError, msg)
  }
}
