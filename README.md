# Idea L Pack — employee portal

A five-tab internal portal: Team, Activity & News, Notifications, Documents and Pictures. The interface uses the supplied monochrome logo and palette, locally served Montserrat, expandable team sections, colleague search, country filters and protected downloads.

## Hosting model

- **GitHub Pages** serves only `public/`: the interface, logo and fonts.
- A **separate HTTPS Node.js service** validates Microsoft 365 access tokens and serves employee data and files.
- **Microsoft Entra ID** handles sign-in and assigned employee/admin roles. The three nominated administrators must also appear in the server's object-ID allowlist.
- `private/`, `runtime/` and populated environment files are excluded from Git. Do not upload them to a public repository or GitHub Pages. The private source pack is delivered separately.

GitHub Pages cannot execute this backend. Publishing just the static files shows the sign-in/setup screen until the backend is connected. The existing live site should not be replaced until the complete flow has been checked with real employee and administrator accounts.

## Local preview

Requires Node.js 22+ and pnpm. Put the supplied private source pack in `private/`.

```sh
pnpm install --ignore-scripts
pnpm build
pnpm preview
```

Open `http://127.0.0.1:4173`. Preview mode binds only to loopback, is visibly labelled, and uses a separate preview data file. `node server.mjs --preview --employee` previews the read-only employee experience. Never run preview mode as a hosted production service.

The supplied private pack contains the 57-person June 2026 organisation data and portraits, original organisation/prize PDFs, 16 prize results, and 14 browser-ready prize-presentation photographs. Runtime edits are stored separately; replacing the seed does not overwrite published edits.

## Microsoft 365 setup for IT

Use two single-tenant app registrations in the company's Microsoft Entra tenant.

1. Register a **Portal API**. Set its requested access-token version to **2** (`api.requestedAccessTokenVersion`). Expose a delegated scope `api://<API-CLIENT-ID>/Portal.Access` with administrator consent.
2. Add two enabled app roles to the API, allowed member type **Users/Groups**:
   - `Portal.Employee`: view and download.
   - `Portal.Admin`: publish news/notices and upload/remove documents and pictures.
3. In the API's Enterprise Application, enable **Assignment required**. Assign employees the employee role. Assign only the three nominated accounts the administrator role. A personal Gmail administrator needs an approved B2B guest account in this tenant; the Gmail address alone is not a Microsoft identity.
4. Record the administrator accounts' **object IDs in this tenant**, not application IDs. Add them to `ADMIN_OBJECT_IDS`. Both an assigned admin role and a matching object ID are required for publishing. Email addresses are used only for display.
5. Register a **Portal website** as a single-tenant SPA. Add the exact redirect URI `https://gomayoha.github.io/ilp-internal-portal/`. Add the API's delegated `Portal.Access` permission and grant tenant admin consent. No client secret belongs in the browser.
6. Configure the backend values in `.env.example`: tenant ID, website app ID, API app ID, approved admin object IDs, backend HTTPS origin and frontend URL. Apply the company's existing Conditional Access/MFA policies to these applications.
7. Serve the Node application on an HTTPS host with **persistent disk**, one process/instance. Put the private source pack at `PRIVATE_DIR`, and point `DATA_DIR` at persistent runtime storage. Use `node --env-file=.env server.mjs` or the host's environment-variable settings. Back up both private and runtime storage. The JSON store is designed for a single process; use transactional database/object storage before scaling to multiple instances.
8. Set `public/config.json` to `{"apiBase":"https://YOUR-BACKEND-ORIGIN"}` with no trailing slash. Set `FRONTEND_URL` exactly as the redirect URI above. The API permits that origin and its own origin; protected file requests use bearer tokens rather than public URLs or third-party cookies.
9. Validate a real employee, every administrator, an unassigned account, and signed-out document/photo links before enabling the live site. Real Microsoft tenant integration could not be exercised without the registration values.

Reference: [Microsoft app roles](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-app-roles-in-apps), [Microsoft access-token validation](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## GitHub Pages release

The manual Pages workflow builds Microsoft’s sign-in library from the pinned package dependencies, fetches the official Montserrat font with a pinned SHA-256 check, then deploys **only** `public/`. Generated bundles and fonts are not committed. Set repository variable `PORTAL_API_ORIGIN` to the working HTTPS backend origin and choose **GitHub Actions** as the Pages publishing source. Run the workflow after Microsoft and storage setup is verified. There is no automatic release on pull-request creation or merge.

The root `index.html` redirects to `public/` for local source browsing after a build. Use the supplied Actions workflow for Pages, not direct branch publishing: generated sign-in and font assets must be built first. The workflow publishes `public/` at the existing site root, preserving the registered redirect URI.

## Validation

```sh
pnpm test
```

Tests use synthetic data, temporary storage and locally signed test tokens. They cover signature/audience/issuer/expiry/tenant/scope/role validation, administrator object IDs, anonymous direct-file denial, employee write denial, administrator persistence, concurrent writes, file-type rejection, CSRF in local preview, and cross-origin checks. These tests do not claim a live Microsoft sign-in has been completed.

## Content and design notes

- UI colours: `#000000`, `#FFFFFF`, `#D2C8BF`, `#B2C5A8`, `#D5CBC1`, with tints derived from those colours. Supplied event photographs retain their natural colours.
- The Seasons font file was not supplied; headings use a serif fallback. A licensed webfont can be added without changing the layout. Montserrat is bundled with its OFL licence.
- HEIC photos were converted to JPEG for browser support and exported without camera EXIF/location metadata. The original photos remain untouched.
- Employee edits are never simulated with local storage. Local storage holds only per-account read markers for notices on that device.
- Downloaded files cannot be revoked after a user saves a copy. File access before download is checked server-side.
