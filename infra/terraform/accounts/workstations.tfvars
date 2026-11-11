# Current production account: Vercel team "workstations" (Hobby).
# Non-secret IDs only. Secrets go in a git-ignored *.auto.tfvars file.
team_id = "team_hAe70TWxiUPTNdjoabkgFUCP"

# Adopt what already exists (read from the Vercel API on 2026-11-11).
existing = {
  project_ids = {
    web = "prj_DzFhHGzMtljT1MR2w32MOMKInYto"
    cms = "prj_ykniULa4SGkXmVsyyzEM5KbnlHqn"
  }
  domains = true
  env_ids = {
    "web:CMS_URL:production" = "znCF067cEhuHwjrA"
    "web:CMS_URL:preview"    = "uul1CC692Mi71Tdr"
    "web:WEB_URL:production" = "1dbsvpDl3Ruhu0GS"
    "web:WEB_URL:preview"    = "LMH6KPxQ9aZeN1oQ"
    "web:PREVIEW_SECRET"     = "dteUOF2mb80AWQc7"
    "web:REVALIDATE_SECRET"  = "UVMJoQXTVM1mx9jV"
    "web:PAYLOAD_API_KEY"    = "BMscDam78VbaFGB6"

    "cms:WEB_URL:production"      = "7aJ5Mk2zKrRwWEAj"
    "cms:CMS_URL:production"      = "u5p5sFzx28eHp4B8"
    "cms:WEB_URL:preview"         = "ZQmETz2sBfmNy4E7"
    "cms:CMS_URL:preview"         = "2NDFfLgqfNC9wKTB"
    "cms:REVALIDATE_SECRET"       = "ts4DKKU9qAXs4dNx"
    "cms:PREVIEW_SECRET"          = "MYAKSxtb33yaRcfi"
    "cms:PAYLOAD_SECRET"          = "sY0mMM0LAxLOt1ZA"
    "cms:CRON_SECRET"             = "nkjKQ7TSqlsEoAhF"
    "cms:WEB_PROTECTION_BYPASS"   = "O2DZ3pXSlkZz8uiz"
    "cms:GITHUB_TOKEN:production" = "d1F6g3ORth4K34gn"
    "cms:GITHUB_TOKEN:preview"    = "8r2jPxsf57R1lexi"
  }
}
