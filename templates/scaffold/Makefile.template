# ══════════════════════════════════════════════════════
# story-cli 工作流入口
# 使用 make help 查看所有可用命令
# ══════════════════════════════════════════════════════

TITLE ?=
TYPE ?= original
LANG ?= zh
MESSAGE ?= "chore: update stories"
FORMAT ?= epub

.PHONY: help init new build commit push epub export import stats link validate analyze clean verify

## 📖 显示所有可用命令
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-8s\033[0m %s\n", $$1, $$2}'

## 🚀 初始化故事仓库
init:
	story init

## ✨ 新建故事并自动构建: make new TITLE="标题" [TYPE=fanfic] [LANG=en]
new:
	@if [ -z "$(TITLE)" ]; then \
	  echo "❌ 请指定标题: make new TITLE=\"我的故事\""; \
	  exit 1; \
	fi
	story new "$(TITLE)" --type=$(TYPE) --lang=$(LANG)
	$(MAKE) build

## 🔨 构建所有 README
build:
	story build

## 📝 构建并提交: make commit [MESSAGE="提交信息"]
commit:
	$(MAKE) build
	git add -A
	git diff --cached --quiet || git commit -m "$(MESSAGE)"

## 🚢 构建、提交并推送
push:
	$(MAKE) commit
	git push

## 📖 导出 EPUB: make epub [TITLE="书名"]（不指定 TITLE 时导出全部）
epub:
	@if [ -z "$(TITLE)" ]; then \
	  story epub --all; \
	else \
	  story epub "$(TITLE)"; \
	fi

## 📤 导出: make export FORMAT=html|txt|json|md|embeddings
export:
	story export $(FORMAT)

## ↩️ 从 JSON 导入: make import FILE=path.json
import:
	story import json $(FILE)

## 📊 查看创作统计
stats:
	story stats

## 🔗 管理关联故事: make link A=源故事 B=目标故事（A/B 为文件夹名或标题）
link:
	@if [ -z "$(A)" ] || [ -z "$(B)" ]; then \
	  echo "❌ 请指定关联: make link A=\"源故事\" B=\"目标故事\""; \
	  exit 1; \
	fi
	story link "$(A)" "$(B)"

## ✅ 合规检查（Story-Repo 规范）
validate:
	story validate

## 📈 写作质量分析（依赖 jq；重复短语 / 章节趋势）
analyze:
	story stats --json | jq '{overview: {storyCount, totalWords}, repeated_phrases: .analysis.repeated, chapter_trends: [.stories[] | {title, chapterCount, chapters: [.chapters[].rawWordCount]}]}'

## 🧹 清理构建产物
clean:
	rm -rf dist/
## ✅ 一键验证（校验配置 + 构建）
verify:
	story build --validate-only && story build
