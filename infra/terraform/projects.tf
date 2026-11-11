resource "vercel_project" "this" {
  for_each = local.projects

  name            = each.value.name
  framework       = each.value.framework
  root_directory  = each.value.root_directory
  build_command   = each.value.build_command
  install_command = local.install_command
  node_version    = local.node_version

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
  }
}
