import fs from "node:fs"
import Handlebars from "handlebars"

// 注册 eq helper：{{#if (eq a b)}} ... {{/if}}
Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b)

/** 模板编译结果缓存（避免重复读取文件 + 重复编译） */
const templateCache = new Map<string, Handlebars.TemplateDelegate>()

/**
 * 使用 handlebars 渲染模板
 * 编译结果按模板路径缓存，多次渲染同一模板时避免重复编译
 * @param templatePath 模板文件路径
 * @param data 模板数据
 * @returns 渲染结果
 */
export function renderTemplate(templatePath: string, data: Record<string, unknown>): string {
  let compiled = templateCache.get(templatePath)
  if (!compiled) {
    const source = fs.readFileSync(templatePath, "utf-8")
    compiled = Handlebars.compile(source)
    templateCache.set(templatePath, compiled)
  }
  return compiled(data)
}
