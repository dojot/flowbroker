FROM node:8.14.0-alpine as basis

WORKDIR /opt/flowbroker/contextManager

RUN apk --no-cache add gcc g++ musl-dev make python bash zlib-dev

COPY contextManager/package.json ./package.json
COPY contextManager/package-lock.json ./package-lock.json
RUN npm install


FROM node:8.14.0-alpine
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

COPY --from=basis /opt/flowbroker/contextManager /opt/flowbroker/contextManager
WORKDIR /opt/flowbroker/contextManager
COPY contextManager ./src

CMD ["node", "src/index.js"]
