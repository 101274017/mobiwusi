# 微光指引 · Windows Server 部署（阿里云 ECS 试验托管）

> 文档日期：2026-10-22。这是**所有者在自有 ECS 上运行的试验托管**脚手架，不是正式发布，也不构成 D07/F19 的部署签收。产品能力边界以 [product-current-state.md](../../docs/implementation/product-current-state.md) 和 [external-capabilities.md](../../docs/implementation/external-capabilities.md) 为准。

## 目标形态

```
公网 :80 (IIS)
├─ /                     静态站点 = apps/web/dist（HashRouter，无 SPA 回退需求）
└─ /healthz, /v1/*       同源反向代理 → 127.0.0.1:3000（Node API，SQLite）
   /internal/*           不代理，不对外暴露
```

- **静态站点**：`apps/web/dist` 使用相对路径（`base: './'`），可部署在站点根或任意子路径。
- **后端**：`apps/server` 直接用 `node --experimental-transform-types src/main.ts` 运行，无 node_modules 依赖；源码相对引用 `packages/*/src`，因此部署目录保持同级结构。
- **存储**：`NUANBAN_SERVER_STORAGE=sqlite`，数据库固定在 `C:\nuanban\data\server.sqlite`（仓库外）。
- **开机自启**：计划任务 `NuanbanServer`（SYSTEM，开机触发，1 分钟重启间隔，无限时长）。
- **反向代理**：需要 IIS URL Rewrite + Application Request Routing（ARR）。两者装不上时后端只监听回环，站点仍可访问，部署脚本会记录 `proxyNote`。

## 目录约定（服务器上）

```
C:\nuanban\
├─ web\            当前静态站点（IIS 物理路径，上一版保留为 web.prev）
├─ app\            当前后端源码树（上一版保留为 app.prev）
├─ scripts\        deploy-server.ps1 / start-server.ps1
├─ data\           server.sqlite
├─ logs\           deploy-*.log、deploy-result.json、server.log
└─ staging\        payload.zip、chunks-<stamp>\（传输中转）
```

## 部署流程

1. **准备产物**（本机）

```powershell
pnpm --filter @nuanban/web build     # 生成 apps/web/dist
node infra/windows/tools/package-payload.mjs
```

2. **准备凭据**（本机，不提交）

RAM 用户只授予所需 ECS 权限，写入 `.cache/aliyun-ak.json`（已被 `.gitignore` 忽略）或使用环境变量：

```powershell
$env:ALIYUN_ACCESS_KEY_ID='<id>'
$env:ALIYUN_ACCESS_KEY_SECRET='<secret>'
```

最小权限策略（临时授予，部署完成后删除 AK）：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeInstances",
        "ecs:DescribeCloudAssistantStatus",
        "ecs:DescribeSecurityGroupAttribute",
        "ecs:AuthorizeSecurityGroup",
        "ecs:DescribeSendFileResults",
        "ecs:SendFile",
        "ecs:RunCommand",
        "ecs:DescribeInvocationResults"
      ],
      "Resource": "*"
    }
  ]
}
```

3. **先只读检查**（不写任何东西）

```powershell
node infra/windows/tools/deploy-windows.mjs --instance i-2zedkag2x1e9e610v8jh --inspect-only
```

输出实例状态、OS、公网 IP、安全组 80 端口是否开放、云助手在线状态。

4. **正式部署**

```powershell
node infra/windows/tools/deploy-windows.mjs --instance i-2zedkag2x1e9e610v8jh --open-port
```

- `--open-port` 会在安全组放行 `tcp/80`（`0.0.0.0/0`）；不加该参数时若 80 未开放会直接失败，不会偷偷改安全组。
- `--skip-proxy` 跳过 ARR/URL Rewrite 安装，后端仅限回环。
- 传输方式：`SendFile` 分块（单次内容 base64 ≤ 32 KB），每块 20 000 字节，约 100 块，并发 4。

5. **服务器上手动重跑**（排障用）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\nuanban\scripts\deploy-server.ps1 -Root C:\nuanban
Get-Content C:\nuanban\logs\deploy-result.json -Raw
```

## 验证

| 检查 | 期望 |
| --- | --- |
| `http://<公网IP>/` | 200，`<div id="root">`，静态资源 200 |
| `http://<公网IP>/models/lumi/character_manifest.json` | 200，`application/json` |
| `http://<公网IP>/healthz` | 200，`storage=sqlite`（需代理成功） |
| `http://<公网IP>/v1/relations`（无令牌） | 401 |
| `http://<公网IP>/internal/desktop/voice/status` | 不代理，返回静态 404 |
| `C:\nuanban\logs\server.log` | 有监听日志，无崩溃重启循环 |

## 回滚

```powershell
# 只回滚静态站点
Move-Item C:\nuanban\web C:\nuanban\web.broken -Force
Move-Item C:\nuanban\web.prev C:\nuanban\web -Force
iisreset /noforce

# 回滚后端
Stop-ScheduledTask -TaskName NuanbanServer
Move-Item C:\nuanban\app C:\nuanban\app.broken -Force
Move-Item C:\nuanban\app.prev C:\nuanban\app -Force
Start-ScheduledTask -TaskName NuanbanServer
```

数据库不做自动回滚：`data\server.sqlite` 在升级前请手工复制备份。

## 安全与边界

- 后端只绑定 `127.0.0.1`，公网仅经 IIS 代理；`/internal/*` 不代理。
- 公网前端按 `VITE_API_MODE=local` 构建：不内联 `VITE_API_TOKEN`，不启用真实供应、屏幕采集、麦克风或云分析。桌面端能力不因这次部署而改变。
- 站点 `web.config` 已关闭目录浏览、补齐 `.glb/.vrm` MIME、加 `nosniff` 与 `Referrer-Policy`。
- 凭据只存在于本机 `.cache/aliyun-ak.json` 或进程环境变量；仓库与产物中不含密钥。
- 本部署**不**等于：正式发布、生产数据库、真实账号/供应、备份恢复演练、签名与回滚演练、D07 Go。

## 已知限制

- ARR/URL Rewrite 的 MSI 来自 `download.microsoft.com`；若 ECS 出网受限，代理会跳过，需手工安装后重跑部署脚本。
- Node.js LTS MSI 优先从 `cdn.npmmirror.com` 下载（国内可达性更好），失败后退到 `nodejs.org`。
- 计划任务不是 Windows 服务：进程崩溃由任务计划重启，但不会做端口健康检查外的恢复。
- 首次部署需要 ECS 出网（Node MSI、可选代理 MSI）；离线主机可用 `-SkipNodeInstall` 并把 MSI 预先放到 `C:\nuanban\staging`。
