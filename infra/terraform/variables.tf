variable "team_id" {
  description = "Vercel team ID that owns both projects (team_...). Set per account in accounts/<name>.tfvars."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository both projects deploy from (owner/name)."
  type        = string
  default     = "0xCAFEBABEx0/athena"
}

variable "production_branch" {
  description = "Git branch that deploys to Production."
  type        = string
  default     = "main"
}

variable "existing" {
  description = <<-EOT
    IDs of resources that already exist in this account and are adopted with
    `import` blocks on the next plan/apply. Leave empty ({}) for a fresh
    account: everything is then created. None of these IDs is a secret.
  EOT
  type = object({
    project_ids = optional(map(string), {})
    env_ids     = optional(map(string), {})
    domains     = optional(bool, false)
  })
  default = {}
}

variable "secrets" {
  description = <<-EOT
    Secret environment variable values, keyed by the names in local.secret_keys.
    Pass them from a git-ignored *.auto.tfvars file or TF_VAR_secrets; never
    commit them. They are only sent to Vercel when an env var is created or its
    entry in secret_versions changes, and are not stored in the state.
  EOT
  type        = map(string)
  sensitive   = true
  ephemeral   = true
}

variable "secret_versions" {
  description = "Bump a key's number to push a new value for that secret (rotation). Missing keys count as 1."
  type        = map(number)
  default     = {}
}

variable "ai_gateway" {
  description = <<-EOT
    Cloudflare AI Gateway in front of Claude (docs/AI_SEARCH.md, "Cloudflare
    AI Gateway"). null = not managed: no gateway, and the apps keep calling
    Anthropic directly. account_id and gateway_id are not secrets.
  EOT
  type = object({
    account_id = string
    gateway_id = optional(string, "whoa")
    # Dollars per window for every Anthropic request through the gateway.
    spend_limit_usd = optional(number, 5)
    # Length of the budget window. The API does not document the unit;
    # seconds, like rate_limiting_interval, is assumed (30 days by default).
    # Check the rule under Settings > Spend limits after the first apply.
    spend_limit_window = optional(number, 2592000)
    # "fixed" resets at the end of each window; "sliding" counts the last window.
    spend_limit_technique = optional(string, "fixed")
    # Request logs (prompts and answers) in Workers Logs, free up to 200,000 a day.
    collect_logs = optional(bool, true)
    # Vercel environments that get ANTHROPIC_BASE_URL and CF_AIG_TOKEN.
    # Start with ["preview"] to try it there first.
    vercel_targets = optional(list(string), ["production", "preview"])
    # true when the gateway was already created in the dashboard: adopt it.
    import = optional(bool, false)
  })
  default = null
}
