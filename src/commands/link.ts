/**
 * `story link` 命令
 * 管理 config.json 中的关联故事字段（links: string[]，弱关联）
 * 与 ROADMAP「确认落盘」设计一致：build 只给建议（零写入），link 才写库
 */
import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "../args.ts"
import { scanStoryFolders } from "../core/scanner.ts"
import { getLocale } from "../i18n/index.ts"
import { detectCliLang } from "../utils/cli-utils.ts"

/**
 * 读取故事 config.json 中的 links 数组（含幂等规范化）
 * @param configPath config.json 路径
 * @returns links 数组（文件不存在或字段缺失时返回空数组）
 */
function readLinks(configPath: string): string[] {
  try {
    if (!fs.existsSync(configPath)) return []
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as { links?: unknown }
    if (!Array.isArray(raw.links)) return []
    return raw.links.filter((l): l is string => typeof l === "string")
  } catch {
    return []
  }
}

/**
 * 运行 story link 命令
 * 用法：
 *   story link <source> <target>            添加 source 的关联 target
 *   story link --remove=<target> <source>   移除 source 的关联 target
 *   story link --list [source]              列出关联（不指定 source 则列出全部）
 * @param rootDir 项目根目录
 * @param args 命令行参数
 * @returns 退出码
 */
export function runLink(rootDir: string, args: string[]): number {
  const { positional, options } = parseArgs(args)
  const locale = getLocale(detectCliLang())
  const folders = scanStoryFolders(rootDir)
  const folderSet = new Set(folders)

  const listOnly = !!options.list
  const removeTarget = typeof options.remove === "string" ? options.remove : null

  // globals：不指定 source 时列出所有故事的关联
  if (listOnly && positional.length === 0) {
    for (const folder of folders) {
      const configPath = path.join(rootDir, folder, "config.json")
      const links = readLinks(configPath)
      if (links.length > 0) {
        console.log(`${folder}: ${links.join(", ")}`)
      }
    }
    return 0
  }

  const source = positional[0]
  if (!source) {
    console.error(`❌ ${locale.linkUsage}`)
    return 1
  }
  if (!folderSet.has(source)) {
    console.error(`❌ ${locale.linkNotFound(source)}`)
    return 1
  }

  const configPath = path.join(rootDir, source, "config.json")
  if (!fs.existsSync(configPath)) {
    console.error(`❌ ${locale.linkMissingConfig(source)}`)
    return 1
  }

  // 读取并解析现有 config.json
  let config: Record<string, unknown>
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>
  } catch {
    console.error(`❌ ${locale.linkParseError(source)}`)
    return 1
  }
  const links = Array.isArray(config.links) ? config.links.filter((l): l is string => typeof l === "string") : []

  // --list 指定 source
  if (listOnly) {
    console.log(locale.linkList(source, links.length > 0 ? links.join(", ") : locale.linkNone))
    return 0
  }

  // --remove
  if (removeTarget) {
    if (!folderSet.has(removeTarget)) {
      console.error(`❌ ${locale.linkNotFound(removeTarget)}`)
      return 1
    }
    const idx = links.indexOf(removeTarget)
    if (idx === -1) {
      console.error(`❌ ${locale.linkNotPresent(source, removeTarget)}`)
      return 1
    }
    links.splice(idx, 1)
    config.links = links
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8")
    console.log(`✅ ${locale.linkRemoved(source, removeTarget)}`)
    return 0
  }

  // 添加关联
  const target = positional[1]
  if (!target) {
    console.error(`❌ ${locale.linkUsage}`)
    return 1
  }
  if (!folderSet.has(target)) {
    console.error(`❌ ${locale.linkNotFound(target)}`)
    return 1
  }
  if (target === source) {
    console.error(`❌ ${locale.linkSelf(source)}`)
    return 1
  }
  if (links.includes(target)) {
    console.log(`✅ ${locale.linkAlreadyPresent(source, target)}`)
    return 0
  }
  links.push(target)
  config.links = links
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8")
  console.log(`✅ ${locale.linkAdded(source, target)}`)
  return 0
}
