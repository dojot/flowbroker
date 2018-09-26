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
        queue: process.env.AMQP_QUEUE || "task_queue"
    },

    'deploy': {
        engine: process.env.DEPLOY_ENGINE || "kubernetes",
        kubernetes: {
            url: `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_PORT_443_TCP_PORT}`,
            token: process.env.KUBERNETES_TOKEN || ""
        },
        docker: {
            socketPath: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock"
        }
    },

    'contextManager': {
        contextManagerAddress: process.env.CONTEXT_MANAGER_ADDRESS || "flowbroker-context-manager",
        contextManagerPort: process.env.CONTEXT_MANAGER_PORT || 5556,
        responseTimeout: process.env.CONTEXT_MANAGER_RESPONSE_TIMEOUT || 10000
    }
};
