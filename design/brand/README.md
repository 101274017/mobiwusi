# 微光指引 · 鹿角光标

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](../../docs/implementation/product-current-state.md)区分品牌资源、桌宠角色与已实现能力。

产品主品牌标：栗栗的侧脸被压成光标，鹿角从后脑长出，奶油口鼻是箭头尖端，围巾绕在尾部，暖黄点击涟漪确认“就是这里”。

资源文件中的 `nuanban-*` 名称保留作兼容路径，不是当前界面名称。Logo 接入不更换桌宠角色、包 ID、用户数据目录或本地唤醒词；默认角色以 `apps/desktop/default-pet.json` 为准。

## 文件

- `nuanban-mark.svg`：透明主标，256 viewBox
- `nuanban-icon-square.svg` / `nuanban-icon-round.svg`：App Icon
- `nuanban-adaptive-foreground.svg`：Android 自适应前景
- `nuanban-notification.svg`：通知栏白色剪影
- `nuanban-mono.svg`：单色标
- `png/`：1024 / 512 / 192 方形图标、透明主标、通知剪影、单色标

## 使用位置

- Web：`apps/web/src/assets/brand-mark.svg` 与 `apps/web/public/favicon.svg`
- 桌面：`apps/desktop/assets/brand/icon.png`、`icon.ico`，托盘与管理窗口
- Android：`apps/android/app/src/main/res/` 的 launcher、adaptive foreground、notification 图标

Web 的 `BrandMark` 使用方形图标；favicon 用简化单色标，保证 16–32px 可读。Android 主应用与 `standalone` 共用 `app/src/main/res`。

## 色彩

- 暖栗棕 `#C47B57`
- 奶油 `#FFF1D7`
- 暖阳黄 `#F4C14F`
- 珊瑚 `#E8785C`
- 可可 `#4B2D24`
- 图标底色 `#FFF7EA`

蓝色/琥珀色继续留给“确定 / 候选”指引状态，不作为品牌主色。

## 合并来源

Logo 源文件与各平台图标来自 `101274017/mobiwusi` 的 `2465dada1ce7ebab9017f5addb33eccce56bee68` 提交。
本项目只接入品牌资源，不合并该仓库的其他功能、桌宠形象、应用标识或唤醒词修改。
