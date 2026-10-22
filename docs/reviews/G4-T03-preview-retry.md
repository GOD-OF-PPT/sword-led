# 明确试听重试的修缮

设置提示玩家可以点击“试听敲击声”重试，但第一次试听的resume Promise若一直等待，再次点击会复用相同mode/epoch的pending，实际没有新请求。`preview-retry-first-red-01` 已在Chromium DPR1复现：第二次真实点击后resumeCalls仍为1，消费者exit1，结束418源／82产物指纹一致。原始失败与截图保留。

当前v5按钮在原有 `setMode('preview')`／`preview()` 前调用已有 `audio.silence()`，使这次明确点击拥有新的epoch并取消旧试听。旧Promise完成仍受原token/context/epoch保护，旧finally不会清掉新pending；不退休native context、不自动补声音、不增加timer。共享audio/input/renderer、经济规则、存档和美术没有再改。

## 实际核对

- `build-22` 实际exit0，含app/node严格类型与三个生产构建。
- `preview-retry-repair-01` 实际9/9通过：新重试、连续试听、较早游戏请求跨设置后新试听归属三项×Chromium／Firefox／WebKit，均DPR1、有窗口。新case先正常试听一次、关闭并确认native暂停，再在重新打开的设置中给下一请求施加已声明故障；第二次真实点击产生新resume及非零软件波形，释放旧请求后总starts仍6，关闭后source断开，四个游戏/炉谱槽的前后原文相同。此项没有统计Storage API调用次数，不将原文相同写成实测零次API写入。结束418／82指纹一致。
- `preview-retry-mute-01` 另实际3/3通过：三个现代引擎DPR1的既有静音取消pending试听用例，结束418／82指纹一致。此为另一批，和上方九次分别记录；[无损补档](../evidence/G4-T03-preview-retry/mute-addendum-manifest.json) 保留实际身份，不混成同一次十二项运行。
- 新runtime仍82文件，80文件与此前正式报价快照逐字节相同；只改index引用及v5 main文件。9个SDK/共享根JS、所有旧入口产物和CSS/美术原字节相同，因此未机械重跑384次整局。
- 正式4179已切至新不可变快照 `tmp/previews/G4-T03-preview-retry`，旧快照保留。`preview-retry-published-01` 实际exit0，82个HTTP文件与快照相同；自有全新context实际3次左键、合格剑交付、领取手艺、报价只读说明、局档原文导出均与正式SDK/原文一致，0页面错误。另实际点击两次试听，设置前后四槽原文一致；该短消费只核按钮/data-state，软件波形及挂起重试证明来自上方独立9次批，不能混称。
- root实际查看1280×720及1920×1080设置截图，提示/试听/收好按钮可见，图像未裁切。没有访问用户标签页或存档profile。

## 其他诊断及责任

旧v3 Chromium关闭问题做了唯一一次最小消费者清理验证。`legacy-clock-cleanup-01` 实际exit1；原业务body完成，`page.clock.resume()` 4.85ms内完成后，fixture关闭context仍超过180秒。不能把该问题归因于假时钟或宣称已修；未奏效的消费者改动已完整保存后恢复原文件，未改旧版生产代码，不继续盲测。

只读审查还确认：原release探针defer实际延迟了native resume的**调用**，释放时才在page.evaluate中调用，并额外注入constructor suspend；它不等于仅延迟原生Promise的完成。原137/138及running但clock0等实际观测仍保留，不能直接归为未注入玩家同因，也不能据此宣称没有生产问题。下一步正确故障语义的隔离草稿与当前已修的重试按钮是不同事项。

WebKit原复合故障、Firefox DPR2极长档81ms回调和旧v3关闭问题继续保留；T03／原五项目标未勾选完成。本轮先修真实交互，未改变原预算、波形阈值、旧声零补播或完整保存校验门。回滚为新增revert或切回原报价不可变快照，不删除原件/失败，不改钱包或存档。

[新增进度档案](../evidence/G4-T03-preview-retry/manifest.json) 已实际归档五项明确终态运行与78份原文/诊断/原图；逐项压缩往返、SHA及输入前后不变核对完成。纯完成延迟探针以未激活草稿身份保留，不作为实际测试。推送以随后发布回执为准。
