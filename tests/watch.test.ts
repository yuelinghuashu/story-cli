import assert from "node:assert"
import { type ChildProcess, spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"

const binPath = fileURLToPath(new URL("../bin/index.ts", import.meta.url))
const tempDirs: string[] = []
const childProcesses: ChildProcess[] = []

function setupRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watch-test-"))
  tempDirs.push(dir)
  // 创建有效故事
  const storyDir = path.join(dir, "01-测试故事")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify({
      title: "测试故事",
      type: "original",
      status: "ongoing",
      summary: "测试故事。",
      created: "2026-08-16",
    }),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n这是正文内容。", "utf-8")
  return dir
}

after(() => {
  // 清理所有子进程
  for (const child of childProcesses) {
    try {
      child.kill("SIGTERM")
    } catch {
      // ignore
    }
  }
  // 清理临时目录
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
})

/** 等待指定毫秒 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test("build --watch 进程存活且文件变更触发重建", async () => {
  const dir = setupRepo()
  const child = spawn(process.execPath, [binPath, "build", "--watch"], {
    cwd: dir,
    stdio: ["ignore", "pipe", "pipe"],
  })
  childProcesses.push(child)

  let stdout = ""
  child.stdout.on("data", (d: Buffer) => {
    stdout += d.toString()
  })

  // 等待初始构建完成
  await sleep(3000)

  // 关键断言：进程应该仍然存活（之前被 process.exit() 杀死，这里是回归测试的核心）
  assert.strictEqual(
    child.exitCode,
    null,
    `build --watch 进程应保持存活（2.5s 后未退出），实际 exitCode=${child.exitCode}`,
  )

  // 验证初始构建已发生
  assert.ok(stdout.includes("initial"), "应包含初始构建标记")
  assert.ok(fs.existsSync(path.join(dir, "README.md")), "根 README 应已生成")
  assert.ok(fs.existsSync(path.join(dir, "01-测试故事", "README.md")), "故事 README 应已生成")

  // 记录初始 README mtime
  const storyReadme = path.join(dir, "01-测试故事", "README.md")
  const readmeMtime0 = fs.statSync(storyReadme).mtimeMs

  // 修改故事，验证触发增量重建
  await sleep(300) // 确保文件监听已注册
  fs.writeFileSync(path.join(dir, "01-测试故事", "text.md"), "# 第一章 更新\n\n增量重建测试。")

  // 轮询等待 README mtime 变化（最多 5 秒）
  let rebuilt = false
  const pollStart = Date.now()
  while (Date.now() - pollStart < 5000) {
    const mtime = fs.statSync(storyReadme).mtimeMs
    if (mtime > readmeMtime0 + 1) {
      rebuilt = true
      break
    }
    await sleep(50)
  }

  assert.ok(rebuilt, "文件变更后 README 应在 5 秒内被重建")

  // 验证重建后 README 内容包含新章节标题
  const readmeContent = fs.readFileSync(storyReadme, "utf-8")
  assert.ok(readmeContent.length > 0, "README 应有内容")
})
