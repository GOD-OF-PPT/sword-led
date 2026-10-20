# v0.7 第一章实际美术资源

本目录保存内置 image_gen 生成的原件、完整提示词、引用链与检查记录。全部沿已选 D「行脚灯炉」风格，未生成整张主界面代替实现。运行图位于 public/assets/d/v07/，合计 **1,404,410 字节（约 1.34 MiB）**，目标上限 2 MiB。没有使用 CLI/API 回退或创意后期修图。

| 运行文件 | 实际尺寸 | 用途 |
| --- | --- | --- |
| lantern-road-v1.webp | 1672×941 | 标题与开炉山路；左侧留给可编辑菜单，右侧炉车 |
| bridge-dark-v1.webp | 1672×941 | 第四天主委托未完成，未亮灯、未恢复巡守 |
| bridge-lit-v1.webp | 1672×941 | 同一构图、地理位置和晚间，完成后亮灯与巡守归来 |
| modifications-v1.webp | 2172×724 | 三列一行，风箱 / 余温架 / 宽口炉 |
| events-v1.webp | 1536×1024 | 三列两行，捐剑 / 借锤 / 旧剑交易 / 赊护 / 修棚 / 守炉 |

图集按从左到右、从上到下裁切。改造每格 724×724，依次 windbox、warmRack、wideMouth；事件每格 512×512，依次 donation、loan、salvage、credit、shelter、rest。完整 sourceRect、hash、alpha 统计在 manifest.json。图集真实透明；alpha>16 的主体均未碰到格边，少数生成残余在切线处 alpha 仅为 1/255，保留原通道，没有伪造完全零值。Chromium 在纸色与深色底的实际合成见 verification/*-composite.png。

originals/ 是完整生成 PNG。改造初稿因木柄跨格被弃用但保留；当前 modifications-v1.png 为内置工具定向缩放/对齐的选定稿。prompts/ 保存每次实际使用的完整提示词，*-source.json 保存默认生成路径与引用链。所有原件的复制 hash 均与默认输出一致。

export-webp.mjs 使用 cwebp 导出，不改尺寸、不裁切；质量为场景82、图集84，alpha_quality=100。verification/ 保存编码日志、PNG原件与WebP解码后的 alpha 检查，以及真正浏览器画布合成记录。解码 PNG 只用于验证，不是生产资源。inspect-alpha.mjs 仅解析和测量；render-proof.mjs 仅生成 QA 合成。

重跑导出：在项目根目录使用 rtk proxy node design/d/v07/export-webp.mjs。界面接入、阶段分支、资源失败回退和全流程浏览器验收由本任务主控负责；此处不宣称页面已接入或游戏整体完成。
