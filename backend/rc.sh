#!/bin/bash
#set -e
#set -x

/backend/tls.sh

/home/admin/updater.sh &

#!/bin/bash

while true :
do
    cd /backend/src && forever -w index.js
    sleep 5
done
