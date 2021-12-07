/**
 * Converts a decimal number to a binary array
 * @param {number} n - decimal number
 * @returns {Array[number]} - binary decomposition of n (lsb at 0th index)
 * (So 6 = 110 = [0, 1, 1])
 */
function decToBin(n) {
    let a = Array();
    let i = 0;
    for (i; n > 0; i++) {
        a[i] = n % 2;
        n = parseInt(n / 2);
    }
    return a;
}

/**
 * Converts a binary array to a decimal number
 * @param {Array[number]} binArr - a little-endian array of 1s & 0s
 * (So 6 = 110 = [0, 1, 1])
 * @returns {number}
 */
function binToDec(binArr) {
    let n = 0;
    for (i = 0; i < binArr.length; i++) {
        if (binArr[i]) {
            n += 2 ** i;
        }
    }
    return n;
}

/**
 * Calculates floor(log_2(n))
 * @param {number} n - a natural number
 * @returns {number}
 */
function floorLog2(n) {
    if (n < 0) {
        throw new Error(`Invalid input ${n}`);
    }
    if (n == 0) {
        return -1; // mathematically incorrect, but works nicely for our purposes.
    }
    const bin = decToBin(n);
    const index = bin.length - 1;
    return index;
}

/**
utility function to remove a leading 0x on a string representing a hex number.
If no 0x is present then it returns the string un-altered.
*/
function strip0x(hex) {
    if (typeof hex === 'undefined') return '';
    if (typeof hex === 'string' && hex.indexOf('0x') === 0) {
        return hex.slice(2).toString();
    }
    return hex.toString();
}

/**
utility function to check that a string has a leading 0x (which the Solidity
compiler uses to check for a hex string).  It adds it if it's not present. If
it is present then it returns the string unaltered
*/
function ensure0x(hex = '') {
    const hexString = hex.toString();
    if (typeof hexString === 'string' && hexString.indexOf('0x') !== 0) {
        return `0x${hexString}`;
    }
    return hexString;
}

module.exports = {
    decToBin,
    binToDec,
    floorLog2,
    strip0x,
    ensure0x,
};