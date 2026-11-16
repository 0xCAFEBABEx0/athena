resource "vercel_project" "this" {
  for_each = local.projects

  name           = each.value.name
  framework      = each.value.framework
  root_directory = each.value.root_directory
  node_version   = local.node_version

  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = var.production_branch
  }

  vercel_authentication = {
    deployment_type = each.value.vercel_authentication
  }

  lifecycle {
    # Deleting a project drops its deployments, domains and env vars.
    prevent_destroy = true
    # Dashboard settings this config does not own. Without this, every update
    # plans them as "known after apply" and could reset them (Fluid compute,
    # the default function region, the Toolbar, the build machine).
    ignore_changes = [
      build_machine_type,
      resource_config,
      serverless_function_region,
      enable_preview_feedback,
      enable_production_feedback,
      preview_comments,
      git_provider_options,
      enable_affected_projects_deployments,
    ]
  }
}
