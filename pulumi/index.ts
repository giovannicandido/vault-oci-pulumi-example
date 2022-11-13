import * as pulumi from "@pulumi/pulumi";
import * as oci from "@pulumi/oci";
import { readFileSync } from "fs";

const config = new pulumi.Config();

const compartmentId = config.require("compartmentId")
const tenancyOcid = config.require("tenancyOcid")
const rootCompartmentId = config.require("rootCompartmentId")

const servicesIdResponse = await oci.core.getServices();

const serviceId = servicesIdResponse.services.filter(s => s.cidrBlock == "all-vcp-services-in-oracle-services-network")[0].id

const test_vcn = new oci.core.Vcn("test-vcn", {
    cidrBlock: "10.1.0.0/16",
    compartmentId: compartmentId,
    displayName: "test-vcn",
    dnsLabel: "test",
});

const internet_gateway = new oci.core.InternetGateway("internet-gateway", {
    compartmentId: compartmentId,
    displayName: "internet-gateway",
    vcnId: test_vcn.id,
});

const nat_gateway = new oci.core.NatGateway("nat-gateway", {
    compartmentId: compartmentId,
    displayName: "nat-gateway",
    vcnId: test_vcn.id,
});

const service_gateway = new oci.core.ServiceGateway("service-gateway", {
    compartmentId: compartmentId,
    displayName: "service-gateway",
    services: [{
        serviceId: serviceId
    }],
    vcnId: test_vcn.id,
});


const nat_route = new oci.core.RouteTable("nat-route", {
    compartmentId: compartmentId,
    displayName: "nat-route",
    routeRules: [
        {
            description: "All Services in region to Service Gateway",
            destination: "all-vcp-services-in-oracle-services-network",
            destinationType: "SERVICE_CIDR_BLOCK",
            networkEntityId: service_gateway.id
        },
        {
            description: "NAT Gateway as default gateway",
            destination: "0.0.0.0/0",
            destinationType: "CIDR_BLOCK",
            networkEntityId: nat_gateway.id,
        },
    ],
    vcnId: test_vcn.id,
});

const internet_route = new oci.core.RouteTable("internet-route", {
    compartmentId: compartmentId,
    displayName: "internet-route",
    routeRules: [{
        description: "Internet Gateway as default gateway",
        destination: "0.0.0.0/0",
        destinationType: "CIDR_BLOCK",
        networkEntityId: internet_gateway.id,
    }],
    vcnId: test_vcn.id,
});


const test_private_subnet_sl = new oci.core.SecurityList("test-private-subnet-sl", {
    compartmentId: compartmentId,
    displayName: "test-private-subnet-sl",
    egressSecurityRules: [{
        destination: "0.0.0.0/0",
        destinationType: "CIDR_BLOCK",
        protocol: "all",
    }],
    ingressSecurityRules: [{
        protocol: "all",
        source: "10.1.0.0/16",
        sourceType: "CIDR_BLOCK",
    }],
    vcnId: test_vcn.id,
});

const test_public_subnet_sl = new oci.core.SecurityList("test-public-subnet-sl", {
    compartmentId: compartmentId,
    displayName: "test-public-subnet-sl",
    egressSecurityRules: [{
        destination: "0.0.0.0/0",
        destinationType: "CIDR_BLOCK",
        protocol: "all",
    }],
    ingressSecurityRules: [
        {
            protocol: "all",
            source: "10.1.0.0/16",
            sourceType: "CIDR_BLOCK",
        },
        {
            protocol: "6",
            source: "0.0.0.0/0",
            sourceType: "CIDR_BLOCK",
            tcpOptions: {
                max: 22,
                min: 22,
            },
        },{
            protocol: "6",
            source: "0.0.0.0/0",
            sourceType: "CIDR_BLOCK",
            tcpOptions: {
                min: 8200,
                max: 8200
            }
        }
    ],
    vcnId: test_vcn.id,
});

const vcn_private_subnet = new oci.core.Subnet("test-private-subnet", {
    cidrBlock: "10.1.1.0/24",
    compartmentId: compartmentId,
    displayName: "test-private-subnet",
    dnsLabel: "priv",
    prohibitInternetIngress: true,
    prohibitPublicIpOnVnic: true,
    routeTableId: nat_route.id,
    securityListIds: [test_private_subnet_sl.id],
    vcnId: test_vcn.id,
});

const vnc_public_subnet = new oci.core.Subnet("vnc-public-subnet", {
    cidrBlock: "10.1.0.0/24",
    compartmentId: compartmentId,
    displayName: "test-public-subnet",
    dnsLabel: "pub",
    routeTableId: internet_route.id,
    securityListIds: [test_public_subnet_sl.id],
    vcnId: test_vcn.id,
});


const sshPublicKey= config.require("ssh-pub-key")

const availabilityDomains = await oci.identity.getAvailabilityDomains({
    compartmentId: compartmentId
})

const placemantConfigs = availabilityDomains.availabilityDomains
        .map(av => {return {availabilityDomain: av.name, subnetId: vcn_private_subnet.id}})
// TODO change for Id of the image. Check: https://docs.oracle.com/en-us/iaas/images/ 
const oracle8AMD64ImageId = "ocid1.image.oc1.sa-vinhedo-1.aaaaaaaa7jz5pgwcep7kke6f7ytyja53nyfqu4tepau2kq5cp32cj3rsp7ja";

const vault_instance = new oci.core.Instance("vault", {
    availabilityDomain: availabilityDomains.availabilityDomains[0].name,
    compartmentId: compartmentId,
    createVnicDetails: {
        displayName: "vault",
        hostnameLabel: "vault",
        subnetId: vnc_public_subnet.id,
        assignPublicIp: "true"
    },
    displayName: "vault-pulumi",

    metadata: {
        ssh_authorized_keys: sshPublicKey
    },
    shape: "VM.Standard.E3.Flex",
    shapeConfig: {
        memoryInGbs: 1,
        ocpus: 1,
    },
    sourceDetails: {
        bootVolumeSizeInGbs: "50",
        bootVolumeVpusPerGb: "10",
        sourceId: oracle8AMD64ImageId,
        sourceType: "image",
    }
});

const secured_keys_vault = new oci.kms.Vault("secured_keys_vault", {
    compartmentId: compartmentId,
    displayName: "pulumi secured keys",
    vaultType: "DEFAULT",
});

const vault_key = new oci.kms.Key("vault_unseal_key", {
    compartmentId: compartmentId,
    displayName: "vault unseal secret",
    keyShape: {
        algorithm: "AES",
        length: 32
    },
    managementEndpoint: secured_keys_vault.managementEndpoint,
    protectionMode: "SOFTWARE"

});

const bucketNamespace = config.require("bucketNamespace")

const vault_bucket = new oci.objectstorage.Bucket("vault_bucket", {
    compartmentId: compartmentId,
    namespace: bucketNamespace,
    name: "pulumi_bucket",
    accessType: "NoPublicAccess",
    autoTiering: "Disabled",
    objectEventsEnabled: false,
    storageTier: "Standard"
});

const vault_bucket_lock = new oci.objectstorage.Bucket("vault_bucket_lock", {
    compartmentId: compartmentId,
    namespace: bucketNamespace,
    name: "pulumi_vault_lock",
    accessType: "NoPublicAccess",
    autoTiering: "Disabled",
    objectEventsEnabled: false,
    storageTier: "Standard"
});
const matchingRule = pulumi.concat("instance.id = '", vault_instance.id, "'")
const vault_instance_dg = new oci.identity.DynamicGroup("vault_dg", {
    compartmentId: tenancyOcid,
    description: "KMS and Storage Target Group for Vault Instance",
    matchingRule: matchingRule,
    
});

const statement1 = pulumi.concat("Allow dynamic-group ", vault_instance_dg.name, ` to use keys in compartment id ${compartmentId} where target.key.id = '`, vault_key.id, "'")
const statement2 = pulumi.concat("Allow dynamic-group ", vault_instance_dg.name, ` to read buckets in compartment id ${compartmentId}`)
const statement3 = pulumi.concat("Allow dynamic-group ", vault_instance_dg.name, ` to manage objects in compartment id ${compartmentId} where any {target.bucket.name='`, vault_bucket.name, "', target.bucket.name='", vault_bucket_lock.name, "'}")
const statement4 = pulumi.concat("Allow dynamic-group ", vault_instance_dg.name, ` to use secrets in compartment id ${compartmentId}`)
const vault_instance_policy = new oci.identity.Policy("vault_instance_policy", {
    compartmentId: compartmentId,
    description: "Allow vault instance to access kms and bucket for storage",
    statements: [
        statement1,
        statement2,
        statement3,
        statement4
    ]
});
const authStatement1 = pulumi.concat("Allow dynamic-group ", vault_instance_dg.name, " to {AUTHENTICATION_INSPECT} in tenancy")
const authStatement2 = pulumi.concat("Allow dynamic-group ", vault_instance_dg.name, " to {GROUP_MEMBERSHIP_INSPECT} in tenancy")
const vault_instance_auth_policy = new oci.identity.Policy("vault_instance_auth_policy", {
    compartmentId: rootCompartmentId,
    description: "Allow vault instance to authenticate with oracle cloud",
    statements: [
        authStatement1,
        authStatement2
    ]
});

const vault_admins_group = new oci.identity.Group("vault_admins", {
    compartmentId: tenancyOcid,
    description: "Admins for hashicorp vault",
    name: "VaultAdminsPulumi",  
});


export const vault_vm_ip = vault_instance.publicIp
export const vault_key_id = vault_key.id
export const vault_bucket_name = vault_bucket.name
export const vault_lock_bucket_name = vault_bucket_lock.name
export const bucket_namespace = vault_bucket.namespace
export const secured_keys_vault_crypto_endpoint = secured_keys_vault.cryptoEndpoint
export const secured_keys_vault_management_endpoint = secured_keys_vault.managementEndpoint
export const vault_admins_group_ocid = vault_admins_group.id
export const vault_instance_dg_id = vault_instance_dg.id
export const readme = readFileSync("./Pulumi.README.md").toString();
