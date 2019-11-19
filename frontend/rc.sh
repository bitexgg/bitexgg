#!/bin/bash
#set -e
#set -x

/frontend/tls.sh

/home/admin/updater.sh &

cd /frontend/sites-enabled && sudo find . -type f -name \*.conf -exec /frontend/tpl.sh {} \;

/home/admin/run.sh &

while true :
do
    /usr/bin/inotifywait --quiet --event CLOSE_WRITE /frontend/sites-enabled
    cd /frontend/sites-enabled && sudo find . -type f -name \*.conf -exec /frontend/tpl.sh {} \;
    if sudo nginx -t ; then
        echo "RELOAD"
        sudo nginx -s reload
    else
        echo "IGNORE CONFIG ERROR"
    fi
    sleep 5
done


