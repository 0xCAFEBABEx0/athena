resource "vercel_project_environment_variable" "this" {
  for_each = local.env

  project_id = vercel_project.this[each.value.project].id
  key        = each.value.key
  target     = each.value.target
  sensitive  = each.value.sensitive
  comment    = try(each.value.comment, null)

  # Plain values live in this repo; secrets come from var.secrets and are
  # write-only, so they never reach the state or a saved plan.
  value            = try(each.value.secret, null) == null ? each.value.value : null
  value_wo         = try(each.value.secret, null) == null ? null : var.secrets[each.value.secret]
  value_wo_version = try(each.value.secret, null) == null ? null : lookup(var.secret_versions, each.value.secret, 1)
}
