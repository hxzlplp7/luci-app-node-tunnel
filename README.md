# Node Tunnel 路由器节点隧道穿透插件 (luci-app-node-tunnel)

`luci-app-node-tunnel` 是一款专为 OpenWrt 路由器打造的内网穿透与本地节点网络发布管理插件。它允许用户在路由器本地一键搭建高性能代理节点（基于 `sing-box` 或 `xray-core`），并融合了 `Cloudflare Argo 隧道` 与 `FRP 反向代理`，能够安全、快速地把本地网络环境、代理节点或路由器管理面板直接发布到公网。

---

## ⚡ 核心特色

1. **多内核本地节点**：
   - 完美适配主流的 **sing-box** 和 **xray-core**。
   - 支持一键生成精简高效的本地 SOCKS5 或 HTTP 代理节点，并支持账号密码安全认证。
2. **零门槛 Argo 临时穿透 (Quick Tunnel)**：
   - 无需 Cloudflare 账户或繁琐的 Token 配置，一键开启临时隧道。
   - 后台利用轻量级侦听线程**自动解析并捕获**动态生成的 `trycloudflare.com` 公网域名，并在 LuCI 前端仪表盘提供可点击的实时超链接。
3. **极速永久隧道 (Named Tunnel)**：
   - 支持直接填入 Cloudflare Zero Trust 平台创建的 Tunnel Token，提供持久且安全的公网访问入口。
4. **现代 FRP TOML 协议穿透**：
   - 适配最新版 FRP (>= v0.52.0) 推荐的 **TOML 配置文件规范**。
   - 允许通过 FRP 服务器轻松将本地 SOCKS5/HTTP 节点、SSH (22端口) 或路由器后台 (80端口) 转发到公网指定的 TCP/UDP 端口、或者绑定自定义域名。
5. **超级 Procd 多进程独立托管**：
   - 严谨接入 OpenWrt 标准的 **Procd 守护进程管理系统**。
   - 本地代理、Argo 隧道、FRP 客户端分别作为**物理隔离的独立服务实例**托管。任何进程因异常闪退时，Procd 会在毫秒级内自动实施重新拉起，且在启用/禁用时实现了完美的无残留脏进程清理。
6. **优雅的现代 JS 前端交互**：
   - 基于 OpenWrt 21.02+ 主流采用的 **LuCI2 Javascript CBI** 前端架构。
   - 纯 JavaScript 面板交互，对所有组件的开关、端口、日志以及运行态进行了**深度的中文汉化与描述设计**。即使在没有编译安装中文语言包的裸固件上，也能直接显示直观精美的中文页面，并支持 5 秒定时自动轮询运行状态。

---

## 📂 项目文件目录树

```text
luci-app-node-tunnel/
├── Makefile                          # OpenWrt 软件包编译构建规则文件
├── ipkg/
│   ├── control                       # 软件包元信息控制文件
│   └── postinst                      # 安装后脚本（自动重启 Web 服务并为执行文件赋权）
├── root/
│   ├── etc/
│   │   ├── config/
│   │   │   └── node_tunnel           # UCI 核心参数配置文件，存储用户参数
│   │   └── init.d/
│   │       └── node_tunnel           # Procd 多服务独立生命周期与守护控制脚本
│   └── usr/
│       └── share/
│           └── luci/
│               ├── menu.d/
│               │   └── luci-app-node-tunnel.json  # LuCI 侧边栏菜单声明
│               └── view/
│                   └── node_tunnel.js             # 汉化版的 LuCI2 JS 管理控制面板前端
└── build_ipk.sh                      # 一键自动化打包成可安装的 .ipk 工具脚本
```

---

## 🛠️ 各模块代码设计详情

### 1. 进程守护：[root/etc/init.d/node_tunnel](file:///d:/workspace/openfrp/root/etc/init.d/node_tunnel)
- **动态配置生成**：每次启动时，脚本读取当前的 UCI 选项，并在 `/var/etc/` 目录下生成 sing-box/xray 对应的精简 JSON 配置文件及 frpc 的 TOML 配置文件。不将运行期临时配置写在 `/etc/` 中，保护闪存寿命。
- **后台 URL 提取**：在临时隧道模式下，临时拉起 `start_argo_url_watcher` 线程对 `/var/log/node_tunnel_argo.log` 进行流式 grep，捕获域名并保存至 `/var/run/node_tunnel_argo.url`，提取成功即自动退出后台任务。

### 2. 交互界面：[root/usr/share/luci/view/node_tunnel.js](file:///d:/workspace/openfrp/root/usr/share/luci/view/node_tunnel.js)
- **状态看板**：通过读取系统 `service list` 判断运行 PID 并显示绿色的 `● 运行中` 或红色的 `○ 已停止` 状态徽章。
- **动态渲染**：异步读取 `/var/run/node_tunnel_argo.url`，如果发现分配了临时公网 URL，自动将其包装为外网超链接呈现在顶部卡片中，方便用户一键复制访问。

---

## 🚀 保姆级打包与安装指南

### 步骤 1：一键制作 `.ipk` 安装包
建议使用任何标准的 Linux 机器或开发主机（如 Ubuntu、WSL、Debian等）进行打包：

1. **克隆或上传项目源码**：将本 `luci-app-node-tunnel` 目录完整拷贝至打包环境。
2. **运行打包脚本**：
   ```bash
   # 进入插件目录
   cd luci-app-node-tunnel

   # 赋予脚本执行权限
   chmod +x build_ipk.sh

   # 运行一键归档打包
   ./build_ipk.sh
   ```
   **运行结果**：脚本将自动验证所有路径并处理权限（设置 `postinst` 和启动脚本的可执行权限 0755），最终在当前目录下输出软件包：`luci-app-node-tunnel_1.0.0-1_all.ipk`。

### 步骤 2：上传到 OpenWrt 路由器
通过局域网 SCP 命令或者任一图形化 SFTP/Web 传输工具，将打包好的 `.ipk` 上传到路由器的 `/tmp` 目录中：
```bash
scp luci-app-node-tunnel_1.0.0-1_all.ipk root@192.168.1.1:/tmp/
```
*(请将 `192.168.1.1` 替换为您路由器的实际 LAN IP 地址)*

### 步骤 3：登录路由器执行安装
使用 SSH 工具连接到您的路由器终端，执行以下命令安装插件及其运行所需的系统依赖：
```bash
# 登录路由器
ssh root@192.168.1.1

# 进入临时目录
cd /tmp

# 如果路由器有网络连接，建议先更新源以保障依赖包能顺利安装
opkg update

# 一键安装本地 .ipk 插件包
opkg install luci-app-node-tunnel_1.0.0-1_all.ipk
```

> **💡 核心依赖补充**：
> - 本插件本身包含 LuCI 的 JS 操作逻辑，依赖 `cloudflared` 和 `frpc` 两个穿透端（已自动在依赖中声明）。
> - 本地代理节点核心：如果您的固件中还没有安装 `sing-box` 或 `xray-core`，请根据偏好在路由器中通过 `opkg install sing-box` 或 `opkg install xray-core` 执行安装。

---

## ⚙️ 常见应用场景与使用配置

### 场景 A：创建本地 Socks5 节点，并暴露至公网（临时隧道模式）
无需任何账户，实现临时内网穿透：
1. **全局设置**：勾选 `启用 Node Tunnel 插件`。
2. **本地代理节点设置**：
   - 勾选 `启用本地节点`。
   - 核心选择 `sing-box`，协议选 `仅 SOCKS5 代理`，端口设为 `1080`。
3. **Argo 隧道设置**：
   - 勾选 `启用 Cloudflare Argo 隧道`。
   - 运行模式选 `临时隧道`。
   - 本地反代目标选择 `本地代理节点`，目标协议选择 `socks5://`，端口填 `1080`。
4. **保存并应用**：点击底部的 `保存并应用` 按钮。
5. **获取公网入口**：等待 10~15 秒，刷新页面，在顶部的 **「Argo 临时穿透服务」** 面板中，即可看到生成的公网链接（例如 `https://your-random-domain.trycloudflare.com`）。您现在即可在外网通过该 HTTP/HTTPS (自动协议转换) 访问该服务，或通过浏览器访问来进行本地路由和内网穿透！

### 场景 B：将路由器的后台 Web 管理页面映射到公网（Argo / FRP 模式）
1. **Argo 隧道模式**：
   - 启用 Argo，反代目标选择 `路由器管理后台Web面板 (HTTP 80 端口)`。
   - 临时模式下，直接通过生成的 `trycloudflare.com` 域名，即可在公网安全访问路由器的 LuCI 管理后台。
2. **FRP 穿透模式**：
   - 启用 FRP，填入您的 FRP 服务器公网 IP、端口（默认 7000）和 Token。
   - 协议类型选择 `HTTP` 或 `HTTPS`，本地目标端口填 `80`。
   - 在子域名或自定义域名中填入您的专属域名。
   - 点击 `保存并应用` 后即可在外网直接用域名远程打理您的路由器后台。

---

## 🛡️ 许可证
本项目基于 [MIT](LICENSE) 协议开源，欢迎各位路由器技术爱好者共同优化和提交 Pull Request！
