import fs from "node:fs"
import Handlebars from "handlebars"

// 注册 eq helper：{{#if (eq a b)}} ... {{/if}}
Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b)

/** 缓存条目：编译结果 + 文件 mtime（用于失效检测） */
interface TemplateCacheEntry {
  compiled: Handlebars.TemplateDelegate
  mtime: number
}

/** 模板编译结果缓存（避免重复读取文件 + 重复编译） */
const templateCache = new Map<string, TemplateCacheEntry>()

/**
 * 使用 handlebars 渲染模板
 * 编译结果按「模板路径 + mtime」缓存，模板文件被修改后自动失效重新编译
 * @param templatePath 模板文件路径
 * @param data 模板数据
 * @returns 渲染结果
 */
export function renderTemplate(templatePath: string, data: Record<string, unknown>): string {
  // 检查文件 mtime，模板被修改时缓存失效（Watch 模式下用户编辑模板能立即生效）
  const entry = templateCache.get(templatePath)
  const mtime = fs.statSync(templatePath).mtimeMs

  if (!entry || entry.mtime !== mtime) {
    const source = fs.readFileSync(templatePath, "utf-8")
    const compiled = Handlebars.compile(source)
    templateCache.set(templatePath, { compiled, mtime })
    return compiled(data)
  }

  return entry.compiled(data)
}
