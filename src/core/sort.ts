/**
 * 故事排序与系列分组
 *
 * 设计目标：物理坐标（文件夹序号）永不更改，逻辑坐标（元数据）自由调整。
 * - 文件夹名是身份证（`NN-` 前缀一旦创建永不修改）
 * - series / seriesOrder 是座位号（README 展示顺序可随时调整）
 */

import { getFolderNumber } from "./scanner.ts"

/** 可排序故事的最小结构（StoryData / StorySummary 等兼容） */
export interface SortableStory {
  /** 故事文件夹名（如 "01-故事A"） */
  folder: string
  /** 系列名称（空字符串等同于未定义） */
  series?: string
  /** 系列内排序键（支持 number 或可转换的字符串） */
  seriesOrder?: unknown
}

/**
 * 系列分组结果
 */
export interface SeriesGroupResult<T extends SortableStory> {
  /** 系列分组列表（组内已按 seriesOrder 排序） */
  groups: Array<{ name: string; stories: T[] }>
  /** 未归入任何系列的故事（按文件夹序号排序） */
  ungrouped: T[]
}

/**
 * 从配置中规范化 seriesOrder 值
 * 支持 number 和可转换为数字的字符串（如 "2.5"）
 * @param raw 原始值
 * @returns 数字或 null（无法解析时）
 */
export function normalizeSeriesOrder(raw: unknown): number | null {
  if (typeof raw === "number") return raw
  if (typeof raw === "string" && raw.trim() !== "" && !Number.isNaN(Number(raw))) return Number(raw)
  return null
}

/**
 * 将故事列表按 series 分组并排序
 *
 * 规则：
 * 1. 按 series 字段分组（空字符串等同于未定义）
 * 2. 组内排序：seriesOrder 数值升序（缺失时回退文件夹序号），再按文件夹序号
 * 3. 组间排序：按组内最小文件夹序号升序，组名作为二级键保证确定性
 * 4. 独立故事按文件夹序号升序，置于所有系列组之后
 *
 * @param stories 所有已加载的故事
 * @returns 分组结果（系列组 + 独立故事）
 */
export function groupAndSortStories<T extends SortableStory>(stories: T[]): SeriesGroupResult<T> {
  const groups = new Map<string, T[]>()
  const ungrouped: T[] = []

  // 1. 分组（series 为空/空白字符串视为未定义）
  for (const story of stories) {
    const seriesName = story.series?.trim() || null
    if (seriesName) {
      if (!groups.has(seriesName)) groups.set(seriesName, [])
      const group = groups.get(seriesName)
      if (group) group.push(story)
    } else {
      ungrouped.push(story)
    }
  }

  // 2. 组内排序：seriesOrder 数值升序（缺失/无效时用文件夹序号作为排序键）
  const compareStories = (a: T, b: T): number => {
    // 缺失或无效的 seriesOrder 回退到文件夹序号（物理坐标）
    const orderA = normalizeSeriesOrder(a.seriesOrder) ?? getFolderNumber(a.folder)
    const orderB = normalizeSeriesOrder(b.seriesOrder) ?? getFolderNumber(b.folder)
    // 排序键相同时再按文件夹序号保证确定性
    if (orderA === orderB) return getFolderNumber(a.folder) - getFolderNumber(b.folder)
    return orderA - orderB
  }

  for (const group of groups.values()) {
    group.sort(compareStories)
  }

  // 3. 组间排序：按组内最小文件夹序号升序，组名作为二级键保证确定性
  // 用 reduce 替代 Math.min(...array) 展开，避免超大数据组时栈溢出
  const minFolderNumber = (stories: SortableStory[]): number =>
    stories.reduce((min, s) => Math.min(min, getFolderNumber(s.folder)), Number.MAX_SAFE_INTEGER)

  const sortedGroups = [...groups.entries()].sort((a, b) => {
    const minA = minFolderNumber(a[1])
    const minB = minFolderNumber(b[1])
    return minA - minB || a[0].localeCompare(b[0])
  })

  // 4. 独立故事按文件夹序号排序
  ungrouped.sort((a, b) => getFolderNumber(a.folder) - getFolderNumber(b.folder))

  return {
    groups: sortedGroups.map(([name, stories]) => ({ name, stories })),
    ungrouped,
  }
}
