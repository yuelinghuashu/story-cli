# ══════════════════════════════════════════════════════
# story-cli 开发工作流
# 使用 make help 查看所有可用命令
# ══════════════════════════════════════════════════════

.PHONY: help build test typecheck lint lint-fix format demo

## 📖 显示所有可用命令
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

## 🏗️ 编译构建（tsc → dist/）
build:
	pnpm build

## 🧪 运行全部测试（node:test）
test:
	pnpm test

## 🔍 TypeScript 类型检查
typecheck:
	pnpm typecheck

## 🔧 代码规范检查（biome）
lint:
	pnpm lint

## 🛠️ 自动修复代码规范
lint-fix:
	pnpm lint:fix

## 🎨 格式化代码
format:
	pnpm format

## 🎬 生成示例故事仓库（开发验证用）
demo:
	node bin/index.ts demo