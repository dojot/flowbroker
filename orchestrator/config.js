"use strict";

module.exports = {
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

    'kafka': {
        kafkaHost: process.env.KAFKA_HOST || "kafka:9092",
        sessionTimeout: process.env.KAFKA_SESSION_TIMEOUT || "15000",
        groupId: process.env.KAFKA_GROUP_ID || ('iotagent-' + Math.floor(Math.random() * 10000))
    },

    'dataBroker': {
        url: process.env.DATA_BROKER_URL || "http://data-broker:80"
    },

    'amqp': {
        url: process.env.AMQP_URL || "amqp://rabbitmq",
        queue: process.env.AMQP_QUEUE || "task_queue"
    },

    'ingestion': {
        subject: process.env.INGESTION_SUBJECT || "device-data"
    },

    'tenancy': {
        subject: process.env.TENANCY_SUBJECT || "dojot.tenancy",
        manager: process.env.TENANCY_MANAGER || "http://auth:5000"
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
    }
};