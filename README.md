# Idea L Pack — employee portal

A five-tab portal for Team, Activity & News, Notifications, Documents and Pictures. Everyone can view and download without signing in. Only three assigned administrator accounts can publish, edit announcements, or upload/remove documents and photographs.

## Hosting

GitHub Pages hosts `public/`. Supabase provides the database, public file storage and email/password administrator login. No Microsoft tenant configuration or separate Node server is needed.

Public viewing is intentional: anyone with the link can see the team directory, news, photographs and documents. The `noindex` tag discourages search indexing but does not restrict access. Do not publish confidential HR records here. Files may remain in visitors' downloads or CDN caches after removal.

## Set up Supabase

1. Create a **Free** project in your organization, preferably Singapore for this team. Free-plan quotas and inactivity pauses apply; check [current limits](https://supabase.com/pricing). Keep offline source backups.
2. Run `supabase/schema.sql` once in the SQL editor of this dedicated project. It creates public-read tables, a public `portal-media` bucket and exactly three administrator slots. Database row-level security protects writes; a visitor cannot gain access by changing the page or calling the API directly.
3. In Authentication settings, disable **Allow new users to sign up** and anonymous sign-ins. Set the site URL to `https://gomayoha.github.io/ilp-internal-portal/`. Use a minimum password length of 15 characters. No email delivery is needed for the initial owner-created accounts. Automatic email resets require separately configured SMTP; the portal currently directs users to the project owner for recovery.
4. In Authentication → Users, create an email/password account for Yohan's work email and Tina's work email. Enter strong unique passwords privately, and transfer credentials securely. These are new portal passwords, not Microsoft/mailbox passwords. Leave the third slot empty until the second HR person is identified.
5. Assign each account's Supabase user ID to a slot using SQL below. Having an Auth account alone grants no publishing rights. Slots can only be assigned by the project owner, not through the public website. Removing a slot immediately removes write access even if a user remains signed in.

```sql
-- Replace these placeholders with actual Auth user IDs.
update public.portal_admin_slots set user_id = 'YOHAN-USER-UUID' where slot = 1;
update public.portal_admin_slots set user_id = 'TINA-USER-UUID' where slot = 2;
-- Reserve slot 3: keep user_id null until the third person is approved.
```

6. Import the supplied source pack. Put it in `private/`, install dependencies, then run `pnpm seed --check`. For the import, supply `SUPABASE_URL` and `SUPABASE_SECRET_KEY` through a local environment file and run `node --env-file=.env scripts/import-content.mjs`. The secret key must never appear in the browser, source control, chat or a public ZIP. The script adds missing initial files and entries without overwriting existing ones.
7. Put only the project URL and **publishable** key into `public/config.json`:

```json
{"supabaseUrl":"https://YOUR-PROJECT.supabase.co","supabasePublishableKey":"sb_publishable_YOUR_PUBLIC_KEY"}
```

The publishable key is intended for browsers. The database policies, not secrecy of this key, enforce publishing permissions.

## Local preview and checks

Node.js 22+ and pnpm are required.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm test
pnpm preview
```

Open `http://127.0.0.1:4173`. With an empty Supabase configuration the loopback-only preview reads the local source pack. Visitors see all content. The account button opens an explicitly labelled administrator demonstration; preview changes are kept in `runtime/supabase-preview-content.json`. This demo is not deployed. When Supabase is configured, the same page uses real hosted data and login.

Tests run the actual schema and access policies in a local PostgreSQL-compatible PGlite runtime, with synthetic Auth/Storage tables. They verify anonymous reads, anonymous and unassigned write denial, three-account limits, slot revocation, file path restrictions and payload validation. They do not replace checking real Supabase Auth and Storage after connection.

## Release

Choose **GitHub Actions** as the repository's Pages source and run the manual **Publish employee portal** workflow from the reviewed release branch. It tests, builds and deploys only `public/`, preserving the existing Pages URL. Before release, verify both administrator accounts, a signed-out browser, uploads, downloads and the public media URLs. Keep the old live page until the new hosted flow works.

The build pins dependencies in `pnpm-lock.yaml`, bundles the Supabase client and downloads the official Montserrat font with a SHA-256 check. Generated bundles/fonts are not committed. The Seasons was not supplied, so headings use a serif fallback. UI colors follow the supplied palette.

## Administrator use

Open the account icon, sign in with your portal email/password, and publishing controls appear. News and notifications can be edited or removed; documents and pictures can be uploaded and removed. Public signup is absent and disabled in Supabase. Uploads are limited to 20 MB each. Changing a password is available in the account dialog. Sessions stay in memory; refreshing or closing the page signs you out, while viewing remains open.

The database is authoritative. Ordinary accounts cannot grant themselves administrator access. Project owners must keep their Supabase account secure and disable unwanted Auth providers. Keep the third administrator slot unassigned until its person is known.
