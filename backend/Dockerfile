FROM debian:latest
MAINTAINER Wendel <wendel@bitex.gg>
ENV DEBIAN_FRONTEND noninteractive
ENV LANG C.UTF-8
ENV DEBIAN_FRONTEND noninteractive
ENV TZ="America/Sao_Paulo" TERM="linux"

RUN apt-get update -o=Dpkg::Use-Pty=0 && \
    apt-get install -o=Dpkg::Use-Pty=0  -y  \
    inotify-tools nodejs npm sudo && \
    npm install -g forever

RUN useradd -o -m -u 1000 -d /home/admin -s /bin/bash admin && \
    mkdir -p /home/admin && \
    chmod 700 /home/admin && \
    chown -R 1000:1000 /home/admin

WORKDIR /home/admin
ENV HOME /home/admin
ENV USERNAME admin
ENV USER admin

COPY rc.sh /home/admin/rc.sh
COPY updater.sh /home/admin/updater.sh
COPY .env /home/admin/rc.conf
RUN chmod 500 /home/admin/rc.sh /home/admin/updater.sh && \
    chown -R 1000:1000 /home/admin/*.sh /home/admin/*.conf

USER admin
CMD ["bash","-c",". /home/admin/rc.sh" ]
