# LiquiLab Smoke Test

Use these steps after each deployment to Railway.

## Automated Checks
1. Homepage availability
   ```bash
   curl -I https://<app>/
   ```
2. API health
   ```bash
   curl -s https://<app>/api/health
   ```
3. Demo pools endpoint
   ```bash
   curl -s https://<app>/api/demo/pools | jq length
   ```

## Manual Checks
1. Visit https://<app>/ and complete the placeholder login.
2. On the homepage, open the wallet connect modal and connect with a test wallet.
3. Confirm the modal shows the top pool card, stats, and both CTAs.
4. Click “Start your free trial” → confirm redirect to `/dashboard?trial=<poolId>`.
5. Return and click “Subscribe to follow more pools” → confirm redirect to `/pricing`.
