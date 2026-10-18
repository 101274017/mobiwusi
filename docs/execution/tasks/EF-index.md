# E/F 执行任务索引（V1.2 双状态）

生成时间：2026-10-17T23:40:07+08:00（Asia/Shanghai）  
计划来源：`暖伴AI公益助手-项目实施计划-Codex高效续作版(1).md`；原计划 E/F WBS 行逐字保存在各自任务卡。  
生成时正式关口：D=`blocked` / `preparatory_not_accepted`；`goNoGoEligible=false`、`eAfterDEligible=false`、`eStarted=false`、`fStarted=false`。
开发门禁快照：`DEV_READY_WITH_EXTERNAL_PENDING`；自动开发可继续不等于正式发布就绪。

> 正式字段继续 blocked / preparatory_not_accepted / execution_started=false。开发检查通过后，按前置 development 状态和 FS/SS/FF 继续本地代码、契约夹具与自动测试，不等待人工开发签字、override 文件或 --bypass-d07；真实设备、供应、真人试点及发布仍独立验证。

E implemented 仅指代码与测试入口存在，automated=not_run；F verified 仅引用已有离线 checks_passed 与非空证据，未在生成时重跑。未验证项为 ready_for_local_checks，实际失败为 blocked_by_code。

| ID | 工作包 | 开发状态 | 自动验证 | 外部验证 | 正式状态 | 依赖 | 任务卡 | 检查记录 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E01 | 身份、设备与辅助开通 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | ACC-01/NV-12；前置 D07：FS | [卡](./E01.md) | [检查](../checks/E01-prep.md) |
| E02 | 关系、同意与协助信令 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | ACC-02/HELP；前置 E01：FS | [卡](./E02.md) | [检查](../checks/E02-prep.md) |
| E03 | 笔记、复习与待办服务 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | NOTE/TODO；前置 E01：FS | [卡](./E03.md) | [检查](../checks/E03-prep.md) |
| E04 | 增量同步与冲突 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | AT-21/同步；前置 E03：SS，E01：FS | [卡](./E04.md) | [检查](../checks/E04-prep.md) |
| E05 | 提醒调度与推送补偿 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | TODO-03/SYS；前置 E03：FS，E04：SS | [卡](./E05.md) | [检查](../checks/E05-prep.md) |
| E06 | 资产任务与签名流程发布 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | PET/FLOW；前置 E02/E03：FS | [卡](./E06.md) | [检查](../checks/E06-prep.md) |
| E07 | 服务骨架、迁移与任务设施 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | 后端/运维；前置 D02/D07：FS | [卡](./E07.md) | [检查](../checks/E07-prep.md) |
| E08 | 真实多模态、ASR/TTS编排 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | IN/CHAT/SUB；前置 D06/D07：FS | [卡](./E08.md) | [检查](../checks/E08-prep.md) |
| E09 | 真实手绘与偏好生成 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | PET-01/02；前置 E08：FS，C13：FS | [卡](./E09.md) | [检查](../checks/E09-prep.md) |
| E10 | 亲情受控媒体生产适配 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | HELP/NV-07；前置 E02：FS，E09：SS | [卡](./E10.md) | [检查](../checks/E10-prep.md) |
| E11 | 本地检测模型与策略固化 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | SAFE/NV-06；前置 C03/D06：FS | [卡](./E11.md) | [检查](../checks/E11-prep.md) |
| E12 | 供应配额、成本与故障隔离 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | Q-15/成本；前置 E08：FS，E10：SS | [卡](./E12.md) | [检查](../checks/E12-prep.md) |
| E13 | Mock逐项替换与接口装配 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | IN/CHAT/NOTE/TODO/ACC；前置 D03/D07：FS | [卡](./E13.md) | [检查](../checks/E13-prep.md) |
| E14 | 真实同步/提醒/亲情视图 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | NOTE/TODO/ACC/同步；前置 E13：FS，E02/E03/E04：SS | [卡](./E14.md) | [检查](../checks/E14-prep.md) |
| E15 | 生成、协助与浮层业务整合 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | PET/HELP/GUIDE；前置 E13：FS，E09/E10：SS | [卡](./E15.md) | [检查](../checks/E15-prep.md) |
| E16 | 真实接口兼容回归 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | 契约/AT前端层；前置 E14：FS，E15：FF | [卡](./E16.md) | [检查](../checks/E16-prep.md) |
| E17 | Android原生生产化 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | IN/GUIDE/SAFE/SYS；前置 D04/D07：FS | [卡](./E17.md) | [检查](../checks/E17-prep.md) |
| E18 | Android流程/认证/资产适配 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | FLOW/ACC/PET；前置 E17：SS，C16：FS | [卡](./E18.md) | [检查](../checks/E18-prep.md) |
| E19 | Windows原生生产化 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | IN/GUIDE/SAFE/SYS；前置 D05/D07：FS | [卡](./E19.md) | [检查](../checks/E19-prep.md) |
| E20 | Windows流程/3D/认证适配 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | FLOW/PET-03/ACC；前置 E19：SS，C11/C16：FS | [卡](./E20.md) | [检查](../checks/E20-prep.md) |
| E21 | 真实资源与无障碍修订 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | PET/SUB/无障碍；前置 D08：FS，E09：SS | [卡](./E21.md) | [检查](../checks/E21-prep.md) |
| E22 | 后端/契约/模块增量测试 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | AT全项准备；前置 D01：FS，E01～E20：SS/FF | [卡](./E22.md) | [检查](../checks/E22-prep.md) |
| E23 | 安全、模型文件与日志审计 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | SAFE/AT-10～12/23；前置 E22：SS | [卡](./E23.md) | [检查](../checks/E23-prep.md) |
| E24 | 自主流程内容、指标与培训工程准备 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | FLOW/公益/指标；前置 C16/D07：FS | [卡](./E24.md) | [检查](../checks/E24-prep.md) |
| E25 | 供应、授权与发布前提自动核对 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | Q-04/05/10/14/15；前置 E24：SS | [卡](./E25.md) | [检查](../checks/E25-prep.md) |
| E26 | 流程库解释与配置更新 | implemented | not_run | external_pending | blocked / preparatory_not_accepted | FLOW；前置 D03：FS，E24：SS | [卡](./E26.md) | [检查](../checks/E26-prep.md) |
| F01 | 共享前端真实双端联调 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | AT-01～24/三场景；前置 E16/E22/E25：FS | [卡](./F01.md) | [检查](../checks/F01-prep.md) |
| F02 | Android真实双端联调 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | AT-01～24/三场景；前置 E16/E22/E25：FS | [卡](./F02.md) | [检查](../checks/F02-prep.md) |
| F03 | Windows/图形真实双端联调 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | AT-01～24/三场景；前置 E16/E22/E25：FS | [卡](./F03.md) | [检查](../checks/F03-prep.md) |
| F04 | 后端/运维真实双端联调 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | AT-01～24/三场景；前置 E16/E22/E25：FS | [卡](./F04.md) | [检查](../checks/F04-prep.md) |
| F05 | AI/媒体真实双端联调 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | AT-01～24/三场景；前置 E16/E22/E25：FS | [卡](./F05.md) | [检查](../checks/F05-prep.md) |
| F06 | 测试/安全复核真实双端联调 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | AT-01～24/三场景；前置 E16/E22/E25：FS | [卡](./F06.md) | [检查](../checks/F06-prep.md) |
| F07 | 隐私/性能/长时/恢复测试 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | AT-07/10～12/17/21～23；前置 F06：SS，F01～F05：SS | [卡](./F07.md) | [检查](../checks/F07-prep.md) |
| F08 | 自动回归与工程候选验收 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | AT-01～24；前置 F07：SS | [卡](./F08.md) | [检查](../checks/F08-prep.md) |
| F09 | 试点工作流自动验证与真实观察状态 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | AT-24/无障碍；前置 F08：SS/FF | [卡](./F09.md) | [检查](../checks/F09-prep.md) |
| F10 | 培训/反馈流程与材料自动交付 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | 公益/亲情/培训；前置 E24：FS，F08：SS | [卡](./F10.md) | [检查](../checks/F10-prep.md) |
| F11 | 自动工程验收与交付 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | 全基线工程交付；前置 F08/F09/F24的development结果：FS或FF | [卡](./F11.md) | [检查](../checks/F11-prep.md) |
| F12 | 培训材料与试点体验修订 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | 无障碍/交付；前置 E21：FS，F10：SS | [卡](./F12.md) | [检查](../checks/F12-prep.md) |
| F13 | 答辩素材与演示包整理 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | 答辩；前置 F12：FS | [卡](./F13.md) | [检查](../checks/F13-prep.md) |
| F14 | 共享前端联调/试点缺陷修复 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | F01～F09问题单；前置 F01～F06：SS | [卡](./F14.md) | [检查](../checks/F14-prep.md) |
| F15 | Android联调/试点缺陷修复 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | F01～F09问题单；前置 F01～F06：SS | [卡](./F15.md) | [检查](../checks/F15-prep.md) |
| F16 | Windows/图形联调/试点缺陷修复 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | F01～F09问题单；前置 F01～F06：SS | [卡](./F16.md) | [检查](../checks/F16-prep.md) |
| F17 | 后端/运维联调/试点缺陷修复 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | F01～F09问题单；前置 F01～F06：SS | [卡](./F17.md) | [检查](../checks/F17-prep.md) |
| F18 | AI/媒体联调/试点缺陷修复 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | F01～F09问题单；前置 F01～F06：SS | [卡](./F18.md) | [检查](../checks/F18-prep.md) |
| F19 | 部署、备份恢复与发布演练 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | 运维/交付；前置 F07：FS，F17：FS | [卡](./F19.md) | [检查](../checks/F19-prep.md) |
| F20 | Android签名/安装/升级交付 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | SYS/交付；前置 F15：FS | [卡](./F20.md) | [检查](../checks/F20-prep.md) |
| F21 | Windows签名/安装/升级交付 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | SYS/交付；前置 F16：FS | [卡](./F21.md) | [检查](../checks/F21-prep.md) |
| F22 | 代码/契约/客户端交接 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | 全客户端；前置 F14：FS | [卡](./F22.md) | [检查](../checks/F22-prep.md) |
| F23 | 供应/模型/媒体运维交接 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | AI/HELP/SAFE；前置 F18：FS | [卡](./F23.md) | [检查](../checks/F23-prep.md) |
| F24 | 最终自动回归与工程证据审查 | verified | checks_passed | external_pending | blocked / preparatory_not_accepted | AT-01～24/NV双状态；前置 F09开发结果：FS，F19～F23开发结果：SS/FF | [卡](./F24.md) | [检查](../checks/F24-prep.md) |

合计：E 26 项，F 24 项；只生成计划卡/检查记录，未修改业务代码、共享 evidence 或阶段状态。

<!-- generated-by: scripts/generate-ef-execution-cards.mjs; sha256:c6dcb70e5ee2a7f5a7314472c1f19b6e89f6ea516bdacc1fe564553eb5ad5ea8 -->
