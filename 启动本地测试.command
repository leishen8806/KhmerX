#!/bin/zsh
cd -- "${0:A:h}"
RUNTIME_NODE="/Users/zhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
if [[ ! -x "$RUNTIME_NODE" ]]; then
  RUNTIME_NODE="$(command -v node)"
fi
if [[ -z "$RUNTIME_NODE" ]]; then
  print "需要 Node.js 22.13 或更高版本。"
  read "?按回车关闭"
  exit 1
fi
export PATH="${RUNTIME_NODE:h}:$PATH"
"$RUNTIME_NODE" scripts/run-framework.mjs dev --host 127.0.0.1 --port 5174
read "?服务已停止。按回车关闭"
