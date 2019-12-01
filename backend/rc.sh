#!/bin/bash
#set -e
#set -x

/backend/tls.sh

/home/admin/updater.sh &

#!/bin/bash
cd /backend/src && npm i

if [[ -d /bitex.gg ]]; then
  rm -rf /backend/src/node_modules/bitex.gg
  cp -Rp /bitex.gg /backend/src/node_modules/bitex.gg
fi

while true :
do
    #cd /backend/src && forever -w index.js
    cd /backend/src && nodemon index.js
    sleep 5
done
