# 前端界面整合：mobiwusi 与独立伙伴页面

更新日期：2026-10-21。

## 来源与范围

- 参考用户指定的同产品仓库 `https://github.com/101274017/mobiwusi`。
- 对比基线为本仓库 `8dac099`，移植版本为来源仓库 `main` 的 `c33983886b56150e0c2d4cf826ea849ba13325a8`。
- 移植首页、欢迎入口、品牌标记、暖光背景、动效、字体大小控制，以及关联页面样式。沿用来源版本不展示尚未接通的亲情陪伴入口。
- 不合并来源仓库的桌宠宿主变更，不修改屏幕观察、光标指引、语音、权限或 AI 服务链路，保留其他正在进行的本地工作。
- 不改变现有默认桌宠，不自动切换角色，不携带或新增云服务凭证。

## 入口与角色页面

| 路由 | 内容 |
| --- | --- |
| `/#/welcome` | 新版欢迎入口，游客进入、继续使用和真实账号服务说明 |
| `/#/onboarding/login` | 账号能力状态，不提供假登录、假令牌或凭证采集 |
| `/#/pets` | 小鹿、小猫收藏卡片；保留已有内置伙伴微调、原画和模型管理 |
| `/#/pets/lili` | 栗栗独立详情页，通过已有本机桥确认后切换桌宠 |
| `/#/pets/lumi` | 露米独立详情页，真实 GLB 预览、旋转、动作与确认调用 |
| `/#/pets/import-3d` | 保留本机模型导入与切回原画入口，两种伙伴详情页均可返回管理 |

栗栗现有资源是二维 PNG 图集动作角色，并非 3D 模型；页面不提供假三维旋转。露米复用已校验的随包 GLB 与九个动作，不新增或下载模型文件。浏览页面不切换桌宠，不启动屏幕或麦克风采集；原生调用失败保留错误并允许重试。

欢迎入口只记录游客选择，不等同账号认证。入口记录无法写入时，本次以临时内存选择进入，刷新后重新选择，不在首页和欢迎页之间循环跳转。

欢迎页区分“资料本机保存”与“模型按需调用”，不以“完全不上传”概括实际服务能力。

## 验证

```powershell
pnpm typecheck
pnpm --filter @nuanban/web build
pnpm exec vitest run tests/platform/web-entry.test.ts tests/platform/lumi-model.test.ts tests/platform/management-companion-bridge.test.ts tests/platform/desktop-local-model.test.ts tests/integration/pet-appearance.test.ts tests/domain/account-demo.test.ts
$env:PLAYWRIGHT_CHANNEL='msedge'
pnpm exec playwright test tests/e2e/welcome.spec.ts tests/e2e/font-scale.spec.ts tests/e2e/companion-pages.spec.ts tests/e2e/lumi-companion.spec.ts tests/e2e/pet-appearance.spec.ts tests/e2e/app.spec.ts tests/e2e/account-demo.spec.ts tests/e2e/scenarios.spec.ts --workers=2 --output=test-results/frontend-integration
```

界面验证覆盖首次进入与刷新、无凭证登录说明、字号与减少动态、桌面与窄屏布局、独立详情页互不混入、3D 实际加载与动作、确认/取消/失败重试、原生桥状态与切回原画，以及原有文字问答、笔记和待办。原生桥交互使用测试替身；不将浏览器测试描述为真实 Windows 桌宠端到端验收。

本次验证：类型检查、Web 生产构建、模块边界检查及差异格式检查通过；相关六个单元测试文件共 55 项通过；桌面与移动端端到端测试共 72 项，71 项通过、1 项按用例条件跳过。

测试截图和运行日志仅保留在忽略的 `test-results`、`.cache/frontend-ui-review` 目录，不提交本地运行数据。
