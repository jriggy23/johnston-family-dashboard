# Johnston Family Dashboard

A family dashboard featuring calendars, news, weather, a live family map, and entertainment recommendations (streaming + upcoming theater releases). Built with Apple authentication.

## Features

- **Family Calendars** — shared calendar views for the whole family
- **News** — curated news feed
- **Local Weather** — current conditions and forecast for each family member's location
- **Streaming** — streaming content recommendations across the family's services
- **Upcoming Theatrical Releases** — movies coming soon to theaters, with release dates
- **Family Map** — live map of where each family member currently is

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend API:** Azure Functions v4 (TypeScript), linked to the Static Web App
- **Auth:** Apple Sign In (managed custom OIDC provider on SWA Standard)
- **CI/CD:** GitHub Actions → Azure Static Web Apps
- **Testing:** Vitest + Testing Library; ESLint for linting

### Project layout

```
/                      React + Vite frontend
  src/                 app + components (mock data for now)
  staticwebapp.config.json   routes + Apple auth config
api/                   Azure Functions (weather, news, streaming, theatrical)
.github/workflows/     CI/CD pipeline
```

## Hosting & Infrastructure

Hosted in a personal Azure subscription, optimizing for low cost. The hosting
tier is **Azure Static Web Apps Standard ($9/mo, ~$108/yr)** — a deliberate
exception to the free-tier preference (see decision below); everything else
stays on free / consumption tiers.

**Requirements:**

- Host in the owner's personal Azure subscription.
- Prefer free tiers; otherwise the least expensive option that meets the need.
- Avoid always-on / fixed-cost resources (e.g. dedicated App Service plans, VMs)
  in favor of serverless / consumption-based billing.

**Component mapping:**

| Need | Azure service | Cost notes |
| --- | --- | --- |
| Web frontend + static hosting | Azure Static Web Apps (**Standard**) | $9/mo; enables managed Apple Sign In (custom OIDC) + bring-your-own Functions. Free SSL, custom domain, 100 GB bandwidth/mo |
| Backend APIs (weather, news, watch) | Azure Functions (Consumption) | First 1M executions/mo free; linked to the Static Web App |
| Data store (members, prefs, cached feeds) | **Azure Table Storage** | Pennies/mo; simple key-value fits the tiny data set. (Cosmos DB free tier considered — richer queries, but more than needed and uses the subscription's one free-Cosmos slot.) Family locations live in CloudKit, not here (see Family Map) |
| Secrets / API keys | Static Web App / Function app settings | Free; upgrade to Key Vault only if needed (~small monthly cost) |
| Scheduled refresh (news/weather cache) | Function timer trigger | Timer triggers enabled via bring-your-own Functions (Standard plan); counts toward free Functions executions |

**Why Standard instead of Free:** the Free tier supports only preconfigured
auth providers (GitHub, Microsoft Entra) and HTTP-only managed Functions.
Standard unlocks two things this app needs — **custom OIDC providers** (so Apple
Sign In is fully managed by SWA) and **bring-your-own Functions** (so the
scheduled cache-refresh timer trigger can run in-app). Both were achievable for
free with extra plumbing (hand-rolled Apple OAuth in a Function + a separate
standalone Functions app for the timer), but the Standard plan was chosen to
consolidate everything into one resource with managed auth and an SLA.

**Authentication — Apple Sign In (decided):**

On the Standard plan, "Sign in with Apple" is configured as a **managed custom
OIDC provider** in Static Web Apps — SWA handles the full login flow:

- Apple registered as a custom OpenID Connect provider in
  `staticwebapp.config.json` (client ID + client secret from app settings).
- SWA manages the redirect, token validation, and session; the signed-in user
  is exposed at `/.auth/me` and login/logout via `/.auth/login/apple` and
  `/.auth/logout`. No hand-rolled OAuth code.
- Setup in the Apple Developer portal: a **Services ID** + a **Sign in with
  Apple key** (used to generate the client-secret JWT). Owner already has an
  Apple Developer account.

Note: registering a custom provider disables SWA's preconfigured providers —
fine here, since Apple is the only intended sign-in.

## External Data Sources

Prefer **free API sources** wherever possible. Paid integrations will be
evaluated only if/when a free option can't meet a need.

| Feature | Candidate free source | Notes |
| --- | --- | --- |
| Local Weather | **Open-Meteo** | No API key, free for non-commercial, global coverage, one-call API. (NWS considered but US-only with a two-step gridpoint lookup.) |
| News | Fox News free RSS feeds (multiple topics) | RSS is fully free with no key; aggregate Fox's per-topic feeds into one view |
| Streaming | TMDB API | Free for non-commercial use; movie/TV metadata + watch-provider availability |
| Upcoming Theatrical Releases | TMDB API (upcoming endpoint) | Free for non-commercial use; theatrical release dates |

- These sources may have rate limits or non-commercial-only terms — fine for
  personal/family use.
- Any source that ends up requiring payment will be flagged and decided on at
  that point.

**News feeds (Fox News, free RSS):**

The News feature pulls from Fox News' free RSS feeds (no API key). Fox publishes
multiple per-topic feeds that can be merged into a single view:

- Latest — `https://moxie.foxnews.com/google-publisher/latest.xml`
- World — `https://moxie.foxnews.com/google-publisher/world.xml`
- Politics — `https://moxie.foxnews.com/google-publisher/politics.xml`
- Sports — `https://moxie.foxnews.com/google-publisher/sports.xml`
- Tech, Science, Health, etc. — additional topic feeds available

Which topics to include is configurable per family preference.

## Family Map (location tracking)

The whole family is on iPhone, so the Family Map uses a **custom Apple-native
approach** rather than a third-party tracker:

- **Core Location** — each family member's iPhone reports its own location
  (with permission).
- **CloudKit (shared database)** — each phone writes its location into a shared
  CloudKit DB; the dashboard reads from it. Keeps location data inside Apple's
  ecosystem and fits the Apple Sign In theme.
- **MapKit / MapKit JS** — renders the map (free).

**Cost note:** requires a custom iOS app, which needs the **Apple Developer
Program ($99/year)** — but the owner **already has an Apple Developer account**,
so this adds **no new cost** to the project. The free-tier goal holds across the
board. (Note: free provisioning expires every 7 days, so the paid program is
required for an always-on tracker — already covered here.)

**Considered and rejected:**

- **Life360 API** — no official public API; only an unofficial/reverse-engineered
  one. Against their ToS, fragile, requires storing real Life360 credentials.
- **Apple Find My API** — does not exist for reading family locations; Apple's
  Find My developer program (MFi) is only for hardware accessories.

## Getting Started

Prerequisites: Node 20+ and npm. For running the API locally, the
[Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local).

There are two ways to run the app locally:

**1. Frontend only (fast UI iteration)** — `vite dev` serves neither `/.auth/*`
nor `/api/*`, so authentication falls back to a built-in **dev stub** user and
data sections fall back to **mock data**:

```bash
npm install
npm run dev          # http://localhost:5173
```

**2. Full emulation (auth + live API)** — the
[Static Web Apps CLI](https://learn.microsoft.com/azure/static-web-apps/local-development)
(`npm run swa`) emulates the SWA runtime: a **mock login** (so you can exercise
the Apple Sign In gate without real Apple credentials) and a proxy to the live
Functions API.

```bash
# Build the API once (the Functions host runs the compiled output in api/dist)
npm --prefix api install
npm --prefix api run build      # or `npm --prefix api run watch` in its own terminal

# In another terminal, start the emulator (it launches `npm run dev` for you)
npm run swa                     # http://localhost:4280
```

Visit the emulator URL, sign in via the mock login, and the dashboard loads with
**live weather and news** (no API key needed). Streaming/theatrical show live
TMDB data only if `TMDB_API_KEY` is set in `api/local.settings.json` (copy
`api/local.settings.json.example`), otherwise they fall back to mock data.

Useful scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## CI/CD

GitHub Actions (`.github/workflows/ci-cd.yml`) runs on every push and PR to `main`:

1. **Validate** — install, lint, typecheck, unit tests, and build (frontend + API).
2. **Deploy** — on `main`, deploy to **production**; on a PR, deploy to a
   per-PR **preview environment**. Closing the PR tears the preview down.

See **Production setup** below for the one-time Apple + Azure configuration the
pipeline depends on.

## Production setup (Apple Sign In + Azure)

These steps are done once, outside the codebase, before the deployed site can
authenticate users. The app code is already wired for all of it.

**Provisioned resources** (Visual Studio Enterprise subscription):

| | |
| --- | --- |
| Resource group | `johnston-family-dashboard` (eastus2) |
| Static Web App | `johnston-family-dashboard` — **Standard** SKU |
| Default host | `proud-hill-0886c370f.7.azurestaticapps.net` |
| Custom domain | **`familydash.jkcons.com`** |
| Deploy secret | `AZURE_STATIC_WEB_APPS_API_TOKEN` (set in GitHub Actions) |

### 1. Custom domain (`familydash.jkcons.com`)

DNS for `jkcons.com` is hosted at **GoDaddy**.

1. In GoDaddy DNS, add a **CNAME**: `familydash` →
   `proud-hill-0886c370f.7.azurestaticapps.net`.
2. Register it on the SWA (validates via the CNAME and issues a managed TLS cert):
   ```bash
   az staticwebapp hostname set -n johnston-family-dashboard \
     -g johnston-family-dashboard --hostname familydash.jkcons.com
   ```

### 2. Apple Developer portal

In [developer.apple.com](https://developer.apple.com/account) → **Certificates,
Identifiers & Profiles**:

1. **App ID** — Identifiers → **+** → *App IDs* → *App*. Enable **Sign in with Apple**.
2. **Services ID** — Identifiers → **+** → *Services IDs*. This identifier (e.g.
   `com.jkcons.familydash.web`) is your **`APPLE_CLIENT_ID`**. Enable **Sign in with
   Apple**, then **Configure**:
   - **Primary App ID**: the App ID from step 1.
   - **Domains and Subdomains**: `familydash.jkcons.com`
   - **Return URLs**: `https://familydash.jkcons.com/.auth/login/apple/callback`
   - Apple verifies the domain by downloading
     `https://familydash.jkcons.com/.well-known/apple-developer-domain-association.txt`.
     **Download the association file from Apple and replace the placeholder at
     [`public/.well-known/apple-developer-domain-association.txt`](public/.well-known/apple-developer-domain-association.txt)**,
     then deploy before clicking *Verify*. (Anonymous access to `/.well-known/*`
     is already allowed in [`staticwebapp.config.json`](staticwebapp.config.json).)
3. **Sign in with Apple key** — Keys → **+**. Enable *Sign in with Apple*, download
   the **`.p8`** key (one-time). Note the **Key ID** and your **Team ID**.

### 3. Generate the client secret (`APPLE_CLIENT_SECRET`)

Apple's "client secret" is a short-lived **ES256 JWT** signed with the `.p8` key:
Team ID (issuer), Services ID (subject), audience `https://appleid.apple.com`, Key
ID (header `kid`). Apple caps its lifetime at **6 months**, so it must be
**regenerated and re-set** before it expires.

### 4. App settings + deploy

Set the application settings on the SWA (names match `clientIdSettingName` /
`clientSecretSettingName` in [`staticwebapp.config.json`](staticwebapp.config.json)):

```bash
az staticwebapp appsettings set -n johnston-family-dashboard -g johnston-family-dashboard \
  --setting-names APPLE_CLIENT_ID=<services-id> APPLE_CLIENT_SECRET=<jwt> TMDB_API_KEY=<optional>
```

Then push to `main` (or merge a PR). Once DNS, the association file, and the app
settings are in place, **"Sign in with Apple"** completes at
`https://familydash.jkcons.com` and the signed-in identity is visible at
`/.auth/me`. `TMDB_API_KEY` is optional — streaming/theatrical fall back to mock
data when it's unset.
