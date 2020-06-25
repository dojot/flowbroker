# Mashup invoker proof of concept

This repository contains the implementation for a replacement for dojot's flow/mashup
processor, based on nodes that run as persistent services on the platform.

The idea here is to run each known processing node (switch, change, geo, email, etc) as a container
(or set of containers) and have the mashup orchestrator invoke a _stateless_ endpoint on such
containers, chaining their responses to produce the final flow results.

## Implementation

- The orchestrator itself is implemented under the directory `orchestrator`.
- The library that abstracts communication from the _orchestrator_ to the nodes themselves (e.g.
  change, email) is implemented under `lib`
- A sample node implementation is found under `sampleNode`.

This code has been developed and tested using node v8.9.x

## How to build (orchestrator)

```bash
cd orchestrator
npm install
```

## Running

```bash
node index.js [options]
```

To run as a server:

```bash
node index.js -s
```

To run a message against a flow (sample):

```bash
node index.js -v -m '{"temperature": 22.5}' -d '18a9' -f flow.json -i 1000
```

This allows a processing node developer to easily test a node when used alongside the broker.
For a sample flow definition file, check `docs/samples/flow.json`.

All the commands above will require at least a running, reachable instance of RabbitMQ at the
hostname `amqp`.

To quickly create an environment using docker-compose, one may use the compose file (`compose.yaml`).
For now, remember that any installed nodes must be added manually to the compose file or else the
orchestrator will not be able to reach them. (developers) To allow quick prototyping and validation
of the flow broker, a raw `node:8` container is used, with the project's homedir mounted into it.

```bash
# -- on host --
docker-compose -p flows -f compose.yaml up -d

# spawn flowbroker within the same network
docker run --rm -it --network flows_default -v $PWD:/flowbroker node:8 bash

# -- now, within the container --
cd /flowbroker/orchestrator
npm install
node index.js -v -m '{"temperature": 22.5}' -d '18a9' -f ../docs/samples/flow.json -i 1000
```

## Making your own image and testing

You can easily make improvements and create your own image, just do the following steps.

```bash
# Fork the project
# Clone your repository
computer@name:~/ git clone https://github.com/UserName/flowbroker

# Enter the "flowbroker" folder
computer@name:~/ cd flowbroker

# From now on it is possible to make several changes and improvements to the project.
# When you are ready to generate your orchestrator image, do:
computer@name:~/flowbroker docker build -t anyName-flowbroker:vX.X.X -f orchestrator.docker .

# If your changes are made in the contexManager, do:
computer@name:~/contextManager docker build -t anyName-contextManger:vX.X.X -f contextManager.docker .
```

To replace an original image with your access to docker-compose.yml
Your docker-compose.yml should look like this:

```yml
# ...
flowbroker:
  image: anyName-contextManger:vX.X.X
  restart: always
  environment:
    DEPLOY_ENGINE: "docker"
    FLOWBROKER_NETWORK: ${FLOWBROKER_NETWORK}
    DOJOT_MANAGEMENT_USER: "flowbroker"
    KAFKA_GROUP_ID: "flowbroker-group"
    LOG_LEVEL: "debug"
  depends_on:
    - rabbitmq
    - kafka
    - mongodb
    - auth
    - flowbroker-context-manager
    - flowbroker-redis
  networks:
    - default
    - flowbroker
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:Z
# ...
```

Then,

```bash
# Make a docker-compose up
computer@name:~/docker-compose/ docker-compose up -d
```
