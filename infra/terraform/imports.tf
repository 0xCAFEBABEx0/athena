# Adopts the resources that already exist in the account named by
# var.existing (accounts/<name>.tfvars). For a fresh account var.existing is
# empty and nothing is imported. Import blocks are no-ops once the resources
# are in the state.

import {
  for_each = var.existing.project_ids
  to       = vercel_project.this[each.key]
  id       = "${var.team_id}/${each.value}"
}

import {
  for_each = var.existing.domains ? local.domains : {}
  to       = vercel_project_domain.this[each.key]
  id       = "${var.team_id}/${var.existing.project_ids[each.value.project]}/${each.value.domain}"
}

import {
  for_each = var.existing.env_ids
  to       = vercel_project_environment_variable.this[each.key]
  # "write-only:" keeps an imported secret's value out of the state.
  id = "${try(local.env[each.key].secret, null) == null ? "" : "write-only:"}${var.team_id}/${var.existing.project_ids[local.env[each.key].project]}/${each.value}"
}
