# Vercel infrastructure (Terraform)

The two Vercel projects, their domains and the environment variables the apps
own, as code, plus the Cloudflare AI Gateway in front of Claude. Uses the
official [`vercel/vercel`](https://registry.terraform.io/providers/vercel/vercel/latest/docs)
and [`cloudflare/cloudflare`](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs)
providers. Credentials and secret values never go to git.

| File | Holds |
| --- | --- |
| `locals.tf` | Project settings, domains and env var definitions (the part you edit) |
| `projects.tf`, `domains.tf`, `env.tf`, `retention.tf` | Resources built from `locals.tf` |
| `ai_gateway.tf` | Cloudflare AI Gateway and its spend limit (only when `ai_gateway` is set) |
| `imports.tf` | Adopts resources that already exist in an account |
| `accounts/workstations.tfvars` | Current account: team ID and the IDs to adopt (no secrets) |
| `accounts/new-account.tfvars.example` | Template for a fresh account |
| `tf` | Runs `terraform` under `op run` with every credential read from 1Password |
| `op.env` | 1Password references (not secrets) for the API tokens and the secret env var values |
| `secrets.auto.tfvars.example` | The same secret keys, for running without 1Password (copy to the git-ignored `secrets.auto.tfvars`) |

## What is managed and what is not

Managed: `athena-web` and `athena-cms` (framework, root directory, install and
build commands, Node version, Git repository and production branch, Vercel
Authentication, Deployment Retention Policy), the 10 project domains, the env vars listed in `local.env`,
and, when `ai_gateway` is set, the Cloudflare AI Gateway with its spend limit.

Not managed here:

- **Settings in `apps/*/vercel.json`** (`bunVersion`, `regions`, `schedules`,
  `functions`, `git.deploymentEnabled`, `buildCommand`, `ignoreCommand`). They
  ship with the code and win over project settings; do not repeat them in
  Terraform. The function region (moving to `sin1`) is one of them.
- **Env vars written by integrations**: Neon (`POSTGRES_*`, `PG*`,
  `DATABASE_URL*`, `NEON_PROJECT_ID`, `STACK_*`, `NEXT_PUBLIC_STACK_*`), Vercel
  Blob (`BLOB_READ_WRITE_TOKEN`), Sentry (`SENTRY_*`, `NEXT_PUBLIC_SENTRY_DSN`)
  and Checkly (`CHECKLY_*`). Terraform leaves variables it does not manage
  alone.
- Marketplace integrations (Neon, Sentry, Checkly), the Blob store, the
  Protection Bypass secret itself, and DNS at Cloudflare.
- `ANTHROPIC_API_KEY` on athena-web: it goes away once the AI Gateway pair is
  set (see below), so it is left alone until then.

## Credentials

**With 1Password (the usual way)**: keep the tokens and secret values in
1Password and run `./tf` instead of `terraform` (same arguments). It runs
`op run --env-file=op.env -- terraform ...`
([Load secrets into the environment](https://www.1password.dev/cli/secrets-environment-variables)):
1Password CLI resolves the references in `op.env` and gives the values to
one child process as environment variables, masks any secret it prints, and
writes nothing to disk. `op.env` sets `VERCEL_API_TOKEN`,
`CLOUDFLARE_API_TOKEN` and one `TF_SECRET_<key>` per key of `var.secrets`,
each a whole-value `op://` reference. The child builds `TF_VAR_secrets` from
the `TF_SECRET_*` variables with jq (so any character in a value is escaped),
stops if any value is still an `op://` reference, and execs terraform. A
plan also stops on an empty or unresolved secret (precondition in `env.tf`).

Do not put `{{ op://... }}` templates inside an env file value: on
2026-11-16 op run 2.42.0 passed such a JSON value through unresolved, and the
first apply sent the reference text to Vercel as every secret.

The references assume the vault `Development` with the items `vercel-terraform` and
`cloudflare-terraform` (field `credential`), `athena-github-repo-read` (field
`credential`, the GitHub token) and `athena-terraform` (one field per other key
of `var.secrets`); edit `op.env` to match yours. Every referenced
field must exist (an empty `cf_aig_token` is fine until the gateway has a
token). Needs the 1Password CLI signed in: the desktop app integration, or a
[service account](https://www.1password.dev/service-accounts/) limited to that
vault (`OP_SERVICE_ACCOUNT_TOKEN`), as 1Password recommends. As with any
environment variable, other processes of the same user can read them while
terraform runs.

Without 1Password:

- **Vercel API token**: create one at <https://vercel.com/account/settings/tokens>
  scoped to the team, and export it in your shell only:
  `export VERCEL_API_TOKEN=...`. Never put it in a `.tf` or `.tfvars` file.
- **Cloudflare API token** (only with `ai_gateway`): a custom token with
  **Account > AI Gateway > Edit**, exported the same way:
  `export CLOUDFLARE_API_TOKEN=...`. Without `ai_gateway` nothing is sent to
  Cloudflare.
- **Secret values**: copy `secrets.auto.tfvars.example` to
  `secrets.auto.tfvars` (git-ignored) and fill it in, or export
  `TF_VAR_secrets='{"revalidate_secret":"...", ...}'`. This file holds the
  values in plain text on disk, which is why `./tf` is the usual way.
- Secrets are **write-only** (`value_wo`, Terraform >= 1.11): they are sent to
  Vercel only when a variable is created or its version in `secret_versions`
  changes, and never land in the state or a saved plan. Imported secrets use the
  `write-only:` import prefix for the same reason.
- **State** is local (`terraform.tfstate`, git-ignored). It holds no secret
  values, but keep it out of git anyway. For remote state, add a git-ignored
  `backend_override.tf`, for example HCP Terraform:

  ```hcl
  terraform {
    cloud {
      organization = "<your-org>"
      workspaces { name = "athena-workstations" }
    }
  }
  ```

  then `terraform init -migrate-state`.

## First run: adopt the current account

```bash
cd infra/terraform
./tf init
./tf plan -var-file=accounts/workstations.tfvars
```

(Without 1Password: export `VERCEL_API_TOKEN`, fill `secrets.auto.tfvars`,
and run `terraform` itself.)

The goal of the first run is a plan that only imports. Expect a few in-place
updates and review each one before applying:

- `build_command` on athena-cms: the dashboard still says `pnpm run ci`, which
  `vercel.json` (`bun run build`) already overrides. Terraform clears it, since
  build and install commands belong to `vercel.json` or Vercel's detection.
  Dashboard settings Terraform does not own (Fluid compute, default function
  region, Toolbar, build machine) are in `ignore_changes` and never sent.
- `value` on the two production URL vars of athena-web: they are Sensitive in
  Vercel, so their value imports as null and is re-sent once (same value).
- `value_wo_version` on the secrets: the first apply re-sends each secret from
  1Password (or `secrets.auto.tfvars`). Supply the **current** values; a new value here is a
  rotation and needs both apps redeployed.

Then `./tf apply -var-file=accounts/workstations.tfvars`. Env var changes
reach a deployment only after a redeploy.

## Everyday changes

- Add or change a plain env var: edit `local.env`, plan, apply, redeploy.
- Rotate a secret: put the new value in `secrets.auto.tfvars`, bump its key in
  `secret_versions` (e.g. `secret_versions = { revalidate_secret = 2 }` in the
  account tfvars), apply, then redeploy **both** apps for shared secrets.
  `revalidate_secret` and `preview_secret` feed both projects from one value, so
  they cannot drift apart.
- Changes made in the dashboard to managed settings are reverted by the next
  apply; make them here instead.

## Cloudflare AI Gateway

Claude calls (Ask AI on athena-web, the Translate button on athena-cms) can go
through Cloudflare AI Gateway with the Anthropic key stored at Cloudflare
(BYOK), so a spend limit caps what they cost. Why and what it costs:
`docs/AI_SEARCH.md`, "Cloudflare AI Gateway". The apps need 1.6.0 or later.

Terraform manages the gateway (authentication on, logs, no gateway cache or
rate limit), one spend limit rule for provider `anthropic`, and
`ANTHROPIC_BASE_URL` + `CF_AIG_TOKEN` on both Vercel projects. Two things are
done once in the dashboard instead, so no secret lands in the state: the
Anthropic key under the gateway's **Provider Keys** (the provider cannot attach
a stored key yet, cloudflare/terraform-provider-cloudflare#7332) and the
gateway token.

1. Uncomment `ai_gateway` in `accounts/workstations.tfvars` and set
   `account_id` (Cloudflare dashboard home). Keep `vercel_targets = ["preview"]`
   for the first round.
2. Put a Cloudflare API token with **Account > AI Gateway > Edit** in
   1Password (`op.env`), then
   `./tf apply -target=cloudflare_ai_gateway.this -var-file=accounts/workstations.tfvars`
   (creates only the gateway; the env vars need the token from step 3).
3. Dashboard, **AI > AI Gateway > athena**: under **Provider Keys** add the
   Anthropic key; under **Settings > Authentication** create a token and put
   it in 1Password as `cf_aig_token`.
4. Check **Settings > Spend limits**: the rule should read the budget and a
   30-day window. The API does not document the unit of `window`; this
   configuration assumes seconds. If the dashboard shows something else, fix
   `spend_limit_window` and apply again.
5. `./tf apply -var-file=accounts/workstations.tfvars`, then redeploy
   athena-web and athena-cms on Preview, ask a question on `/search` and see
   it in the gateway's analytics.
6. Set `vercel_targets = ["production", "preview"]`, apply, delete
   `ANTHROPIC_API_KEY` from both projects in the dashboard (it is not managed
   here and is unused once the gateway pair is set), and redeploy Production.

Change the budget with `spend_limit_usd` and apply; no redeploy is needed.
To go back to calling Anthropic directly, set `ANTHROPIC_API_KEY` again,
remove `ai_gateway` (the env vars are deleted; the gateway too, as
`authentication` cannot be turned off once on) and redeploy.

## Moving to another account

1. In the new account, install the Vercel GitHub App on the repository and
   create a team-scoped token.
2. Copy `accounts/new-account.tfvars.example` to `accounts/<name>.tfvars`, set
   `team_id`, keep `existing = {}`, and use a separate state (a new workspace).
3. Remove the domains from `local.domains` for the first apply (a domain can be
   attached to one account only), then apply: projects and env vars are
   created.
4. Reconnect integrations by hand (Neon, Blob, Sentry, Checkly) and copy the
   data: Neon with `pg_dump`/`pg_restore` (a Vercel-managed Neon project cannot
   be transferred), Blob files with a copy script.
5. Check the new `*.vercel.app` URLs, remove the domains from the old projects,
   restore `local.domains` and apply; `terraform output domain_verification`
   lists any TXT records Cloudflare needs.

A move to a Pro team you belong to can use Vercel's own project transfer
instead, which also moves deployments, env vars and domains; this
configuration can then adopt the transferred projects with a new
`accounts/<name>.tfvars`.
