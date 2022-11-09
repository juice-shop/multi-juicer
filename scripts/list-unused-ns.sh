#!/bin/bash

echo "This script shows all the namespaces that have not been used, it requires an export of the users in CTFD"
echo "It assumes you have the users.csv file and teams.csv file from CTFD in the same folder"
echo "This script results in a file unusedteams.txt with all the teams that have no exact match with the registration of users and teams in CTFD"
rm unusedteams.txt
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
        echo "did NOT find $NO_TDASH_NAMESPACE in users and teams"
        echo $NAMESPACE >> unusedteams.txt
    fi

fi
done
