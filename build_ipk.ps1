# build_ipk.ps1 - 一键在 Windows PowerShell 下打包 luci-app-node-tunnel 插件为标准的 .ipk 包
# 该脚本利用 Windows 10/11 自带的 tar.exe 引擎，无需任何第三方工具链

$PkgName = "luci-app-node-tunnel"
$PkgVer = "1.0.0-1"
$WorkDir = Get-Location
$BuildDir = Join-Path $WorkDir ".build_tmp"
$IpkOut = Join-Path $WorkDir "${PkgName}_${PkgVer}_all.ipk"

Write-Host "==> [1/5] 正在初始化打包工作空间..." -ForegroundColor Cyan
if (Test-Path $BuildDir) { Remove-Item -Recurve -Force $BuildDir }
New-Item -ItemType Directory -Path $BuildDir | Out-Null

# ── 1. 筹备并压缩控制指令域 (control.tar.gz) ──────────────────────────────────────────────────
Write-Host "==> [2/5] 正在打包控制信息域 (control)..." -ForegroundColor Cyan
$CtrlTmp = Join-Path $BuildDir "control"
New-Item -ItemType Directory -Path $CtrlTmp | Out-Null
Copy-Item -Path (Join-Path $WorkDir "ipkg/control") -Destination (Join-Path $CtrlTmp "control")
Copy-Item -Path (Join-Path $WorkDir "ipkg/postinst") -Destination (Join-Path $CtrlTmp "postinst")

# 利用 Windows 内置的 tar 引擎进行归档 (强制使用 USTAR 格式以保障 Linux 的完美兼容性)
Push-Location $CtrlTmp
tar.exe -czf (Join-Path $BuildDir "control.tar.gz") --format=ustar *
Pop-Location

# ── 2. 筹备并压缩应用文件数据域 (data.tar.gz) ─────────────────────────────────────────────────
Write-Host "==> [3/5] 正在归档应用数据树 (data)..." -ForegroundColor Cyan
$DataTmp = Join-Path $BuildDir "data"
New-Item -ItemType Directory -Path $DataTmp | Out-Null

# 在临时目录中物理还原 OpenWrt 系统底层的安装目录结构
New-Item -ItemType Directory -Path (Join-Path $DataTmp "etc/config") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $DataTmp "etc/init.d") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $DataTmp "usr/share/luci/menu.d") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $DataTmp "usr/share/luci/view") -Force | Out-Null

# 复制文件
Copy-Item -Path (Join-Path $WorkDir "root/etc/config/node_tunnel") -Destination (Join-Path $DataTmp "etc/config/node_tunnel")
Copy-Item -Path (Join-Path $WorkDir "root/etc/init.d/node_tunnel") -Destination (Join-Path $DataTmp "etc/init.d/node_tunnel")
Copy-Item -Path (Join-Path $WorkDir "root/usr/share/luci/menu.d/luci-app-node-tunnel.json") -Destination (Join-Path $DataTmp "usr/share/luci/menu.d/luci-app-node-tunnel.json")
Copy-Item -Path (Join-Path $WorkDir "root/usr/share/luci/view/node_tunnel.js") -Destination (Join-Path $DataTmp "usr/share/luci/view/node_tunnel.js")

# 打包数据文件夹
Push-Location $DataTmp
tar.exe -czf (Join-Path $BuildDir "data.tar.gz") --format=ustar etc usr
Pop-Location

# ── 3. 创建 debian-binary 规范声明文件 ──────────────────────────────────────────────────────────
Write-Host "==> [4/5] 写入 debian-binary 规范版本声明..." -ForegroundColor Cyan
"2.0`n" | Out-File -FilePath (Join-Path $BuildDir "debian-binary") -Encoding ascii -NoNewline

# ── 4. 合并打包生成最终的兼容性 .ipk 格式包 ───────────────────────────────────────────────────────
Write-Host "==> [5/5] 正在打包整合为最终的安装包..." -ForegroundColor Cyan
Push-Location $BuildDir
tar.exe -czf $IpkOut --format=ustar debian-binary control.tar.gz data.tar.gz
Pop-Location

# 清理临时编译产生的缓存文件夹，保护闪存与磁盘健康
Remove-Item -Recurve -Force $BuildDir

Write-Host "`n✅  luci-app-node-tunnel 插件在 Windows 下打包成功！" -ForegroundColor Green
Write-Host "    输出包体路径: $IpkOut"
Write-Host "    您现在可以直接将该 .ipk 文件通过 SCP 上传到您的路由器，然后执行以下命令安装："
Write-Host "    opkg install /tmp/luci-app-node-tunnel_1.0.0-1_all.ipk`n" -ForegroundColor Yellow
