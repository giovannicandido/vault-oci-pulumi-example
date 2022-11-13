# Oracle Cloud Instance
​
[Oracle Console](https://cloud.oracle.com)
​
## Connection to Vault VM

```
ssh opc@${outputs.vault_vm_ip}
```

## Configure Ansible

Add this configuration to file **ansible/inventories/oci-prod/group_vars/vault-servers**

```yaml
bucket_name: ${outputs.vault_bucket_name}
lock_bucket_name: ${outputs.vault_lock_bucket_name}
namespace_name: ${outputs.bucket_namespace} 
crypto_endpoint: ${outputs.secured_keys_vault_crypto_endpoint}
key_id: ${outputs.vault_key_id}
management_endpoint: ${outputs.secured_keys_vault_management_endpoint}
```

Add this to the hosts in **ansible/inventories/oci-prod/hosts.yaml**

```yaml
vault-servers:
  hosts:
    vault-0:
      ansible_host: ${outputs.vault_vm_ip}
      ansible_user: opc
```

Run the ansible playbook:

```bash
cd ansible
ansible-playbook -i inventories/oci-prod vault-servers.yaml
```

## Acess Vault

Edit **/etc/hosts** file add (change your-domain to your dns):

```
your-domain.com  ${outputs.vault_vm_ip}
```

Init Vault

```
export VAULT_ADDR='https://your-domain.com:8200'
vault operator init
```

Check vault 

```
vault login
vault secrets enable -version=2 kv
vault secrets list
vault kv put -mount=kv test a=secret
vault kv get -mount=kv test
```