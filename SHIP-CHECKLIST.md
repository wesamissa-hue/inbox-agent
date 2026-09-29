# Ship Checklist

## Ready in Source

- [x] Core inbox-to-agent-to-response flow is in place (reported working).
- [x] Inbox and dashboard share a consistent UI.
- [x] Loading, empty, and error states are present.
- [x] Email/password sign-up, confirmation, and sign-in flow is implemented.
- [x] Existing login redirects users into the protected project.
- [x] Secrets use environment variables; local `.env.local` files are ignored.
- [x] No token-shaped credentials were found in source or documentation.
- [x] Two-minute demo script is ready.

## Verify on the Live URL

- [x] Live URL responds: https://inbox-agent-rho.vercel.app
- [ ] Deploy the current source changes to Vercel.
- [ ] Create a new account on the live URL and complete email confirmation if enabled.
- [ ] Sign in with that new account and confirm the inbox loads.
- [ ] Confirm the Agent Dashboard loads after sign-in.
- [ ] Run the two-minute demo against the deployed version.

Before testing signup, confirm the Supabase Email provider is enabled and its
Auth Site URL points to the deployed app URL. The supplied demo RLS policies
remain open to anonymous and authenticated users, so login does not isolate
conversation data by account.