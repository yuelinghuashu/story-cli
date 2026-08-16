import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const rootDir = fileURLToPath(new URL("..", import.meta.url))
const actionPath = path.join(rootDir, ".github", "actions", "story-cli", "action.yml")
const workflowPath = path.join(rootDir, ".github", "workflows", "example.yml")

test("action.yml 存在且包含必要字段", () => {
  assert.ok(fs.existsSync(actionPath), "action.yml 应存在")
  const content = fs.readFileSync(actionPath, "utf-8")
  assert.ok(content.includes("name:"), "应包含 name")
  assert.ok(content.includes("inputs:"), "应包含 inputs")
  assert.ok(content.includes("runs:"), "应包含 runs")
  assert.ok(content.includes("using: 'composite'"), "应使用 composite")
  assert.ok(content.includes("command:"), "应包含 command 输入")
  assert.ok(content.includes("cli-version:"), "应包含 cli-version 输入")
  assert.ok(content.includes("working-directory:"), "应包含 working-directory 输入")
  assert.ok(content.includes("actions/setup-node@v4"), "应使用 setup-node")
  assert.ok(content.includes("npx --yes"), "应使用 npx --yes")
  assert.ok(content.includes("@yuelinghuashu/story-cli"), "应引用 npm 包名")
})

test("example.yml 展示用户使用方式", () => {
  assert.ok(fs.existsSync(workflowPath), "example.yml 应存在")
  const content = fs.readFileSync(workflowPath, "utf-8")
  assert.ok(content.includes("actions/checkout@v4"), "应包含 checkout")
  assert.ok(content.includes("yuelinghuashu/story-cli@v1"), "应引用 Action")
  assert.ok(content.includes('command: "build"'), "应包含 build 命令")
  assert.ok(content.includes('command: "epub --all"'), "应包含 epub 命令")
})
