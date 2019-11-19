#!/bin/bash

while true :
do
    sleep 86600
    apt-get update -o=Dpkg::Use-Pty=0
    NEED_UPDATE1=`apt search nginx 2>&1  | grep upgradable | wc -l`;
    if [ "$NEED_UPDATE1" == 1 ]; then
        echo "nginx UPGRADE...";
        sudo apt-get install -o=Dpkg::Use-Pty=0 -y nginx
        sudo kill -9 $(pidof nginx)
    fi;
done
