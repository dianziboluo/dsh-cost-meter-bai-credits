# Show your B.AI Credits balance in dsh-cost-meter

A community recipe for [**dsh-cost-meter**](https://github.com/Han-1413141/dsh-cost-meter): display your
[**B.AI**](https://b.ai) account balance — Credits (积分), the platform's own token unit — as a live card in
the DSH sidebar and in the plugin's **Cost → Quota** settings page.

- No fork of the plugin and no code changes — it uses the built-in *Custom provider balance* feature.
- The number shown is **exactly** what B.AI returns in `data.personal_balance`: integer Credits, with no
  division and no FX conversion.
- Verified against **dsh-cost-meter 1.7.40** and **`GET https://api.b.ai/v1/balance`**.

> 中文版：[`bai-credits-balance.zh-CN.md`](./bai-credits-balance.zh-CN.md)

---

## 1. What you get

| | |
|---|---|
| Where | Sidebar card **and** Cost settings row (`display: both`), collapsed rail included |
| Value | `12345678 Credits` — the raw `personal_balance` integer |
| Refresh | every 15 minutes, plus click the card for an immediate refresh |
| Progress bar | none — B.AI returns a balance but no quota ceiling. The global money budget does not apply to `CREDITS` entries |

## 2. Why Credits and not USD

B.AI's balance endpoint returns **integer Credits**, the platform's own accounting unit — not a fiat amount.

The two official exchange rates are used for *billing* and *top-up rebates*, not for labelling your balance:

| Rate | Source |
|---|---|
| `1 USD = 1,000,000 Credits` | [Pricing & usage](https://docs.b.ai/zh-Hans/llmservice/pricing-and-usage/) — how usage is deducted |
| `1 Coin = 1,000,000 Credits` | [Invitation rewards](https://docs.b.ai/zh-Hans/llmservice/invitation-rewards/) — Coin → Credits |

So a `$`/`¥` card is a **derived** figure — and converting USD to CNY adds a second, unrelated rate on top.
Credits have no CNY peg, so an `¥` label actively misleads. This recipe shows Credits as-is. An optional
USD-equivalent variant is provided in §6.

## 3. Prerequisites

1. **dsh-cost-meter ≥ 1.7.0** — older versions have a single `customBalance` entry and no `unit: "CREDITS"`.
2. **A B.AI API key.** A *personal* key works as documented below. *Team* keys return a different payload
   (see §8).
3. The DSH instance is the one running the plugin (the `web` profile in a normal desktop install).

## 4. Quick start (Settings UI, no file editing)

Go to **Settings → Cost → Quota tab → Custom provider balance → Add entry**
(ZH: **设置 → 费用 → 额度 → 自定义 Provider 余额 → 添加配置**) and fill in:

> This route only edits the `<DSH_HOME>` that the *running* DSH serves, and needs a browser session. If you
> are targeting a different home — or DSH is not running a web UI at all — skip to §5 and use the file/script
> route, which can be pointed at any home with `$DSH_HOME`.

| Field (EN) | Field (ZH) | Value |
|---|---|---|
| Request URL | 请求 URL | `https://api.b.ai/v1/balance` |
| HTTP method | 请求方法 | `GET` |
| Headers (JSON) | 请求头 (JSON) | `{"Authorization":"Bearer {{BAI_API_KEY}}"}` |
| Request body (JSON) | 请求体 (JSON) | *(leave empty — GET sends no body)* |
| Extract rules (JSON) | 解析规则 (JSON) | `{"remaining":"data.personal_balance","unit":"CREDITS"}` |
| Source currency | 余额原币种 | `CREDITS` |
| Convert USD balance to display currency | 按显示币种折算（USD 余额） | **off** — and it stays disabled: the switch only applies to a `USD` unit |
| Chinese name | 中文名称 | `B.AI 余额` |
| English name | 英文名称 | `B.AI Balance` |
| Custom balance display | 自定义余额显示位置 | 侧边栏 / 设置页 / 两者 (both) |
| Refresh interval (minutes) | 刷新间隔 (分钟) | `15` |
| Allowed hosts | 凭据白名单 (逗号分隔) | `api.b.ai` |

Then a **Credential input** row (凭据输入) appears for the `{{BAI_API_KEY}}` placeholder — paste your key
there. It is write-only: the key goes into the DSH credential store and is **never** written to
`ledger.json`, echoed back to the browser, or logged.

**How those rows map to the JSON in §5.** Request URL → `request.url` · HTTP method → `request.method` ·
Headers (JSON) → `request.headers` · Request body (JSON) → `request.body` · Extract rules (JSON) → `extract` ·
Source currency → `unit` · Convert USD balance… → `convertToDisplayCurrency` · Chinese name / English name →
`label` / `labelEn` · Refresh interval → `refreshMinutes` · Custom balance display → `display`, whose accepted
values are `sidebar`, `settings`, `both` and `off` · Allowed hosts → `allowedHosts`.

**Variable naming tip.** `{{BAI_API_KEY}}` above is just a name — you choose it, and it must be the
*same* string in the header and in the credential box. The plugin's convention is `<ROUTE>_API_KEY`, where
`<ROUTE>` is the provider id shown on **Settings → Models**, uppercased with non-alphanumerics replaced by
`_`. Two consequences:

- If B.AI is **already** one of your model providers, use that provider's variable name instead of
  `BAI_API_KEY`. The balance query and the model calls then resolve the *same* stored key, and rotating it
  in one place keeps both working.
- If you keep `BAI_API_KEY` while your model provider already stores its key under another name, you will
  need to store the key a **second** time under the new name — until you do, the card reports
  `custom balance HTTP 401`. Resolution order is the DSH credential store first, then `process.env`.

## 5. Alternative: write the config directly

Target: `<DSH_HOME>/storages/cost-meter/ledger.json` → `config.customBalances[]`
(`<DSH_HOME>` defaults to `~/.dsh`; on Windows `%USERPROFILE%\.dsh`).

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

Notes:

- **Append** it to `config.customBalances` (at most **8** entries). Do not replace the whole file.
- **Which home?** Both the plugin and the script resolve `<DSH_HOME>` as `$DSH_HOME` first, then `~/.dsh`.
  DSH normally *sets* `$DSH_HOME`, so if you have more than one install, check the `dsh home` line the script
  prints before trusting the target.
- If your ledger already holds a **blank, disabled placeholder entry** (empty `url`), the recipe *appends*
  alongside it rather than filling it in. That is harmless — the plugin skips disabled entries entirely
  (`customBalances[i].enabled !== true` is never queried) — but delete it if you prefer a tidy list.
- Run the bundled script with `--dry-run` first: it reports whether an existing B.AI entry would be updated in
  place and which placeholder names already resolve, so you can pick the name your model provider stores.
- On load the plugin **injects extra keys** into every entry's `extract` — `maxBudget: "info.max_budget"`
  and `spend: "info.spend"`, taken from its built-in *default* entry. That is expected and harmless here
  (B.AI has no such fields, so both resolve to `null`), but it means the file will not stay byte-identical
  to the snippet above.
- **No restart needed — but not instantly, either.** The plugin's write path three-way merges `config`
  (baseline vs in-memory vs on-disk) and the on-disk value wins for anything it has not changed in memory.
  That merge only runs when a write is already pending, so an external edit is picked up on the plugin's
  *next* write — normally within seconds of the next model call. If the card never appears, restart DSH or
  make one call to trigger a flush.
- Back up `ledger.json` first. The plugin writes it atomically (temp file + rename), so a plain overwrite
  from your side is safe, but a backup costs nothing.
- Prefer the UI if you can: it validates the JSON as you type and creates the credential row for you.

A ready-to-apply preset and a portable one-shot script are in
[`bai-credits-balance.preset.json`](./bai-credits-balance.preset.json) and
[`apply-bai-credits.mjs`](./apply-bai-credits.mjs).

## 6. Optional: show the USD equivalent instead

If you would rather see money, use `unit: "USD"` and divide by the official rate. This is a **derived**
value — label it with `$`, and only enable the conversion switch if you also want it in your display
currency.

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

For a `12,345,678` Credit balance the entry shows `$12.3457`. With **Convert USD balance to display
currency** on, that USD figure is additionally multiplied by your display rate and rendered in your display
currency — e.g. at a rate of 1.5 with 2 decimals it becomes `18.52`. Keep the two numbers apart:

- the **pre-conversion USD** value (`12.3457`) is the one numerically identical to your balance expressed in
  Coin, because 1 Coin = 1,000,000 Credits = 1 USD;
- the **converted** figure is a local-currency rendering of that USD value, not a Coin count.

You can add both variants side by side (Credits + USD) — the plugin allows up to 8 entries. The two differ
by `unit`, which is what the bundled applier uses to tell them apart, so applying one does not overwrite the
other.

## 7. Verify the endpoint yourself

```bash
# Personal key — expect { success: true, data: { api_key_type: "personal", personal_balance: <int> } }
curl -s https://api.b.ai/v1/balance -H "Authorization: Bearer $MY_BAI_KEY"

# or with x-api-key
curl -s https://api.b.ai/v1/balance -H "x-api-key: $MY_BAI_KEY"
```

Reading the response:

| Field | Meaning |
|---|---|
| `success` | Use this, not the HTTP status, as the result — a failed lookup can be a `200` with `success: false` |
| `data.api_key_type` | `personal` or `team` — decides which fields exist |
| `data.personal_balance` | Integer Credits, **personal keys only** |
| `data.active_status` | `active`, or the reason the account/seat is not usable |
| `data.team.*` | Team keys only: `member_quota_used`, `member_quota_limit` (only when `quota_limit_type === "limited"`), `team_balance` (`admin` role only) |

No key yet? You can still smoke-test reachability: an unauthenticated call returns HTTP 401 with B.AI's error
envelope, which proves DNS, TLS and the endpoint path are fine and isolates any problem to the credential.

## 8. Team keys (untested — derived from the API docs)

A team key has **no** `personal_balance`, so `{"remaining":"data.personal_balance"}` fails. For a member
whose quota is capped (`quota_limit_type: "limited"`):

```json
"extract": {
  "remaining": { "op": "subtract", "paths": ["data.team.member_quota_limit", "data.team.member_quota_used"] },
  "maxBudget": "data.team.member_quota_limit",
  "spend": "data.team.member_quota_used",
  "unit": "CREDITS"
}
```

Caveats: `member_quota_limit` is **omitted** when the quota is unlimited → extraction fails and the card
reports an error rather than a wrong number; and `team_balance` exists only for `admin` roles. A team key
therefore cannot be expressed as a single reliable "remaining" value.

## 9. Troubleshooting

| Message | Cause | Fix |
|---|---|---|
| `custom balance extract.remaining is missing or not numeric` | Path does not exist in the payload — usual cause is a **team** key with no `personal_balance`, or a typo in `extract` | Check `api_key_type`; see §8 |
| `custom balance HTTP 401` | Missing/expired/wrong key, or the placeholder did not resolve to a value | Re-enter the key in the Credential input; check the variable name matches the placeholder exactly |
| `custom balance HTTP 429` | Rate limited. Personal keys sit behind the top-up-status limiter (and a per-user RPM if one is configured); the 429 body is not guaranteed to be JSON | Raise `refreshMinutes`; team keys are exempt from the personal top-up-status limiter |
| `customBalance request host "api.b.ai" is not in customBalance.allowedHosts; refusing to send credentials there (add it explicitly to allow)` | Host not whitelisted while the request carries a credential | Add `api.b.ai` to **Allowed hosts** |
| `custom balance endpoint redirected (HTTP 3xx); redirects are refused to avoid forwarding credentials to another host` | The plugin refuses to follow redirects so credentials cannot be forwarded to another host | Use the final HTTPS endpoint directly |
| `customBalance.request.url must use https (got http:); refusing to send credentials over plaintext` | Plaintext `http://` to a non-loopback host | Use `https://` |
| Card shows `—` or a stale number | Last refresh failed; the plugin keeps the previous value and reports the error in the tooltip | Click the card to force a refresh |
| `extract` gained `maxBudget` / `spend` keys I never wrote | The plugin merges the default entry's `extract` into each new entry | Harmless: B.AI has no `info.max_budget` / `info.spend`, so both resolve to `null` |

## 10. Security notes

- **Never commit** `ledger.json` or your credential store. This recipe keeps the key out of the config
  file entirely by using a `{{VAR}}` placeholder.
- `allowedHosts` is a credential-egress guard: when the request headers carry a secret (placeholder or
  literal), the plugin refuses to send it anywhere else. Keep `["api.b.ai"]` so an imported config cannot
  exfiltrate your key.
- The plugin never ships a plaintext key to the browser: suspicious headers are blanked in the config sent
  to the client.

## 11. Agent-ready application

Both files below are self-contained. An agent (or you) can fetch them and apply the recipe without reading
the plugin's source:

```text
Read bai-credits-balance.preset.json.
Insert or update the `variants.credits.entry` object in the array named by apply.pointer inside
<DSH_HOME>/storages/cost-meter/ledger.json. Match an existing entry exactly on apply.identityFields
(request.url + unit) and update it in place; only append when nothing matches. Back up the file
first, respect apply.maxEntries, and keep any existing credential-header placeholder untouched
(apply.preserveCredentialBinding). Never inline an API key: the {{VAR}} placeholder must survive
literally. Report the resulting entry.
```

`bai-credits-balance.preset.json` carries a machine-readable `apply` block, and
[`apply-bai-credits.mjs`](./apply-bai-credits.mjs) is a reference implementation of it:

| Key | Meaning |
|---|---|
| `apply.path` | Target file, relative to `<DSH_HOME>` |
| `apply.pointer` | Append-style JSON Pointer; the array before the trailing `/-` is the target |
| `apply.maxEntries` | Hard limit enforced by the plugin |
| `apply.requiresRestart` | `false` |
| `apply.identityFields` | Fields that decide "same entry": `request.url` + `unit` |
| `apply.preserveCredentialBinding` | When updating, keep the existing `{{VAR}}` placeholder instead of re-pointing the entry at a different name |
| `apply.requiresCredential` | Variable names that must resolve — from the DSH credential store **or** `process.env` |

The bundled script implements exactly those keys and adds safety rails:

```bash
node apply-bai-credits.mjs                # native Credits variant (default)
node apply-bai-credits.mjs --dry-run      # print what would change, write nothing
node apply-bai-credits.mjs --variant usdEquivalent
node apply-bai-credits.mjs --print-paths  # absolute paths instead of <DSH_HOME>/...
```

It reads `apply.pointer` / `identityFields` / `preserveCredentialBinding` / `requiresCredential` from the
preset, so the preset — not the script — stays the source of truth. Run it with `--dry-run` first: it will
tell you whether an existing entry would be updated in place and which credential names already resolve.

## 12. Credits & scope

- Plugin: [dsh-cost-meter](https://github.com/Han-1413141/dsh-cost-meter) by Han-1413141 (MIT). The exact
  build this recipe was tested against (`1.7.40`) is pinned deliberately: the claims above are behavioural,
  and a version number is public release metadata, not personal data.
- API: [B.AI balance API](https://docs.b.ai/zh-Hans/llmservice/api/balance/) ·
  [pricing & Credits](https://docs.b.ai/zh-Hans/llmservice/pricing-and-usage/).
- This document is an independent, unofficial recipe. It is not affiliated with B.AI or with the plugin
  author. No API keys, account identifiers or balance figures are included — all values above are
  placeholders or taken from B.AI's public documentation.
