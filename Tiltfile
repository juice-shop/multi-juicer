k8s_resource_assembly_version(2)
k8s_yaml('juice-balancer-k8.yml')

repo = local_git_repo('.')

docker_build('iteratec/juice-balancer',
             '.',
             dockerfile='Dockerfile')

k8s_resource('juice-balancer', port_forwards='3000:3000')
