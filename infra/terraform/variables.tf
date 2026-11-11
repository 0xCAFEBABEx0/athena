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
