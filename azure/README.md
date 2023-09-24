# Setup your secrets in Azure

In this setup we integrate the secrets exercise with Azure AKS and let pods consume secrets from an Azure Key Vault. If you want to know more about integrating secrets with AKS, check [this link](https://github.com/Azure/secrets-store-csi-driver-provider-azure).
Please make sure that the account in which you run this exercise has either Log Analytics enabled, or is not linked to your current subscriptions and/or DTAP environment.

## Pre-requisites

Have the following tools installed:

- az CLI - [Installation](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- Tfenv (Optional) - [Installation](https://github.com/tfutils/tfenv)
- Terraform CLI - [Installation](https://learn.hashicorp.com/tutorials/terraform/install-cli)
- Wget - [Installation](https://www.jcchouinard.com/wget/)
- Helm [Installation](https://helm.sh/docs/intro/install/)
- Kubectl [Installation](https://kubernetes.io/docs/tasks/tools/)
- jq [Installation](https://stedolan.github.io/jq/download/)

Make sure you have an active subscription at Azure for which you have configured the credentials on the system where you will execute the steps below.

Please note that this setup relies on bash scripts that have been tested in MacOS and Linux. We have no intention of supporting vanilla Windows at the moment.

## Installation

**Note-I**: We create resources in `east us` by default. You can set the region by editing `terraform.tfvars`.

**Note-II**: The cluster you create has its access bound to the public IP of the creator. In other words: the cluster you create with this code has its access bound to your public IP-address if you apply it locally. If you switched to a different network, you'll need to run `terraform apply` again to update the firewall rules.

### (Optional) Multi-user setup: shared state

If you want to host a multi-user setup, you will probably want to share the state file so that everyone can try related challenges. We have provided a starter to easily do so using an Azure storage container.

First, enable the `Microsoft.Storage` API (if it isn't already) using:

```bash
az provider register --namespace Microsoft.Storage
```

Then, apply the Terraform (optionally add `-var="region=YOUR_DESIRED_REGION"` to the apply to use a region other than the default `East US`):

```bash
cd shared-state
terraform init
terraform apply
```

The storage account name should be in the output. Please use that to configure the Terraform backend in `main.tf` by uncommenting the part on the `backend "azurerm"` inside the `terraform` block. Assign the `storage_account_name` to the one from the output.

**Note**: You'll need to follow the description [below](#wrongsecrets-ctf-party) in step 1 for the "existing resource group" i.e., use the `azurerm_resource_group.default` resource.

### WrongSecrets-ctf-party

1. Set either a new resource group or use an existing resource group in `main.tf` (it defaults to the existing `OWASP-Projects` resource group). Note that you'll need to find/replace references to "azurerm_resource_group.default" to "arurerm_resource_group.default" if you want to create a new one.
2. check whether you have the right project by doing `az account show` (after `az login`). Want to set the project as your default? Use `az account set --subscription <.id here>`.
3. If not yet enabled, register the required services for the subscription, run:
    - `az provider register --namespace Microsoft.ContainerService`
    - `az provider register --namespace Microsoft.KeyVault`
    - `az provider register --namespace Microsoft.ManagedIdentity`
4. Run `terraform init` (if required, use `tfenv` to select TF 0.14.0 or higher )
5. Run `terraform plan` to see what will be created (optional).
6. Run `terraform apply`. Note: the apply will take 5 to 20 minutes depending on the speed of the Azure backplane.
7. Go to the values of the helm chart and replace the wrongsecrets.config with this:

    ```yaml
    K8S_ENV: "azure"
    ```

    and replace the value of wrongsecrets.env having the name 'K8S_ENV' with this:

    ```yaml
    value: "azure"
    ```

8. Run `./build-and-deploy-azure.sh`. Your kubeconfig file will automatically be updated.

Your AKS cluster should be visible in your resource group. Want a different region? You can modify `terraform.tfvars` or input it directly using the `region` variable in plan/apply.

Are you done playing? Please run `terraform destroy` twice to clean up.

### Test it

When you have completed the installation steps, you can do `kubectl port-forward service/wrongsecrets-balancer 3000:3000` and then go to [http://localhost:3000](http://localhost:3000).

Want to know how well your cluster is holding up? Check with

```sh
    kubectl top nodes
    kubectl top pods
```

### Configuring CTFd

You can use the [Juiceshop CTF CLI](https://github.com/juice-shop/juice-shop-ctf) to generate CTFd configuration files.

Follow the following steps:

```shell
    npm install -g juice-shop-ctf-cli@9.1.2
    juice-shop-ctf #choose ctfd and https://wrongsecrets-ctf.herokuapp.com as domain. No trailing slash! The key is 'test', by default feel free to enable hints. We do not support snippets or links/urls to code or hints.
```

Now visit the CTFd instance and setup your CTF. To test things locally before setting up a load balancer/ingress, you can use `kubectl port-forward -n ctfd $(kubectl get pods --namespace ctfd -l "app.kubernetes.io/name=ctfd,app.kubernetes.io/instance=ctfd" -o jsonpath="{.items[0].metadata.name}") 8000:8000` and go to `localhost:8000` to visit CTFd.

_!!NOTE:_ **The following can be dangerous if you use CTFd `>= 3.5.0` with wrongsecrets `< 1.5.11`. Check the `challenges.json` and make sure it's 1-indexed - a 0-indexed file will break CTFd!** _/NOTE!!_

Then use the administrative backup function to import the zipfile you created with the juice-shop-ctf command.
After that you will still need to override the flags with their actual values if you do use the 2-domain configuration. For a guide on how to do this see the 2-domain setup steps in the general [README](../readme.md)
Want to setup your own? You can! Watch out for people finding your key though, so secure it properly: make sure the running container with the actual ctf-key is not exposed to the audience, similar to our heroku container.

Want to make the CTFD instance look pretty? Include the fragment located at [./k8s/ctfd_resources/index_fragment.html](/k8s/ctfd_resources/index_fragment.html) in your index.html via the admin panel.

If you want to share with others go to the [When you want to share your environment with others (experimental)](#when-you-want-to-share-your-environment-with-others-experimental) section.

### Configuring the application

In the front page of the application you can edit the description to reference the right urls and the desplayed image. Use the following:

```sh
helm upgrade --install wrongsecrets ../helm/wrongsecrets-ctf-party \
  --set="balancer.env.REACT_APP_MOVING_GIF_LOGO=<>" \
  --set="balancer.env.REACT_APP_HEROKU_WRONGSECRETS_URL=<>" \
  --set="balancer.env.REACT_APP_CTFD_URL='<>'" \
```

### Monitoring the cluster

For a guide on how to use the monitoring setup, see the [monitoring guide](../guides/monitoring-setup/monitoring.md).

### Clean it up

When you're done:

1. Kill the port forward.
2. Run `terraform destroy` to clean up the infrastructure. Note that you may need to repeat the destroy to fully clean up.
3. If you've used the shared state, `cd` to the `shared-state` folder and run `terraform destroy` there too.
4. Run `rm terraform.tf*` to remove local state files.

### A few things to consider

1. Does your worker node now have access as well?
2. Can you easily obtain the AKS managed identity of the Node?
3. Can you get the secrets in the Key vault? Which paths do you see?

### When you want to share your environment with others (experimental)

We added additional scripts for adding a Load Balancer and ingress so that you can use your cloud setup with multiple people.
Do the following:

1. Follow the installation section first.
2. Run `./k8s-nginx-lb-script.sh` and the script will return the url at which you can reach the application. (Be aware this opens the url's to the internet in general, if you'd like to limit the access please do this using the security groups in Azure)
3. When you are done, before you do cleanup, first run `./k8s-nginx-lb-script-cleanup.sh`.

Note that you might have to do some manual cleanups after that.

## Terraform documentation

The documentation below is auto-generated to give insight on what's created via Terraform.

<!-- BEGINNING OF PRE-COMMIT-TERRAFORM DOCS HOOK -->
## Requirements

| Name | Version |
|------|---------|
| <a name="requirement_terraform"></a> [terraform](#requirement\_terraform) | ~> 1.1 |
| <a name="requirement_azurerm"></a> [azurerm](#requirement\_azurerm) | ~> 3.67.0 |
| <a name="requirement_http"></a> [http](#requirement\_http) | ~> 3.4.0 |
| <a name="requirement_random"></a> [random](#requirement\_random) | ~> 3.5.1 |

## Providers

| Name | Version |
|------|---------|
| <a name="provider_azurerm"></a> [azurerm](#provider\_azurerm) | 3.67.0 |
| <a name="provider_http"></a> [http](#provider\_http) | 3.4.0 |
| <a name="provider_random"></a> [random](#provider\_random) | 3.5.1 |

## Modules

No modules.

## Resources

| Name | Type |
|------|------|
| [azurerm_key_vault.vault](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault) | resource |
| [azurerm_key_vault_access_policy.extra_identity_access](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_access_policy) | resource |
| [azurerm_key_vault_access_policy.identity_access](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_access_policy) | resource |
| [azurerm_key_vault_access_policy.user](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_access_policy) | resource |
| [azurerm_key_vault_secret.wrongsecret_1](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_secret) | resource |
| [azurerm_key_vault_secret.wrongsecret_2](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_secret) | resource |
| [azurerm_key_vault_secret.wrongsecret_3](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/key_vault_secret) | resource |
| [azurerm_kubernetes_cluster.cluster](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/kubernetes_cluster) | resource |
| [azurerm_resource_group.default](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/resource_group) | resource |
| [azurerm_role_assignment.aks_extra_identity_operator](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/role_assignment) | resource |
| [azurerm_role_assignment.aks_identity_operator](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/role_assignment) | resource |
| [azurerm_role_assignment.aks_vm_contributor](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/role_assignment) | resource |
| [azurerm_user_assigned_identity.aks_extra_pod_identity](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/user_assigned_identity) | resource |
| [azurerm_user_assigned_identity.aks_pod_identity](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/user_assigned_identity) | resource |
| [random_integer.suffix](https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/integer) | resource |
| [random_password.password](https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/password) | resource |
| [random_string.suffix](https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/string) | resource |
| [azurerm_client_config.current](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/client_config) | data source |
| [http_http.ip](https://registry.terraform.io/providers/hashicorp/http/latest/docs/data-sources/http) | data source |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_cluster_name"></a> [cluster\_name](#input\_cluster\_name) | The AKS cluster name | `string` | `"wrongsecrets-exercise-cluster"` | no |
| <a name="input_cluster_version"></a> [cluster\_version](#input\_cluster\_version) | The AKS cluster version to use | `string` | `"1.25"` | no |
| <a name="input_region"></a> [region](#input\_region) | The Azure region to use | `string` | `"East US"` | no |

## Outputs

| Name | Description |
|------|-------------|
| <a name="output_aad_extra_pod_identity_client_id"></a> [aad\_extra\_pod\_identity\_client\_id](#output\_aad\_extra\_pod\_identity\_client\_id) | Client ID for the Managed Identity for AAD Pod Identity |
| <a name="output_aad_extra_pod_identity_resource_id"></a> [aad\_extra\_pod\_identity\_resource\_id](#output\_aad\_extra\_pod\_identity\_resource\_id) | Resource ID for the Managed Identity for AAD Pod Identity |
| <a name="output_aad_pod_identity_client_id"></a> [aad\_pod\_identity\_client\_id](#output\_aad\_pod\_identity\_client\_id) | Client ID for the Managed Identity for AAD Pod Identity |
| <a name="output_aad_pod_identity_resource_id"></a> [aad\_pod\_identity\_resource\_id](#output\_aad\_pod\_identity\_resource\_id) | Resource ID for the Managed Identity for AAD Pod Identity |
| <a name="output_cluster_name"></a> [cluster\_name](#output\_cluster\_name) | AKS Cluster name |
| <a name="output_key_vault_url"></a> [key\_vault\_url](#output\_key\_vault\_url) | Azure KeyVault URI for the Demo Container |
| <a name="output_resource_group"></a> [resource\_group](#output\_resource\_group) | Resource group name |
| <a name="output_tenant_id"></a> [tenant\_id](#output\_tenant\_id) | Azure tenant ID |
| <a name="output_vault_name"></a> [vault\_name](#output\_vault\_name) | Vault name |
| <a name="output_vault_uri"></a> [vault\_uri](#output\_vault\_uri) | Vault URI |
<!-- END OF PRE-COMMIT-TERRAFORM DOCS HOOK -->
