# main 文件体积与历史归档

2026-11-17 清理前，main 的追踪文件合计 **2,414,741,298 字节**。清理目标是当前 main 文件树低于 **100,000,000 字节**（十进制 100 MB）。

完整备份已推送至 GitHub：

- 分支：[backup/main-before-size-cleanup-20261117-203734](https://github.com/GOD-OF-PPT/sword-led/tree/backup/main-before-size-cleanup-20261117-203734)
- 原提交：`4ca2d91be5e1a5a25adbe95aee3521f3a940c1c3`

## 保留与归档

main 保留全部 `src/`、`public/`、`tests/`、开发脚本和配置；保留设计提示词、清单、Markdown 报告、当前主线 `design/d/v1-campaign/` 原图，以及 `test:art` 需要的 `design/b/` 原图和 `design/concepts/main-b-v3.png`。

历史 `docs/evidence/` 中的截图、录像、trace、原始报告和代码快照移出 main 的追踪范围。测试或审计脚本实际读取的历史输入仍保留，包括 T06、v4 witness-fixed、v3 模型资料、v0.9 内核资料和 `.gitignore` 中逐项列出的 JSON。其他历史设计 PNG 也只在备份分支保留。已有文档中指向归档文件的链接，可在备份分支按原路径查阅。

本次本地清理只取消 Git 追踪，归档文件仍在原目录，由 `.gitignore` 排除。新克隆的 main 不包含这些归档文件。新增原始测试证据写入 `tmp/` 或独立归档；需要持续执行的测试输入优先放入 `tests/fixtures/`，避免再次提交成批截图和录像。

随后按要求删除了 `goal-1/`、`goal-2/`、`goal-3/`、`goal-4/` 和 `openspec/`，这些目录不再保留在本地工作区。历史内容仍可在上述备份分支按原路径查看；旧版模型生产与审计脚本的输入列表已同步移除 `goal-1/input.md`。

## 恢复历史材料

GitHub 上可直接切换至上述备份分支查阅或下载。需要完整材料时，先获取备份，再导出至新目录，避免覆盖当前源码：

```sh
git fetch origin refs/heads/backup/main-before-size-cleanup-20261117-203734:refs/remotes/origin/backup/main-before-size-cleanup-20261117-203734
archive_dir=$(mktemp -d ../sword-led-archive.XXXXXX)
git archive origin/backup/main-before-size-cleanup-20261117-203734 docs/evidence design | tar -x -C "$archive_dir"
```

维护旧版 D 美术的格式导出或历史证据审计时，先从这个目录取回所需原图和原始报告。当前游戏运行和常规构建不需要取回归档。

## 核对当前追踪体积

```sh
git ls-tree -r -l HEAD | awk '$2 == "blob" { bytes += $4 } END { printf "Tracked files: %.0f bytes (%.2f MB)\n", bytes, bytes / 1000000; exit(bytes >= 100000000) }'
```

这里统计当前提交中所有文件的字节数，重复内容按路径分别计入。Git 历史、备份分支、`.git/`、`node_modules/` 和忽略的本地归档不属于这个指标。此次不重写历史，因此普通完整克隆和本地仓库总占用仍可能较大；仅需当前 main 时可使用：

```sh
git clone --depth 1 --single-branch --branch main https://github.com/GOD-OF-PPT/sword-led.git
```

需要撤销清理时，revert 本次清理提交即可恢复追踪；不要强推覆盖历史。
