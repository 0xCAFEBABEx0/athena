# The API token is never written here: export VERCEL_API_TOKEN before running
# terraform (see README.md).
provider "vercel" {
  team = var.team_id
}
