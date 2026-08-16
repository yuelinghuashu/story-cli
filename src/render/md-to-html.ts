/**
 * Markdown → HTML 转换器
 * 将 Markdown 文本转为 HTML（story-cli 内部使用，供 EPUB / HTML 导出共享）
 */
import { escapeHtml, sanitizeUrl } from "./html-utils.ts"

/**
 * 渲染行内 Markdown 格式
 *
 * 设计原则：
 * 1. 对行内格式使用递归处理（processInline），支持嵌套格式（粗体中的斜体等）
 * 2. 使用占位符保护已生成的 HTML 片段，避免被后续 escapeHtml 二次转义
 * 3. 反斜杠转义序列在开始时保护，结束时恢复
 * 4. 行内代码优先处理，其内容中的格式标记不会干扰外部解析
 */
/**
 * 平衡 URL 中的括号（移除尾部多余右括号）
 * 例如：https://example.com/path_(v1)) → https://example.com/path_(v1)
 * 如果 URL 中的左括号和右括号不匹配，则移除尾部多余的右括号
 * @param url 原始 URL
 * @returns 平衡后的 URL；如果无法平衡则返回 null
 */
function balanceUrlParens(url: string): string | null {
  const openCount = (url.match(/\(/g) ?? []).length
  let closeCount = (url.match(/\)/g) ?? []).length
  let balanced = url
  // 移除尾部多余的右括号，直到括号配对
  while (closeCount > openCount && balanced.endsWith(")")) {
    balanced = balanced.slice(0, -1)
    closeCount--
  }
  return balanced
}

function renderInline(text: string): string {
  // 1. 保护反斜杠转义序列（\*、\_ 等），防止被行内格式正则误解析
  const backslashEscapes: Array<{ token: string; char: string }> = []
  let protectedText = text.replace(/\\([\\*_`{}[\]()#+\-.!|><~])/g, (_match, char: string) => {
    const token = `\u0000ESC${backslashEscapes.length}\u0000`
    backslashEscapes.push({ token, char })
    return token
  })

  // 2. 生成的 HTML 片段列表（用占位符保护，后续 escapeHtml 不会污染）
  const htmlFragments: Array<{ token: string; html: string }> = []
  const protect = (html: string): string => {
    const token = `\u0000HTML${htmlFragments.length}\u0000`
    htmlFragments.push({ token, html })
    return token
  }

  // 3. 递归处理行内格式（支持嵌套）
  const processInline = (input: string): string => {
    let result = input

    // 行内代码优先（保护内部的格式标记，使 ``` 不会干扰其他解析）
    result = result.replace(/`([^`\n]+)`/g, (_match, content: string) => protect(`<code>${escapeHtml(content)}</code>`))

    // 图片（alt 和 src 捕获组分别转义）
    result = result.replace(/!\[([^\]]*)\]\(([^)\n]+)\)/g, (_match, alt: string, url: string) => {
      const safe = sanitizeUrl(url.trim())
      if (!safe) return ""
      return protect(`<img src="${escapeHtml(safe)}" alt="${escapeHtml(alt)}"/>`)
    })

    // 粗体（内容递归处理，支持嵌入斜体/删除线等）
    result = result.replace(/\*\*(.+?)\*\*/g, (_match, content: string) =>
      protect(`<strong>${processInline(content)}</strong>`),
    )

    // 斜体（内容递归处理）
    result = result.replace(/\*(?!\s)(.+?)(?<!\s)\*/g, (_match, content: string) =>
      protect(`<em>${processInline(content)}</em>`),
    )

    // 删除线（内容递归处理）
    result = result.replace(/~~(.+?)~~/g, (_match, content: string) => protect(`<del>${processInline(content)}</del>`))

    // 链接（http(s) URL 优先精确匹配；支持 URL 中的括号配对）
    result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^\s]*)\)/g, (_match, label: string, url: string) => {
      const balancedUrl = balanceUrlParens(url)
      const safe = balancedUrl !== null ? sanitizeUrl(balancedUrl) : null
      return safe ? protect(`<a href="${escapeHtml(safe)}">${processInline(label)}</a>`) : processInline(label)
    })
    // 链接（其他协议如 mailto:，由 sanitizeUrl 统一过滤危险协议）
    result = result.replace(/\[([^\]]+)\]\(([^)\n]+)\)/g, (_match, label: string, url: string) => {
      const safe = sanitizeUrl(url.trim())
      return safe ? protect(`<a href="${escapeHtml(safe)}">${processInline(label)}</a>`) : processInline(label)
    })

    return result
  }

  protectedText = processInline(protectedText)

  // 4. 转义剩余纯文本（HTML 片段由占位符保护，不被转义）
  protectedText = escapeHtml(protectedText)

  // 5. 恢复 HTML 片段（循环直到没有更多占位符，支持嵌套占位符恢复）
  let finalText = protectedText
  let hadReplacements = true
  while (hadReplacements) {
    hadReplacements = false
    for (const { token, html } of htmlFragments) {
      if (finalText.includes(token)) {
        finalText = finalText.split(token).join(html)
        hadReplacements = true
      }
    }
  }
  protectedText = finalText

  // 6. 恢复反斜杠转义字符为字面量（\* → *）
  return backslashEscapes.reduce((acc, { token, char }) => acc.split(token).join(char), protectedText)
}

/**
 * 渲染嵌套列表（支持无序/有序 + 缩进嵌套 + 缩进续行）
 * 算法：
 *   1. 递归地在同一缩进级别收集列表项
 *   2. 当遇到更深缩进的列表项时，递归构建其子列表
 *   3. 当遇到更深缩进的非列表行时，作为续行内容追加到当前项
 *   4. 子列表 HTML 嵌入到前一个 <li> 内部
 *   5. 相同列表类型（ul/ol）的连续项归入同一个 <ul>/<ol>
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

    // 处理后续行：更深缩进（列表项 → 子列表；非列表行 → 续行）
    while (i < lines.length) {
      const nextLine = lines[i]
      const nextIndent = getIndent(nextLine)

      // 缩进等于或小于当前级别 → 不是子项，退出处理
      if (nextIndent <= baseIndent) break

      // 更深缩进的列表项 → 递归构建子列表
      if (/^\s*([-*+]|\d+\.)\s+/.test(nextLine)) {
        const nested = renderNestedList(lines, i)
        item.subList = nested.html
        i = nested.nextIndex
        continue
      }

      // 更深缩进的非列表行 → 作为续行内容（转换为 <br/> 换行）
      if (nextLine.trim()) {
        item.content = `${item.content}\n${nextLine.trim()}`
        i++
        continue
      }
      break
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
      // renderInline 内部处理转义，直接传入 raw 内容；换行转换为 <br/>
      const content = renderInline(item.content).replace(/\n/g, "<br/>")
      html += `<li>${content}`
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
 * 注意：Tab 按 4 个空格计算（Markdown 标准缩进是 4 空格，2 空格可能导致嵌套级别判断偏差）
 * @param line 文本行
 * @returns 缩进深度
 */
function getIndent(line: string): number {
  const match = line.match(/^\s*/)
  return match ? match[0].replace(/\t/g, "    ").length : 0
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
          const headers = tableLines[0].split("|").map((c) => renderInline(c.trim()))
          const rows = tableLines
            .slice(2)
            .filter((r) => r.trim())
            .map((r) => r.split("|").map((c) => renderInline(c.trim())))
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

      // 引用块（递归调用 mdToHtml 支持块级语法）
      if (lines.every((l) => /^>\s?/.test(l))) {
        const quoteContent = lines.map((l) => l.replace(/^>\s?/, "")).join("\n")
        const innerHtml = mdToHtml(quoteContent)
        return `<blockquote>\n${innerHtml}\n</blockquote>`
      }

      // 标题（# → h2，## → h2，###+ → h3；章节标题已在模板中单独输出 h1）
      const firstLine = lines[0]?.trim() ?? ""
      const headingMatch = firstLine.match(/^(#{1,6})\s+(.+)$/)
      if (headingMatch) {
        const hashes = headingMatch[1].length
        const level = hashes <= 2 ? 2 : 3
        const title = renderInline(headingMatch[2])
        // 标题后紧跟正文（无空行）时，剩余行作为段落输出
        const rest = lines.slice(1).join("\n").trim()
        if (rest) {
          return `<h${level}>${title}</h${level}>\n<p>${renderInline(rest).replace(/\n/g, "<br/>")}</p>`
        }
        return `<h${level}>${title}</h${level}>`
      }

      // 水平线
      if (/^(-{3,}|\*{3,})$/.test(trimmed)) return "<hr/>"

      // 普通段落（含 <br/> 换行）
      // renderInline 内部处理转义，先渲染再替换换行为 <br/>
      return `<p>${renderInline(trimmed).replace(/\n/g, "<br/>")}</p>`
    })
    .filter(Boolean)
    .join("\n")
}
