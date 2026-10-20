# 来客进工坊：v0.5原图与运行资产

**下图是3f的历史构图参考，非实机。3g已将独立人物、纸单、挂件和两页手札接入实际默认首页。** [当前实机](../../../docs/evidence/T11-4-2-3g/preview-default.webp)与[R3.17](../../../docs/reviews/R3-17-traveler-notebook.md)可直接对照。沿用用户已选D。

![v0.5来客场景提案，非实机](main-customer-v1.png)

来客从纸内装饰移到炉边，挂纸只说明一项愿望和明日预告；真实剑和自然锤姿居中，三门手艺成为左下实体挂件，右下是一册可主动翻开的作品。实际数值/文字/按钮为原生DOM，成品由Canvas按真状态绘制；这张构图没有贴入运行页面。

这张构图用[真实v3经济快照](../../../docs/evidence/T11-4-2-3f/visual-economy-example.json)：第4轮、0/850、2388金币、三印、三柄80新剑、2643旧剑、余烬/回响。来客示意为“归来”，不代表该seed的实际编排，也没有forge-v4。图中的轮次路标、武器阶段细节和命中区不作为运行证明；实施按实际十二轮/真实等级、DOM文字及44px目标核验。

内置imagegen生成，原图源路径/完整引用与hash在[manifest](manifest.json)，实际完整提示词在[prompt](main-customer-v1.prompt.txt)。未覆盖旧图，没有Steam美术。具体界面/只读投影/原档合同见[实施说明](../../../docs/v0.5-notebook-interface.md)。图上v0.5表示界面版本，经济规则仍forge-v3/schema3。

## 实际运行资产

来客等待/收剑六格图集和实体封面已派生为独立资源并实际接入。运行两图共829,100字节，小于1MiB；PNG原件与WebP alpha逐像素相同。图集v1有跨格边界，内置imagegen修为v2后两列分隔与两行分隔alpha均为0；原件/完整prompt/直接引用链在[runtime-generation-records](runtime-generation-records.json)，实际1254×1254尺寸、源矩形和预算在[runtime-assets](runtime-assets.json)。没有将上面的整图覆盖运行。102场景与最后手札21项定向回归与加载失败回退见[R3.17](../../../docs/reviews/R3-17-traveler-notebook.md)。
