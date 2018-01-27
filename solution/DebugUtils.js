'use strict';

/**
 * полезные утилиты
 */
const DEBUG_ON = false;
let nodeUtil = require('util');

function var_dump(variable) {
    if (DEBUG_ON) {
        console.log(nodeUtil.inspect(variable, {showHidden: true, depth: null, colors: true}));
    }
}

module.exports = {var_dump};
