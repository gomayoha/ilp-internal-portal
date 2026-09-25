# Idea L Pack — internal workplace portal

A five-section portal for Our Team, Activity & News, Notifications, Documents, and Photo Gallery. Employees enter one shared workplace password to view and download. Only the two assigned administrators (with a third slot reserved) can publish, edit, or upload content using their separate email/password accounts.

## Hosting and access

GitHub Pages serves the public application shell. Supabase Auth checks the shared password; database row-level security and a private Storage bucket keep the team directory, updates, photos, and documents inaccessible to unauthenticated visitors. The GitHub repository contains code and public logo assets, not the protected portal records or uploaded files. The `noindex` tag is supplemental and is not an access control.

The shared viewer password is attached to one purpose-specific Supabase Auth account, `workplace-access@idea-l-pack.com`. It is never stored in the GitHub repository or JavaScript. The owner creates that account in Supabase Authentication → Users with **Auto confirm user** enabled and privately sets a password of at least 15 characters. Do not send the password in chat. Share it securely with staff and rotate it if it spreads beyond the intended audience. Because it is shared, the portal cannot distinguish individual employee viewers; a person who knows it can access the same content as other viewers. Administrator accounts must use different private passwords.

Public signup and anonymous sign-in should remain disabled in Supabase Auth. The Auth user alone has no viewing right until its ID is registered in `portal_viewer_account`; only the project's owner can do that. The three administrator slots remain in `portal_admin_slots`. The viewer account cannot post or upload; assigned administrators can still view everything after signing in directly from the password screen.

## Installation and database

For a new project, run `supabase/schema.sql` in the Supabase SQL editor. Add the viewer account ID to `portal_viewer_account` and the approved admin IDs to their slots. The portal owner can find user IDs in Authentication → Users. Keep slot 3 empty until the additional HR administrator is identified. Existing projects should apply the access-and-departments update through the project migration history before switching the live site.

```sql
insert into public.portal_viewer_account(id,user_id)
select 1,id from auth.users where email='workplace-access@idea-l-pack.com';
```

The source content, portraits, photos, and original PDFs are in `private/` and are not deployed to GitHub Pages. Use the import script described in `scripts/import-content.mjs` with a locally supplied Supabase secret key to seed a new project. Never put that secret in source control or the browser. The browser's `public/config.json` contains only the project URL and Supabase publishable key; row-level policies enforce access.

## Local checks

Node.js 22+ and pnpm are required.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm test
pnpm preview
```

The loopback-only preview at `http://127.0.0.1:4173` uses the local source pack and a clearly labelled administrator demonstration. It bypasses the hosted access gate solely to allow local visual review. Production always uses Supabase Auth and private Storage. Local preview edits are kept in `runtime/supabase-preview-content.json` and are not deployed.

Tests exercise the SQL policies using PGlite. They verify that anonymous and unassigned accounts cannot read portal records or storage objects, that the shared viewer can read but not write, and that only the three assigned admin accounts can publish and upload. They also check the local preview API and content validation. After a live release, verify unauthenticated REST and Storage access are denied and that a real viewer can download files.

## Publishing

The manual GitHub Actions workflow tests, builds, and deploys only `public/` to GitHub Pages, preserving the existing URL. Coordinate the release with the Supabase migration: the viewer account must exist before access is locked, and the database policies and Storage bucket must be private before declaring the password protection active. Old public media URLs stop working after the bucket is made private. The browser uses authenticated downloads instead.

The Montserrat font is pinned by checksum in `build.mjs`. The Seasons was not supplied, so headings use a serif fallback. The header uses the supplied sage sample; the rest of the palette follows the Idea L Pack colour reference.
