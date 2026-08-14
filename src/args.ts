/**
 * 统一的命令行参数解析工具
 */

import type { ParsedArgs } from "./core/types.ts"

/**
 * 解析命令行参数
 * 支持：--key=value、--flag、位置参数（无前缀）
 * 示例：
 *   ["Title", "--type=fanfic", "--all"]
 *   → { positional: ["Title"], options: { type: "fanfic", all: true } }
 *
 * @param args 参数列表（不含命令名）
 * @returns 解析结果
 */
export function parseArgs(args: string[]): ParsedArgs {
  const positional: string[] = []
  const options: Record<string, string | boolean> = {}

  for (const arg of args) {
    if (arg.startsWith("--")) {
      const eqIndex = arg.indexOf("=")
      if (eqIndex !== -1) {
        options[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1)
      } else {
        options[arg.slice(2)] = true
      }
    } else {
      positional.push(arg)
    }
  }

  return { positional, options }
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
