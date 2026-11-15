# BIDORA marketplace

BIDORA is a Next.js 14 / React marketplace with Supabase authentication, auction listings, bidding, watchlists, storage, admin moderation, scheduled auction close, winner reservations, Razorpay payment links, and delivery detail collection.

## Connect a Supabase project

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never put a secret/service-role key in a `NEXT_PUBLIC_` variable.
3. In Supabase SQL Editor, run the migration files in order: `202610300001_marketplace.sql`, `202610310001_roles_presence.sql`, `202610310002_admin_listing_submit.sql`, `202610310003_auction_settlement.sql`, and `202610310004_auction_agent.sql`.
4. Start the app with `npm run dev` and open http://localhost:3000.
5. Register an account. Confirm the email if email confirmation is enabled.
6. Create a listing from **Sell an item**. It enters the pending moderation queue. To bootstrap the first admin, find your user ID in Supabase Authentication and run `update public.profiles set role = 'admin' where id = '<your-user-uuid>';` in SQL Editor. Sign out and back in, then approve listings from `/admin`.

## Features

- Email/password sign up and sign in, with cookie-based server sessions.
- Auction browsing from Supabase when configured; local demo catalogue fallback before configuration.
- Seller listing submissions and cover-image uploads to the `listing-images` bucket.
- Atomic bid placement through a Postgres function, with database row locking and realtime current-bid updates.
- Per-user watchlists and seller dashboard.
- Admin-only moderation protected by role checks and row-level security.
- Auctions close five minutes after the last bid (or at their scheduled end); the highest bidder receives a two-hour payment window.
- Unpaid items restart as a new seven-day round. Each auction round is processed independently by a Supabase Cron job.
- The auction agent creates an INR Razorpay payment link for every new winning award, emails it to the buyer through Razorpay, and expires it at the two-hour deadline. The agent does not choose winners or mark payments as paid.
- Paid winners are verified from Razorpay's signed webhook and then asked for delivery details; sale and delivery notices appear in the admin dashboard.
- Auction amounts and payment links use INR.
- Jet black / cerulean blue / neon rose responsive interface.
- Bidi, the BIDORA auction guide, is available from the floating **Ask Bidi** chat. It follows the published auction rules and never handles bids, moderation, payment confirmation, or private account information.

## Configure Bidi's OpenAI API access

1. Create an OpenAI API key in your OpenAI developer account. Keep it private; do not paste it into chat, source code, or a `NEXT_PUBLIC_` variable.
2. Add `OPENAI_API_KEY=your_key` to `.env.local` in the project folder. Optionally set `BIDORA_ASSISTANT_MODEL` there; the default is `gpt-6-luna`.
3. Stop and restart the local Next.js server so it reads the new setting. In production, add the same variables to the hosting provider's server-side environment settings and redeploy.
4. Open any page and use **Ask Bidi**. Without the key, Bidi gives built-in auction FAQ answers; with the key, it uses OpenAI for responses. OpenAI API use may incur charges according to your account's current pricing and usage.

The API key is read only by `app/api/assistant/chat/route.ts`; the browser sends chat messages to BIDORA's own route and never receives the key. The assistant is informational only and cannot make or approve transactions.

## Routes

- `/` Marketplace home
- `/auctions` Live auction catalogue
- `/auctions/[slug]` Auction details, realtime price, bidding and watchlist
- `/login`, `/register` Authentication
- `/sell` Create a listing for review
- `/dashboard` Your listings, bids and saved items
- `/admin` Moderation (admin role required)
- `/payments/[awardId]` Winner payment and delivery steps

## Enable the auction agent and scheduled payments

1. Run migrations `202610310003_auction_settlement.sql` and `202610310004_auction_agent.sql` after the earlier three migrations. The third migration schedules auction closing and unpaid relisting. The fourth creates the secure agent award-claim procedure.
2. Deploy the `auction-agent` Supabase Edge Function from this folder with the Supabase CLI: `supabase link --project-ref YOUR_PROJECT_REF`, then `supabase functions deploy auction-agent`. The `supabase/config.toml` file disables Supabase JWT verification for this function because the function validates its own private `x-bidora-agent-secret` header.
3. In the Supabase Dashboard, open **Edge Functions → Secrets** and add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `BIDORA_AGENT_SECRET`, and `BIDORA_SITE_URL`. Use Razorpay **test mode** credentials first. Set `BIDORA_SITE_URL` to the public BIDORA URL; for local development use `http://localhost:3000`. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions.
4. In the Supabase Dashboard, open **Database → Extensions** and enable `pg_net` if it is not enabled. Supabase Cron uses `pg_cron` plus `pg_net` to invoke Edge Functions on a schedule, and Supabase recommends storing the URL and invocation secret in Vault. [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
5. Open `supabase/agent/setup-cron.sql`. Replace `YOUR_PROJECT_REF` with your Supabase project reference and `PASTE_THE_SAME_PRIVATE_BIDORA_AGENT_SECRET_HERE` with the exact value you saved as `BIDORA_AGENT_SECRET`. Run the script once in Supabase SQL Editor. It schedules the agent every minute. It only stores the custom agent token in Vault; do not use your Supabase service-role key for this token.
6. In Razorpay, add a webhook pointing to `https://YOUR_PUBLIC_SITE/api/webhooks/razorpay`, subscribe to `payment_link.paid`, and set `RAZORPAY_WEBHOOK_SECRET` in the app's server environment. The webhook verifies the signature and then checks the payment with Razorpay before recording it as paid.
7. Set `NEXT_PUBLIC_SITE_URL` in the app environment to the public BIDORA URL and restart the app. Test the complete flow with Razorpay test credentials before using live keys.

The webhook must reach a public HTTPS site; Razorpay cannot call `localhost` directly. The sale confirmation is shown in the admin dashboard with item, buyer name, buyer ID, and paid amount. The agent can handle multiple awards per run and each auction round independently. The agent does not create a payment link until the database lifecycle worker has closed the auction and recorded its winner. Payments cannot be considered live until the Edge Function, secrets, Vault cron job, public webhook, and Razorpay credentials are configured. This project does not yet handle shipping labels, refunds, chargebacks, or payment disputes; those need a separate operational flow before production use.
