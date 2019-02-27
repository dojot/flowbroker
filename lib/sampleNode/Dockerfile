FROM node:8

WORKDIR /opt

COPY package.json .
RUN npm install

COPY src ./src
CMD ["node", "src/index.js"]
