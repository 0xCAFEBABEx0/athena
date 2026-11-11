# Vercel infrastructure (Terraform)

The two Vercel projects, their domains and the environment variables the apps
own, as code. Uses the official [`vercel/vercel`](https://registry.terraform.io/providers/vercel/vercel/latest/docs)
provider. Credentials and secret values never go to git.

| File | Holds |
| --- | --- |
| `locals.tf` | Project settings, domains and env var definitions (the part you edit) |
| `projects.tf`, `domains.tf`, `env.tf` | Resources built from `locals.tf` |
| `imports.tf` | Adopts resources that already exist in an account |
| `accounts/workstations.tfvars` | Current account: team ID and the IDs to adopt (no secrets) |
| `accounts/new-account.tfvars.example` | Template for a fresh account |
| `secrets.auto.tfvars.example` | The secret keys to supply (copy to the git-ignored `secrets.auto.tfvars`) |

## What is managed and what is not

Managed: `athena-web` and `athena-cms` (framework, root directory, install and
build commands, Node version, Git repository and production branch, Vercel
Authentication), the 10 project domains, and the env vars listed in
`local.env`.

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

## Credentials

- **Vercel API token**: create one at <https://vercel.com/account/settings/tokens>
  scoped to the team, and export it in your shell only:
  `export VERCEL_API_TOKEN=...`. Never put it in a `.tf` or `.tfvars` file.
- **Secret values**: copy `secrets.auto.tfvars.example` to
  `secrets.auto.tfvars` (git-ignored) and fill it in, or export
  `TF_VAR_secrets='{"revalidate_secret":"...", ...}'`. A password manager works
  too, e.g. `op inject -i secrets.auto.tfvars.tpl -o secrets.auto.tfvars`.
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
export VERCEL_API_TOKEN=...            # team-scoped token
cp secrets.auto.tfvars.example secrets.auto.tfvars   # fill in current values
terraform init
terraform plan -var-file=accounts/workstations.tfvars
```

The goal of the first run is a plan that only imports. Expect a few in-place
updates and review each one before applying:

- `build_command` / `install_command` / `root_directory`: Terraform sends the
  values in `locals.tf`. If the plan shows a dashboard value that should stay,
  copy it into `locals.tf` instead.
- `value` on the two production URL vars of athena-web: they are Sensitive in
  Vercel, so their value imports as null and is re-sent once (same value).
- `value_wo_version` on the secrets: the first apply re-sends each secret from
  `secrets.auto.tfvars`. Supply the **current** values; a new value here is a
  rotation and needs both apps redeployed.

Then `terraform apply -var-file=accounts/workstations.tfvars`. Env var changes
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
