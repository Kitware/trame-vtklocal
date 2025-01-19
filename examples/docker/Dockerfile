FROM --platform=linux/amd64 kitware/trame:py3.10

RUN apt-get update \
 && apt-get install -y libosmesa6-dev libxrender1 \
 && rm -rf /var/lib/apt/lists/*

RUN apt-get install -y libosmesa6-dev libxrender1

COPY --chown=trame-user:trame-user . /deploy

RUN /opt/trame/entrypoint.sh build