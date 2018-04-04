FROM dojot/dredd-nodejs:8

RUN mkdir -p /opt/flowbroker

COPY . /opt/flowbroker

WORKDIR /opt/flowbroker
RUN cd /opt/flowbroker/lib && npm install
RUN cd /opt/flowbroker/orchestrator && npm install

CMD ["./tests/start-test.sh"]
