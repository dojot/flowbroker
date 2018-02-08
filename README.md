# Mashup invoker proof of concept

This repository contains a simple implementation for a replacement for dojot's flow/mashup
processor, based on nodes that run as persistent services on the platform.

The idea here is to run each known processing node (switch, change, geo, email, etc) as a container
(or set of containers) and have the mashup orchestrator invoke a *stateless* endpoint on such
containers, chaining their responses to produce the final flow results.

## Implementation

The implementation for the proof of concept is on `_flow.js`. In there, two approaches were
tested.

The first uses promises to implement a "node-red" like alternative, thus limiting the execution of
any given flow (i.e. message trigger) to the process that started its processing. While this does
have the best throughput, it has the downside of invalidating the whole flow, should any of its
steps fail.

A second approach is based on amqp (rabbitmq) to achieve better task distribution. In this mode
each message is placed at an amqp queue, and the set of workers consume from there, triggering
the remote node that implements the processing step and eventually placing its results back on the
queue, to be processed at a later time. Having the extra layer of messaging takes its toll on the
perceived latency and overall throughput of the implementation, but allows for better workload
management.

For the tests, a single node implementation was made available at `_dummy.js`. It does nothing
but wait for an arbitrary time, and return the message with an extra field informing that the
message's gone through it.


## How to use

```shell
npm install
docker build -f sampleNode/worker.docker -t mashup/worker .
docker-compose -f compose.yaml up -d
```

That does not start any orchestrator instance. To do so:

```shell
docker run --rm -it --network dojotflowbroker_default -v $PWD:/opt node:4 bash

# then, within the container
cd /opt
# to start an amqp worker:
node _flow.js amqp_worker
# to start an amqp publisher:
node _flow.js amqp_prod
# to run the promise-based PoC
node _flow.js local
```
