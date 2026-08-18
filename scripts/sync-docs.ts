/**
 * 文档同步校验：docs/commands.md 与命令注册表一致性检查
 *
 * 背景：`src/core/command-registry.ts` 是 CLI 命令的单一事实来源（帮助输出由此派生），
 * `docs/commands.md` 是手写文档（说明列含注册表没有的补充信息，无法完全生成）。
 * 本脚本做「注册表 → 文档」单向校验：注册表中每条可校验的 usage 必须出现在中文文档中。
 *
 * 用法：
 *   node scripts/sync-docs.ts        # 校验（不一致时退出码 1，CI 用）
 *
 * 注意：
 * - 仅校验中文版 docs/commands.md（usage 含中文位置参数如「标题」，无法直接匹配英文文档；
 *   英文版 docs/commands.en.md 靠人工保持同步）
 * - 概括型主命令（export / import，含 subcommands）不校验其总 usage——文档按子命令展开
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { COMMANDS } from "../src/core/command-registry.ts"

/** 收集可校验的 usage：无子命令的命令 + 所有子命令的 usage */
function collectUsages(): string[] {
  const usages: string[] = []
  for (const cmd of COMMANDS) {
    if (!cmd.subcommands) usages.push(cmd.usage)
    for (const sub of cmd.subcommands ?? []) usages.push(sub.usage)
  }
  return [...new Set(usages)]
}

const usages = collectUsages()

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const docPath = path.join(root, "docs", "commands.md")
const content = fs.readFileSync(docPath, "utf-8")

// Markdown 表格中 `|` 写作 `\|`，匹配前需转义
const missing = usages.filter((u) => !content.includes(u.replace(/\|/g, "\\|")))

if (missing.length > 0) {
  console.error(`❌ docs/commands.md 与命令注册表不一致（${missing.length} 条用法缺失/过时）：`)
  for (const m of missing) console.error(`  - ${m}`)
  console.error("")
  console.error("提示：更新 src/core/command-registry.ts 后，请同步 docs/commands.md 的用法列")
  console.error("（新增参数如 --output/--css 也需同步 docs/commands.md 的「常见参数说明」表）")
  process.exit(1)
}

console.log(`✅ docs/commands.md 与命令注册表一致（${usages.length} 条用法校验通过）`)
