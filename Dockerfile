# story-cli MCP Server — container image for Glama / Smithery directories
#
# story-cli runs a stdio MCP server (`story mcp-server`). This image is built
# from the published npm package so directory builds stay deterministic and
# require no toolchain (TypeScript/pnpm) in the runtime stage.
#
# Local smoke test:
#   docker build -t story-cli-mcp .
#   printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | docker run --rm -i story-cli-mcp

FROM node:22-slim

# 安装已发布的 CLI（运行时依赖仅 fflate + handlebars，纯 JS，无编译步骤）
RUN npm install -g @yuelinghuashu/story-cli@1.5.1 \
  && npm cache clean --force

# MCP stdio server 无需仓库内容即可响应 initialize / tools/list（工具调用时才读写目录）
WORKDIR /repo

ENV NODE_ENV=production

# 非 root 运行（目录平台安全检查惯例）
USER node

ENTRYPOINT ["story", "mcp-server"]
