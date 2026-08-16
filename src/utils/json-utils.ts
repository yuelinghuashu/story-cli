/**
 * 共享 JSON 文件读取工具
 * 统一处理「编码检测 + 警告输出 + TextDecoder 解码 + JSON.parse」的完整流程
 * 消除 config.ts / story-loader.ts / loader.ts 中的重复代码
 */
import fs from "node:fs"
import fsp from "node:fs/promises"
import { getLocale } from "../i18n/index.ts"
import { detectCliLang } from "./cli-utils.ts"
import { detectEncodingIssue, encodingWarning } from "./encoding.ts"

/** 解析 JSON Buffer（编码检测 + 警告 + 解码 + 解析） */
export function parseJsonBuffer(filePath: string, buffer: Uint8Array): Record<string, unknown> {
  const issue = detectEncodingIssue(filePath, buffer)
  if (issue) console.warn(encodingWarning(issue, getLocale(detectCliLang())))
  return JSON.parse(new TextDecoder("utf-8").decode(buffer)) as Record<string, unknown>
}

/** 同步读取并解析 JSON 文件 */
export function readJsonFileSync(filePath: string): Record<string, unknown> {
  return parseJsonBuffer(filePath, fs.readFileSync(filePath))
}

/** 异步读取并解析 JSON 文件 */
export async function readJsonFileAsync(filePath: string): Promise<Record<string, unknown>> {
  return parseJsonBuffer(filePath, await fsp.readFile(filePath))
}
