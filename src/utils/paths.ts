/**
 * 包路径解析工具
 *
 * 兼容两种运行场景：
 * - 开发：直接运行 .ts（bin/index.ts → src/...）
 * - 发布：编译后运行 .js（dist/bin/index.js → dist/src/...）
 *
 * 统一通过「向上查找 package.json」定位包根，
 * 避免硬编码目录层级。
 */
import fs from "node:fs"
import path from "node:path"

/**
 * 从指定目录向上查找包含 package.json 的目录（包根）
 * @param startDir 起始目录
 * @returns 包根目录绝对路径
 */
function findPackageRoot(startDir: string): string {
  let dir = startDir
  // 防止无限循环
  const root = path.parse(dir).root
  while (dir !== root) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir
    dir = path.dirname(dir)
  }
  return startDir
}

/** 当前模块目录（Node 21.2+ 内置） */
const moduleDir = import.meta.dirname

/** 包根目录（含 package.json） */
export const packageRoot = findPackageRoot(moduleDir)

/** 模板目录 */
export const templatesDir = path.join(packageRoot, "templates")

/**
 * 读取包版本号
 * @returns package.json 中的版本号
 */
export function getPackageVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf-8")) as { version?: string }
    return pkg.version || "0.0.0"
  } catch {
    return "0.0.0"
  }
}
