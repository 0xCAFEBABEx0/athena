# Current production account: Vercel team "workstations" (Hobby).
# Non-secret IDs only. Secrets go in a git-ignored *.auto.tfvars file.
team_id = "team_hAe70TWxiUPTNdjoabkgFUCP"

# Adopt what already exists (read from the Vercel API on 2026-11-11, env vars
# and protection checked again on 2026-11-16).
existing = {
  project_ids = {
    web = "prj_DzFhHGzMtljT1MR2w32MOMKInYto"
    cms = "prj_ykniULa4SGkXmVsyyzEM5KbnlHqn"
  }
  domains = true
  env_ids = {
    "web:CMS_URL:production"    = "znCF067cEhuHwjrA"
    "web:CMS_URL:preview"       = "uul1CC692Mi71Tdr"
    "web:WEB_URL:production"    = "1dbsvpDl3Ruhu0GS"
    "web:WEB_URL:preview"       = "LMH6KPxQ9aZeN1oQ"
    "web:PREVIEW_SECRET"        = "dteUOF2mb80AWQc7"
    "web:REVALIDATE_SECRET"     = "UVMJoQXTVM1mx9jV"
    "web:PAYLOAD_API_KEY"       = "BMscDam78VbaFGB6"
    "web:CMS_PROTECTION_BYPASS" = "Njz9o7DDwiIUmFE3"

    "cms:WEB_URL:production"    = "7aJ5Mk2zKrRwWEAj"
    "cms:CMS_URL:production"    = "u5p5sFzx28eHp4B8"
    "cms:WEB_URL:preview"       = "ZQmETz2sBfmNy4E7"
    "cms:CMS_URL:preview"       = "2NDFfLgqfNC9wKTB"
    "cms:REVALIDATE_SECRET"     = "ts4DKKU9qAXs4dNx"
    "cms:PREVIEW_SECRET"        = "MYAKSxtb33yaRcfi"
    "cms:PAYLOAD_SECRET"        = "sY0mMM0LAxLOt1ZA"
    "cms:CRON_SECRET"           = "nkjKQ7TSqlsEoAhF"
    "cms:WEB_PROTECTION_BYPASS" = "O2DZ3pXSlkZz8uiz"
    "cms:GITHUB_TOKEN"          = "d1F6g3ORth4K34gn"
    "cms:VOYAGE_API_KEY"        = "J2yyCDwNRdfBK45C"
  }
}

# Cloudflare AI Gateway in front of Claude (docs/AI_SEARCH.md). Uncomment
# after the Cloudflare account ID is known (dashboard home, right column).
ai_gateway = {
  account_id      = "6b3d305816ba5b9c7629ce019a22cfde"
  gateway_id      = "athena"
  spend_limit_usd = 5
  vercel_targets  = ["production", "preview"] # production since the 1.6.0 release (2026-11-16)
}

# Version 2 re-sends every secret: on 2026-11-16 the first apply sent the
# unresolved op:// reference text instead of the values (see README,
# Credentials). Bump a key again to rotate it later.
secret_versions = {
  revalidate_secret     = 2
  preview_secret        = 2
  payload_api_key       = 2
  payload_secret        = 2
  cron_secret           = 2
  web_protection_bypass = 2
  cms_protection_bypass = 2
  github_token          = 2
  voyage_api_key        = 2
  cf_aig_token          = 2
}
