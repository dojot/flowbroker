"use strict";

module.exports = {

    'redis': {
        url: process.env.FLOWBROKER_CACHE_HOST || "flowbroker-redis"
    },

    'deviceManager': {
        url: process.env.DEVICE_MANAGER_HOST || "http://device-manager:5000"
    },

    'mongodb': {
        url: process.env.MONGO_URL || "mongodb://mongodb:27017",
        opt: {
            connectTimeoutMS: 2500,
            reconnectTries: 100,
            reconnectInterval: 2500,
            autoReconnect: true,
            replicaSet: process.env.REPLICA_SET
        }
    },

    'dataBroker': {
        url: process.env.DATA_BROKER_URL || "http://data-broker:80"
    },

    'amqp': {
        url: process.env.AMQP_URL || "amqp://rabbitmq",
        queue: process.env.AMQP_QUEUE || "task_queue",
        event_queue: process.env.AMQP_EVENT_QUEUE || "event_queue"
    },

    'deploy': {
        engine: process.env.DEPLOY_ENGINE || "kubernetes",
        kubernetes: {
            url: `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_PORT_443_TCP_PORT}`,
            token: process.env.KUBERNETES_TOKEN || ""
        },
        docker: {
            socketPath: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock",
            network: process.env.FLOWBROKER_NETWORK || "dojot"
        }
    },

    'contextManager': {
        contextManagerAddress: process.env.CONTEXT_MANAGER_ADDRESS || "flowbroker-context-manager",
        contextManagerPort: process.env.CONTEXT_MANAGER_PORT || 5556,
        responseTimeout: process.env.CONTEXT_MANAGER_RESPONSE_TIMEOUT || 10000
    },

    'kafkaMessenger' : {
        kafka: {
            producer: {
                "metadata.broker.list": process.env.KAFKA_HOSTS || "kafka:9092",
                "compression.codec": "gzip",
                    "retry.backoff.ms": 200,
                    "message.send.max.retries": 10,
                    "socket.keepalive.enable": true,
                    "queue.buffering.max.messages": 100000,
                    "queue.buffering.max.ms": 100,
                    "batch.num.messages": 1000000,
                    "dr_cb": true
                },

                consumer: {
                    "group.id": process.env.KAFKA_GROUP_ID || "flowbroker",
                    "metadata.broker.list": process.env.KAFKA_HOSTS || "kafka:9092"
                }
            },
            databroker: {
              host: process.env.DATA_BROKER_URL || "http://data-broker",
            },
            auth: {
              host: process.env.AUTH_URL || "http://auth:5000",
            },
            deviceManager: {
              host: process.env.DEVICE_MANAGER_URL || "http://device-manager:5000",
            },
            dojot: {
              managementService: process.env.DOJOT_SERVICE_MANAGEMENT || "dojot-management",
              subjects: {
                tenancy: process.env.DOJOT_SUBJECT_TENANCY || "dojot.tenancy",
                devices: process.env.DOJOT_SUBJECT_DEVICES || "dojot.device-manager.device",
                deviceData: process.env.DOJOT_SUBJECT_DEVICE_DATA || "device-data"
              }
            }
        },

        healthChecker: {
            timeout: {
              uptime: process.env.HC_UPTIME_TIMEOUT || 300000,
              memory: process.env.HC_MEMORY_USAGE_TIMEOUT || 300000,
              cpu: process.env.HC_CPU_USAGE_TIMEOUT || 300000,
              mongodb: process.env.HC_MONGODB_TIMEOUT || 30000,
              kafka: process.env.HC_KAFKA_TIMEOUT || 30000
            }
        }
};
