/**
 * Markdown → HTML 转换器
 * 将 Markdown 文本转为 HTML（story-cli 内部使用，供 EPUB / HTML 导出共享）
 */
import { escapeHtml, sanitizeUrl } from "./html-utils.ts"

function renderInline(text: string): string {
  // 保护反斜杠转义序列（\*、\_ 等），防止被行内格式正则误解析
  // 在 Markdown 中，\* 应渲染为字面量 *（而非 <em>）
  const escaped: Array<{ token: string; char: string }> = []
  const protectedText = text.replace(/\\([\\*_`{}[\]()#+\-.!|><~])/g, (_match, char: string) => {
    const token = `\u0000ESC${escaped.length}\u0000`
    escaped.push({ token, char })
    return token
  })

  const html = protectedText
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, url: string) => {
      const safe = sanitizeUrl(url)
      return safe ? `<img src="${safe}" alt="${alt}"/>` : ""
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    // 注意：第一个分支只匹配 http(s):// URL。mailto: 等非 http(s) 链接
    // 会落到第二个通用分支中，由 sanitizeUrl 统一过滤危险协议（mailto: 是允许的）
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, url: string) => {
      const safe = sanitizeUrl(url)
      return safe ? `<a href="${safe}">${label}</a>` : label
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, url: string) => {
      const safe = sanitizeUrl(url)
      return safe ? `<a href="${safe}">${label}</a>` : label
    })

  // 恢复转义字符为字面量（\* → *）
  return escaped.reduce((acc, { token, char }) => acc.split(token).join(char), html)
}

/**
 * 渲染嵌套列表（支持无序/有序 + 缩进嵌套）
 * 算法：
 *   1. 递归地在同一缩进级别收集列表项
 *   2. 当遇到更深缩进的下一行时，递归构建其子列表
 *   3. 子列表 HTML 嵌入到前一个 <li> 内部
 *   4. 相同列表类型（ul/ol）的连续项归入同一个 <ul>/<ol>
 * @param lines 列表行
 * @param startIndex 起始行索引
 * @returns 渲染结果和下一个处理位置
 */
function renderNestedList(lines: string[], startIndex: number): { html: string; nextIndex: number } {
  const baseIndent = getIndent(lines[startIndex])
  const items: Array<{ tag: string; content: string; subList: string | null }> = []
  let i = startIndex

  while (i < lines.length) {
    const line = lines[i]
    const listMatch = line.match(/^\s*([-*+]|\d+\.)\s+(.+)$/)
    if (!listMatch) break

    const indent = getIndent(line)
    if (indent < baseIndent) break // 缩进级别上升（由上层处理）
    if (indent > baseIndent) break // 更深缩进（由上层递归处理）

    const item: { tag: string; content: string; subList: string | null } = {
      tag: isOrdered(line) ? "ol" : "ul",
      content: listMatch[2] ?? "",
      subList: null,
    }
    i++

    // 检查下一行是否有更深缩进 → 递归构建子列表
    if (i < lines.length) {
      const nextLine = lines[i]
      if (/^\s*([-*+]|\d+\.)\s+/.test(nextLine) && getIndent(nextLine) > baseIndent) {
        const nested = renderNestedList(lines, i)
        item.subList = nested.html
        i = nested.nextIndex
      }
    }

    items.push(item)
  }

  // 按列表类型分组生成 HTML
  let html = ""
  let currentTag: string | null = null
  let buffer: typeof items = []

  const flushList = () => {
    if (!currentTag || buffer.length === 0) return
    html += `<${currentTag}>\n`
    for (const item of buffer) {
      html += `<li>${renderInline(escapeHtml(item.content))}`
      if (item.subList) {
        html += `\n${item.subList}`
      }
      html += `</li>\n`
    }
    html += `</${currentTag}>\n`
    buffer = []
    currentTag = null
  }

  for (const item of items) {
    if (item.tag !== currentTag) {
      flushList()
      currentTag = item.tag
    }
    buffer.push(item)
  }
  flushList()

  return { html, nextIndex: i }
}

/**
 * 获取行首缩进（空格数）
 * @param line 文本行
 * @returns 缩进深度
 */
function getIndent(line: string): number {
  const match = line.match(/^\s*/)
  return match ? match[0].replace(/\t/g, "  ").length : 0
}

/**
 * 判断是否为有序列表行
 * @param line 文本行
 * @returns 是否为有序列表
 */
function isOrdered(line: string): boolean {
  return /^\s*\d+\.\s+/.test(line)
}

/**
 * 将 Markdown 文本转换为 HTML（story-cli 内部使用）
 * 支持：粗体、斜体、删除线、行内代码、标题、引用、链接、图片、有序/无序列表（含嵌套）、表格、代码块、水平线
 * @param markdown Markdown 文本
 * @returns HTML 内容
 */
export function mdToHtml(markdown: string | null | undefined): string {
  if (!markdown) return ""

  return String(markdown)
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ""

      // 代码块
      const codeMatch = trimmed.match(/^```[\w-]*\n([\s\S]*?)\n```$/)
      if (codeMatch) return `<pre><code>${escapeHtml(codeMatch[1])}</code></pre>`

      const lines = trimmed.split("\n")

      // 表格：| 列1 | 列2 | 格式
      if (lines.length >= 2 && lines.every((l) => l.trim().startsWith("|") && l.trim().endsWith("|"))) {
        const tableLines = lines.map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, ""))
        const isSeparator = (row: string) => /^[\s|:-]+$/.test(row) && row.includes("-")

        if (isSeparator(tableLines[1])) {
          const headers = tableLines[0].split("|").map((c) => renderInline(escapeHtml(c.trim())))
          const rows = tableLines
            .slice(2)
            .filter((r) => r.trim())
            .map((r) => r.split("|").map((c) => renderInline(escapeHtml(c.trim()))))
          return `<table>\n<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>\n<tbody>${rows.map((r) => `\n<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}\n</tbody>\n</table>`
        }
      }

      // 列表（含嵌套）
      if (lines.some((l) => /^\s*([-*+]|\d+\.)\s+/.test(l))) {
        // 需要检查这是否是真正的列表块（排除段落中以文本开头的行）
        const listStart = lines.findIndex((l) => /^\s*([-*+]|\d+\.)\s+/.test(l))
        if (listStart === 0) {
          return renderNestedList(lines, 0).html
        }
      }

      // 引用块
      if (lines.every((l) => /^>\s?/.test(l))) {
        const quoteContent = lines.map((l) => l.replace(/^>\s?/, "")).join("\n")
        return `<blockquote>${renderInline(escapeHtml(quoteContent))}</blockquote>`
      }

      // 标题（# → h2，## → h2，###+ → h3；章节标题已在模板中单独输出 h1）
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
      if (headingMatch) {
        const hashes = headingMatch[1].length
        const level = hashes <= 2 ? 2 : 3
        return `<h${level}>${renderInline(escapeHtml(headingMatch[2]))}</h${level}>`
      }

      // 水平线
      if (/^(-{3,}|\*{3,})$/.test(trimmed)) return "<hr/>"

      // 普通段落（含 <br/> 换行）
      // 注意：先 escapeHtml 再替换换行为 <br/>，否则 <br/> 会被转义
      return `<p>${renderInline(escapeHtml(trimmed)).replace(/\n/g, "<br/>")}</p>`
    })
    .filter(Boolean)
    .join("\n")
}
