# Cloudflare AI Gateway in front of Claude, with a spend limit. Created only
# when var.ai_gateway is set. Not managed here (dashboard, once): the
# Anthropic key under the gateway's Provider Keys, which the provider cannot
# attach yet (cloudflare/terraform-provider-cloudflare#7332), and the gateway
# token (CF_AIG_TOKEN); both stay out of the state that way.
resource "cloudflare_ai_gateway" "this" {
  count = var.ai_gateway == null ? 0 : 1

  account_id = var.ai_gateway.account_id
  id         = var.ai_gateway.gateway_id

  # Requests need the gateway token. Cloudflare cannot turn this off again.
  authentication = true
  collect_logs   = var.ai_gateway.collect_logs

  # No gateway cache or request limit: the web app keeps answers itself
  # (Runtime Cache, ai.answers) and limits questions (AI_DAILY_LIMIT).
  cache_ttl                  = 0
  cache_invalidate_on_update = false
  rate_limiting_interval     = 0
  rate_limiting_limit        = 0

  spend_limits = {
    enabled = true
    rules = [{
      id         = "anthropic"
      enabled    = true
      limit      = var.ai_gateway.spend_limit_usd
      limit_type = "cost"
      window     = var.ai_gateway.spend_limit_window
      technique  = var.ai_gateway.spend_limit_technique
      ai_gateway_provider = {
        mode   = "filter"
        values = ["anthropic"]
      }
    }]
  }
}
