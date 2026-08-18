import assert from "node:assert"
import { test } from "node:test"
import { CATEGORIES, COMMANDS } from "../src/core/command-registry.ts"

/** cli.ts switch 中的命令分发入口集合（手动从 switch 抽取，作为回归锚点） */
const CLI_SWITCH_COMMANDS = [
  // 主命令
  "build",
  "new",
  "epub",
  "export",
  "stats",
  "validate",
  "link",
  "import",
  "mcp-server",
  "demo",
  "init",
  "help",
  "version",
]

/** cli.ts switch 支持的所有命令别名（不含 --help/-h/--version/-v，它们是全局标志走全局拦截器） */
const CLI_SWITCH_ALIASES = [
  "b",
  "n",
  "e", // build/new/epub
  "s",
  "check", // stats/validate
  "mcp", // mcp-server
  "i", // init
  "h", // help（--help/-h 是全局标志，走拦截器）
]

test("注册表包含 cli.ts 分发的所有主命令", () => {
  const registryNames = new Set(COMMANDS.map((c) => c.name))
  for (const cmd of CLI_SWITCH_COMMANDS) {
    assert.ok(registryNames.has(cmd), `注册表缺失命令: ${cmd}`)
  }
})

test("注册表包含 cli.ts 分发的所有别名", () => {
  const registryAliases = new Set(COMMANDS.flatMap((c) => [c.name, ...(c.aliases ?? [])]))
  for (const alias of CLI_SWITCH_ALIASES) {
    assert.ok(registryAliases.has(alias), `注册表缺失别名: ${alias}`)
  }
})

test("注册表无重复命令名", () => {
  const names = COMMANDS.map((c) => c.name)
  const dupes = names.filter((n, i) => names.indexOf(n) !== i)
  assert.deepStrictEqual(dupes, [], `发现重复命令名: ${dupes.join(", ")}`)
})

test("注册表无重复别名（跨命令不冲突）", () => {
  const allNames: string[] = []
  for (const cmd of COMMANDS) {
    allNames.push(cmd.name)
    for (const alias of cmd.aliases ?? []) allNames.push(alias)
  }
  const dupes = allNames.filter((n, i) => allNames.indexOf(n) !== i)
  assert.deepStrictEqual(dupes, [], `发现重复别名: ${dupes.join(", ")}`)
})

test("注册表所有分类都是合法分类", () => {
  const validCategories = new Set(CATEGORIES.map((c) => c.id))
  for (const cmd of COMMANDS) {
    assert.ok(validCategories.has(cmd.category), `命令 ${cmd.name} 使用非法分类: ${cmd.category}`)
  }
})

test("注册表每个分类有至少一个命令", () => {
  for (const cat of CATEGORIES) {
    const count = COMMANDS.filter((c) => c.category === cat.id).length
    assert.ok(count > 0, `分类 ${cat.id}(${cat.label}) 下无任何命令`)
  }
})

test("注册表每个命令都有 usage 和 description（中英文均存在）", () => {
  for (const cmd of COMMANDS) {
    assert.ok(cmd.usage && cmd.usage.length > 0, `命令 ${cmd.name} 缺少 usage`)
    assert.ok(cmd.description && cmd.description.length > 0, `命令 ${cmd.name} 缺少英文 description`)
    assert.ok(cmd.descriptionZh && cmd.descriptionZh.length > 0, `命令 ${cmd.name} 缺少中文 descriptionZh`)
  }
})

test("注册表子命令也有 usage 和 description", () => {
  for (const cmd of COMMANDS) {
    for (const sub of cmd.subcommands ?? []) {
      assert.ok(sub.usage && sub.usage.length > 0, `命令 ${cmd.name}/${sub.name} 缺少 usage`)
      assert.ok(sub.description && sub.description.length > 0, `命令 ${cmd.name}/${sub.name} 缺少 description`)
    }
  }
})

test("help/version 命令有 flags 字段（--help/-h/--version/-v 是全局标志，非命令别名）", () => {
  const helpCmd = COMMANDS.find((c) => c.name === "help")!
  const versionCmd = COMMANDS.find((c) => c.name === "version")!
  assert.deepStrictEqual(helpCmd.flags, ["--help", "-h"], "help 的 flags 应为 --help/-h")
  assert.deepStrictEqual(versionCmd.flags, ["--version", "-v"], "version 的 flags 应为 --version/-v")
  assert.ok(!helpCmd.aliases?.includes("--help"), "help 的 aliases 不应含 --help")
  assert.ok(!versionCmd.aliases?.includes("--version"), "version 的 aliases 不应含 --version")
})

test("story help 输出包含所有注册表命令名", async () => {
  const { execSync } = await import("node:child_process")
  const { fileURLToPath } = await import("node:url")
  const helpOutput = execSync(`node ${fileURLToPath(new URL("../bin/index.ts", import.meta.url))} help`, {
    encoding: "utf-8",
    cwd: process.cwd(),
  })

  for (const cmd of COMMANDS) {
    assert.ok(helpOutput.includes(cmd.usage), `story help 应包含命令 ${cmd.name} 的 usage: "${cmd.usage}"`)
  }
})

test("story help 输出包含所有分类标题", async () => {
  const { execSync } = await import("node:child_process")
  const { fileURLToPath } = await import("node:url")
  const helpOutput = execSync(`node ${fileURLToPath(new URL("../bin/index.ts", import.meta.url))} help`, {
    encoding: "utf-8",
    cwd: process.cwd(),
  })

  for (const cat of CATEGORIES) {
    assert.ok(helpOutput.includes(cat.labelZh), `story help 应包含分类标题: "${cat.labelZh}"`)
  }
})
