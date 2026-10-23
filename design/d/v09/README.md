# 一剑开路：透明场景物件

由内置image_gen.imagegen按已选D东方炉火方向生成，风格参考本项目新炉台；Steam图未作资产。三件物件与一张四阶段兵器原始RGBA PNG、完整prompt与运行WebP均保留，转换只用cwebp质量90，不改原件。

- [木盾卫机](originals/wood-guardian-v1.png) / [prompt](wood-guardian-v1.prompt.txt)：实际试锋可点击目标，护甲/耐久来自正式核。
- [回锋齿](originals/rebound-tooth-v1.png) / [prompt](rebound-tooth-v1.prompt.txt)：取得后存一次真实溢出追斩。
- [崩炉钉](originals/furnace-nail-v1.png) / [prompt](furnace-nail-v1.prompt.txt)：首次击破甲靶回充，净0不假称获益。
- [原件/运行文件/SHA/尺寸清单](manifest.json)。

原图是孤立资产，游戏场景由独立DOM/Canvas合成。它们不包含HUD、文字、剑或锤，动作和结果仍由Accepted事件驱动。兵器另有[四阶段透明图集](originals/sword-stages-v1.png)、[完整prompt](sword-stages-v1.prompt.txt)和[实测alpha帧](sword-stages-v1.frames.json)。原生渐变第一稿经实图认定质感割裂，现以同D手绘阶段为主，正式hits/strength/sealedStrength选阶段、真实裂纹/崩纹/磨损/断裂仍在Canvas独立叠层；不会把图上装饰当实际裂纹。帧分析仅读取alpha，未编辑像素；兵器运行WebP质量92、alpha无损。

2.2实图再次修缮：原CSS木百叶箱被认定像道具卡片，替为[真实手绘工具匣](originals/tool-chest-v1.png) / [prompt](tool-chest-v1.prompt.txt)，两目标以吊绳和铁闩分别呈现，奖励预览仍用独立真实工具图。

护送者从简略SVG符号换成[同D手绘旅人](originals/lantern-traveller-v1.png) / [prompt](lantern-traveller-v1.prompt.txt)，原图完整人物含灯笼；只由正式GateCleared触发通行，恢复显示抵达静态位置。

3.1工具尾声的远靶替换为[同D无甲木靶](originals/practice-target-v1.png) / [prompt](practice-target-v1.prompt.txt)，图像仅为完整道具，存伤、追斩与倒靶仍来自Accepted，避免用CSS圈和符号代替实物。
