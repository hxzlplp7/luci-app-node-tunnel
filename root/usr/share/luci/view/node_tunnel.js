'use strict';
'require view';
'require form';
'require fs';
'require uci';
'require ui';
'require rpc';

// RPC 接口：声明获取系统服务运行列表的调用
var callServiceList = rpc.declare({
    object: 'service',
    method: 'list',
    params: ['name'],
    expect: { '': {} }
});

// ─── UI 渲染辅助函数 ──────────────────────────────────────────────────────────

// 渲染红绿状态徽章
function renderBadge(running, label) {
    if (running) {
        return E('span', {
            'class': 'badge badge-success',
            'style': 'background:#27ae60;color:#fff;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:bold;display:inline-block;'
        }, '● ' + (label || '运行中'));
    }
    return E('span', {
        'class': 'badge badge-danger',
        'style': 'background:#e74c3c;color:#fff;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:bold;display:inline-block;'
    }, '○ ' + (label || '已停止'));
}

// 渲染仪表盘状态行
function renderCardRow(label, valueNode) {
    return E('div', {
        'style': 'display:flex;align-items:center;padding:10px 0;border-bottom:1px solid #f2f4f8;'
    }, [
        E('span', {
            'style': 'width:180px;color:#4a5568;font-size:13px;font-weight:600;flex-shrink:0;'
        }, label),
        E('span', { 'style': 'flex:1;font-size:13px;word-break:break-all;' },
          Array.isArray(valueNode) ? valueNode : [valueNode])
    ]);
}

// ─── 视图主体 ───────────────────────────────────────────────────────────

return view.extend({

    // 轮询定时器、仪表盘和临时域名容器
    _pollInterval: null,
    _statusContainer: null,
    _argoUrlContainer: null,

    // 初始化时加载配置与服务状态
    load: function () {
        return Promise.all([
            uci.load('node_tunnel'),
            L.resolveDefault(callServiceList('node_tunnel'), {})
        ]);
    },

    // 通过 Procd 服务状态判断各子进程是否在运行
    _getProcessStatus: function (svcData) {
        var instances = L.isObject(svcData) &&
                        L.isObject(svcData['node_tunnel']) &&
                        L.isObject(svcData['node_tunnel'].instances)
                        ? svcData['node_tunnel'].instances : {};

        return {
            node: !!(instances['node'] && instances['node'].running),
            argo: !!(instances['argo'] && instances['argo'].running),
            frp:  !!(instances['frp']  && instances['frp'].running)
        };
    },

    // 从文件系统读取 Argo 临时域名
    _readArgoUrl: function () {
        return fs.read('/var/run/node_tunnel_argo.url').then(function (content) {
            return content ? content.trim() : null;
        }).catch(function () { return null; });
    },

    // 刷新仪表盘上的子进程状态与动态 URL
    _refreshStatus: function () {
        var self = this;

        Promise.all([
            L.resolveDefault(callServiceList('node_tunnel'), {}),
            self._readArgoUrl()
        ]).then(function (results) {
            var svcData = results[0];
            var argoUrl = results[1];
            var status  = self._getProcessStatus(svcData);

            if (self._statusContainer) {
                var enabled = uci.get('node_tunnel', 'global', 'enabled') === '1';

                dom.content(self._statusContainer, [
                    renderCardRow('全局总开关', renderBadge(enabled, enabled ? '已启用' : '已关闭')),
                    renderCardRow('本地代理节点 (sing-box/xray)', renderBadge(status.node)),
                    renderCardRow('Cloudflare Argo 隧道', renderBadge(status.argo)),
                    renderCardRow('FRP 反向代理', renderBadge(status.frp))
                ]);
            }

            if (self._argoUrlContainer) {
                var argoEnabled = uci.get('node_tunnel', 'argo', 'enabled') === '1';
                var argoMode    = uci.get('node_tunnel', 'argo', 'mode') || 'quick';

                var urlContent;
                if (!argoEnabled) {
                    urlContent = E('span', { 'style': 'color:#a0aec0;' }, 'Argo 隧道未启用');
                } else if (argoMode === 'token') {
                    urlContent = E('span', { 'style': 'color:#718096;' }, '永久隧道模式 (Token 运行) ── 请在 Cloudflare 控制台查看连接状态');
                } else if (!status.argo) {
                    urlContent = E('span', { 'style': 'color:#dd6b20;font-weight:600;' }, '正在等待 Argo 隧道启动并建立连接...');
                } else if (!argoUrl) {
                    urlContent = E('span', { 'style': 'color:#3182ce;font-weight:600;' }, '正在获取分配的 trycloudflare 临时域名，请稍候...');
                } else if (argoUrl === 'UNAVAILABLE') {
                    urlContent = E('span', { 'style': 'color:#e53e3e;font-weight:600;' }, '获取临时域名超时失败，请检查日志');
                } else {
                    urlContent = E('a', {
                        'href': argoUrl,
                        'target': '_blank',
                        'style': 'color:#2b6cb0;font-weight:bold;text-decoration:underline;font-size:14px;'
                    }, argoUrl);
                }

                dom.content(self._argoUrlContainer, [
                    renderCardRow('Argo 动态公网链接', urlContent)
                ]);
            }
        });
    },

    // ── 主渲染流程 ──────────────────────────────────────────────────────────
    render: function (data) {
        var self = this;
        var svcData  = data[1];
        var status   = self._getProcessStatus(svcData);
        var enabled  = uci.get('node_tunnel', 'global', 'enabled') === '1';

        // ── 仪表盘：服务运行状态卡片 ──────────────────────────────────────────────────────
        var statusCard = E('div', {
            'class': 'cbi-section',
            'style': 'background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-bottom:20px;box-shadow: 0 1px 3px rgba(0,0,0,0.05);'
        }, [
            E('h3', { 'style': 'margin:0 0 16px;font-size:16px;font-weight:700;color:#2d3748;border-bottom:2px solid #edf2f7;padding-bottom:10px;' },
              '⚡ 服务运行状态仪表盘'),
            E('div', { 'id': 'nt-status-rows' }, [
                renderCardRow('全局总开关', renderBadge(enabled, enabled ? '已启用' : '已关闭')),
                renderCardRow('本地代理节点 (sing-box/xray)', renderBadge(status.node)),
                renderCardRow('Cloudflare Argo 隧道', renderBadge(status.argo)),
                renderCardRow('FRP 反向代理', renderBadge(status.frp))
            ])
        ]);
        self._statusContainer = statusCard.querySelector('#nt-status-rows');

        // ── 仪表盘：Argo 临时域名卡片 ────────────────────────────────────────────────────
        var argoCard = E('div', {
            'class': 'cbi-section',
            'style': 'background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-bottom:20px;box-shadow: 0 1px 3px rgba(0,0,0,0.05);'
        }, [
            E('h3', { 'style': 'margin:0 0 16px;font-size:16px;font-weight:700;color:#2d3748;border-bottom:2px solid #edf2f7;padding-bottom:10px;' },
              '🌐 Argo 临时穿透服务'),
            E('div', { 'id': 'nt-argo-url' }, [
                renderCardRow('Argo 动态公网链接',
                    E('span', { 'style': 'color:#a0aec0;' }, '正在获取状态...'))
            ])
        ]);
        self._argoUrlContainer = argoCard.querySelector('#nt-argo-url');

        // ── 快捷控制按钮组 ───────────────────────────────────────────────────
        var btnStart = E('button', {
            'class': 'btn cbi-button-action',
            'style': 'margin-right:10px;background:#2b6cb0;border-color:#2b6cb0;color:#fff;font-weight:600;padding:6px 16px;',
            'click': ui.createHandlerFn(this, function () {
                return fs.exec('/etc/init.d/node_tunnel', ['start'])
                    .then(function () {
                        ui.addNotification(null, E('p', 'Node Tunnel 服务已成功启动！'), 'success');
                        self._refreshStatus();
                    });
            })
        }, '启动服务');

        var btnStop = E('button', {
            'class': 'btn cbi-button-reset',
            'style': 'margin-right:10px;font-weight:600;padding:6px 16px;',
            'click': ui.createHandlerFn(this, function () {
                return fs.exec('/etc/init.d/node_tunnel', ['stop'])
                    .then(function () {
                        ui.addNotification(null, E('p', 'Node Tunnel 服务已成功停止！'), 'info');
                        self._refreshStatus();
                    });
            })
        }, '停止服务');

        var btnRestart = E('button', {
            'class': 'btn cbi-button-apply',
            'style': 'font-weight:600;padding:6px 16px;',
            'click': ui.createHandlerFn(this, function () {
                return fs.exec('/etc/init.d/node_tunnel', ['restart'])
                    .then(function () {
                        ui.addNotification(null, E('p', 'Node Tunnel 服务重载中...'), 'success');
                        self._refreshStatus();
                    });
            })
        }, '重启服务');

        var actionCard = E('div', {
            'style': 'margin-bottom:24px;display:flex;align-items:center;'
        }, [btnStart, btnStop, btnRestart]);

        // ── 配置文件参数表单 ────────────────────────────────────────────────────
        var m = new form.Map('node_tunnel',
            'Node Tunnel 网络内网穿透插件',
            '在本地路由器上一键搭建本地 SOCKS5/HTTP 代理节点 (基于 sing-box 或 xray-core)，并支持通过 Cloudflare Argo 隧道和 FRP 反代发布到公网，轻松穿透内网环境。');

        // ── Section: 全局设置 ──────────────────────────────────────────────────
        var sGlobal = m.section(form.NamedSection, 'global', 'global', '全局设置');
        sGlobal.addremove = false;

        var oEnabled = sGlobal.option(form.Flag, 'enabled', '启用 Node Tunnel 插件');
        oEnabled.rmempty = false;

        var oLogLevel = sGlobal.option(form.ListValue, 'log_level', '日志输出级别');
        oLogLevel.value('debug', 'Debug (调试)');
        oLogLevel.value('info', 'Info (基本信息)');
        oLogLevel.value('warn', 'Warning (警告级)');
        oLogLevel.value('error', 'Error (错误级)');
        oLogLevel.default = 'warn';

        // ── Section: 本地代理节点设置 ────────────────────────────────────────────────────
        var sNode = m.section(form.NamedSection, 'node', 'node', '本地代理节点设置');
        sNode.addremove = false;
        sNode.tab('basic', '基本选项');
        sNode.tab('auth', '安全认证');

        var oNodeEnabled = sNode.taboption('basic', form.Flag, 'enabled', '启用本地节点');
        oNodeEnabled.rmempty = false;

        var oCore = sNode.taboption('basic', form.ListValue, 'core', '代理核心内核');
        oCore.value('sing-box', 'sing-box (极力推荐)');
        oCore.value('xray', 'xray-core');
        oCore.depends('enabled', '1');

        var oProto = sNode.taboption('basic', form.ListValue, 'protocol', '出入站代理协议');
        oProto.value('socks5', '仅 SOCKS5 代理');
        oProto.value('http',   '仅 HTTP 代理');
        oProto.value('both',   'SOCKS5 与 HTTP 均启用');
        oProto.depends('enabled', '1');

        var oListenAddr = sNode.taboption('basic', form.Value, 'listen_addr', '本地监听地址');
        oListenAddr.placeholder = '0.0.0.0';
        oListenAddr.datatype = 'ipaddr';
        oListenAddr.depends('enabled', '1');
        oListenAddr.description = '若仅允许本地或隧道程序连接，可填 127.0.0.1；若允许局域网内其他设备访问，请填 0.0.0.0';

        var oListenPort = sNode.taboption('basic', form.Value, 'listen_port', 'SOCKS5 监听端口');
        oListenPort.placeholder = '1080';
        oListenPort.datatype = 'port';
        oListenPort.depends('enabled', '1');

        var oHttpPort = sNode.taboption('basic', form.Value, 'http_port', 'HTTP 监听端口');
        oHttpPort.placeholder = '1081';
        oHttpPort.datatype = 'port';
        oHttpPort.depends({ 'enabled': '1', 'protocol': ['http', 'both'] });

        var oUsername = sNode.taboption('auth', form.Value, 'username', '安全用户名');
        oUsername.placeholder = '留空表示免密码访问';
        oUsername.depends('enabled', '1');

        var oPassword = sNode.taboption('auth', form.Value, 'password', '安全认证密码');
        oPassword.placeholder = '留空表示免密码访问';
        oPassword.password = true;
        oPassword.depends('enabled', '1');

        // ── Section: Cloudflare Argo 隧道 ────────────────────────────────────────────────────
        var sArgo = m.section(form.NamedSection, 'argo', 'argo', 'Cloudflare Argo 隧道（内网穿透）');
        sArgo.addremove = false;
        sArgo.tab('basic', '核心参数');
        sArgo.tab('target', '反向代理目标');

        var oArgoEnabled = sArgo.taboption('basic', form.Flag, 'enabled', '启用 Cloudflare Argo 隧道');
        oArgoEnabled.rmempty = false;

        var oArgoMode = sArgo.taboption('basic', form.ListValue, 'mode', '隧道连接模式');
        oArgoMode.value('quick', '临时隧道 (Quick Tunnel ── 无需注册 Cloudflare 账号，即开即用)');
        oArgoMode.value('token', '永久隧道 (Named Tunnel ── 需要在后台配置并填入专属 Token)');
        oArgoMode.depends('enabled', '1');

        var oArgoToken = sArgo.taboption('basic', form.Value, 'token', 'Argo Tunnel Token');
        oArgoToken.placeholder = '在 Cloudflare Zero Trust 平台创建 Tunnel 并复制其 Token 粘贴至此';
        oArgoToken.password = true;
        oArgoToken.depends({ 'enabled': '1', 'mode': 'token' });

        var oArgoTargetType = sArgo.taboption('target', form.ListValue, 'target_type',
            '本地反向代理服务目标');
        oArgoTargetType.value('node',  '本地代理节点 (sing-box/xray)');
        oArgoTargetType.value('admin', '路由器管理后台Web面板 (HTTP 80 端口)');
        oArgoTargetType.value('custom', '自定义其他内网地址与端口');
        oArgoTargetType.depends('enabled', '1');

        var oArgoTargetProto = sArgo.taboption('target', form.ListValue, 'target_proto',
            '目标网络协议类型');
        oArgoTargetProto.value('socks5', 'socks5:// (指向本地 Socks5 节点)');
        oArgoTargetProto.value('http',   'http:// (普通 Web 服务/节点)');
        oArgoTargetProto.value('https',  'https:// (加密 Web 服务)');
        oArgoTargetProto.depends({ 'enabled': '1', 'target_type': ['node', 'custom'] });

        var oArgoTargetAddr = sArgo.taboption('target', form.Value, 'target_addr',
            '目标 IP 地址');
        oArgoTargetAddr.placeholder = '127.0.0.1';
        oArgoTargetAddr.depends({ 'enabled': '1', 'target_type': 'custom' });

        var oArgoTargetPort = sArgo.taboption('target', form.Value, 'target_port',
            '目标网络端口');
        oArgoTargetPort.placeholder = '1080';
        oArgoTargetPort.datatype = 'port';
        oArgoTargetPort.depends({ 'enabled': '1', 'target_type': ['node', 'custom'] });

        // ── Section: FRP 反向代理设置 ─────────────────────────────────────────────────────
        var sFrp = m.section(form.NamedSection, 'frp', 'frp', 'FRP 反向代理（多协议穿透）');
        sFrp.addremove = false;
        sFrp.tab('server', 'FRP 服务端连接');
        sFrp.tab('tunnel', '隧道配置项');

        var oFrpEnabled = sFrp.taboption('server', form.Flag, 'enabled', '启用 FRP 隧道功能');
        oFrpEnabled.rmempty = false;

        var oFrpServer = sFrp.taboption('server', form.Value, 'server_addr',
            'FRP 服务器公网地址');
        oFrpServer.placeholder = '例如: server.openfrp.net 或 1.2.3.4';
        oFrpServer.depends('enabled', '1');

        var oFrpServerPort = sFrp.taboption('server', form.Value, 'server_port',
            'FRP 服务端连接端口');
        oFrpServerPort.placeholder = '7000';
        oFrpServerPort.datatype = 'port';
        oFrpServerPort.depends('enabled', '1');

        var oFrpToken = sFrp.taboption('server', form.Value, 'auth_token',
            'FRP 通信验证 Token');
        oFrpToken.placeholder = '服务端上配置的与客户端进行安全握手的 Token';
        oFrpToken.password = true;
        oFrpToken.depends('enabled', '1');

        var oFrpType = sFrp.taboption('tunnel', form.ListValue, 'tunnel_type',
            '代理传输协议类型');
        oFrpType.value('tcp',   'TCP 协议 (通用网络连接)');
        oFrpType.value('udp',   'UDP 协议 (适用于游戏/P2P等)');
        oFrpType.value('http',  'HTTP 协议 (Web站点)');
        oFrpType.value('https', 'HTTPS 协议 (加密Web站点)');
        oFrpType.depends('enabled', '1');

        var oFrpLocalAddr = sFrp.taboption('tunnel', form.Value, 'local_addr',
            '本地目标服务 IP 地址');
        oFrpLocalAddr.placeholder = '127.0.0.1';
        oFrpLocalAddr.depends('enabled', '1');

        var oFrpLocalPort = sFrp.taboption('tunnel', form.Value, 'local_port',
            '本地目标服务端口');
        oFrpLocalPort.placeholder = '1080';
        oFrpLocalPort.datatype = 'port';
        oFrpLocalPort.depends('enabled', '1');
        oFrpLocalPort.description = '映射的目标，如本地代理节点端口 1080，或路由器管理端口 80';

        var oFrpRemotePort = sFrp.taboption('tunnel', form.Value, 'remote_port',
            '远程映射的公网端口');
        oFrpRemotePort.placeholder = '例如: 6000';
        oFrpRemotePort.datatype = 'port';
        oFrpRemotePort.depends({ 'enabled': '1', 'tunnel_type': ['tcp', 'udp'] });
        oFrpRemotePort.description = '穿透后，外网访问此 FRP 服务器该端口即可转发至内网对应服务';

        var oFrpSubdomain = sFrp.taboption('tunnel', form.Value, 'subdomain',
            '分配的自定义三级域名子域');
        oFrpSubdomain.placeholder = '例如: testnode';
        oFrpSubdomain.depends({ 'enabled': '1', 'tunnel_type': ['http', 'https'] });

        var oFrpCustomDomain = sFrp.taboption('tunnel', form.Value, 'custom_domain',
            '绑定的独立外部域名');
        oFrpCustomDomain.placeholder = '例如: proxy.yourdomain.com';
        oFrpCustomDomain.depends({ 'enabled': '1', 'tunnel_type': ['http', 'https'] });

        // ── 定时轮询服务运行状态与动态域名 ─────────────────────────────────────────────────────
        self._pollInterval = window.setInterval(function () {
            self._refreshStatus();
        }, 5000);

        return m.render().then(function (formNode) {
            // 首次进入页面时进行数据加载刷新
            self._refreshStatus();

            return E('div', {}, [
                statusCard,
                argoCard,
                actionCard,
                E('hr', {}),
                formNode
            ]);
        });
    },

    // 处理保存并应用，保存 UCI 后对 Procd 进程池进行全局重启以使新配置立即生效
    handleSaveApply: function (ev) {
        return this.handleSave(ev).then(function () {
            return fs.exec('/etc/init.d/node_tunnel', ['restart']);
        }).then(function () {
            ui.addNotification(null, E('p', '配置保存成功，Node Tunnel 相关子进程正在重启使设置生效！'), 'success');
        });
    },

    handleReset: null,

    // 页面销毁时主动注销定时轮询器以节约系统资源
    onViewDestroy: function () {
        if (this._pollInterval) {
            window.clearInterval(this._pollInterval);
            this._pollInterval = null;
        }
    }
});
