#!/usr/bin/env bash
# 在 Linux 上用 Wine 跑 beacon signer —— 不需要 Windows。
#
# 前置：wine64（Debian/Ubuntu: apt-get install -y --no-install-recommends wine64）
# 用法：
#   ./run-wine.sh                # 首次会下 node.exe，然后前台起服务
#   SIGNER_HOST=0.0.0.0 ./run-wine.sh
#
# 目录约定：
#   <repo>/native/                     4 个 Windows 文件（仓库自带）
#   <this>/node-win/node.exe           首次自动下载
#   <this>/wineprefix/                 首次自动创建（约 700 MB）
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
NATIVE_DIR="${BEACON_NATIVE_DIR:-$ROOT/native}"
NODE_DIR="$HERE/node-win"
NODE_EXE="$NODE_DIR/node.exe"
WINEPREFIX="${WINEPREFIX:-$HERE/wineprefix}"
NODE_VERSION="${NODE_VERSION:-v22.20.0}"
MIRROR="${NODE_MIRROR:-https://registry.npmmirror.com/-/binary/node}"
export WINEPREFIX WINEARCH=win64 WINEDEBUG=-all
export WINEDLLOVERRIDES="mscoree,mshtml="
export SIGNER_HOST="${SIGNER_HOST:-127.0.0.1}"
export SIGNER_PORT="${SIGNER_PORT:-9024}"
export BEACON_NATIVE_DIR="$NATIVE_DIR"

WINE_BIN="${WINE_BIN:-}"
if [ -z "$WINE_BIN" ]; then
  for c in wine64 /usr/lib/wine/wine64 wine; do
    if command -v "$c" >/dev/null 2>&1 || [ -x "$c" ]; then WINE_BIN="$c"; break; fi
  done
fi
[ -n "$WINE_BIN" ] || { echo "找不到 wine64，先装：apt-get install -y --no-install-recommends wine64" >&2; exit 1; }

if [ ! -f "$NODE_EXE" ]; then
  echo "下载 node.exe $NODE_VERSION ..."
  mkdir -p "$NODE_DIR"
  tmp="$(mktemp -d)"
  # -L 必须带：npmmirror 的二进制是 302 到 cdn.npmmirror.com
  curl -fL --retry 3 -o "$tmp/node.zip" "$MIRROR/$NODE_VERSION/node-$NODE_VERSION-win-x64.zip"
  ( cd "$tmp" && unzip -qo node.zip )
  cp "$tmp/node-$NODE_VERSION-win-x64/node.exe" "$NODE_EXE"
  rm -rf "$tmp"
  echo "node.exe -> $NODE_EXE"
fi

if [ ! -d "$WINEPREFIX" ]; then
  echo "初始化 wineprefix（首次较慢）..."
  "$WINE_BIN" wineboot --init >/dev/null 2>&1 || true
  # wine 默认把自己报成 win7，node 会拒绝启动（Node.js is only supported on Windows 8.1+）
  "$WINE_BIN" reg add "HKCU\\Software\\Wine" /v Version /d win10 /f >/dev/null 2>&1 || true
fi

echo "listening on http://$SIGNER_HOST:$SIGNER_PORT  native=$NATIVE_DIR"
# ⚠ Wine 下 node 的 stdout 会抛 spawn EINVAL，所以 signer 只往日志文件写
exec "$WINE_BIN" "$NODE_EXE" "$HERE/signer.js"
