"use strict";

var hooks = require("hooks");

function validateHTML(transaction) {
    // Always skip body validation - it should be a HTML
    transaction.real.body = transaction.expected.body;
}


hooks.beforeValidation('NodeRED nodes > Retrieve all nodes > Example 2', validateHTML);