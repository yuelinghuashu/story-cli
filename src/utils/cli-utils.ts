/**
 * CLI 公共工具
 * 抽取多个命令中重复使用的辅助函数
 */

import { execSync } from "node:child_process"
import { safeTruncate } from "./unicode.ts"

/**
 * 检测 CLI 输出语言：根据系统环境变量 LANG 检测，默认中文
 * @returns 语言代码（zh / en）
 */
export function detectCliLang(): string {
  const systemLang = process.env.LANG || ""
  return systemLang.toLowerCase().startsWith("en") ? "en" : "zh"
}

/**
 * 将标题转换为安全的文件名（去除/替换非法字符）
 *
 * 统一使用 Windows 非法字符规则（\ / : * ? " < > |），
 * 即使当前运行在 Linux/macOS 上也保持一致——保证同一 Git 仓库
 * 在不同平台 clone 后生成的文件名完全相同（跨平台一致性优先于平台自由度）。
 *
 * @param title 原始标题
 * @returns 安全文件名
 */
export function sanitizeFileName(title: string): string {
  return safeTruncate(
    title
      .replace(/[\\/:*?"<>|]/g, "_") // Windows 非法字符（跨平台统一规则）
      .replace(/\s+/g, " ")
      .trim(),
    120, // 防止文件名过长（按码点截断，不切断 emoji/生僻字）
  )
}

/**
 * 检测暂存区中是否有故事文件夹重命名
 *
 * 通过 `git status --porcelain` 解析 `R` 状态（重命名），
 * 仅检测「已暂存但未提交」的重命名（提交后无法自动检测）。
 *
 * - 非 Git 仓库或 git 不可用时静默返回 []
 * - 仅报告符合 NN- 前缀约定（故事文件夹）的重命名
 * - 同一文件夹内多个文件重命名会合并为一条记录
 *
 * @param rootDir 项目根目录
 * @returns 重命名列表（如 ["02-故事B → 03-故事B"]）
 */
export function detectRenames(rootDir: string): string[] {
  try {
    // core.quotepath=false：避免中文路径被转义为八进制（如 \346\225\205）
    const output = execSync("git -c core.quotepath=false status --porcelain", {
      cwd: rootDir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }) as string

    const renames: string[] = []
    for (const line of output.split("\n")) {
      // R 状态格式：R  old_path -> new_path（路径可能带引号）
      if (line.startsWith("R")) {
        const rest = line.slice(1).trim()
        const [oldPart, newPart] = rest.split("->").map((s) => s.trim())
        if (!oldPart || !newPart) continue

        // 去掉可能的引号（路径含空格/中文时 git 会加引号）
        const cleanPath = (p: string) => p.replace(/^"|"$/g, "")
        const oldPath = cleanPath(oldPart)
        const newPath = cleanPath(newPart)

        // git 报告的是文件重命名（如 config.json），取路径第一段得到文件夹名
        const oldFolder = oldPath.split("/")[0] ?? ""
        const newFolder = newPath.split("/")[0] ?? ""
        // 仅报告故事文件夹重命名（NN- 前缀）且文件夹确实改变了
        if (oldFolder !== newFolder && /^\d+-/.test(oldFolder) && /^\d+-/.test(newFolder)) {
          renames.push(`${oldFolder} → ${newFolder}`)
        }
      }
    }
    // 去重（一个文件夹内多个文件重命名会生成多条 R 记录）
    return [...new Set(renames)]
  } catch {
    return [] // 非 Git 仓库或 git 不可用时静默跳过
  }
}
