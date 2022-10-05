#!/bin/bash

echo "This script DELETES all the namespaces that have not been used, it requires an export of the users in CTFD"
echo "It assumes you have the users.csv file from CTFD in the same folder"
echo "ONLY RUN THIS IF YOU ARE SATISFIED WITH THE OUTPUT OF list-unused-ns.sh!"

sleep 2
echo "Sleeping for 10 seconds to give you time to abort if you are not sure to use automatic deletion"
sleep 10

source check-available-commands.sh
checkCommandsAvailable kubectl jq awk
IFS=$'
'
USERS=($(awk -F , '{print tolower($3)}' users.csv))
TEAMS=($(awk -F , '{print tolower($3)}' teams.csv))
unset IFS
for NAMESPACE in `kubectl get ns | grep t- |  awk '{print $1;}'`
do
echo "found $NAMESPACE"
CUT_NAMESPACE=${NAMESPACE:2}
NO_TDASH_NAMESPACE=`echo $CUT_NAMESPACE | awk '{print tolower($0)}'`
echo "checking list for $NO_TDASH_NAMESPACE"
if [[ " ${USERS[*]} " =~ " ${NO_TDASH_NAMESPACE} " ]]; then
    echo "FOUND $NO_TDASH_NAMESPACE in users"
else
    if [[ " ${TEAMS[*]} " =~ " ${NO_TDASH_NAMESPACE} " ]]; then
        echo "FOUND $NO_TDASH_NAMESPACE in teams"
    else
        echo "did NOT find $NO_TDASH_NAMESPACE in users and teams. Deletig it now!"
        kubectl delete ns $NAMESPACE
        echo "deleted $NAMESPACE"
    fi
    
fi
done