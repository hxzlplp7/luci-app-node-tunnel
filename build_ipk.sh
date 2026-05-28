#!/bin/bash
# build_ipk.sh - 一键将 luci-app-node-tunnel 打包为标准的 OpenWrt .ipk 安装文件
# 请在 luci-app-node-tunnel 的同级父目录或该目录中执行
set -e

PKG_NAME="luci-app-node-tunnel"
PKG_VER="1.0.0-1"
WORK_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="${WORK_DIR}/.build_tmp"
IPK_OUT="${WORK_DIR}/${PKG_NAME}_${PKG_VER}_all.ipk"

echo "==> [1/6] 正在清理上一次的临时编译目录..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "==> [2/6] 正在筹备 ipkg 控制和安装后脚本..."
mkdir -p "${BUILD_DIR}/control"
cp "${WORK_DIR}/ipkg/control"  "${BUILD_DIR}/control/control"
cp "${WORK_DIR}/ipkg/postinst" "${BUILD_DIR}/control/postinst"
chmod 0755 "${BUILD_DIR}/control/postinst"

echo "==> [3/6] 正在根据目录树规范归档插件资源文件..."
mkdir -p "${BUILD_DIR}/data"

# ── 写入 /etc/config/node_tunnel 配置文件 ──────────────────────────────────────────────────
install -Dm 0644 \
    "${WORK_DIR}/root/etc/config/node_tunnel" \
    "${BUILD_DIR}/data/etc/config/node_tunnel"

# ── 写入 /etc/init.d/node_tunnel 守护启动管理脚本 ──────────────────────────────────────────
install -Dm 0755 \
    "${WORK_DIR}/root/etc/init.d/node_tunnel" \
    "${BUILD_DIR}/data/etc/init.d/node_tunnel"

# ── 写入 LuCI 菜单映射定义 ────────────────────────────────────────────────────────────────
install -Dm 0644 \
    "${WORK_DIR}/root/usr/share/luci/menu.d/luci-app-node-tunnel.json" \
    "${BUILD_DIR}/data/usr/share/luci/menu.d/luci-app-node-tunnel.json"

# ── 写入 LuCI 交互视图控制代码 ────────────────────────────────────────────────────────────────
install -Dm 0644 \
    "${WORK_DIR}/root/usr/share/luci/view/node_tunnel.js" \
    "${BUILD_DIR}/data/usr/share/luci/view/node_tunnel.js"

echo "==> [4/6] 正在利用 tar 归档控制域及数据域包 (统一 root 用户及组权限)..."
cd "${BUILD_DIR}/control"
tar --numeric-owner --group=0 --owner=0 -czf "${BUILD_DIR}/control.tar.gz" .

cd "${BUILD_DIR}/data"
tar --numeric-owner --group=0 --owner=0 -czf "${BUILD_DIR}/data.tar.gz" .

echo "==> [5/6] 正在写入 debian-binary 规范声明..."
echo "2.0" > "${BUILD_DIR}/debian-binary"

echo "==> [6/6] 正在利用 ar 命令打包为标准的 .ipk 格式包..."
cd "$BUILD_DIR"
ar rcs "$IPK_OUT" debian-binary control.tar.gz data.tar.gz

# 清理临时编译残留
rm -rf "$BUILD_DIR"

echo ""
echo "✅  .ipk 插件包制作成功！"
echo "    文件路径: $IPK_OUT"
echo ""
echo "    您可以将此文件上传到您的路由器上进行安装："
echo "    1. 发送到路由器: scp ${PKG_NAME}_${PKG_VER}_all.ipk root@192.168.1.1:/tmp/"
echo "    2. 登录路由器: ssh root@192.168.1.1"
echo "    3. 一键安装: opkg install /tmp/${PKG_NAME}_${PKG_VER}_all.ipk"
echo ""
