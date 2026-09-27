# 在 dsh-cost-meter 中显示 B.AI 代币余额（Credits）

> 这是给 [**dsh-cost-meter**](https://github.com/Han-1413141/dsh-cost-meter) 写的一份社区用法说明：把
> [**B.AI**](https://b.ai) 账户余额（Credits / 积分，即平台代币余额）作为实时卡片显示在 DSH 侧边栏和插件的
> **费用 → 额度** 设置页里。
>
> 英文版：[`bai-credits-balance.md`](./bai-credits-balance.md)

不需要改插件源码、不需要 fork —— 全程使用插件内置的「自定义 Provider 余额」功能。卡片显示的数字**就是**
B.AI 接口 `data.personal_balance` 返回的整数 Credits，不做除法、不做汇率折算。

已在 **dsh-cost-meter 1.7.40** 与 **`GET https://api.b.ai/v1/balance`** 上实测通过。

---

## 1. 最终效果

| | |
|---|---|
| 显示位置 | 侧边栏卡片 **与** 费用设置页（`display: both`），窄栏收起态同样显示 |
| 显示值 | `12345678 Credits` —— 原始的 `personal_balance` 整数 |
| 刷新 | 默认 15 分钟一次；点击卡片可立即刷新 |
| 进度条 | 无。B.AI 只返回余额、不返回额度上限；`CREDITS` 条目也不参与全局货币预算 |

## 2. 为什么是 Credits，而不是美元/人民币

B.AI 余额接口返回的是**整数 Credits**，也就是平台自己的记账单位，不是货币金额。

官方那两个比例是**扣费**和**返利兑换**用的，不是给你标注余额币种用的：

| 比例 | 出处 |
|---|---|
| `1 USD = 1,000,000 Credits` | [定价与用量](https://docs.b.ai/zh-Hans/llmservice/pricing-and-usage/) —— 按此换算扣除 Credits |
| `1 Coin = 1,000,000 Credits` | [邀请返利规则](https://docs.b.ai/zh-Hans/llmservice/invitation-rewards/) —— Coin 兑换 Credits |

所以显示成 `$` / `¥` 都是**派生的**数字：先 ÷1,000,000 得到美元等值，再乘一个跟 B.AI 毫无关系的
美元兑人民币汇率。Credits 与人民币之间**不存在**任何汇率关系，用 `¥` 标注属于误导。

本方案直接显示原生 Credits。如果你确实想看金额视角，见 §6 的可选变体。

## 3. 前置条件

1. **dsh-cost-meter ≥ 1.7.0** —— 更早的版本只有单条 `customBalance`，也没有 `unit: "CREDITS"`。
2. **一个 B.AI API Key。** 下面写的是**个人 Key** 的用法；**团队 Key** 返回的字段不一样，见 §8。
3. 该 DSH 实例正是运行此插件的实例（常规桌面安装即 `web` profile）。

## 4. 快速上手（设置页操作，不需要改文件）

进入 **设置 → 费用 → 额度 → 自定义 Provider 余额 → 添加配置**，按下表填写：

> 这条路只能改**正在运行的 DSH 实例**所用的那个 `<DSH_HOME>`，而且需要浏览器会话。如果你要改的是另一个
> home —— 或者 DSH 压根没在跑 Web UI —— 请直接跳到 §5 用文件/脚本路线，它可以用 `$DSH_HOME` 指向任意 home。

| 字段 | 填什么 |
|---|---|
| 请求 URL | `https://api.b.ai/v1/balance` |
| 请求方法 | `GET` |
| 请求头 (JSON) | `{"Authorization":"Bearer {{BAI_API_KEY}}"}` |
| 请求体 (JSON) | 留空（GET 不发请求体） |
| 解析规则 (JSON) | `{"remaining":"data.personal_balance","unit":"CREDITS"}` |
| 余额原币种 | `CREDITS` |
| 按显示币种折算（USD 余额） | **关闭**，而且本来就点不动 —— 该开关只在 `unit` 为 `USD` 时可用 |
| 中文名称 | `B.AI 余额` |
| 英文名称 | `B.AI Balance` |
| 自定义余额显示位置 | 侧边栏 / 设置页 / 两者 |
| 刷新间隔 (分钟) | `15` |
| 凭据白名单 (逗号分隔) | `api.b.ai` |

填好后，下方「凭据输入」区会为 `{{BAI_API_KEY}}` 生成一行 write-only 输入框，把 Key 粘进去即可。密钥只写入
DSH 凭据库，**不会**落进 `ledger.json`、不会回传给浏览器、也不进日志。

**这些界面字段对应 §5 里的哪个 JSON 键。** 请求 URL → `request.url` · 请求方法 → `request.method` ·
请求头 (JSON) → `request.headers` · 请求体 (JSON) → `request.body` · 解析规则 (JSON) → `extract` ·
余额原币种 → `unit` · 按显示币种折算 → `convertToDisplayCurrency` · 中文名称 / 英文名称 → `label` / `labelEn` ·
刷新间隔 → `refreshMinutes` · 自定义余额显示位置 → `display`，可取值只有 `sidebar`、`settings`、`both`、`off` ·
凭据白名单 → `allowedHosts`。

**变量名命名建议。** 上面的 `{{BAI_API_KEY}}` 只是个名字，由你自己定：**请求头里写什么，凭据输入框里就得填同名**。
插件约定是 `<ROUTE>_API_KEY`：`<ROUTE>` 取「设置 → 模型」里的 provider id，全部大写、非字母数字字符换成 `_`。
这带来两个后果：

- 如果你已经把 B.AI 配成了模型 provider，**请改用那个 provider 的变量名**，而不是 `BAI_API_KEY`。这样模型调用和
  余额查询会解析到**同一把**已存密钥，以后换 Key 只需改一处。
- 如果你坚持用 `BAI_API_KEY`，而你的模型 provider 已经把密钥存在别的名字下，那你就得**再存一次**；在存之前卡片会
  报 `custom balance HTTP 401`。解析顺序是：先查 DSH 凭据库，再查 `process.env`。

## 5. 另一种做法：直接写配置文件

目标文件：`<DSH_HOME>/storages/cost-meter/ledger.json` 里的 `config.customBalances[]`
（`<DSH_HOME>` 默认为 `~/.dsh`，Windows 上是 `%USERPROFILE%\.dsh`）。

```json
{
  "enabled": true,
  "display": "both",
  "refreshMinutes": 15,
  "label": "B.AI 余额",
  "labelEn": "B.AI Balance",
  "unit": "CREDITS",
  "convertToDisplayCurrency": false,
  "request": {
    "url": "https://api.b.ai/v1/balance",
    "method": "GET",
    "headers": { "Authorization": "Bearer {{BAI_API_KEY}}" }
  },
  "extract": { "remaining": "data.personal_balance", "unit": "CREDITS" },
  "allowedHosts": ["api.b.ai"]
}
```

几点说明：

- **追加**到 `config.customBalances` 数组里，最多 **8** 条；不要整个文件替换。
- **作用于哪个 home？** 插件和脚本都按 `$DSH_HOME` → `~/.dsh` 的顺序解析 `<DSH_HOME>`。而 DSH 通常**会设置**
  `$DSH_HOME`，所以如果你机器上有多套安装，先看脚本打印的 `dsh home` 那一行，再确认目标是否正确。
- 如果账本里已经有一条**空白且未启用**的占位条目（`url` 为空），本方案是**追加**在它旁边，而不是填进它。
  这无害 —— 插件会完全跳过未启用的条目（`customBalances[i].enabled !== true` 永不查询）—— 但你要是想列表干净，
  可以直接删掉它。
- 先跑一次 `--dry-run`：它会告诉你已有条目会不会被就地更新，以及哪些占位符名字已经能解析到，便于你直接选模型
  provider 已经在用的那个名字。
- 加载时插件会往每条的 `extract` 里**补写两个键**：`maxBudget: "info.max_budget"` 和 `spend: "info.spend"`，
  取自它内置的**默认**条目。这是预期行为、此处无害（B.AI 没有这两个字段，取值都是 `null`），但意味着磁盘上的
  配置不会和上面的片段逐字节一致。
- **不需要重启 DSH，但也不是立刻生效。** 插件的写入路径会对 `config` 做三方合并（基线 / 内存 / 磁盘），内存里
  没改过的字段以磁盘为准；但这次合并只在**已有待写入内容时**才会跑，所以外部改动是在插件下一次写入时被采纳 ——
  通常是下一次模型调用后的几秒内。如果卡片一直不出现，重启 DSH，或随便发起一次调用触发 flush。
- 改前先备份 `ledger.json`。插件本身用「临时文件 + rename」原子写盘，从外部覆盖是安全的，但备份不要钱。
- 能用设置页就用设置页：它会边输入边校验 JSON，还会自动生成凭据输入行。

可直接套用的预设和便携的一次性脚本见
[`bai-credits-balance.preset.json`](./bai-credits-balance.preset.json) 与
[`apply-bai-credits.mjs`](./apply-bai-credits.mjs)。

## 6. 可选：改看美元等值

如果你更想看到金额，把单位改成 `unit: "USD"` 并按官方比例换算。这是一个**派生值**：用 `$` 标注，只有在你
同时想折算成本地显示币种时才打开折算开关。

```json
{
  "unit": "USD",
  "convertToDisplayCurrency": false,
  "extract": {
    "remaining": { "op": "divide", "path": "data.personal_balance", "by": 1000000 },
    "unit": "USD"
  }
}
```

`12,345,678` Credits 在条目里显示为 `$12.3457`。再打开「按显示币种折算」时，这个美元值会被乘以你的显示汇率并
按显示币种渲染 —— 例如汇率 1.5、精度 2 位时变成 `18.52`。这两个数字要分清：

- **折算前的美元值**（`12.3457`）才在数值上等于你的余额换算成 Coin 的数量，因为 1 Coin = 1,000,000 Credits = 1 USD；
- **折算后**的数字只是这个美元值的本地币种呈现，不是 Coin 数量。

两种变体可以并存（Credits + USD 各一条），插件最多支持 8 条。两者靠 `unit` 区分，这正是随附脚本判断「同一条」的
依据，所以应用其中一个不会覆盖另一个。

## 7. 自己验证接口

```bash
# 个人 Key —— 期望 { success: true, data: { api_key_type: "personal", personal_balance: <整数> } }
curl -s https://api.b.ai/v1/balance -H "Authorization: Bearer $MY_BAI_KEY"

# 或用 x-api-key
curl -s https://api.b.ai/v1/balance -H "x-api-key: $MY_BAI_KEY"
```

响应字段：

| 字段 | 含义 |
|---|---|
| `success` | **以它为准**，不要只看 HTTP 状态码 —— 查询失败可能是 `200` + `success: false` |
| `data.api_key_type` | `personal` 或 `team`，决定有哪些字段 |
| `data.personal_balance` | 整数 Credits，**仅个人 Key 返回** |
| `data.active_status` | `active`，或账户/席位不可用的原因 |
| `data.team.*` | 仅团队 Key：`member_quota_used`；`member_quota_limit`（仅 `quota_limit_type === "limited"` 时存在）；`team_balance`（仅 `admin` 角色） |

**还没有 Key 也能先探活**：未携带凭据的调用会返回 HTTP 401 加 B.AI 的错误信封 —— 这证明 DNS、TLS 与端点路径都没问题，
从而把问题范围收敛到凭据本身。

## 8. 团队 Key（未实测，按接口文档推导）

团队 Key **没有** `personal_balance`，所以 `{"remaining":"data.personal_balance"}` 会失败。对于有额度上限的成员
（`quota_limit_type: "limited"`）：

```json
"extract": {
  "remaining": { "op": "subtract", "paths": ["data.team.member_quota_limit", "data.team.member_quota_used"] },
  "maxBudget": "data.team.member_quota_limit",
  "spend": "data.team.member_quota_used",
  "unit": "CREDITS"
}
```

注意：额度不限时 `member_quota_limit` 会被**省略**，此时取数失败并报错（而不是显示一个错误的数字）；
`team_balance` 只有 `admin` 角色才有。也就是说，团队 Key 无法用单条配置表达为一个可靠的「剩余额度」。

## 9. 排错

| 报错 / 现象 | 原因 | 处理 |
|---|---|---|
| `custom balance extract.remaining is missing or not numeric` | 路径在响应里不存在 —— 最常见是用了**团队** Key（没有 `personal_balance`），或 `extract` 写错 | 先看 `api_key_type`；见 §8 |
| `custom balance HTTP 401` | Key 缺失/过期/写错，或占位符没解析出值 | 在「凭据输入」里重新填 Key；核对变量名与占位符完全一致 |
| `custom balance HTTP 429` | 触发限流。个人 Key 受充值状态限流器约束（若配置了单用户 RPM 则优先用该配置）；429 的响应体不保证是 JSON | 调大「刷新间隔」；团队 Key 不适用个人充值状态限流 |
| `customBalance request host "api.b.ai" is not in customBalance.allowedHosts; refusing to send credentials there (add it explicitly to allow)` | 请求携带凭据但主机不在白名单 | 把 `api.b.ai` 加进「凭据白名单」 |
| `custom balance endpoint redirected (HTTP 3xx); redirects are refused to avoid forwarding credentials to another host` | 插件拒绝跟随重定向，防止凭据被转发到别的主机 | 直接写最终 HTTPS 地址 |
| `customBalance.request.url must use https (got http:); refusing to send credentials over plaintext` | 对非回环主机用了明文 `http://` | 改用 `https://` |
| 卡片显示 `—` 或旧值 | 最近一次查询失败；插件保留上一次的值并在悬停提示里说明错误 | 点击卡片强制刷新一次 |
| `extract` 里多出我没写的 `maxBudget` / `spend` | 插件会把**内置默认条目**的 `extract` 合并进每一条配置 | 无害：B.AI 没有 `info.max_budget` / `info.spend` 这两个路径，取值为 `null` |

## 10. 安全说明

- **不要**把 `ledger.json` 或凭据库提交到仓库。本方案用 `{{VAR}}` 占位符，配置文件里**完全没有**密钥。
- `allowedHosts` 是凭据外带防护：请求头携带密钥（占位符或明文）时，插件只允许发往白名单主机。保持
  `["api.b.ai"]`，这样即使导入了他人的配置也无法把你的密钥带出去。
- 插件下发给浏览器的配置里，疑似密钥的请求头一律置空，明文密钥不会出现在前端。

## 11. 让 Agent 自动套用

下面两个文件都是自包含的。Agent（或你自己）可以直接读取并套用，无需翻插件源码：

```text
读取 bai-credits-balance.preset.json。
把 variants.credits.entry 对象插入或更新到 apply.pointer 指向的数组里（<DSH_HOME>/storages/cost-meter/ledger.json）。
按 apply.identityFields（request.url + unit）做精确匹配：命中就就地更新，没命中才追加。先备份文件，遵守
apply.maxEntries 上限；更新时保留原有的凭据头占位符（apply.preserveCredentialBinding），不要把它改指到别的
变量名。不要把任何 API Key 写成内联，{{VAR}} 占位符必须原样保留。最后回报写入结果。
```

`bai-credits-balance.preset.json` 内含机器可读的 `apply` 段，随附的
[`apply-bai-credits.mjs`](./apply-bai-credits.mjs) 就是它的一份参考实现：

| 键 | 含义 |
|---|---|
| `apply.path` | 目标文件，相对 `<DSH_HOME>` |
| `apply.pointer` | 追加式 JSON Pointer；末尾 `/-` 之前的那段就是目标数组 |
| `apply.maxEntries` | 插件强制的条数上限 |
| `apply.requiresRestart` | `false` |
| `apply.identityFields` | 判定「同一条」的字段：`request.url` + `unit` |
| `apply.preserveCredentialBinding` | 更新时保留原有 `{{VAR}}` 占位符，不把条目改指到另一个变量名 |
| `apply.requiresCredential` | 必须能解析到的变量名 —— 来自 DSH 凭据库**或** `process.env` |

脚本完整实现了这些键，并额外带了几道保险：

```bash
node apply-bai-credits.mjs                # 默认应用原生 Credits 变体
node apply-bai-credits.mjs --dry-run      # 只打印将要发生的改动,不写盘
node apply-bai-credits.mjs --variant usdEquivalent
node apply-bai-credits.mjs --print-paths  # 打印绝对路径（默认显示 <DSH_HOME>/...）
```

它从预设里读取 `pointer` / `identityFields` / `preserveCredentialBinding` / `requiresCredential`，所以
**预设才是唯一事实来源，脚本不是**。建议先跑 `--dry-run`：它会告诉你已有条目会被就地更新，以及哪些凭据名已经能解析到。

## 12. 出处与声明

- 插件：[dsh-cost-meter](https://github.com/Han-1413141/dsh-cost-meter)（作者 Han-1413141，MIT）。文中
  锁定了实测所用的具体版本（`1.7.40`）：上面所有结论都是行为性断言，而版本号本身是公开发布元数据，不属于个人信息。
- 接口：[B.AI 余额 API](https://docs.b.ai/zh-Hans/llmservice/api/balance/) ·
  [定价与 Credits](https://docs.b.ai/zh-Hans/llmservice/pricing-and-usage/)。
- 本文是一份独立的非官方用法说明，与 B.AI 及插件作者均无隶属关系。文中不含任何 API Key、账号标识或真实
  余额数字 —— 所有取值均为占位符，或取自 B.AI 公开文档。
