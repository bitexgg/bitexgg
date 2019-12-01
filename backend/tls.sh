#!/bin/bash

. /home/admin/rc.conf

mkdir -p /backend/tls || exit 1

if [[ ! -f /backend/tls/dhparam.pem ]]; then
  openssl dhparam -out /backend/tls/dhparam.pem 2048
fi

if [[ ! -f /backend/tls/server-cert.pem ]]; then

  echo GEN TLS CERT $TLS

  openssl genrsa 2048 > /backend/tls/ca-key.pem
  openssl req -new -x509 -nodes -days 9999 -subj "$TLS" -key \
    /backend/tls/ca-key.pem -out /backend/tls/ca.pem

  openssl req -newkey rsa:2048 -days 9999 -subj "$TLS" -nodes \
    -keyout /backend/tls/server-key.pem -out /backend/tls/server-req.pem

  openssl rsa -in /backend/tls/server-key.pem \
    -out /backend/tls/server-key.pem
  openssl x509 -req -in /backend/tls/server-req.pem -days 9999 -CA /backend/tls/ca.pem \
    -CAkey /backend/tls/ca-key.pem -set_serial 01 -out /backend/tls/server-cert.pem

  openssl req -newkey rsa:2048 -days 9999 -subj "$TLS" -nodes \
    -keyout /backend/tls/client-key.pem -out /backend/tls/client-req.pem

  openssl rsa -in /backend/tls/client-key.pem \
    -out /backend/tls/client-key.pem

  openssl x509 -req -in /backend/tls/client-req.pem -days 9999 -CA /backend/tls/ca.pem \
    -CAkey /backend/tls/ca-key.pem -set_serial 02 -out /backend/tls/client-cert.pem

  openssl x509 -in /backend/tls/client-cert.pem -text -noout | grep 'Subject:'

fi
