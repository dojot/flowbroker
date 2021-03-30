var hooks = require("hooks");

function generate_token() {
    'use strict';
    return ("Bearer " + new Buffer('dummy jwt schema').toString('base64')) +
            '.' + (new Buffer(JSON.stringify({'service': 'admin', 'username': 'admin'})).toString('base64')) +
            '.' + (new Buffer('dummy signature').toString('base64'));

}

hooks.beforeEach(function (transaction, done) {
    'use strict';
    // Generate token
    if (transaction.hasOwnProperty('request') &&
            transaction.request.hasOwnProperty('headers') &&
            transaction.request.headers.hasOwnProperty('Authorization33333')) {
        transaction.request.headers.Authorization = generate_token();
    }
    done();
});
