FROM debian:latest
MAINTAINER Wendel <wendel@bitex.gg>
ENV DEBIAN_FRONTEND noninteractive
ENV LANG C.UTF-8
ENV DEBIAN_FRONTEND noninteractive
ENV TZ="America/Sao_Paulo" TERM="linux"

RUN apt-get update -o=Dpkg::Use-Pty=0 && \
    apt-get install -o=Dpkg::Use-Pty=0  -y  \
    inotify-tools nginx sudo

RUN useradd -o -m -u 1000 -d /home/admin -s /bin/bash admin && \
    mkdir -p /home/admin && \
    chmod 700 /home/admin && \
    chown -R 1000:1000 /home/admin && \
    echo "admin ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/admin && \
    /bin/rm /etc/nginx/sites-enabled/*

WORKDIR /home/admin
ENV HOME /home/admin
ENV USERNAME admin
ENV USER admin

COPY rc.sh /home/admin/rc.sh
COPY run.sh /home/admin/run.sh
COPY updater.sh /home/admin/updater.sh
COPY .env /home/admin/rc.conf
RUN chmod 500 /home/admin/rc.sh /home/admin/rc.conf /home/admin/run.sh /home/admin/updater.sh && \
    chown -R 1000:1000 /home/admin/*.sh /home/admin/*.conf

USER admin
CMD ["bash","-c",". /home/admin/rc.sh" ]
