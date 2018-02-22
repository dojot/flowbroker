# Mashup invoker proof of concept

This repository contains the implementation for a replacement for dojot's flow/mashup
processor, based on nodes that run as persistent services on the platform.

The idea here is to run each known processing node (switch, change, geo, email, etc) as a container
(or set of containers) and have the mashup orchestrator invoke a *stateless* endpoint on such
containers, chaining their responses to produce the final flow results.

## Implementation

 - The orchestrator itself is implemented under the directory `orchestrator`.
 - The library that abstracts communication from the *orchestrator* to the nodes themselves (e.g.
change, email) is implemented under `lib`
 - A sample node implementation is found under `sampleNode`.

This code has been developed and tested using node v8.9.x

## How to build (orchestrator)

```shell
cd orchestrator
npm install
```

## Running

```shell
node index.js [options]
```

To run as a server:

```shell
node index.js -s
```

To run a message against a flow (sample):

```shell
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

```shell
# -- on host --
docker-compose -p flows -f compose.yaml up -d

# spawn flowbroker within the same network
docker run --rm -it --network flows_default -v $PWD:/flowbroker node:8 bash

# -- now, within the container --
cd /flowbroker/orchestrator
npm install
node index.js -v -m '{"temperature": 22.5}' -d '18a9' -f ../docs/samples/flow.json -i 1000
```
