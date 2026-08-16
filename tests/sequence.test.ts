import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { after, test } from "node:test"
import { getNextNumber } from "../src/core/sequence.ts"
import { cleanupTempDirs, makeTemp } from "./helpers.ts"

after(() => {
  cleanupTempDirs(["sequence-test-"])
})

function setupDir(folders: string[]): string {
  const dir = makeTemp("sequence-test-")
  for (const folder of folders) {
    fs.mkdirSync(path.join(dir, folder), { recursive: true })
  }
  return dir
}

test("getNextNumber 空目录返回 01", () => {
  const dir = setupDir([])
  assert.strictEqual(getNextNumber(dir), "01")
})

test("getNextNumber 已有故事时返回最大序号 + 1", () => {
  const dir = setupDir(["01-故事A", "02-故事B", "03-故事C"])
  assert.strictEqual(getNextNumber(dir), "04")
})

test("getNextNumber 非连续序号取最大 + 1", () => {
  const dir = setupDir(["01-故事A", "05-故事B"])
  assert.strictEqual(getNextNumber(dir), "06")
})

test("getNextNumber 排除非 NN- 前缀目录", () => {
  const dir = setupDir(["01-故事A", "not-a-story", "README.md"])
  assert.strictEqual(getNextNumber(dir), "02")
})

test("getNextNumber 排除基础设施目录", () => {
  const dir = setupDir(["01-故事A", "node_modules", "dist", "assets", ".git"])
  assert.strictEqual(getNextNumber(dir), "02")
})

test("getNextNumber 三位数序号正确递增", () => {
  const dir = setupDir(["01-故事A", "99-故事B", "100-故事C"])
  assert.strictEqual(getNextNumber(dir), "101")
})

test("getNextNumber 应用 .storyignore 排除目录", () => {
  const dir = setupDir(["01-故事A", "02-草稿"])
  fs.writeFileSync(path.join(dir, ".storyignore"), "*-草稿/\n", "utf-8")
  assert.strictEqual(getNextNumber(dir), "02")
})
