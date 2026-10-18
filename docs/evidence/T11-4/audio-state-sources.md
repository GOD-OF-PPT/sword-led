# 音频拒绝状态的来源核对

2026-10-19。六项目预检中WebKit真实AudioContext返回`interrupted`，应用仍显示浏览器阻止、没有振荡器启动且规则动作保留。错误在测试把所有引擎的拒绝后状态硬编码为`suspended`。

[Web Audio API 1.1 编辑草案](https://webaudio.github.io/web-audio-api/#enumdef-audiocontextstate)（2026-09-09，仍为进行中工作文档）列有`interrupted`，其含义为中断结束前不能处理音频。本项目只据此校正测试所允许的非播放状态，不声称草案是最终规范或全平台认证。[WebKit原始问题206695](https://bugs.webkit.org/show_bug.cgi?id=206695)记录了该状态的历史实现背景；其2020年对当时枚举的表述不能拿来否定2026年草案。

当前断言保留：Chrome/Firefox为`suspended`；WebKit允许`suspended/interrupted`，均要求仅一个真实上下文、0次振荡器启动、0活跃声源、可读阻止提示、接受剑状态完整保留。没有因为引擎差异放宽为任何状态，尤其不接受`running`或意外`closed`。
