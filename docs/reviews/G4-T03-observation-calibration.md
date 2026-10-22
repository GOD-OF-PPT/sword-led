# 音频故障与长档测量校准

本轮正确模拟的音频晚完成检查已通过；校准后的长档与四连锻用例通过原阈值。旧v3 Chromium关闭仍有已定位到协议阶段的缺口。生产代码、玩法、存档、SDK与美术没有修改，试玩仍为已发布的build22。

## 音频：保留原生调用的真实手势

旧defer探针直到release/evaluate才调用native resume，并注入constructor suspend；原“只延迟完成”的描述不准确。现在在原手势栈同步调用native resume，只延迟其原结果交给产品。release只开门闩，原成功/拒绝及先后顺序保持，重复release不重复调用；constructor暂停仍明确属于故障注入。256 FFT、8ms采样、原波形/旧声/状态与全部动作断言均保持。

| 实际运行 | 结果与范围 |
| --- | --- |
| `pure-completion-title-01` | 原WebKit DPR1标题返回场景预定三次，3/3通过，418源/82运行文件结束一致。 |
| `pure-completion-fault-axis-01` | 九逻辑×三引擎×DPR1/2，54/54通过；含晚完成后三出口、试听关闭/静音/零音量/系统动效取消、跨设置新授权与明确重试。0跳过/flaky，418/82结束一致。 |
| 独立操作归属核对 | 57份对应原件SHA及实际operation一致：held原id同步native-start一次，release零次native API，保原始成功/拒绝语义；现有用例核波形、旧cue与局/炉谱原文。独立只读复核无行为阻断。 |

正确“晚完成”责任在上述范围内闭环。旧137/138、所有复合注入与clock0候选按旧源/协议保留，不能重写成通过，也不能从新批次推断物理扬声器。六份新retry记录沿用了“延迟调用”的过时机制文字：**本批应读为原手势调用、仅延迟完成**，实际operation已逐份核对；原件不改写，未来消费者文案已纠正，未为文案重跑54。

## 性能：减少测量脚本造成的布局工作

首次采样命令锚定了裸标题，而Playwright grep搜索完整标签，`ff2-pressure-profiler-01`实际exit1/No tests found；没有执行浏览器用例。纠正筛选并明确发现唯一用例后，`02`才是首个实际采样。两次原文均保留。

`ff2-pressure-profiler-02`实际exit1、418/82结束一致。本地原生profile有内容GeckoMain的40,757个样本与CPU delta，三次页面timeOrigin/innerWindow/marker窗口完整；53,181,242B原件及摘录前后SHA不变。采用[Mozilla内置本地采样方式](https://firefox-source-docs.mozilla.org/networking/http/logging.html#capturing-a-profile-with-logs-at-startup)，没有安装CLI、上传或远程symbolication。

本次30/31ms可对齐到watch→结束重投影，实际有clientWidth触发样式/布局的栈；具体是哪一次DOM写入失效尚未定位。pointer p95为17ms，首接触228ms，均保留红。228ms包含102ms交付间隔和测试协议工作，不能算成228ms产品同步执行；本次没有重现原81ms，更不能解释那一次原始尖峰。

安装版expect源码及采样另证实：忙碌属性断言尚未满足时，matcher会采集可见性/ARIA。校准后只读既有observer的isIdle（须有最后输入且已Accepted、已观察idle），50ms轻量轮询，原5秒截止；返回后仍单次读取属性并断言false。没有读取布局、调用昂贵sample或添加noop RAF；原raw/identity采集仍在，因此也不称零协议开销。原contacts/数量/完整状态、800+500ms尾核及所有预算不变。

| 当前无profiler运行 | 原阈值实际结果 |
| --- | --- |
| `ff2-calibrated-observation-01`，FF DPR2/1920极长合法档，三输入路径各六次Accepted | 通过，418/82结束一致。callback p95鼠标8/Space7/Enter6ms，max14/24/21ms；同步handler max44/49/40ms；加载上界874/628/626ms；首接触max138/106/113ms。 |
| `ff2-calibrated-burst-01`，同项目/尺寸原四连锻 | 通过，418/82结束一致。原三份独立合法恢复、每份1Accepted/4contacts及原样本/预算门保持；没有把中间接触误判成完成。 |

这是当前校准方法下的实际结果，不能改称旧81ms已经归因或产品性能代码已优化。其他既有结果保原构建/消费者身份，不把不同批次拼成新的完整矩阵。三个严格类型检查21/22/23均实际0。

## 旧入口关闭：协议阶段已收窄

`legacy-close-protocol-01`实际exit1，418/82结束一致。原业务断言完成、临时截图147已回复；root dispose149发出后约三分钟没有回复，直到runner关闭整个browser，才收到detach与成功回复。已收窄到Chromium销毁请求内部，仍不能归为设备、AudioContext或pagehide的具体根因。只读OS采样尝试在“该运行仍活跃”的首个守卫即停止，未启动sample。

随后固定四个静态页条件none/Clock/nativeAudio/Clock+Audio，逐叶自有新浏览器、真实按钮和原生三短source，没有游戏/SDK/存档/WebLocks。`close-minimal-01`实际exit0，421输入/82运行文件结束一致；四次准备成功，context关闭分别35.8/28.3/44.3/28.6ms，均在browser关闭前完成。5秒仅诊断pending观察，不替换原游戏180秒门。该组未复现原游戏，不证明其已修，也不足以排除全部相互作用。

T03仍未勾选，原81ms历史调查、旧v3关闭与最终整体审计继续保留。可选试玩反馈已询问，未答不当接受。所有原件与失败保留；本轮只提交观测校准和有界诊断，不轮换相同82文件试玩，不改变已批准方案。

[本轮无损清单](../evidence/G4-T03-observation-calibration/manifest.json) 已实际归档11个明确终态命令、330份原文/诊断/本地profile/原图；gzip往返及全部输入前后SHA一致。root仅将实际查看的当前长档工坊图标为已看，另保留两张失败图，其他原件未删除。本档不代表全T03验收；推送以发布回执为准。

本轮源提交 `2fd17e10ec6e96b9280ae15e9878aec96a79ba4a` 已实际push0，fresh远程main及GitHub根tree全等，六个代表性消费者/报告/清单/压缩采样摘录blob原字节一致；[发布回执](../evidence/G4-T03-observation-calibration/source-publication.json) 保留身份。当前82运行文件及正式试玩仍是同一build22，未为纯测试代码轮换预览。
