/**
 * demo 示例图片生成（零额外依赖）
 * 用 fflate（已是运行时依赖）的 zlibSync 压缩 + 手写 CRC32 生成合法纯色 PNG，
 * 供 `story demo` 演示封面渲染与正文图片嵌入。生成逻辑已用一次性脚本验证
 * （产物为合法 PNG：正确签名 + chunk 结构）。
 */
import { strToU8, zlibSync } from "fflate"

/** CRC32 查表（fflate 未导出 crc32，手写标准表驱动实现，用于 PNG chunk 校验） */
const CRC_TABLE: number[] = (() => {
  const table = new Array<number>(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** 生成纯色 PNG（8-bit truecolor RGB，无 alpha） */
function solidPng(width: number, height: number, [r, g, b]: [number, number, number]): Uint8Array {
  const ihdr = new Uint8Array(13)
  new DataView(ihdr.buffer).setUint32(0, width)
  new DataView(ihdr.buffer).setUint32(4, height)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor RGB

  // 每行 = 1 字节 filter(0) + width*3 RGB（PNG 扫描线格式）
  const raw = new Uint8Array(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 3)
    raw[row] = 0
    for (let x = 0; x < width; x++) {
      const o = row + 1 + x * 3
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
    }
  }

  // PNG chunk：4 字节长度 + 4 字节类型 + 数据 + 4 字节 CRC
  const chunk = (type: string, data: Uint8Array): Uint8Array => {
    const typeBytes = strToU8(type)
    const len = new Uint8Array(4)
    new DataView(len.buffer).setUint32(0, data.length)
    const crc = new Uint8Array(4)
    new DataView(crc.buffer).setUint32(0, crc32(new Uint8Array([...typeBytes, ...data])))
    return new Uint8Array([...len, ...typeBytes, ...data, ...crc])
  }

  // 注意：签名必须用原始字节数组——"\x89" 是 U+0089，strToU8 会按 UTF-8 编码成两字节（0xC2 0x89），破坏签名
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  return new Uint8Array([
    ...signature, // PNG 签名
    ...chunk("IHDR", ihdr),
    ...chunk("IDAT", zlibSync(raw)),
    ...chunk("IEND", new Uint8Array(0)),
  ])
}

/** 示例封面 PNG（深蓝 300x400） */
export function demoCoverPng(): Uint8Array {
  return solidPng(300, 400, [0x1a, 0x23, 0x4a])
}

/** 示例插图 PNG（浅蓝 200x120） */
export function demoInlinePng(): Uint8Array {
  return solidPng(200, 120, [0x4a, 0x6a, 0x9a])
}
