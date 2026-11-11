locals {
  # Settings that also live in apps/*/vercel.json (bunVersion, regions,
  # schedules, functions, git.deploymentEnabled, buildCommand, ignoreCommand)
  # are owned by vercel.json and deliberately not repeated here.
  projects = {
    web = {
      name           = "athena-web"
      framework      = "astro"
      root_directory = "apps/web"
      build_command  = "bun run build"
      # Standard Protection: Vercel Authentication on every deployment URL
      # except the production custom domains (API: all_except_custom_domains).
      vercel_authentication = "standard_protection_new"
    }
    cms = {
      name           = "athena-cms"
      framework      = "nextjs"
      root_directory = "apps/cms"
      build_command  = "bun run build"
      # Never protect athena-cms Production (AGENTS.md pitfall 14).
      vercel_authentication = "none"
    }
  }

  install_command = "bun install --frozen-lockfile"
  node_version    = "24.x"

  # Production domains are assigned on every production deployment; a
  # git_branch domain follows that branch's latest deployment.
  domains = {
    "web:whoa.me"             = { project = "web", domain = "whoa.me" }
    "web:www.whoa.me"         = { project = "web", domain = "www.whoa.me", redirect = "whoa.me", redirect_status_code = 308 }
    "web:preview.whoa.me"     = { project = "web", domain = "preview.whoa.me", git_branch = "preview" }
    "cms:cms.whoa.me"         = { project = "cms", domain = "cms.whoa.me" }
    "cms:preview.cms.whoa.me" = { project = "cms", domain = "preview.cms.whoa.me", git_branch = "preview" }
    # findb.uk is the old domain. It stays attached without a redirect to
    # whoa.me because it may be reused later; remove these entries first then.
    "web:findb.uk"             = { project = "web", domain = "findb.uk", redirect = "www.findb.uk", redirect_status_code = 308 }
    "web:www.findb.uk"         = { project = "web", domain = "www.findb.uk" }
    "web:preview.findb.uk"     = { project = "web", domain = "preview.findb.uk", git_branch = "preview" }
    "cms:cms.findb.uk"         = { project = "cms", domain = "cms.findb.uk" }
    "cms:preview.cms.findb.uk" = { project = "cms", domain = "preview.cms.findb.uk", git_branch = "preview" }
  }

  urls = {
    web_production = "https://whoa.me"
    web_preview    = "https://preview.whoa.me"
    cms_production = "https://cms.whoa.me"
    cms_preview    = "https://preview.cms.whoa.me"
  }

  # Environment variables managed here. A `secret` entry takes its value from
  # var.secrets[secret] (write-only); the others carry their value inline.
  # `sensitive` mirrors the current Vercel type (changing it replaces the
  # variable). Not managed here, because an integration writes them: the Neon
  # vars (POSTGRES_*, PG*, DATABASE_URL*, NEON_PROJECT_ID, STACK_*,
  # NEXT_PUBLIC_STACK_*), BLOB_READ_WRITE_TOKEN, SENTRY_*, NEXT_PUBLIC_SENTRY_DSN
  # and CHECKLY_*.
  env = {
    # --- athena-web --------------------------------------------------------
    "web:CMS_URL:production" = { project = "web", key = "CMS_URL", target = ["production"], sensitive = true, value = local.urls.cms_production }
    "web:CMS_URL:preview"    = { project = "web", key = "CMS_URL", target = ["preview"], sensitive = false, value = local.urls.cms_preview, comment = "Preview CMS (athena-cms preview branch)" }
    "web:WEB_URL:production" = { project = "web", key = "WEB_URL", target = ["production"], sensitive = true, value = local.urls.web_production }
    "web:WEB_URL:preview"    = { project = "web", key = "WEB_URL", target = ["preview"], sensitive = false, value = local.urls.web_preview, comment = "Preview web origin (canonical, og:url)" }
    "web:PREVIEW_SECRET"     = { project = "web", key = "PREVIEW_SECRET", target = ["production", "preview"], sensitive = true, secret = "preview_secret" }
    "web:REVALIDATE_SECRET"  = { project = "web", key = "REVALIDATE_SECRET", target = ["production", "preview"], sensitive = true, secret = "revalidate_secret" }
    "web:PAYLOAD_API_KEY"    = { project = "web", key = "PAYLOAD_API_KEY", target = ["production"], sensitive = true, secret = "payload_api_key" }

    # --- athena-cms --------------------------------------------------------
    "cms:WEB_URL:production"      = { project = "cms", key = "WEB_URL", target = ["production"], sensitive = false, value = local.urls.web_production, comment = "Astro web origin (invalidation webhook, preview, CORS, redirects)" }
    "cms:CMS_URL:production"      = { project = "cms", key = "CMS_URL", target = ["production"], sensitive = false, value = local.urls.cms_production, comment = "This CMS origin" }
    "cms:WEB_URL:preview"         = { project = "cms", key = "WEB_URL", target = ["preview"], sensitive = false, value = local.urls.web_preview, comment = "Astro web preview origin" }
    "cms:CMS_URL:preview"         = { project = "cms", key = "CMS_URL", target = ["preview"], sensitive = false, value = local.urls.cms_preview, comment = "This CMS preview origin" }
    "cms:REVALIDATE_SECRET"       = { project = "cms", key = "REVALIDATE_SECRET", target = ["production", "preview"], sensitive = true, secret = "revalidate_secret" }
    "cms:PREVIEW_SECRET"          = { project = "cms", key = "PREVIEW_SECRET", target = ["production", "preview", "development"], sensitive = false, secret = "preview_secret" }
    "cms:PAYLOAD_SECRET"          = { project = "cms", key = "PAYLOAD_SECRET", target = ["production", "preview", "development"], sensitive = false, secret = "payload_secret" }
    "cms:CRON_SECRET"             = { project = "cms", key = "CRON_SECRET", target = ["production", "preview", "development"], sensitive = false, secret = "cron_secret" }
    "cms:WEB_PROTECTION_BYPASS"   = { project = "cms", key = "WEB_PROTECTION_BYPASS", target = ["preview"], sensitive = true, secret = "web_protection_bypass" }
    "cms:GITHUB_TOKEN:production" = { project = "cms", key = "GITHUB_TOKEN", target = ["production"], sensitive = true, secret = "github_token_production" }
    "cms:GITHUB_TOKEN:preview"    = { project = "cms", key = "GITHUB_TOKEN", target = ["preview"], sensitive = true, secret = "github_token_preview" }
  }

  # Every key var.secrets must provide.
  secret_keys = toset(compact([for e in values(local.env) : try(e.secret, null)]))
}
