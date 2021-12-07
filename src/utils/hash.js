const crypto = require('crypto');
const { ZERO } = require('../config');
const { strip0x } = require('./number');

// Obviously we won't use sha256, but all this code is for example's sake.
function shaHash(...items) {
    const concatValue = items.map(strip0x).reduce((acc, item) => acc + item);
    const h = `0x${crypto
        .createHash('sha256')
        .update(concatValue, 'hex')
        .digest('hex')}`;
    return h;
}

function concatenateThenHash(left, right) {
    if (left == ZERO && right == ZERO) {
        return ZERO;
    }
    return shaHash(...[left, right]);
}

// For experimentation
const timeHashes = n => {
    let hash = '0x01'
    console.time('hash timer');
    for (i = 0; i < n; i++) {
        hash = concatenateThenHash(hash, hash);
    }
    console.timeEnd('hash timer');
}

module.exports = { concatenateThenHash, timeHashes };