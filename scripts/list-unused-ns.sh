#!/bin/bash

echo "This script shows all the namespaces that have not been used, it requires an export of the users in CTFD"
echo "It assumes you have the users.csv file from CTFD in the same folder"
source check-available-commands.sh
checkCommandsAvailable kubectl jq awk
IFS=$'
'
USERS=($(awk -F , '{print $3}' users.csv))
unset IFS
for NAMESPACE in `kubectl get ns | grep t- |  awk '{print $1;}'`
do
echo "found $NAMESPACE"
NO_TDASH_NAMESPACE=${NAMESPACE:2}
echo "checking list for $NO_TDASH_NAMESPACE"
if [[ " ${USERS[*]} " =~ " ${NO_TDASH_NAMESPACE} " ]]; then
    echo "FOUND $NO_TDASH_NAMESPACE in users"
else
    echo "did not find $NO_TDASH_NAMESPACE in users"
fi
done