# Full configuration options can be found at https://www.vaultproject.io/docs/configuration

api_addr = "https://0.0.0.0:8200"
ui = true

cluster_name = "vault"

max_lease_ttl = "30m"
default_lease_ttl = "5m"
log_level = "INFO"

#mlock = true
#disable_mlock = true

#storage "file" {
#  path = "/opt/vault/data"
#}

#storage "consul" {
#  address = "127.0.0.1:8500"
#  path    = "vault"
#}

# HTTP listener
#listener "tcp" {
#  address = "127.0.0.1:8200"
#  tls_disable = 1
#}

# HTTPS listener
listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/etc/vault-certificates/vault.pem"
  tls_key_file  = "/etc/vault-certificates/vault.key"
}

# Enterprise license_path
# This will be required for enterprise as of v1.8
#license_path = "/etc/vault.d/vault.hclic"

# Example AWS KMS auto unseal
seal "ocikms" {
  auth_type_api_key   = "false"
  crypto_endpoint     = "{{ crypto_endpoint }}" 
  key_id              = "{{ key_id }}"
  management_endpoint = "{{ management_endpoint }}"
}

storage "oci" {
  auth_type_api_key = "false"
  bucket_name       = "{{ bucket_name }}"
  ha_enabled        = "true"
  lock_bucket_name  = "{{ lock_bucket_name }}"
  namespace_name    = "{{ namespace_name }}"
}