FROM node:8

WORKDIR /opt
RUN npm set registry http://10.202.21.25:4873
COPY package.json .
RUN npm install

COPY src ./src
CMD ["node", "src/index.js"]
