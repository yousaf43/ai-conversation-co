<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- WhatsApp traffic enters only via `src/routes/api/public/greenapi-webhook.ts`, which checks a Bearer token against `GREEN_WEBHOOK_TOKEN` before any privileged DB work — the route is public.
- Agent prompt + AI call live in `src/lib/agent.server.ts`; rates are read live from the owner Google Sheet (src/lib/rates-sheet.server.ts, 60s cache, falls back to the products table) and owner notes from the DB on every reply so rate changes apply without a deploy.
- Dashboard data is admin-only via RLS `has_role(auth.uid(),'admin')`; the first account that signs up is made admin by a DB trigger.
- Message dedupe uses a unique `external_id` (Green API idMessage) so webhook retries never cause double replies.
