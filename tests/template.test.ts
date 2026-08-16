import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { renderTemplate } from "../src/render/template.ts"

function writeTempTemplate(content: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "template-test-"))
  const filePath = path.join(dir, "template.md")
  fs.writeFileSync(filePath, content, "utf-8")
  return filePath
}

test("renderTemplate 渲染简单变量", () => {
  const tpl = writeTempTemplate("标题：{{title}}")
  const result = renderTemplate(tpl, { title: "测试" })
  assert.strictEqual(result, "标题：测试")
})

test("renderTemplate eq 条件 (original/fanfic)", () => {
  const tpl = writeTempTemplate('{{#if (eq type "original")}}原创内容{{else}}二创内容{{/if}}')
  assert.strictEqual(renderTemplate(tpl, { type: "original" }), "原创内容")
  assert.strictEqual(renderTemplate(tpl, { type: "fanfic" }), "二创内容")
})

test("renderTemplate 缺少变量时输出空字符串", () => {
  const tpl = writeTempTemplate("{{missing}}")
  assert.strictEqual(renderTemplate(tpl, {}), "")
})

test("renderTemplate 渲染二创模板", () => {
  const tpl = writeTempTemplate('{{#if (eq type "fanfic")}}{{originalWork}} ({{originalAuthor}}){{else}}原创{{/if}}')
  const result = renderTemplate(tpl, {
    type: "fanfic",
    originalWork: "圣斗士星矢",
    originalAuthor: "车田正美",
  })
  assert.strictEqual(result, "圣斗士星矢 (车田正美)")
})

test("renderTemplate each 循环", () => {
  const tpl = writeTempTemplate("{{#if chapters}}\n{{#each chapters}}\n- {{title}} — {{wordCount}}\n{{/each}}\n{{/if}}")
  const result = renderTemplate(tpl, {
    chapters: [
      { title: "第一幕", wordCount: "约 3 千字" },
      { title: "第二幕", wordCount: "约 4 千字" },
    ],
  })
  assert.ok(result.includes("- 第一幕 — 约 3 千字"))
  assert.ok(result.includes("- 第二幕 — 约 4 千字"))
})

test("renderTemplate chapters 为空时不渲染", () => {
  const tpl = writeTempTemplate("{{#if chapters}}\n{{#each chapters}}\n- {{title}} — {{wordCount}}\n{{/each}}\n{{/if}}")
  const result = renderTemplate(tpl, {})
  assert.strictEqual(result, "")
})

test("renderTemplate 模板修改后（mtime 变化）自动失效重新编译", () => {
  const tpl = writeTempTemplate("旧内容：{{title}}")
  assert.strictEqual(renderTemplate(tpl, { title: "A" }), "旧内容：A")

  // 修改模板内容（mtime 会变化）
  fs.writeFileSync(tpl, "新内容：{{title}}", "utf-8")

  // 同一路径 + 新 mtime → 应重新编译并返回新内容
  assert.strictEqual(renderTemplate(tpl, { title: "B" }), "新内容：B")
})

test("renderTemplate 模板未修改时重复调用使用缓存", () => {
  const tpl = writeTempTemplate("缓存测试：{{title}}")
  // 第一次编译 + 缓存
  assert.strictEqual(renderTemplate(tpl, { title: "X" }), "缓存测试：X")
  // 第二次（mtime 未变）→ 使用缓存（外部无法直接观察，但行为应保持一致）
  assert.strictEqual(renderTemplate(tpl, { title: "Y" }), "缓存测试：Y")
})
