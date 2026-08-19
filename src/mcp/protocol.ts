/**
 * MCP JSON-RPC 2.0 协议适配层
 *
 * 遵循 Model Context Protocol (MCP) 的 JSON-RPC 2.0 over stdio 传输规范。
 * 基于 ROADMAP「AI 只负责思考，CLI 负责治理」的设计原则：
 * - 零新运行时依赖（Node 内置能力实现协议）
 * - 不锁文件，依赖 Git 原子提交
 * - AI 写入后提示「请运行 story build 更新 README」
 */

/** JSON-RPC 2.0 请求 */
export interface JsonRpcRequest {
  jsonrpc: "2.0"
  id: string | number
  method: string
  params?: unknown
}

/** JSON-RPC 2.0 响应 */
export interface JsonRpcResponse {
  jsonrpc: "2.0"
  id: string | number | null
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/** MCP 工具定义 */
export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/** MCP 工具调用结果 */
export interface McpToolResult {
  content: Array<{ type: "text"; text: string }>
  isError?: boolean
}

/** MCP 工具处理器 */
export type McpToolHandler = (args: Record<string, unknown>, rootDir: string) => McpToolResult | Promise<McpToolResult>

/** 注册的 MCP 工具 */
export interface RegisteredTool {
  tool: McpTool
  handler: McpToolHandler
}

/** JSON-RPC 错误码（MCP 规范定义） */
export const JsonRpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const

/** 判断值是否为合法的 JSON-RPC 请求对象 */
export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as JsonRpcRequest).jsonrpc === "2.0" &&
    typeof (value as JsonRpcRequest).method === "string" &&
    ((value as JsonRpcRequest).id === undefined ||
      typeof (value as JsonRpcRequest).id === "string" ||
      typeof (value as JsonRpcRequest).id === "number")
  )
}

/**
 * 解析 JSON-RPC 请求消息
 *
 * JSON-RPC 2.0 区分两类消息：
 * - 请求（含 id）：期望响应，返回 JsonRpcRequest
 * - 通知（无 id，如 notifications/initialized）：fire-and-forget，不期望任何响应，返回 null
 *
 * @param raw 原始输入文本（单条 JSON）
 * @returns 解析后的请求；通知时返回 null；格式非法时抛出带错误码的 Error
 */
export function parseRequest(raw: string): JsonRpcRequest | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const err = new Error("Parse error") as Error & { code?: number }
    err.code = JsonRpcErrorCode.ParseError
    throw err
  }

  // 有 id → 请求
  if (parsed && typeof parsed === "object" && "id" in (parsed as object)) {
    if (!isJsonRpcRequest(parsed)) {
      const err = new Error("Invalid request") as Error & { code?: number }
      err.code = JsonRpcErrorCode.InvalidRequest
      throw err
    }
    return parsed
  }

  // 无 id → 通知（fire-and-forget）：仅校验 jsonrpc 版本与 method，合法则静默忽略（返回 null）
  // 注意：JSON-RPC 2.0 §4.2 规定通知不得返回任何响应（含错误响应），故不抛错
  const obj = parsed as { jsonrpc?: unknown; method?: unknown } | null
  if (obj && typeof obj === "object" && obj.jsonrpc === "2.0" && typeof obj.method === "string") {
    return null
  }

  const err = new Error("Invalid request") as Error & { code?: number }
  err.code = JsonRpcErrorCode.InvalidRequest
  throw err
}

/** 构建 JSON-RPC 成功响应 */
export function makeResponse(id: string | number, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result }
}

/** 构建 JSON-RPC 错误响应 */
export function makeErrorResponse(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } }
}

/** 序列化 JSON-RPC 消息（带换行符，适合 stdio 协议） */
export function serializeMessage(message: JsonRpcResponse): string {
  return `${JSON.stringify(message)}\n`
}
