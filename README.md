# Provision Hashicorp Vault in Oracle OCI

This project uses two tools (pulumi and ansible) to create a full instegrated Hashicorp Vault VM instance with oracle cloud.

The Vault will have the capabilities:

1. Auto unseal using oracle key management service
2. HA Storage with Buckets
3. OCI policies to authenticate with vault using a oracle group

Note that the 3 capability has a bug in vault that prevent from working. Please check: https://github.com/hashicorp/vault/issues/13607

# Usage

1. Create a new project in pulumi from the pulumi folder:

Note: Create a pulumi project from an existing code is not as strait as it should be, you can try to fork the project and use the `new` command with the repo url but it do not allow to clone with ssh, which is a drawnback. It also do not allow you to specify a folder as the root of the project, which do not work as this repo has a **pulumi** folder in it
Theres is two alternatives. First create the project from the public fork

```bash
cd pulumi
pulumi new https://github.com/user/repo
```

Or you can clone the repo as usual and override the files, then reset it to get the original code:

```bash
git clone <repoUrl>
cd repo/pulumi
pulumi new vault-oci --force #follow the questions and choose typescript project
git reset --hard #this should reset the files to the original code
```

2. Configure pulumi

Check the pulumi stack file **pulumi/Pulumi.dev.yaml** for all configurations and add each one as required:

```bash
pulumi config set oci:region your-region
pulumi config set oci:tenancyOcid yourTenancyOcid --secure
pulumi config set bucketNamespace yourbucketNamespace
pulumi config set compartmentId yourcompartmentid --secure
pulumi config set region your-region #yes it needs two configs
pulumi config set rootCompartmentId yourRootCompartmentId
pulumi config set ssh-pub-key `cat ~/.ssh/id_rsa.pub`
pulumi config set tenancyOcid yourTenancyOcid --secure #yes again (can't access the config from the plugin oci in the main index.ts)
```

3. Create the resources

```bash
pulumi up
```

4. Check your pulumi README in the pulumi web console it should generate the instructions for the ansible configuration based on the resources created

5. Configure ansible

Edit the file **ansible/inventories/oci-prod/hosts.yaml** and **ansible/inventories/oci-prod/group_vars/vault-servers** with the correct information generated

6. Prepare SSL certificates for the vault server.

Instructions are out of the scope of this tutorial but you can check my video about it in: [https://youtu.be/xyKMdG2p4tk](https://youtu.be/xyKMdG2p4tk])

Add your certificates as the files to the folder **ansible/roles/vault-server/files**:

    vault-chain.pem
    vault.key
    vault.pem

If you don't whant to secure the vault url. Change the file **ansible/roles/vault-server/template/vault.hcl** and **ansible/roles/vault-server/tasks/main.yaml** accordly. (but why whould you do that?)

7. Finaly provision the vault server

```bash
cd ansible
ansible-playbook -i inventories/oci-prod vault-servers.yaml
```

# Full video demostration

Check the video explaning how to configure this by yourself (manually) and with the automation in this project: [https://youtu.be/EFMdJ2NpKGA](https://youtu.be/EFMdJ2NpKGA)

