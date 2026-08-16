/**
 * 统一的命令行参数解析工具
 * 使用 Node 内置 util.parseArgs（Node >= 18.3）
 */

import { parseArgs as parseArgsNode } from "node:util"
import type { ParsedArgs } from "./core/types.ts"

/**
 * 解析命令行参数
 * 支持：--key=value、--flag、位置参数（无前缀）、-- 分隔符
 * 示例：
 *   ["Title", "--type=fanfic", "--all"]
 *   → { positional: ["Title"], options: { type: "fanfic", all: true } }
 *
 * @param args 参数列表（不含命令名）
 * @returns 解析结果
 */
export function parseArgs(args: string[]): ParsedArgs {
  const { values, positionals } = parseArgsNode({
    args,
    allowPositionals: true,
    strict: false, // 宽容模式：接受未知选项，保持与手写实现一致
  })

  // values 中的 undefined 值被过滤，保持与手写实现一致（不存在的选项不写入）
  const options: Record<string, string | boolean> = {}
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      options[key] = value
    }
  }

  return { positional: positionals, options }
}

/**
 * 从原始 argv 中解析命令和剩余参数
 * 示例：
 *   ["build", "--watch"]
 *   → { command: "build", args: ["--watch"] }
 *
 * @param argv 原始命令行参数（含 node 和脚本路径）
 * @returns 命令和参数
 */
export function parseCommand(argv: string[]): { command: string; args: string[] } {
  const args = argv.slice(2)
  return { command: args[0] ?? "", args: args.slice(1) }
}
