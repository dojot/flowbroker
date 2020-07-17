const config = require('./config');

/**
 * Calculates based on the device id in which queue processing should take place in rabbitmq
 * @param {String} deviceID in hexadecimal
 * @returns {Number} queue number
 */
const calculateQueue = (deviceID) => (parseInt(deviceID, 16) % config.amqp.queue_n || 0);

module.exports = { calculateQueue }