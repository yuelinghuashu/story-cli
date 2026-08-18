/**
 * build 关联建议层（Story-Repo v2.0 links 字段的半自动机制）
 * 设计：只输出候选关联「建议」，绝不写盘（避免 dirty tree），用户用 `story link` 确认落盘
 * 规则：同一 series 且标题/简介共享关键词的故事视为候选关联
 */
import type { Language } from "./types.ts"

/** 参与建议的最小故事数据 */
export interface SuggestStoryInput {
  folder: string
  series?: string
  title: string
  summary?: string
  content: string
  lang: Language
}

/** 一条关联建议 */
export interface LinkSuggestion {
  source: string
  target: string
  /** 共享关键词数量（决定建议强度） */
  sharedKeywords: number
}

/** 提取关键词（英文按高频词 + 去停用；中文取标题去停用字后的片段）——轻量启发式 */
const ZH_STOP_CHARS = new Set(
  "的了是在我你他她它们就都也有和与及一个上下中着过吧吗呢啊呀说要会能但而是因为之其这那没把被从对向到出起于跟给让".split(
    "",
  ),
)
const EN_STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "is",
  "are",
  "was",
  "were",
  "be",
  "it",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "that",
  "this",
  "my",
  "your",
  "his",
  "her",
])

/** 从文本提取关键词集合（英文取长词、中文取 2+ 字片段） */
function keywordSet(text: string, lang: Language): Set<string> {
  const set = new Set<string>()
  if (!text) return set
  if (lang === "en") {
    for (const w of text.toLowerCase().match(/[a-z]{3,}/g) ?? []) {
      if (!EN_STOP.has(w)) set.add(w)
    }
    return set
  }
  // 中文：取连续 2 字片段（标题/简介较短，直接用片段近似关键词）
  const chars = text.match(/[\u4e00-\u9fa5]/g) ?? []
  for (let i = 0; i < chars.length - 1; i++) {
    if (ZH_STOP_CHARS.has(chars[i])) continue
    set.add(chars[i] + chars[i + 1])
  }
  return set
}

/**
 * 生成关联建议（仅返回建议，不写盘）
 * 语义与旧实现完全等价（旧实现遍历所有 (i,j) 对后跳过不同系列），
 * 但先按 series 分桶、仅桶内两两比较，避免大规模仓库下 O(n²) 全量配对
 * （无 series 的故事直接不参与比较）。
 * @param stories 参与建议的故事
 * @param minSharedTokens 成为建议的最低共享关键片段数（默认 1）
 * @returns 建议列表
 */
export function suggestLinks(stories: SuggestStoryInput[], minSharedTokens = 1): LinkSuggestion[] {
  const suggestions: LinkSuggestion[] = []
  // 每个故事预计算标题+简介的关键词
  const keywords = new Map<string, Set<string>>()
  for (const s of stories) {
    keywords.set(s.folder, keywordSet(`${s.title} ${s.summary ?? ""}`, s.lang))
  }

  // 按 series 分桶（保持首次出现顺序），桶内按原始下标两两比较
  const buckets = new Map<string, number[]>()
  for (let i = 0; i < stories.length; i++) {
    const series = stories[i].series
    if (!series) continue
    const bucket = buckets.get(series)
    if (bucket) bucket.push(i)
    else buckets.set(series, [i])
  }

  for (const indices of buckets.values()) {
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const i = indices[a]
        const j = indices[b]
        const kwa = keywords.get(stories[i].folder) ?? new Set<string>()
        const kwb = keywords.get(stories[j].folder) ?? new Set<string>()
        let shared = 0
        for (const k of kwa) if (kwb.has(k)) shared++
        if (shared >= minSharedTokens) {
          suggestions.push({ source: stories[i].folder, target: stories[j].folder, sharedKeywords: shared })
        }
      }
    }
  }
  return suggestions
}
