const winston = require("winston");


module.exports = {
  logger: winston.createLogger({
    level: 'debug',
    format: winston.format.combine(winston.format.splat(), winston.format.simple()),
    transports: [
      new winston.transports.Console()
    ]
  })
};