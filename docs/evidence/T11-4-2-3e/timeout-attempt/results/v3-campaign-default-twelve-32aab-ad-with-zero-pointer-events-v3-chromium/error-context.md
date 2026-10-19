# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: v3-campaign.spec.ts >> default twelve-round campaign completes through three merchants, upgrades, replacement and reload with zero pointer events
- Location: tests/e2e/v3-campaign.spec.ts:33:1

# Error details

```
Test timeout of 360000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=f4e3]:
  - banner [ref=f4e4]:
    - generic [ref=f4e5]:
      - text: 锤下求生
      - generic [ref=f4e6]: 行脚灯炉 · 行旅版 · 十二轮契约版
    - generic [ref=f4e7]:
      - generic [ref=f4e8]: 第 12 / 12 轮
      - generic [ref=f4e9]: 交差 47,462 / 42,000
      - progressbar "本轮交差进度" [ref=f4e10]
      - list "本局契约旅程" [ref=f4e12]:
        - listitem "第1轮已达标" [ref=f4e13]: "1"
        - listitem "第2轮已达标" [ref=f4e14]: "2"
        - listitem "第3轮已达标，商人到访" [ref=f4e15]: "3"
        - listitem "第4轮已达标" [ref=f4e16]: "4"
        - listitem "第5轮已达标" [ref=f4e17]: "5"
        - listitem "第6轮已达标，商人到访" [ref=f4e18]: "6"
        - listitem "第7轮已达标" [ref=f4e19]: "7"
        - listitem "第8轮已达标" [ref=f4e20]: "8"
        - listitem "第9轮已达标，商人到访" [ref=f4e21]: "9"
        - listitem "第10轮已达标" [ref=f4e22]: "10"
        - listitem "第11轮已达标" [ref=f4e23]: "11"
        - listitem "第12轮已达标" [ref=f4e24]: "12"
    - generic [ref=f4e25]:
      - generic [ref=f4e26]: 金币 160,216
      - generic "契约印记 3/3" [ref=f4e27]:
        - generic [aria-hidden] [ref=f4e28]: 契
        - generic [aria-hidden] [ref=f4e29]: 契
        - generic [aria-hidden] [ref=f4e30]: 契
    - button "暂停" [disabled] [ref=f4e31]
    - button "契约" [ref=f4e32] [cursor=pointer]
  - region "保存状态" [ref=f4e33]:
    - status [ref=f4e34]: 本地自动保存
    - button "导出进度" [ref=f4e35] [cursor=pointer]
  - generic [ref=f4e36]:
    - heading "十二轮契约完成" [level=1] [ref=f4e37]
    - generic [ref=f4e39]:
      - generic [ref=f4e40]:
        - paragraph [ref=f4e41]: 炉火未熄 · 十二轮的作品留在这里
        - figure "青云剑 已交差 · 49,381" [ref=f4e42]
        - text: 本局最高身价 49,381 · 造型来自实际锻造
      - paragraph [ref=f4e44]: 你已完成十二轮契约期，保住3枚印记。
      - generic [ref=f4e45]:
        - paragraph [ref=f4e46]:
          - text: 达标轮数
          - generic [ref=f4e47]: 12/12
        - paragraph [ref=f4e48]:
          - text: 累计交差
          - generic [ref=f4e49]: 165,136
        - paragraph [ref=f4e50]:
          - text: 留存金币
          - generic [ref=f4e51]: 160,216
        - paragraph [ref=f4e52]:
          - text: 最高身价
          - generic [ref=f4e53]: 49,381
      - paragraph [ref=f4e54]: 收官留剑：赤羽刀 · 身价1,848。
      - group [ref=f4e55]:
        - generic "查看本局 12 轮账本" [ref=f4e56] [cursor=pointer]
    - generic [ref=f4e57]:
      - button "再开一炉" [ref=f4e58] [cursor=pointer]
      - button "导出这次经历" [ref=f4e59] [cursor=pointer]
  - contentinfo [ref=f4e60]:
    - status
    - button "玩法图解" [ref=f4e61] [cursor=pointer]
    - group [ref=f4e62]:
      - generic "声音与动效" [ref=f4e63] [cursor=pointer]
```