# LiquiLab Access Policy

LiquiLab is currently offered through a limited early-access program. This document outlines how seats are assigned, how crypto payments work, and which disclaimers apply.

## Early Access Slots
- Early access is capped at **100 activated users**.
- Every activated wallet receives **two pools for free**; additional pools require a paid subscription once public billing launches.
- When 100 accounts are active new applicants are placed on the waitlist. Slots reopen as accounts are deactivated.

## Waitlist
- Operators can join from `/waitlist` or the homepage CTA.
- Required fields: email (mandatory) and optional Flare wallet address.
- Entries are timestamped so the team can invite accounts in order.

## Fast-Track Access (Crypto)
- Supporters can skip the waitlist with a **one-time $50 USDT₀** payment on Flare (chainId 14).
- Payment parameters:
  - **Treasury address:** `TREASURY_ADDRESS` (see environment config).
  - **Token:** `ACCEPTED_TOKEN_ADDRESS_USDT0` (USDT₀ / eUSDT contract on Flare).
  - **Amount:** exactly `50.000000` tokens (6 decimals).
- The `/fastforward/pay` page issues an intent ID, displays QR instructions, and collects the submitted transaction hash.
- `/api/fastforward/confirm` verifies the payment on-chain (ERC-20 `Transfer` logs). Status changes to `PAID`, but the account remains on the waitlist until an admin approves the payment.

## Admin Approval
- Admins review payments at `/admin/payments` using `ADMIN_SECRET`.
- Only payments with status `PAID` can be approved.
- On approval:
  - `User.state` → `ACTIVATED`
  - `poolAllowance` → `2`
  - An approval email plus a CSV invoice is sent via Resend. The attachment is formatted for direct import into GetGekko.

## Disclaimers
LiquiLab is in early development. Features and pricing may change. Outages or data issues may occur and no refunds can be issued for early access or usage-based payments.

By paying or using the application you accept these conditions.
