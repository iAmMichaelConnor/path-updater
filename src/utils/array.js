/**
 * E.g. given arr1 = [1, 2, 3], arr2 = ['a', 'b', 'c'],
 * returns the zipped array of arrays [[1, 'a'], [2, 'b'], [3, 'c']]
 * @returns {Array}
 */
const zip = (arr1, arr2) => arr1.map((v, i) => [v, arr2[i]]);

const removeDuplicates = arr => arr.filter(function (item, pos, self) {
    return self.indexOf(item) == pos;
})

// remove duplicates from array of arrays:
// (this one is copy-pasta)
const removeDuplicatesArrayofArrays = arr => arr.filter((t = {}, a => !(t[a] = a in t)));

module.exports = { zip, removeDuplicates, removeDuplicatesArrayofArrays };