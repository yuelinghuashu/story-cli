/**
 * 公共 HTML 工具模块
 * 集中管理 HTML 转义、危险 URL 过滤、页面样式等跨模块共享工具
 */

import fs from "node:fs"
import path from "node:path"

// 使用 String.fromCharCode 拼接 HTML 实体，避免字符串被 XML/格式化器解析转义
const AMP = `${String.fromCharCode(38)}amp;`
const LT = `${String.fromCharCode(38)}lt;`
const GT = `${String.fromCharCode(38)}gt;`
const QUOT = `${String.fromCharCode(38)}quot;`
const APOS = `${String.fromCharCode(38)}apos;`

/**
 * 转义 HTML 特殊字符
 * @param text 输入文本
 * @returns 转义后的文本
 */
export function escapeHtml(text: unknown): string {
  return String(text).replace(/&/g, AMP).replace(/</g, LT).replace(/>/g, GT).replace(/"/g, QUOT).replace(/'/g, APOS)
}

/** 允许的 data URI 图片类型（白名单） */
const ALLOWED_DATA_IMAGE_TYPES = /^data:image\/(png|jpe?g|gif|webp|bmp);/i

/**
 * 过滤危险 URL 协议（XSS 防护）
 * 允许：http(s)、mailto、相对路径、安全的 data:image/* 图片
 * 禁止：javascript:、vbscript:、data:image/svg+xml（可嵌入脚本）、data:text/html 等
 * @param url 原始 URL
 * @returns 安全 URL；危险 URL 返回 null
 */
export function sanitizeUrl(url: string): string | null {
  // 去除前导空白和 ASCII 控制字符（避免在正则中匹配控制字符）
  let trimmed = url.trim()
  let start = 0
  while (start < trimmed.length && trimmed.charCodeAt(start) < 0x20) {
    start++
  }
  trimmed = trimmed.slice(start)

  // 过滤危险协议
  if (/^(javascript|vbscript|data:text\/html)/i.test(trimmed)) return null
  // data: URI 仅允许白名单图片类型（SVG 可嵌入脚本/事件属性，必须拒绝）
  if (/^data:/i.test(trimmed) && !ALLOWED_DATA_IMAGE_TYPES.test(trimmed)) return null
  return trimmed
}

/**
 * 通用页面样式（export-html.ts 使用）
 */
export const PAGE_STYLE = `
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.7; }
    h1 { border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .back { display: inline-block; margin-bottom: 1.5rem; color: #666; }
    blockquote { border-left: 4px solid #eee; margin-left: 0; padding-left: 1rem; color: #666; }
    pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    img { max-width: 100%; }

    /* 打印样式：浏览器「另存为 PDF」时使用 */
    @media print {
      .back { display: none; }                                    /* 隐藏返回链接 */
      h1, h2, h3 { page-break-after: avoid; }                     /* 标题不孤立在页底 */
      pre, blockquote, table, img { page-break-inside: avoid; }   /* 代码块/引用/表格/图片不跨页 */
      a { color: inherit; text-decoration: none; }                /* 链接颜色在纸面上更友好 */
      body { max-width: none; margin: 0; padding: 1rem; }         /* 打印时使用完整页宽 */
    }
`

/**
 * 读取故事 config.json 中的 title 字段
 * @param folderPath 故事文件夹路径
 * @returns title 字符串（读取失败或缺失时返回空字符串）
 */
export function readConfigTitle(folderPath: string): string {
  try {
    const configPath = path.join(folderPath, "config.json")
    if (fs.existsSync(configPath)) {
      const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>
      if (typeof rawConfig.title === "string" && rawConfig.title.trim()) {
        return rawConfig.title
      }
    }
  } catch {
    // 忽略配置读取失败
  }
  return ""
}
