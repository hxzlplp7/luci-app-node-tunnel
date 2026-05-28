# 项目上下文：OpenFRP 节点隧道路由器插件 (luci-app-node-tunnel)

## 1. 项目概述
这是一个用于 OpenWrt 路由器的 LuCI 插件，旨在帮助用户：
- 在本地路由器上使用 `sing-box` 或 `xray` 搭建本地代理节点（如 SOCKS5、HTTP、Trojan、Vless 等）。
- 使用 `cloudflare` (Argo 隧道) 或 `frp` 将本地节点或内网的其他服务（如路由器管理页面、NAS 等）反向代理到公网。
- Argo 隧道要求支持：
  - 临时隧道（Quick Tunnel，通过 `trycloudflare.com`，无需配置 Token 即可快速使用）。
  - 永久隧道（Named Tunnel，支持配置 Argo Tunnel Token 或 JSON 凭证文件）。
- 插件打包格式为 OpenWrt 标准的 `.ipk` 文件。

## 2. 技术栈
- **LuCI 界面**：基于 LuCI2 (Javascript + JSON) 或经典 LuCI (Lua CBI)，为了兼容现代 OpenWrt（21.02+ / 22.03+ / 23.05+），采用现代的 JavaScript API。
- **配置系统**：OpenWrt UCI (`/etc/config/node_tunnel`)。
- **服务守护**：OpenWrt Init 脚本 (`/etc/init.d/node_tunnel`)，使用 Procd 进行守护进程管理。
- **二进制依赖**：`sing-box` 或 `xray-core`，`cloudflared` (Argo) 或 `frpc` (FRP 客户端)。

## 3. 核心目录结构规划
```text
luci-app-node-tunnel/
├── Makefile                          # OpenWrt 软件包编译/打包 Makefile
├── ipkg/
│   └── postinst                      # 安装后脚本（设置执行权限、重启服务等）
└── root/
    ├── etc/
    │   ├── config/
    │   │   └── node_tunnel           # UCI 配置文件，存储用户参数
    │   └── init.d/
    │       └── node_tunnel           # Procd 启动管理脚本，控制后台服务
    └── usr/
        └── share/
            └── luci/
                ├── menu.d/
                │   └── luci-app-node-tunnel.json  # 菜单配置文件
                └── view/
                    └── node_tunnel.js             # 界面主要前端逻辑（JS CBI 架构）
```
