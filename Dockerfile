FROM node:8-alpine

RUN mkdir -p /opt/flowbroker
WORKDIR /opt/flowbroker/orchestrator
CMD ["node", "index.js", "-w", "1", "-s"]


COPY . /opt/flowbroker
RUN apk --no-cache add gcc g++ musl-dev make python
RUN cd /opt/flowbroker/lib && npm install
RUN cd /opt/flowbroker/orchestrator && npm install
RUN apk --no-cache del gcc g++ musl-dev make python

