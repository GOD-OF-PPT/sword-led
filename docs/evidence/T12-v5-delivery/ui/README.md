# T12 局档原文导出：真实浏览器消费者

最终构建22656，独立测试地址4210。浏览器启动前先执行既有工具：

`rtk proxy node scripts/release-fingerprint.mjs capture tmp/T12-v5-delivery/ui-start-fingerprint.json tmp/T12-v5-delivery/ui/consumer.mjs tmp/T12-v5-delivery/ui/fixture.json`

capture实际exit0，375源文件/80构建文件及明确消费者/fixture输入已冻结。此后启动的session **98356实际exit0**，一次隔离Chromium browser、三个独立context（其中一个另开同context只读page）。没有使用用户tab/profile，没有任何领域命令、没有创建新游戏或真的恢复备份。

## 真实输入来源

`fixture.json.backupRaw`逐字取自既有真实UI保存：`docs/evidence/T11-4-2-3l4/ui/run-02/states.json.gz#a4-deliver`，runId `d1bc1f84-a3bb-4713-9c86-4716fc3eec62`、revision5。来源gzip SHA256 `894af0c64a936cdde8f6c4ce556b04c1ec69aa425b865b5f7cb3f38e788a25bd`；原始backupRaw SHA256 `eaa0c90e994023aea13a4c2fb0305e302c4ee3d4378cc40d3830f0e6e9b3b4ed`。准备和运行时正式decode都确认备份有效。没有改动该状态的金币、兵器或journal。

损坏main是有首尾空白/CRLF和中文的明确坏JSON负样例。未来main只把同一真实保存信封的schema/rules版本改为未知值，作为明确不兼容负样例，不冒充合法未来状态。全部负样例只存在测试context自己的localStorage。

## 三个case，四个实际下载

1. **bad-json**：无合法当前state，保存详情的 `#v5-export-raw-run` 仍启用。真实点击捕获download，文件 `slots.main.raw` 与坏JSON逐字相同，`slots.backup.raw` 与实际旧备份逐字相同。恢复/重开的确认都有先导出原文提醒，均点“再想想”取消。
2. **same-context readonly**：第一个page继续持有writer锁，第二page真实进入“另一窗口正在保存，本页只读”。原文导出按钮仍启用且实际下载成功，两槽文本准确；没有请求保存权或写入。
3. **future-version**：无可续当前state，未知版本main原文和合法backup原文都准确下载。恢复/重开确认只取消，未知文本不被改写。
4. **main-read-denied**：单独context仅对主key的 `getItem` 抛SecurityError，备份仍可读。实际下载中main为 `{key,ok:false,error:"storage_read_failed"}`，没有伪装为null，也没有raw字段；backup仍是准确原文。`#v5-raw-export-status` 明确“1个位置读取失败”。

每个page在测试fixture准备完后监控主/备setItem、removeItem和clear；所有case导出前后raw精确相同，监控写操作为0。故障case通过测试持有的原生getter观察底层原字节，产品读取仍真实抛错；没有绕过故障向产品提供主档。结果完整保存在 `run-01/result.json`，下载原件分别保存为四个JSON。

## 画面和边界

12张1280×720与1920×1080实际截图。人工看过只读导出1280、读取失败提示1280、未知版本恢复警示1920：按钮与状态可读、回到当前页面/确认取消可见。此批0页面错误、0领域命令，不算新试玩整局，也不扩兼容或性能矩阵。

消费者、fixture、产品和构建在运行期间保持原字节；root在终态后使用同一指纹文件verify并归档。没有改产品、core、SDK、构建、旧档或Git。
