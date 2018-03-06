from node:8

RUN mkdir -p /opt/flowbroker

ADD . /opt/flowbroker

WORKDIR /opt/flowbroker/orchestrator
RUN npm install

CMD ["node", "api.js"]
