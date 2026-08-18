import assert from "node:assert"
import { test } from "node:test"
import { demoCoverPng, demoInlinePng } from "../src/commands/demo-assets.ts"

/** 解析 PNG 的 IHDR 尺寸（宽/高/位深/颜色类型） */
function readPngHeader(png: Uint8Array): { width: number; height: number; bitDepth: number; colorType: number } {
  // 签名：89 50 4E 47 0D 0A 1A 0A
  assert.strictEqual(png[0], 0x89, "PNG 签名首字节应为 0x89")
  assert.strictEqual(String.fromCharCode(png[1], png[2], png[3]), "PNG", "PNG 签名应为 PNG")
  // IHDR chunk：8 字节签名后，4 字节长度 + "IHDR" + 13 字节数据
  assert.strictEqual(String.fromCharCode(png[12], png[13], png[14], png[15]), "IHDR", "第一个 chunk 应为 IHDR")
  const view = new DataView(png.buffer, png.byteOffset + 16, 8)
  return { width: view.getUint32(0), height: view.getUint32(4), bitDepth: png[24], colorType: png[25] }
}

test("demoCoverPng 生成合法 300x400 封面", () => {
  const png = demoCoverPng()
  const header = readPngHeader(png)
  assert.strictEqual(header.width, 300)
  assert.strictEqual(header.height, 400)
  assert.strictEqual(header.bitDepth, 8)
  assert.strictEqual(header.colorType, 2, "应为 truecolor RGB")
  assert.ok(png.length > 0)
})

test("demoInlinePng 生成合法 200x120 插图", () => {
  const png = demoInlinePng()
  const header = readPngHeader(png)
  assert.strictEqual(header.width, 200)
  assert.strictEqual(header.height, 120)
})

test("demo 图片输出稳定（确定性）", () => {
  // 同一调用应产出相同字节（纯色 PNG 压缩结果确定）
  assert.deepStrictEqual(demoCoverPng(), demoCoverPng())
  assert.deepStrictEqual(demoInlinePng(), demoInlinePng())
})
