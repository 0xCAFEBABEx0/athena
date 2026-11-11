output "project_ids" {
  description = "Vercel project IDs."
  value       = { for k, p in vercel_project.this : k => p.id }
}

output "domain_verification" {
  description = "DNS challenges for domains Vercel has not verified yet (add them at Cloudflare)."
  value = {
    for k, d in vercel_project_domain.this : d.domain => d.verification
    if !d.verified
  }
}
