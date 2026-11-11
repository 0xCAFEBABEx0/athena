resource "vercel_project_domain" "this" {
  for_each = local.domains

  project_id           = vercel_project.this[each.value.project].id
  domain               = each.value.domain
  git_branch           = try(each.value.git_branch, null)
  redirect             = try(each.value.redirect, null)
  redirect_status_code = try(each.value.redirect_status_code, null)
}
