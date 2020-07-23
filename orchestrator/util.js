const config = require('./config');

/**
 * Calculates based on the device id in which queue processing should take place in rabbitmq
 * @param {String} deviceID in hexadecimal
 * @returns {Number} queue number
 */
const calculateQueue = (deviceID, queueNumber = 1) => (parseInt(deviceID, 16) % queueNumber || 0);

module.exports = { calculateQueue }