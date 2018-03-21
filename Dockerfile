from node:8

RUN mkdir -p /opt/flowbroker

ADD . /opt/flowbroker

WORKDIR /opt/flowbroker/orchestrator
RUN cd /opt/flowbroker/lib && npm install
RUN cd /opt/flowbroker/orchestrator && npm install

CMD ["node", "index.js", "-w", "1", "-s"]
