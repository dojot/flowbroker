FROM dojot/dredd-nodejs:8

RUN mkdir -p /opt/flowbroker/lib
RUN mkdir -p /opt/flowbroker/orchestrator
WORKDIR /opt/flowbroker

COPY ./lib/package.json ./lib
COPY ./orchestrator/package.json ./orchestrator

RUN cd /opt/flowbroker/lib && npm install
RUN cd /opt/flowbroker/orchestrator && npm install

COPY . /opt/flowbroker

ENTRYPOINT ["./tests/start-test.sh"]
