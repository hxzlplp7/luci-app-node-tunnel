include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-node-tunnel
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_MAINTAINER:=node-tunnel
PKG_LICENSE:=MIT

LUCI_TITLE:=Node Tunnel - Local proxy with Argo/FRP reverse proxy
LUCI_DEPENDS:=+luci-base +luci-compat +cloudflared +frpc

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot magic
$(eval $(call BuildPackage,luci-app-node-tunnel))
