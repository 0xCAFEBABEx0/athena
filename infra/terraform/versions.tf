terraform {
  # 1.11+ for write-only arguments (`value_wo`), which keep secret values out
  # of the state and plan files.
  required_version = ">= 1.11.0"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.25"
    }
  }

  # State stays local (and git-ignored) by default. To keep it remotely, add a
  # git-ignored `backend_override.tf` (see README.md).
}
