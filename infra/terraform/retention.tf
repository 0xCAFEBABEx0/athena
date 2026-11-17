# Deployment Retention Policy of both projects (Settings > Build and
# Deployment). Every retained deployment keeps its Function bundles in
# Functions Storage, which is 10 GB per Hobby team; over the limit Vercel
# deletes older deployments right away and can block new ones. On Hobby the
# default keeps every deployment for 30 days, and athena-cms is about 140 MB
# of bundles per deployment (five Next.js functions, each carrying sharp's
# libvips), so a busy week of preview pushes fills most of it.
#
# Vercel keeps these whatever the policy says: the current production
# deployment, the last 3 production deployments and the last 3 deployments of
# each project, and any deployment with an alias (preview.whoa.me and
# preview.cms.whoa.me follow the latest `preview` build). Allowed values:
# 1d, 1w, 1m, 2m, 3m, 6m, 1y. Removing this resource leaves the policy as it
# is in Vercel.
resource "vercel_project_deployment_retention" "this" {
  for_each = local.projects

  project_id            = vercel_project.this[each.key].id
  expiration_preview    = local.deployment_retention.preview
  expiration_production = local.deployment_retention.production
  expiration_canceled   = local.deployment_retention.canceled
  expiration_errored    = local.deployment_retention.errored
}
