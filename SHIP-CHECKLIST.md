# Ship Checklist

## Ready in Source

- [x] Core inbox-to-agent-to-response flow is in place (reported working).
- [x] Inbox and dashboard share a consistent UI.
- [x] Loading, empty, and error states are present.
- [x] Email/password sign-up, confirmation, and sign-in flow is implemented.
- [x] Existing login redirects users into the protected project.
- [x] Conversation ownership is assigned and enforced by RLS in source SQL.
- [x] Message and private-image access is checked through owned conversations.
- [x] Dashboard route requires the trusted `admin` app-metadata role.
- [x] Agent RPC execution is restricted to the server-side `service_role`.
- [x] Secrets use environment variables; local `.env.local` files are ignored.
- [x] No token-shaped credentials were found in source or documentation.
- [x] Two-minute demo script is ready.

## Verify on the Live URL

- [x] Live URL responds: https://inbox-agent-rho.vercel.app
- [ ] Deploy the current source changes to Vercel.
- [ ] Apply the ownership migration and map all legacy conversations to verified owners.
- [ ] Assign the `admin` app-metadata role to trusted dashboard operators.
- [ ] Re-import/update the existing n8n Build Prompt node for private signed images.
- [ ] Create a new account on the live URL and complete email confirmation if enabled.
- [ ] Sign in with that new account and confirm the inbox loads.
- [ ] Confirm that user's conversations are isolated from a second test user.
- [ ] Confirm a normal user cannot access the Agent Dashboard; confirm an admin can.
- [ ] Confirm image upload, private display, and agent image understanding.
- [ ] Run the two-minute demo against the deployed version.

Before testing signup, confirm the Supabase Email provider is enabled and its
Auth Site URL points to the deployed app URL. This workspace has no Supabase
CLI/local database configuration, so two-user RLS and live n8n integration
checks remain manual after applying the migration.