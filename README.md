# dsh-cost-meter-bai-credits

Show your **B.AI Credits balance** inside [dsh-cost-meter](https://github.com/Han-1413141/dsh-cost-meter) —
as a live card in the DSH sidebar and in the plugin's **Cost → Quota** settings page.

把 **B.AI 代币余额（Credits）** 显示在 [dsh-cost-meter](https://github.com/Han-1413141/dsh-cost-meter) 的
侧边栏卡片与「费用 → 额度」设置页里。

No fork, no plugin changes: it uses the built-in *Custom provider balance* feature, and the number shown is
exactly what `GET https://api.b.ai/v1/balance` returns in `data.personal_balance` — integer Credits, no
division, no FX conversion.

不改插件源码、不 fork：用的是内置的「自定义 Provider 余额」功能。卡片显示的数字**就是**
`GET https://api.b.ai/v1/balance` 返回的 `data.personal_balance` 整数 Credits，不做除法、不做汇率折算。

Tested against **dsh-cost-meter 1.7.40** and B.AI's public balance API. / 已在 dsh-cost-meter 1.7.40 与
B.AI 公开余额接口上实测。

---

## Files / 文件

| File | What it is |
|---|---|
| [bai-credits-balance.md](./bai-credits-balance.md) | **English guide** — 12 sections: UI steps, config reference, the optional USD variant, team keys, troubleshooting, security, agent-ready application |
| [bai-credits-balance.zh-CN.md](./bai-credits-balance.zh-CN.md) | **中文说明** —— 同样的 12 节：设置页步骤、配置字段、可选美元变体、团队 Key、排错、安全说明、让 Agent 自动套用 |
| [bai-credits-balance.preset.json](./bai-credits-balance.preset.json) | Machine-readable preset: two variants (`credits`, `usdEquivalent`) plus a declarative `apply` block for agents |
| [apply-bai-credits.mjs](./apply-bai-credits.mjs) | Zero-dependency reference implementation of that `apply` block |

## Quick start / 快速开始

Read the guide for your language, or apply the preset directly:

```bash
node apply-bai-credits.mjs --dry-run   # show what would change, write nothing
node apply-bai-credits.mjs             # apply the native Credits variant
```

Then paste your B.AI API key into the plugin's **Credential input** row for the `{{VAR}}` placeholder
(write-only; it never lands in `ledger.json`) and refresh the page.

然后把你 B.AI 的 API Key 粘进插件条目里的「凭据输入」行（write-only，**不会**落进 `ledger.json`），刷新页面即可。

## Why Credits, not USD or CNY / 为什么是 Credits 而不是美元或人民币

B.AI's balance endpoint returns **integer Credits** — the platform's own unit. The two documented rates,
`1 USD = 1,000,000 Credits` (billing) and `1 Coin = 1,000,000 Credits` (Coin exchange), are conversion rates,
not the balance's unit. Credits have no CNY peg, so a `¥` label misleads. The optional USD variant exists but
is clearly marked as a derived view.

B.AI 余额接口返回的是**整数 Credits**，即平台自有单位。文档里那两个比例
（`1 USD = 1,000,000 Credits` 扣费用、`1 Coin = 1,000,000 Credits` 兑换用）是换算率，不是余额币种。
Credits 与人民币之间不存在汇率，用 `¥` 标注属于误导。可选的美元变体保留，但已明确标为派生视图。

## Safety / 安全

- No API key is ever stored in the config file: the entry keeps a `{{VAR}}` **placeholder**, resolved from the
  DSH credential store (or `process.env`).
- `allowedHosts: ["api.b.ai"]` acts as a credential-egress guard, so an imported config cannot forward your
  key elsewhere.
- This repository contains no keys, account identifiers, or real balance figures.

- 配置文件里**永远没有** API Key：条目只保留 `{{VAR}}` **占位符**，由 DSH 凭据库（或 `process.env`）解析。
- `allowedHosts: ["api.b.ai"]` 是凭据外带防护，导入他人的配置也无法把你的密钥带出去。
- 本仓库不含任何密钥、账号标识或真实余额数字。

## Scope / 声明

An independent, unofficial recipe. Not affiliated with B.AI or with the dsh-cost-meter author.
一份独立的非官方用法说明，与 B.AI 及 dsh-cost-meter 作者均无隶属关系。
