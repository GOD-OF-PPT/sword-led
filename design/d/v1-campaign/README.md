# 护炉远行 · D 前景资源

按已确认的“行脚灯炉”风格，使用内置 **image_gen** 生成并接入实际目标。不是整屏概念图覆盖UI；目标仍可点击，血量、破坏、开路、轮停和灯芯暖光由游戏事件驱动。

| 资源 | 实际用途 |
| --- | --- |
| bridge-winch-v1 | 断桥铁闩、双驿与接力的门闩实物；开闩和切索有不同表现 |
| charger-v1 | 正面冲阵者与更重的撞桩者 |
| flanker-v1 | 轻捷侧身绕行者，与重甲轮廓区分 |
| shelter-lock-v1 | 避难炉的失控顶锁与炉梁 |
| drive-lock-v1 | 母灯传动锁与链条 |
| mother-wheel-v1 | 母灯逆转轮、固定底座和中央灯芯座 |
| companions-fullbody-v1 | 保留阿岚／阿禾／杜伯原面貌服装的全身随行姿态；旧半身图仍用于手札与后话 |

完整最终提示词在[prompts.json](prompts.json)；原PNG在[originals/](originals/)，尺寸、alpha和SHA在[manifest.json](manifest.json)。运行资源在 `/public/assets/d/v1-campaign/`，只做 `cwebp -q 90 -alpha_q 100` 格式转换，透明边缘保留，没有程序抠图或像素改画。

母轮位图含固定底座，因此用轮缘金色流线表现运转，停轮后收敛；不把整幅带底座的图旋转。自然锤沿用用户已认可的原件、方向、比例与接触锚点。剑仍使用原真实图集帧，裂纹、磨损和断口按正式状态绘制。
