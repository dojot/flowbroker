"use strict";

let config = {
    redis: {
        url: process.env.FLOWBROKER_CACHE_HOST || "flowbroker-redis"
    },
    deviceManager: {
        url: process.env.DEVICE_MANAGER_HOST || "http://device-manager:5000"
    },
    mongodb: {
        url: process.env.MONGO_URL || "mongodb://mongodb:27017",
        opt: {
            connectTimeoutMS: 2500,
            reconnectTries: 100,
            reconnectInterval: 2500,
            autoReconnect: true,
            replicaSet: process.env.REPLICA_SET
        }
    },
    dataBroker: {
        url: process.env.DATA_BROKER_URL || "http://data-broker:80"
    },
    amqp: {
        url: process.env.AMQP_URL || "amqp://rabbitmq?heartbeat=60",
        task_queue_prefix: process.env.AMQP_PREFIX_TASK_QUEUE || "task_queue",
        task_queue_n: process.env.AMQP_TASK_QUEUE_N || 10,
        event_queue_prefix: process.env.AMQP_PREFIX_EVENT_QUEUE || "event_queue",
        event_queue_n: process.env.AMQP_EVENT_QUEUE_N || 10,
        maxTimeToRetryReconnection: process.env.AMQP_MAX_TIME_RETRY_RECONNECT || 180,
        initialTimeToRetryReconnection: process.env.AMQP_INITIAL_TIME_RETRY_RECONNECT || 2
    },
    deploy: {
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
    contextManager: {
        contextManagerAddress: process.env.CONTEXT_MANAGER_ADDRESS || "flowbroker-context-manager",
        contextManagerPort: process.env.CONTEXT_MANAGER_PORT || 5556,
        responseTimeout: process.env.CONTEXT_MANAGER_RESPONSE_TIMEOUT || 10000
    },
    kafkaMessenger: {
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
            },
            dojot: {
                subscriptionHoldoff: Number(process.env.DOJOT_SUBSCRIPTION_HOLDOFF) || 2500,
                timeoutSleep: 5,
                connectionRetries: 5
            }
        },
        databroker: {
            url: process.env.DATA_BROKER_URL || "http://data-broker",
            timeoutSleep: 5,
            connectionRetries: 5
        },
        auth: {
            url: process.env.AUTH_URL || "http://auth:5000",
            timeoutSleep: 5,
            connectionRetries: 5
        },
        deviceManager: {
            url: process.env.DEVICE_MANAGER_URL || "http://device-manager:5000",
            timeoutSleep: 5,
            connectionRetries: 5
        },
        dojot: {
            management: {
                user: process.env.DOJOT_MANAGEMENT_USER || "dojot-management",
                tenant: process.env.DOJOT_MANAGEMENT_TENANT || "dojot-management"
            },
            managementService: process.env.DOJOT_SERVICE_MANAGEMENT || "dojot-management",
            subjects: {
                tenancy: process.env.DOJOT_SUBJECT_TENANCY || "dojot.tenancy",
                devices: process.env.DOJOT_SUBJECT_DEVICES || "dojot.device-manager.device",
                deviceData: process.env.DOJOT_SUBJECT_DEVICE_DATA || "device-data",
                notification: process.env.DOJOT_SUBJECT_NOTIFICATIONS || "dojot.notifications",
                ftp: process.env.DOJOT_SUBJECT_FTP || "dojot.ftp"
            },
            events: {
                tenantEvent: {
                    NEW_TENANT: "new-tenant",
                    DELETE_TENANT: "delete-tenant"
                },
                tenantActionType: {
                    CREATE: "create",
                    DELETE: "delete"
                }
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
    },
    language: {
        //language supported by flowBroker
        supportedLanguages: ["pt-BR", "en-US"],
        //map of similar language, like pt is similar to pt-pt and pt
        //default its the default language when anyone of listed language are found
        mapSimilarLanguage: {
            "pt": "pt-BR",
            "pt-pt": "pt-BR",
            default: "en-US"
        }
    },
    taskProcessing: {
        taskTimeout: process.env.TASK_TIMEOUT || 30000, // time in ms
        workers: process.env.WORKERS || 1
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info' // it could be error, warn, info or debug
    }
};

/**
 * This function appends a base object with properties related to the kafka.
 * Every property in the env parameter will be appended in the baseObj parameter
 * with the following rules:
 * - properties with the prefix 'kafka_producer_' will be appended to the baseObj as
 * kafka.producer.<...>
 * - properties with the prefix 'kafka_consumer_' will be appended to the baseObj as
 * kafka.consumer.<...>
 * @param {*} baseObj a base object to be appended
 * @param {*} env a dictionary with the configurations
 */
function _setKafkaConfiguration(baseObj, env) {
    if (!baseObj.kafka) {
        baseObj.kafka = {};
    }
    if (!baseObj.kafka.producer) {
        baseObj.kafka.producer = {};
    }
    if (!baseObj.kafka.consumer) {
        baseObj.kafka.consumer = {};
    }

    let keys = Object.keys(env);
    for (let i = 0; i < keys.length; ++i) {
        let key = keys[i];
        let keyNormalized = key.toLowerCase();
        let value = env[key];
        if (keyNormalized.startsWith("kafka_producer_")) {
            // removes the prefix and replaces the '_' by '.'
            let newKey = keyNormalized.substring(15).replace(/_/g, '.');

            baseObj.kafka.producer[newKey] = isNaN(value) ? value : Number(value);
        } else if (keyNormalized.startsWith("kafka_consumer_")) {
            // removes the prefix and replaces the '_' by '.'
            let newKey = keyNormalized.substring(15).replace(/_/g, '.');
            baseObj.kafka.consumer[newKey] = isNaN(value) ? value : Number(value);
        }
    }
}

_setKafkaConfiguration(config.kafkaMessenger, process.env);


module.exports = config;