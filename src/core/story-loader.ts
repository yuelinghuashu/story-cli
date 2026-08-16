/**
 * 共享的故事配置加载与校验工具
 * 供 epub / export-html / export-txt 等命令复用
 */

import fs from "node:fs"
import path from "node:path"
import { getLocale, resolveLang } from "../i18n/index.ts"
import { detectCliLang } from "../utils/cli-utils.ts"
import { detectEncodingIssue, encodingWarning } from "../utils/encoding.ts"
import { ErrorCode, StoryError } from "../utils/errors.ts"
import type { Language, StoryConfig } from "./types.ts"
import { type ValidationOverrides, validateConfig } from "./validate.ts"

/**
 * 读取并校验单个故事的 config.json（共享工具）
 * @param folderPath 故事文件夹路径
 * @param folder 故事文件夹名（用于错误提示）
 * @param overrides 仓库级校验覆盖
 * @returns 规范化后的故事配置 + 语言
 */
export function loadStoryConfig(
  folderPath: string,
  folder: string,
  overrides: ValidationOverrides,
): { config: StoryConfig; lang: Language } {
  const configPath = path.join(folderPath, "config.json")

  if (!fs.existsSync(configPath)) {
    throw new StoryError(`missing config.json: ${folder}`, ErrorCode.CONFIG_MISSING, { folder })
  }

  let rawConfig: Record<string, unknown>
  try {
    const buffer = fs.readFileSync(configPath)
    const issue = detectEncodingIssue(configPath, buffer)
    if (issue) console.warn(encodingWarning(issue, getLocale(detectCliLang())))
    rawConfig = JSON.parse(new TextDecoder("utf-8").decode(buffer)) as Record<string, unknown>
  } catch (e) {
    throw new StoryError(`config.json parse failed: ${folder} - ${(e as Error).message}`, ErrorCode.CONFIG_PARSE, {
      folder,
    })
  }

  const validation = validateConfig(rawConfig, folder, overrides)
  if (!validation.valid) {
    throw new StoryError(`config validation failed: ${folder}`, ErrorCode.CONFIG_INVALID, {
      folder,
      issues: validation.issues,
    })
  }

  const lang = resolveLang(validation.normalized)
  return { config: validation.normalized, lang }
}
