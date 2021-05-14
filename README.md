# Flowbroker

[![License badge](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Docker badge - flowbroker](https://img.shields.io/docker/pulls/dojot/flowbroker.svg)](https://hub.docker.com/r/dojot/flowbroker/)
[![Docker badge - flowbroker-context-manager](https://img.shields.io/docker/pulls/dojot/flowbroker-context-manager.svg)](https://hub.docker.com/r/dojot/flowbroker-context-manager/)
[![Build Status](https://travis-ci.org/dojot/flowbroker.svg?branch=development)](https://travis-ci.org/dojot/flowbroker)
[![CodeFactor](https://www.codefactor.io/repository/github/dojot/flowbroker/badge)](https://www.codefactor.io/repository/github/dojot/flowbroker)
[![DeepScan grade](https://deepscan.io/api/teams/2690/projects/3915/branches/36007/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=2690&pid=3915&bid=36007)

This repository contains the implementation to build data processing flows to perform a set of actions.

## What it does

A flow is a sequence of functional blocks (nodes) to process incoming particular events or device messages. With a flow you can dynamically analyze each new message in order to apply validations, infer information, trigger actions or notifications.

### Flowbroker Orchestrator

 There are many blocks (nodes) that are ready to use, in general these blocks can be divided into:

- **entry point**: blocks (nodes) that represent triggers to start a given flow. These blocks might be a device, a cron event, etc.
- **processing blocks**: blocks (nodes) that perform operations using the event. The blocks (nodes) might be: testing content for particular values or ranges, geo-positioning analysis, changing message attributes, perform operations on external elements, and so on.
- **exit point**: blocks (nodes) that represent where the resulting data should be forwarded to. These blocks might be a database, a virtual device, an external element, and so on.

The flowbroker orchestrator is implemented under the [`orchestrator`](./orchestrator) directory.

### Flowbroker Context Manager

The flowbroker context manager is a mechanism that allows a given set of data to persist beyond the life of the event, thus making it possible to store a state for the elements of the solution.

The flowbroker context manager is implemented under the [`contextManager`](./contextManager) directory.

### Flowbroker Library

The flowbroker library  that abstracts communication from the *orchestrator* to the nodes themselves (e.g. change, email) is implemented under the [`lib`](./lib) directory.

It's possible to create new blocks (nodes) using the **flowbroker library**, it will be explained in the following topics.

## Dependencies

The services dependencies are listed in the next topics.

- Dojot Services: They are dojot services
- Others Services: They are external services

### Flowbroker Orchestrator

#### Dojot Services

      - Auth
      - DeviceManager
      - DataBroker
      - Flowbroker-context-manager

#### Others Services

      - Kafka (tested using Kafka version 2.12)
      - RabbitMQ (tested using RabbitMQ version 3.7)
      - MongoDB (tested using MongoDB version 3.2)
      - Redis (tested using Redis version 5.0)

### Flowbroker Context manager

#### Others Services

      - Zookeeper (tested using Zookeeper version 3.4)

**Note:** The Flowbroker is based on the [Node-RED](https://nodered.org/) frontend, but uses its own engine to process the messages.

## Create a new block (node)

It's possible create news blocks (nodes) to extend the functionalities of flowbroker using the flowbroker [library](./lib) and `docker-compose` or `kubernetes`.
There are two examples and a guide in the [Flowbroker library](./lib), check for more details.

## **Running the service**

### **Configuration**

Before proceeding, **make sure you configure your environment**.

#### Flowbroker orchestrator

##### General configurations

Key                    | Purpose                       | Default Value      | Valid Values  |
---------------------- | ----------------------------- | -------------------| --------------|
AMQP_EVENT_QUEUE_N     | Number of event queues to be used    | 10  | natural number
AMQP_PREFIX_EVENT_QUEUE| RabbitMQ prefix of queues that map kafka messages in order to ensure order of tasks    | event_queue  | string
AMQP_PREFIX_TASK_QUEUE | RabbitMQ prefix of the queues that map the tasks to be performed, each block (node) can be seen as a task.   | task_queue  | string
AMQP_TASK_QUEUE_N      | Number of task queues to be used    | 10  | natural number
AMQP_URL               | RabbitMQ host address    | amqp://rabbitmq  | url
CONTEXT_MANAGER_ADDRESS| **Flowbroker context manager** hostname | flowbroker-context-manager | hostname
CONTEXT_MANAGER_PORT   | **Flowbroker context manager** port | 5556 | port
CONTEXT_MANAGER_RESPONSE_TIMEOUT | How long the client should wait for a response (to save/get a context). | 10000 | milliseconds
DEVICE_MANAGER_HOST    | Device Manager host address | http://device-manager:5000  | url
FLOWBROKER_CACHE_HOST  | Redis cache hostname        | flowbroker-redis   | Hostname
LOG_LEVEL              | Log level | info | info, warn, debug, error
MONGO_URL              | Mongo database's address    | mongodb://mongodb:27017  | url
REPLICA_SET            | Mongo database's replica set address  | None  | url

##### Remote node configurations

Key                    | Purpose                       | Default Value      | Valid Values  |
---------------------- | ----------------------------- | -------------------| --------------|
DEPLOY_ENGINE           | Choose the type of deployment. It will be used with remote nodes.           |  kubernetes  | "kubernetes" or "docker"
DOCKER_SOCKET_PATH      | The unix socket (TCP sockets to communicate with nodes running in Docker). It will be used with remote nodes when not using k8s. | /var/run/docker.sock | path
FLOWBROKER_NETWORK      | Docker network.  It will be used with remote nodes when not using k8s.       | dojot | string
KUBERNETES_SERVICE_HOST | Kubernetes service host (is automatically passed to services on the k8s)    | None  | hostname/ip
KUBERNETES_PORT_443_TCP_PORT |  Kubernetes service port  (is automatically passed to services on the k8s). It will be used with remote nodes.   | None  | port
KUBERNETES_TOKEN        | Credential (token) for service account, if nothing is passed it will be used the file at `/var/run/secrets/kubernetes.io/serviceaccount/token`.  It will be used with remote nodes.  | "" (empty string) | string token

##### Dojot Libraries configurations

In addition, some environment variables are used by dojot libraries that flowbroker uses.

Key                        | Purpose                                                     | Default Value
-------------------------- | ----------------------------------------------------------- | -----------------------------
AUTH_URL                   | Auth host address                                           | "http://auth:5000"
DATA_BROKER_URL            | Data Broker host address                                    | "http://data-broker"
DEVICE_MANAGER_URL         | Device Manager host address                                 | "http://device-manager:5000"
DOJOT_MANAGEMENT_TENANT    | Internal Management tenant | "dojot-management"
DOJOT_MANAGEMENT_USER      | Internal Management user  | "dojot-management"
DOJOT_SUBJECT_DEVICES      | Subject for device management messages                      | "dojot.device-manager.device"
DOJOT_SUBJECT_DEVICE_DATA  | Subject for device data messages                            | "device-data"
DOJOT_SUBSCRIPTION_HOLDOFF | Time (ms) before attempting to subscribe to a set of topics | 2500
DOJOT_SUBJECT_TENANCY      | Subject for tenancy messages                                | "dojot.tenancy"
KAFKA_GROUP_ID             | Kafka group ID for consumers                                | "kafka"
KAFKA_HOSTS                | List of Kafka instances                                     | "kafka:9092"

#### Flowbroker Context Manager

Key                    | Purpose                       | Default Value      | Valid Values  |
---------------------- | ----------------------------- | -------------------| --------------|
HOLD_LOCK_TIMEOUT | How long a client can hold a lock  | 10000 | milliseconds
LOG_LEVEL         | Log level | info | info, warn, debug, error
SERVICE_PORT      | Service port for change log level | 80 | port
WAIT_LOCK_TIMEOUT | How long a client can wait for a lock  | 30000 | milliseconds
ZEROMQ_PORT       | ZeroMQ port | 5556 | port
ZOOKEEPER_HOST    | Zookeeper hostname | zookeeper | hostname/IP
ZOOKEEPER_PORT    | Zookeeper port | 2181 | port

# How to run

Beforehand, you need an already running dojot instance in your machine. Check out the
[dojot documentation](https://dojotdocs.readthedocs.io)
for more information on installation methods.

Generate the Dockers images:

```shell
docker build -t <username>/flowbroker:<tag> -f orchestrator.docker .
docker build -t <username>/flowbroker-context-manager:<tag> -f contextManager.docker .
```

Then the images tagged as `<username>/flowbroker:<tag>` and  `<username>/flowbroker-context-manager:<tag>` will be made available. You can send it to
your DockerHub registry to made it available for non-local dojot installations:

```shell
docker push <username>/flowbroker:<tag>
docker push <username>/flowbroker-context-manager:<tag>
```

__NOTE THAT__  you can use the official images provided by dojot in its  [DockerHub page](https://hub.docker.com/r/dojot/).

This code has been developed and tested using node v8.14.x

# Documentation

- [Development API docs](https://dojot.github.io/flowbroker/apiary_development.html)
- [Latest API docs](https://dojot.github.io/flowbroker/apiary_latest.html)
- [Latest Tutorial Using flow builder](https://dojotdocs.readthedocs.io/en/latest/flow.html)

# Issues and help

If you found a problem or need help, leave an issue in the main
[dojot repository](https://github.com/dojot/dojot) and we will help you!
