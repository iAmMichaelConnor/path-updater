/**
 * @fileoverview
 * For each new batch of leaves which gets added to the tree,
 * the aim of this file is to tell you which updated nodes of the tree actually need to be stored, 
 * so as to maintain an up-to-date sibling path for each leaf you own.
 * 
 * Terminology:
 * leafIndex: count from 0
 * level (of the tree): the leaves are at level 0
 */

const { removeDuplicatesArrayofArrays } = require("./utils/array");
const { decToBin, floorLog2 } = require("./utils/number");


/// MAIN FUNCTIONS

/**
 * Given an owned leaf, when inserting the leaf at newLeafIndex, an element of the
 * owned leaf's sibling path will be changed. This function returns the level
 * (in the tree) of the node in the sibling path which will change.
 * @param {number} ownedLeafIndex 
 * @param {number} newLeafIndex 
 * @returns 
 */
function levelToUpdate(ownedLeafIndex, newLeafIndex) {
    let i = ownedLeafIndex;
    let j = newLeafIndex;
    if (i == j) return 0;
    const fl2i = floorLog2(i);
    const fl2j = floorLog2(j);
    if (fl2i < fl2j) {
        return fl2j;
    } else {
        i -= 2 ** fl2i;
        j -= 2 ** fl2j;
        return levelToUpdate(i, j);
    }
}

/**
 * Given an owned leaf, each time a new leaf is inserted, an element of the
 * owned leaf's sibling path will be changed. When inserting a batch of leaves,
 * elements in the sibling path might be updated multiple times. We only care about
 * storing the element after the _last_ time it is changed during the batch insertion.
 * This function returns the right-most leafIndices in the batch whose insertion will
 * change an element of the owned leaf's sibling path.
 * @param {number} ownedLeafIndex
 * @param {number} minLeafIndex - of the batch
 * @param {number} maxLeafIndex - of the batch
 * @returns 
 */
function getCoordsWhichChangeTheSiblingPath(ownedLeafIndex, minLeafIndex, maxLeafIndex) {
    if (ownedLeafIndex > maxLeafIndex) throw new Error('bad inputs');

    let coords = []

    const nextPowerOf2 = 2 ** (floorLog2(maxLeafIndex) + 1);
    const oneBeforeNextPowerOf2 = nextPowerOf2 - 1;

    // Interestingly, the binary decomposition of this difference gives all the 
    // information needed to deduce which leafIndices will be the _last_ to update
    // certain levels of the tree, given the ownedLeafIndex.
    const binDiff = decToBin(oneBeforeNextPowerOf2 - ownedLeafIndex);

    let leafIndex = ownedLeafIndex;
    for (let i = 0; i < binDiff.length; i++) {
        if (!binDiff[i]) continue;
        leafIndex += 2 ** i;
        if (leafIndex < minLeafIndex) continue;
        if (leafIndex > maxLeafIndex) {
            const level = levelToUpdate(ownedLeafIndex, maxLeafIndex);
            coords.push([maxLeafIndex, level]);
            break;
        }
        const level = levelToUpdate(ownedLeafIndex, leafIndex);
        coords.push([leafIndex, level]);
    }

    // console.log('coords which change the path', coords);

    return coords;
}



/**
 * Ensures we permanently store elements of the frontier which 
 * coincide with the sibling path of indices we own.
 * @param {Arrat[number]} ownedLeafIndices 
 * @param {number} batchMinLeafIndex 
 * @param {number} batchMaxLeafIndex 
 * @returns {Array[number]} the node indices which must be stored, when `updateNodes` runs.
 */
function getFrontierCoordsWhichLieOnTheSiblingPath(ownedLeafIndex, batchMaxLeafIndex) {
    if (ownedLeafIndex > batchMaxLeafIndex) throw new Error("Can't do this");
    // A '1' in the binary decomposition gives us the levels of the sibling path which lie on the frontier
    const bitDecomp = decToBin(ownedLeafIndex);
    // Calculate the very last index in the batch which will refer to a frontier-lying sibling path element:
    // 2 ** l * floor(n / (2 ** l)) + (2 ** l - 1)
    let coords = [];
    let pow = 0.5
    for (let level = 0; level < bitDecomp.length; level++) {
        pow *= 2;
        const bit = bitDecomp[level];
        if (!bit) continue;
        const lastLeafIndex = (pow * Math.floor(ownedLeafIndex / pow) + (pow - 1));
        const leafIndex = Math.min(lastLeafIndex, batchMaxLeafIndex);
        coords.push([leafIndex, level]);
    }

    // console.log('coords which lie on the path', coords);

    return coords;
}

/**
 * Given an owned leaf, each time a new leaf is inserted, an element of the
 * owned leaf's sibling path will be changed. When inserting a batch of leaves,
 * elements in the sibling path might be updated multiple times. We only care about
 * storing the _last_ time each element is changed.
 * This function returns special 'coordinates' for the nodes in the tree which must
 * stored, for each owned leaf, when inserting the leaves in a batch.
 * @note This assumes all prior batches have been parsed in this same way (and so ignores
 * the writes that would have been needed for those batches, since they're assumed to
 * already have happened).
 * @param {Array[number]} ownedLeafIndices
 * @param {number} minLeafIndex - of the batch
 * @param {number} maxLeafIndex - of the batch
 * @returns {Array[Array[number]]} - 'coordinates':
 *     How to read the coordinates:
 *       [15, 3] means [leafIndex = 15, level = 3]
 *       what this means is that when _adding_ leafIndex 15 (by hashing it into the
 *       tree) store level 3 of that hash path.
 */
function calculateCoordsToStoreFromBatch(ownedLeafIndices, batchMinLeafIndex, batchMaxLeafIndex) {
    let coordsWhichLieOnTheSiblingPathAndFrontier = [];
    let coordsWhichChangeTheSiblingPath = [];

    for (let i = 0; i < ownedLeafIndices.length; i++) {
        const ownedLeafIndex = ownedLeafIndices[i];
        if (ownedLeafIndex > batchMaxLeafIndex) continue; // can't compute a path for a leaf that hasn't been added to the tree yet. Wait for a future batch.

        coordsWhichChangeTheSiblingPath.push(
            ...getCoordsWhichChangeTheSiblingPath(ownedLeafIndex, batchMinLeafIndex, batchMaxLeafIndex)
        );

        if (ownedLeafIndex < batchMinLeafIndex) continue;
        coordsWhichLieOnTheSiblingPathAndFrontier.push(
            ...getFrontierCoordsWhichLieOnTheSiblingPath(ownedLeafIndex, batchMaxLeafIndex)
        );
    }

    // Perhaps the above loop can be made to not produce duplicates.
    // For now, remove them, then sort by leafIndex (then by level)
    coordsWhichChangeTheSiblingPath = removeDuplicatesArrayofArrays(
        coordsWhichChangeTheSiblingPath
    ).sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    coordsWhichLieOnTheSiblingPathAndFrontier = removeDuplicatesArrayofArrays(
        coordsWhichLieOnTheSiblingPathAndFrontier
    ).sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    return [coordsWhichChangeTheSiblingPath, coordsWhichLieOnTheSiblingPathAndFrontier];
}

// CLI example execution:
// node -e 'require("./src/update-sibling-paths").test()'
module.exports = {
    levelToUpdate,
    getCoordsWhichChangeTheSiblingPath,
    getFrontierCoordsWhichLieOnTheSiblingPath,
    calculateCoordsToStoreFromBatch,
};