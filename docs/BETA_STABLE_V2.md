# VVVEco Beta Stable V2 — Baseline

**Date:** 2026-06-14
**Branch:** mainnet-pilot
**Network:** Base Sepolia (chainId: 84532)

---

## Git

| Item | Value |
|------|-------|
| Commit ID | b3e558a |
| Branch | mainnet-pilot |
| Repository | https://github.com/JH666666/VVVEco.git |

---

## Contract Addresses

| Contract | Address |
|----------|---------|
| VVVToken | `0x3C03096D6174b7d6Cc6d5f1e442f43B269Bc3A30` |
| VVVEcoStaking | `0x707AeF5E4331c45F1b11aA50EB452b396cE69DD9` |
| VVVPayout | `0x6cb514724C355Be8A2d19D1228DF8300cBb1CbA6` |
| VVVTreasury | `0xD9247b65A641c67b4Db600494af67E0De6e17e72` |
| MockRouter | `0x9BB5BA22C26B816157Cd943b13bEe8967aAe01B1` |

All four contracts verified on-chain: `owner()` = `0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3`

---

## Key Addresses

| Role | Address |
|------|---------|
| Owner | `0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3` |
| Root Referrer | `0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3` |
| Fee Wallet | `0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3` |
| Project Wallet | `0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3` |

---

## Verified Sources

All addresses confirmed consistent across four sources:
- `.env`
- `deployments/base-sepolia.json`
- DB `contract_config`
- On-chain `owner()` call

---

## Scope of This Release

- Contract Admin freeze controls (personal claim + principal withdrawal)
- Freeze list: UID from DB, operation time, default 10 rows with expand
- Team claim freeze panel removed (contract-level architectural limitation)
- Legacy `app/` routes removed after migration to `app/(app)/` shared layout
- All admin contract routing corrected (setFeeWallet → Payout, setProjectWallet → Treasury)
- TP wallet duplicate-call nonce fix
- ETH rescue via `useRescueETH` hook

---

> All future development should branch from this baseline.
