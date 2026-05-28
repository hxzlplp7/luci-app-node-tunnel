#!/bin/bash
# build_ipk.sh - 严格按照 OpenWrt opkg-build 标准格式打包 .ipk
# 参考源码: https://git.openwrt.org/project/opkg-lede.git opkg-build
set -e

PKG_NAME="luci-app-node-tunnel"
PKG_VER="0.0.1-1"
WORK_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="${WORK_DIR}/.build_tmp"
IPK_OUT="${WORK_DIR}/${PKG_NAME}_${PKG_VER}_all.ipk"

echo "==> [1/6] 清理旧构建目录..."
rm -rf "$BUILD_DIR" "$IPK_OUT"
mkdir -p "$BUILD_DIR"

# ── 准备 control 目录 ────────────────────────────────────────────────────
echo "==> [2/6] 准备 control 文件..."
CTRL_DIR="${BUILD_DIR}/control_dir"
mkdir -p "$CTRL_DIR"
cp "${WORK_DIR}/ipkg/control"  "$CTRL_DIR/control"
cp "${WORK_DIR}/ipkg/postinst" "$CTRL_DIR/postinst"
chmod 0755 "$CTRL_DIR/postinst"

# 强制转换为 Unix 换行符 (LF)，避免在 Windows 平台拉取代码导致换行符变成 CRLF 从而引起 opkg 解析失败
find "$CTRL_DIR" -type f -exec sed -i 's/\r$//' {} +

# ── 准备 data 目录（还原路由器上的安装目录结构）────────────────────────────
echo "==> [3/6] 准备 data 文件树..."
DATA_DIR="${BUILD_DIR}/data_dir"
mkdir -p "$DATA_DIR"

install -Dm0644 "${WORK_DIR}/root/etc/config/node_tunnel" \
                "${DATA_DIR}/etc/config/node_tunnel"
install -Dm0755 "${WORK_DIR}/root/etc/init.d/node_tunnel" \
                "${DATA_DIR}/etc/init.d/node_tunnel"
install -Dm0644 "${WORK_DIR}/root/usr/share/luci/menu.d/luci-app-node-tunnel.json" \
                "${DATA_DIR}/usr/share/luci/menu.d/luci-app-node-tunnel.json"
install -Dm0644 "${WORK_DIR}/root/usr/share/luci/view/node_tunnel.js" \
                "${DATA_DIR}/usr/share/luci/view/node_tunnel.js"

# 强制转换为 Unix 换行符 (LF)，避免在 Windows 平台拉取代码导致换行符变成 CRLF 从而引起 opkg 解析失败
find "$DATA_DIR" -type f -exec sed -i 's/\r$//' {} +

# ── 创建三个标准组件（严格按照 opkg-build 格式要求）─────────────────────────
echo "==> [4/6] 创建 tar 归档..."

# 关键点1：control.tar.gz 内部路径必须以 ./ 开头
# 关键点2：使用 --format=gnu 确保与 BusyBox tar 兼容
cd "$CTRL_DIR"
tar --numeric-owner --group=0 --owner=0 --format=gnu -czf "${BUILD_DIR}/control.tar.gz" .

cd "$DATA_DIR"
tar --numeric-owner --group=0 --owner=0 --format=gnu -czf "${BUILD_DIR}/data.tar.gz" .

echo "==> [5/6] 写入 debian-binary..."
printf "2.0\n" > "${BUILD_DIR}/debian-binary"

# ── 组装 .ipk（严格按照 opkg-build 使用的 ar 调用方式）─────────────────────
echo "==> [6/6] 打包 .ipk..."

cd "$BUILD_DIR"
# 关键点3：ar 成员名必须使用 ./xxx 前缀，这是 opkg 解析器硬编码的期望格式
# 关键点4：不使用 s 标志（不生成符号索引）以避免 BusyBox ar 解析失败
# 关键点5：智能检测 ar 工具对 -D 确定性模式的支持，擦除打包者 UID/GID 与时间戳，规避格式错误
if ar --help 2>&1 | grep -q -- "-D"; then
    ar crD "$IPK_OUT" ./debian-binary ./control.tar.gz ./data.tar.gz
else
    ar cr "$IPK_OUT" ./debian-binary ./control.tar.gz ./data.tar.gz
fi

# 清理
rm -rf "$BUILD_DIR"

echo ""
echo "✅ 打包成功: $IPK_OUT"
echo ""
echo "安装方法:"
echo "  scp ${PKG_NAME}_${PKG_VER}_all.ipk root@<路由器IP>:/tmp/"
echo "  ssh root@<路由器IP> 'opkg install /tmp/${PKG_NAME}_${PKG_VER}_all.ipk'"
echo ""

# 自检：验证 ar 包内部结构
echo "==> 自检: ar 包内部成员列表:"
ar t "$IPK_OUT"
echo ""
