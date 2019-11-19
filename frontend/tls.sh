#!/bin/bash

. /home/admin/rc.conf

if [[ ! -f /frontend/tls/dhparam.pem ]]; then
  openssl dhparam -out /frontend/tls/dhparam.pem 2048
fi

if [[ ! -f /frontend/tls/server-cert.pem ]]; then

  echo GEN TLS CERT $TLS

  openssl genrsa 2048 > /frontend/tls/ca-key.pem
  openssl req -new -x509 -nodes -days 9999 -subj "$TLS" -key \
    /frontend/tls/ca-key.pem -out /frontend/tls/ca.pem

  openssl req -newkey rsa:2048 -days 9999 -subj "$TLS" -nodes \
    -keyout /frontend/tls/server-key.pem -out /frontend/tls/server-req.pem

  openssl rsa -in /frontend/tls/server-key.pem \
    -out /frontend/tls/server-key.pem
  openssl x509 -req -in /frontend/tls/server-req.pem -days 9999 -CA /frontend/tls/ca.pem \
    -CAkey /frontend/tls/ca-key.pem -set_serial 01 -out /frontend/tls/server-cert.pem

  openssl req -newkey rsa:2048 -days 9999 -subj "$TLS" -nodes \
    -keyout /frontend/tls/client-key.pem -out /frontend/tls/client-req.pem

  openssl rsa -in /frontend/tls/client-key.pem \
    -out /frontend/tls/client-key.pem

  openssl x509 -req -in /frontend/tls/client-req.pem -days 9999 -CA /frontend/tls/ca.pem \
    -CAkey /frontend/tls/ca-key.pem -set_serial 02 -out /frontend/tls/client-cert.pem

  openssl x509 -in /frontend/tls/client-cert.pem -text -noout | grep 'Subject:'

fi
