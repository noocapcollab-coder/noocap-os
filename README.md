# NOOCAP Production OS — live, Notion-backed dashboard

A small Vercel app that reads your client content databases from Notion live,
logs each person in with a 4-digit code, shows them a role-based dashboard, and
lets Ops/COO assign editors straight back to Notion.

- **No stale snapshots** — it reads Notion on every load (30s cache).
- **Real access control** — editors only ever receive their own videos (filtered
  on the server, not hidden in the browser).
- **Write-back** — the "→ assign" button updates the Notion page.

---

## What you need (10–15 min, one time)

1. A **Notion internal integration** and its secret token.
2. A **Vercel** account (free tier is fine).
3. To **share each client database** with the integration.

---

## Step 1 — Create the Notion integration

1. Go to <https://www.notion.com/my-integrations> → **New integration**.
2. Name it "Production OS", pick your workspace, capabilities: **Read content**
   and **Update content**. Create it.
3. Copy the **Internal Integration Secret** (starts with `ntn_`). Keep it safe.

## Step 2 — Share the databases with it

For **each** client content database (Valeri, Chris, Brad, …):
open the database as a full page → **•••** (top-right) → **Connections** →
add your "Production OS" integration. If you skip this, that client returns empty.

## Step 3 — Deploy to Vercel

1. Put this folder in a Git repo (GitHub/GitLab) **or** run `npx vercel` from
   inside it.
2. In Vercel → **New Project** → import the repo (framework preset: **Other**).
3. Add two Environment Variables (Settings → Environment Variables):
   - `NOTION_TOKEN` = the `ntn_...` secret from Step 1
   - `AUTH_SECRET` = any long random string
     (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
4. **Deploy.** Open the URL, enter a code from `config/users.js` (yours is `4471`).

That's it — you're looking at live Notion data.

---

## Everyday config (edit these files, redeploy)

- **`config/users.js`** — people, roles, and 4-digit codes. Change the codes
  before sharing. For editors, `editorTag` must match the exact editor value in
  Notion (usually UPPERCASE, e.g. `PARVEZ`).
- **`config/clients.js`** — the client → database mapping. **Valeri, Chris and
  Brad are already wired.** To add the other 9 clients, copy the template block
  at the bottom, fill in the `databaseId` and each Notion property name, and
  redeploy. (Brad currently has no Priority/Effort/Waiting-On fields — add those
  three selects to Brad's DB and set the names in his config to switch them on.)
- **`lib/statusmap.js`** — only touch if a client uses different status names.

### Finding a database id
Open the database as a full page in Notion, copy the URL. The id is the 32-char
hex string before `?v=`. Paste it as `databaseId` (dashes optional).

---

## Roles

| Role         | Sees                                   | Can edit?              |
|--------------|----------------------------------------|------------------------|
| COO          | All clients — health overview          | (read; write optional) |
| Ops          | All clients — full cockpit             | Yes (assign/status)    |
| Scriptwriter | All clients — scripting queue          | No                     |
| Editor       | **Only their own videos**              | No (read-only)         |

To let editors move their own cards later, extend `api/update.js`.

---

## How it plugs into your Discord / n8n

The dashboard writes to the same Notion fields your automations already watch,
so its buttons trigger your existing Discord flows — no parallel notifications.

- **Ops taps "→ assign"** → sets the creator board's **Editor** and flips **Status
  to "7- In Edit"** → fires your "you've been assigned" Discord ping to that editor.
  (Both fields are set in one write, in `api/update.js` → `ASSIGN_STATUS`.)
- **Editor taps "Submit for review"** → prompts for the Frame.io link, then creates
  a **Video Intake** row (Title, Creator, Editor, Type, Frame.io) → fires your
  handoff flow. It also moves the source card to "9- Approval Brand/Creator" so it
  leaves the editor's queue. (`api/submit.js`, config in `INTAKE`.)
- **Editor taps "⚑ Blocked"** → sets Waiting-On = Ops so it surfaces on the Ops board.

If you tune the trigger status or the Intake spellings, edit `config/clients.js`
(`ASSIGN_STATUS`, `REVIEW_STATUS`, and `INTAKE.creatorMap` / `editorMap`). Note
the "Valeri" board maps to creator "Valerie" in Intake.

## Notes & limits

- **Untested against your workspace.** The code is complete but was written
  without your token, so do a first deploy and sanity-check each client loads.
  If a client is empty, it's almost always the Step 2 share step.
- **Capacity = days of work.** Short-form = ½ day, long-form = 2 days, healthy
  ceiling 2 days/editor. Tune in `public/index.html` (`EFFPTS`, `CAP`).
- **Write-back covers select/status fields.** Editor assignment assumes a
  *select*-type editor field (Valeri/Chris/Brad use this). A *people*-type field
  needs member IDs — tell me and I'll extend it.
- Passcodes are simple by design (internal tool). For stronger auth, swap
  `config/users.js` for an SSO/Auth provider later.

---

## Local run (optional)

```bash
npm install
npx vercel dev        # then open http://localhost:3000
```
Set `NOTION_TOKEN` and `AUTH_SECRET` in a `.env` file first (see `.env.example`).
