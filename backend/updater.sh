#!/bin/bash

while true :
do
    sleep 86600
    apt-get update -o=Dpkg::Use-Pty=0
    NEED_UPDATE1=`apt search node 2>&1  | grep upgradable | wc -l`;
    if [ "$NEED_UPDATE1" == 1 ]; then
        echo "node UPGRADE...";
        sudo apt-get install -o=Dpkg::Use-Pty=0 -y node
    fi;
    cd /backend/src && npm audit fix
done
