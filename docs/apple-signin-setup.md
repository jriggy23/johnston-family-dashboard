# Apple Sign In — manual portal setup

These are the **manual steps you perform** in the Apple Developer portal to enable
"Sign in with Apple" for the dashboard. Everything else (client-secret JWT,
deploying the domain-association file, setting Azure app settings, verifying the
live login) is automated — see [What to hand back](#what-to-hand-back).

**Portal:** <https://developer.apple.com/account> → **Certificates, Identifiers & Profiles**

## Project values (copy/paste these exactly)

| Field | Value |
| --- | --- |
| App ID (Bundle ID) | `com.jkcons.familydash` |
| Services ID (= `APPLE_CLIENT_ID`) | `com.jkcons.familydash.web` |
| Domain / Subdomain | `familydash.jkcons.com` |
| Return URL | `https://familydash.jkcons.com/.auth/login/apple/callback` |

---

## Step 1 — Create an App ID
The "primary" identifier the web Services ID groups under.

1. **Identifiers** → blue **＋** → **App IDs** → **Continue** → type **App** → **Continue**.
2. **Description:** `Johnston Family Dashboard`
3. **Bundle ID:** Explicit → `com.jkcons.familydash`
4. In **Capabilities**, check **☑ Sign in with Apple** (leave as "Enable as a primary App ID").
5. **Continue** → **Register**.

## Step 2 — Create the Services ID
This identifier becomes `APPLE_CLIENT_ID`.

1. **Identifiers** → **＋** → **Services IDs** → **Continue**.
2. **Description:** `Family Dashboard Web`
3. **Identifier:** `com.jkcons.familydash.web` (must differ from the App ID)
4. **Continue** → **Register**.

## Step 3 — Configure the Services ID (web auth + domain)

1. Click the **`com.jkcons.familydash.web`** Services ID.
2. Check **☑ Sign in with Apple** → **Configure**.
3. **Primary App ID:** `com.jkcons.familydash`
4. **Domains and Subdomains:** `familydash.jkcons.com`
5. **Return URLs:** `https://familydash.jkcons.com/.auth/login/apple/callback`
6. Click **Download** to get **`apple-developer-domain-association.txt`**.
   - ⚠️ **Do NOT click _Verify_ yet.** Send me the file contents first; I deploy it to
     `https://familydash.jkcons.com/.well-known/apple-developer-domain-association.txt`
     (path is already live), **then** you click **Verify** → **Continue** → **Save**.

## Step 4 — Create the Sign in with Apple key (`.p8`)

1. **Keys** → **＋**.
2. **Key Name:** `Family Dashboard SIWA Key`
3. Check **☑ Sign in with Apple** → **Configure** → **Primary App ID** = `com.jkcons.familydash` → **Save**.
4. **Continue** → **Register**.
5. **Download** the **`.p8`** — ⚠️ **one-time download**, cannot be retrieved again.
   Note the **Key ID** (10 chars) on the key's page. Treat the `.p8` like a password.

## Step 5 — Note the Team ID
Top-right of the portal (or **Membership details**) — a 10-character **Team ID**.

---

## What to hand back

| Artifact | Example | Becomes |
| --- | --- | --- |
| Services ID | `com.jkcons.familydash.web` | `APPLE_CLIENT_ID` |
| Team ID | `ABCDE12345` | JWT `iss` claim |
| Key ID | `XYZ9876543` | JWT header `kid` |
| `.p8` file | file contents | signs the client-secret JWT |
| Domain-association file | contents (Step 3) | deployed → enables **Verify** |

## What happens after (automated)

1. Deploy the domain-association file to `public/.well-known/` → you click **Verify** in Apple.
2. Generate the **`APPLE_CLIENT_SECRET`** (ES256 JWT, `aud: https://appleid.apple.com`,
   `sub`/`iss`/`kid` from above; Apple caps lifetime at **6 months** → must be regenerated).
3. Set Azure app settings:
   ```bash
   az staticwebapp appsettings set -n johnston-family-dashboard -g johnston-family-dashboard \
     --setting-names APPLE_CLIENT_ID=<services-id> APPLE_CLIENT_SECRET=<jwt> TMDB_API_KEY=<optional>
   ```
4. Sign in with Apple goes live at <https://familydash.jkcons.com>.

> Reminder: the JWT expires within 6 months — set a calendar reminder to regenerate
> `APPLE_CLIENT_SECRET` (or automate it on a schedule).
