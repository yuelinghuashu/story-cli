import assert from "node:assert"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { after, test } from "node:test"
import { detectCliLang, detectRenames, sanitizeFileName } from "../src/utils/cli-utils.ts"
import { cleanupTempDirs, makeTemp } from "./helpers.ts"

after(() => {
  cleanupTempDirs(["cli-utils-test-"])
})

/** 创建带 git 仓库的临时目录 */
function setupGitRepo(): string {
  const dir = makeTemp("cli-utils-test-")
  const git = (args: string[]) =>
    spawnSync("git", args, { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] })
  git(["init", "-q"])
  git(["config", "user.email", "test@example.com"])
  git(["config", "user.name", "Test User"])
  return dir
}

test("sanitizeFileName 正常标题保持不变", () => {
  assert.strictEqual(sanitizeFileName("我的新故事"), "我的新故事")
  assert.strictEqual(sanitizeFileName("My First Story"), "My First Story")
})

test("sanitizeFileName 替换 Windows 非法字符", () => {
  assert.strictEqual(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j'), "a_b_c_d_e_f_g_h_i_j")
})

test("sanitizeFileName 折叠连续空格", () => {
  assert.strictEqual(sanitizeFileName("标题   带空格"), "标题 带空格")
})

test("sanitizeFileName 去除首尾空格", () => {
  assert.strictEqual(sanitizeFileName("  前后有空格  "), "前后有空格")
})

test("sanitizeFileName 超长标题截断到 120 字符", () => {
  const longTitle = "很".repeat(150)
  const result = sanitizeFileName(longTitle)
  assert.strictEqual(result.length, 120)
})

test("sanitizeFileName 中文和特殊 Unicode 字符保留", () => {
  assert.strictEqual(sanitizeFileName("🌟 星海 ✨"), "🌟 星海 ✨")
  assert.strictEqual(sanitizeFileName("𠀀𠀁 扩展区"), "𠀀𠀁 扩展区")
})

// ─── detectCliLang 测试 ─────────────────────────────────

test("detectCliLang 默认返回中文", () => {
  const original = process.env.LANG
  delete process.env.LANG
  try {
    assert.strictEqual(detectCliLang(), "zh")
  } finally {
    if (original !== undefined) process.env.LANG = original
  }
})

test("detectCliLang 检测英文环境", () => {
  const original = process.env.LANG
  process.env.LANG = "en_US.UTF-8"
  try {
    assert.strictEqual(detectCliLang(), "en")
  } finally {
    if (original !== undefined) process.env.LANG = original
    else delete process.env.LANG
  }
})

// ─── detectRenames 测试 ─────────────────────────────────

test("detectRenames 非 Git 仓库时返回空数组", () => {
  const dir = makeTemp("cli-utils-test-")
  assert.deepStrictEqual(detectRenames(dir), [])
})

test("detectRenames Git 仓库无暂存变更时返回空数组", () => {
  const dir = setupGitRepo()
  fs.mkdirSync(path.join(dir, "01-故事A"), { recursive: true })
  fs.writeFileSync(path.join(dir, "01-故事A", "config.json"), "{}", "utf-8")
  const git = (args: string[]) =>
    spawnSync("git", args, { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] })
  git(["add", "."])
  git(["commit", "-q", "-m", "initial"])
  assert.deepStrictEqual(detectRenames(dir), [])
})

test("detectRenames 检测到故事文件夹重命名", () => {
  const dir = setupGitRepo()
  fs.mkdirSync(path.join(dir, "01-故事A"), { recursive: true })
  fs.writeFileSync(path.join(dir, "01-故事A", "config.json"), "{}", "utf-8")
  fs.mkdirSync(path.join(dir, "02-故事B"), { recursive: true })
  fs.writeFileSync(path.join(dir, "02-故事B", "config.json"), "{}", "utf-8")
  const git = (args: string[]) =>
    spawnSync("git", args, { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] })
  git(["add", "."])
  git(["commit", "-q", "-m", "initial"])

  // 重命名 02-故事B → 03-故事B
  fs.renameSync(path.join(dir, "02-故事B"), path.join(dir, "03-故事B"))
  git(["add", "-A"])

  const renames = detectRenames(dir)
  assert.deepStrictEqual(renames, ["02-故事B → 03-故事B"])
})

test("detectRenames 非故事文件夹重命名不报告", () => {
  const dir = setupGitRepo()
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true })
  fs.writeFileSync(path.join(dir, "docs", "readme.md"), "doc", "utf-8")
  const git = (args: string[]) =>
    spawnSync("git", args, { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] })
  git(["add", "."])
  git(["commit", "-q", "-m", "initial"])

  // 重命名 docs → docs-new（非 NN- 前缀，不应报告）
  fs.renameSync(path.join(dir, "docs"), path.join(dir, "docs-new"))
  git(["add", "-A"])

  assert.deepStrictEqual(detectRenames(dir), [])
})
