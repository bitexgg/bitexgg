#!/bin/bash
#set -x

. /home/admin/rc.conf

while read line; do
    export $line
done < /home/admin/rc.conf
export FILE_IN=/frontend/sites-enabled/$1
export FILE_OUT=/etc/nginx/sites-enabled/$1
#echo "< $FILE_IN > $FILE_OUT"
perl -p -e 's/\$\{([^}]+)\}/defined $ENV{$1} ? $ENV{$1} : $&/eg' < $FILE_IN > $FILE_OUT
