const { ZERO, TREE_HEIGHT } = require('./config');
const { concatenateThenHash } = require('./utils/hash');
const { leafIndexToNodeIndex, parentNodeIndex, rightShift } = require('./utils/merkle');
leafIndexToNodeIndex

function getFrontierSlot(leafIndex) {
    let slot = 0;
    if (leafIndex % 2 === 1) {
        let exp1 = 1;
        let pow1 = 2;
        let pow2 = pow1 << 1;
        while (slot === 0) {
            if ((leafIndex + 1 - pow1) % pow2 === 0) {
                slot = exp1;
            } else {
                pow1 = pow2;
                pow2 <<= 1;
                exp1 += 1;
            }
        }
    }
    return slot;
}

async function updateNodes(
    leafValues,
    currentLeafCount,
    frontier,
    coordsWhichChangeTheSiblingPath,
    coordsWhichLieOnTheSiblingPathAndFrontier,
    writeNodesFunction,
    height = TREE_HEIGHT,
) {

    let storedNodeIndices = []; // for DEBUGGING
    let nextCoordIndexA = 0;
    let nextCoordIndexB = 0;

    const writeNode = async (nodeIndex, value, baseLeafIndex, level, isFrontierNode = false) => {
        if (!writeNodesFunction) return;
        if (!isFrontierNode && nextCoordIndexA == coordsWhichChangeTheSiblingPath.length) return;
        if (isFrontierNode && nextCoordIndexB == coordsWhichLieOnTheSiblingPathAndFrontier.length) return;

        const nextCoord = isFrontierNode ?
            coordsWhichLieOnTheSiblingPathAndFrontier[nextCoordIndexB] :
            coordsWhichChangeTheSiblingPath[nextCoordIndexA];

        if (nextCoord[0] == baseLeafIndex && nextCoord[1] == level) {
            storedNodeIndices.push(nodeIndex);
            await writeNodesFunction({ value, nodeIndex });
            if (isFrontierNode) { nextCoordIndexB++ } else { nextCoordIndexA++ };
        }
    }

    const treeWidth = 2 ** height;
    const newFrontier = frontier;

    // check that space exists in the tree:
    const numberOfLeavesAvailable = treeWidth - currentLeafCount;
    const numberOfLeaves = Math.min(leafValues.length, numberOfLeavesAvailable);
    if (numberOfLeavesAvailable == 0) throw new Error("No space left in tree. Check inputs. and/or config.");

    const minLeafIndex = currentLeafCount;
    const maxLeafIndex = minLeafIndex + numberOfLeaves - 1;
    let slot;
    let leafIndex;
    let nodeIndex;
    let nodeValue;
    let hashCounter = 0;

    // consider each new leaf in turn, from left to right:
    for (
        leafIndex = minLeafIndex;
        leafIndex <= maxLeafIndex;
        leafIndex++
    ) {
        nodeValue = leafValues[leafIndex - currentLeafCount];
        nodeIndex = leafIndexToNodeIndex(leafIndex, height);

        await writeNode(nodeIndex, nodeValue, leafIndex, 0);
        await writeNode(nodeIndex - 1, frontier[0], leafIndex, 0, true);


        slot = getFrontierSlot(leafIndex); // determine at which level we will next need to store a nodeValue

        if (slot === 0) {
            newFrontier[slot] = nodeValue; // store in frontier
        }

        // hash up to the level whose nodeValue we'll store in the frontier slot:
        for (let level = 1; level <= slot; level++) {
            // console.log('calculating level', level);
            if (nodeIndex % 2 === 0) {
                // even nodeIndex
                // console.log('left', frontier[level - 1]);
                // console.log('right', nodeValue);
                nodeValue = concatenateThenHash(frontier[level - 1], nodeValue);
                // console.log('nodeValue', nodeValue);
                hashCounter++;
            } else {
                // odd nodeIndex
                // console.log('left', nodeValue);
                // console.log('right', ZERO);
                nodeValue = concatenateThenHash(nodeValue, ZERO);
                // console.log('nodeValue', nodeValue);
                hashCounter++;
            }
            nodeIndex = parentNodeIndex(nodeIndex); // move one level up the tree
            await writeNode(nodeIndex, nodeValue, leafIndex, level);
            await writeNode(nodeIndex - 1, frontier[level], leafIndex, level, true);
        }

        newFrontier[slot] = nodeValue; // store in frontier
    }

    leafIndex = maxLeafIndex;

    // So far we've added all leaves, and hashed up to a particular level of the tree. We now need to continue hashing from that level until the root:
    for (let level = slot + 1; level <= height; level++) {
        // console.log('calculating level', level);
        if (nodeIndex % 2 === 0) {
            // even nodeIndex
            // console.log('left', frontier[level - 1]);
            // console.log('right', nodeValue);
            nodeValue = concatenateThenHash(frontier[level - 1], nodeValue);
            // console.log('nodeValue', nodeValue);
            hashCounter++;
        } else {
            // odd nodeIndex
            // console.log('left', nodeValue);
            // console.log('right', ZERO);
            nodeValue = concatenateThenHash(nodeValue, ZERO);
            // console.log('nodeValue', nodeValue);
            hashCounter++;
        }
        nodeIndex = parentNodeIndex(nodeIndex); // move one level up the tree
        await writeNode(nodeIndex, nodeValue, leafIndex, level);
        await writeNode(nodeIndex - 1, frontier[level], leafIndex, level, true);

    }

    const root = nodeValue;
    // console.log(`root: ${ root } `);

    // let difference = nodeIndicesToStoreFromBatch.filter(x => !storedNodeIndices.includes(x));
    // if (difference.length !== 0) throw new Error(`Some data wasn't stored that should have been: ${difference}`);

    return [root, newFrontier, hashCounter];
}

/**
 * Calculates the exact number of hashes required to add a consecutive batch of leaves to a tree
 * @param {integer} maxLeafIndex - the highest leafIndex of the batch
 * @param {integer} minLeafIndex - the lowest leafIndex of the batch
 * @param {integer} height - the height of the merkle tree
 */
function getNumberOfHashes(maxLeafIndex, minLeafIndex, height = TREE_HEIGHT) {
    let hashCount = 0;
    let increment;
    let hi = Number(maxLeafIndex);
    let lo = Number(minLeafIndex);
    const batchSize = hi - lo + 1;
    const binHi = hi.toString(2); // converts to binary
    const bitLength = binHi.length;

    for (let level = 0; level < bitLength; level += 1) {
        increment = hi - lo;
        hashCount += increment;
        hi = rightShift(hi, 1);
        lo = rightShift(lo, 1);
    }
    // console.log(hashCount + height - (batchSize - 1))
    return hashCount + height - (batchSize - 1);
}

function getNumberOfHashesAcrossBatches(numberOfBatches, batchSize, startIndex = 0, height = TREE_HEIGHT) {
    let sum = 0;
    for (i = 0; i < numberOfBatches; i++) {
        let incr = getNumberOfHashes(batchSize * (i + 1) + startIndex, batchSize * i + startIndex);
        console.log(incr);
        sum += incr;
    }
    console.log(sum);
    return sum;
}

module.exports = {
    getFrontierSlot,
    updateNodes,
    getNumberOfHashes,
    getNumberOfHashesAcrossBatches,
};