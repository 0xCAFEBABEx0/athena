# The API token is never written here: export VERCEL_API_TOKEN before running
# terraform (see README.md).
provider "vercel" {
  team = var.team_id
}

# Likewise CLOUDFLARE_API_TOKEN (permission: AI Gateway Edit). Only the AI
# Gateway (ai_gateway.tf) uses it.
provider "cloudflare" {}
