/**
 * `story validate` 命令
 * Story-Repo 规范 v2.0 的合规检查器
 * 复用 checkRepoCompliance（与 MCP validate 工具同口径）
 */
import { parseArgs } from "../args.ts"
import { checkRepoCompliance } from "../core/compliance.ts"
import { getLocale } from "../i18n/index.ts"
import { detectCliLang } from "../utils/cli-utils.ts"

/**
 * 运行合规检查
 * @param rootDir 项目根目录
 * @param args 命令行参数（--json 可选）
 * @returns 退出码（0 合规，1 有 error 级别问题）
 */
export function runValidate(rootDir: string, args: string[]): number {
  const { options } = parseArgs(args)
  const asJson = !!options.json
  const locale = getLocale(detectCliLang())

  if (!asJson) {
    console.log(`${locale.complianceTitle}\n`)
  }

  const result = checkRepoCompliance(rootDir, locale)

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          valid: result.valid,
          storyCount: result.storyCount,
          issues: result.issues,
          stories: result.stories,
        },
        null,
        2,
      ),
    )
    return result.valid ? 0 : 1
  }

  const errorCount = result.issues.filter((i) => i.severity === "error").length
  const warningCount = result.issues.length - errorCount

  for (const issue of result.issues) {
    const icon = issue.severity === "error" ? "❌" : "⚠️"
    console.log(`  ${icon} [${issue.code}] ${issue.message}`)
  }

  console.log("")
  if (result.valid) {
    console.log(locale.compliancePass(result.storyCount))
  } else {
    console.log(locale.complianceFail(errorCount, warningCount))
  }

  return result.valid ? 0 : 1
}
