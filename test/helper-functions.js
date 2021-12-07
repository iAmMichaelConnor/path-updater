const { TREE_HEIGHT, ZERO } = require('../src/config');
const { read } = require('../src/db/db');
const { concatenateThenHash } = require('../src/utils/hash');
const { decToBin } = require('../src/utils/number');


const getNodeValuesFromIndices = async nodeIndices => {
    let nodeValues = [];
    for (let i = 0; i < nodeIndices.length; i++) {
        const nodeIndex = nodeIndices[i];
        let nodeValue;
        try {
            nodeValue = await read(nodeIndex.toString());
        } catch {
            // Just assume it isn't in the db, so use ZERO
            nodeValue = ZERO;
        }
        nodeValues.push(nodeValue);
    }
    return nodeValues;
}

const calculateRootFromMembershipWitness = (leafValue, leafIndex, _siblingPath) => {
    const siblingPath = _siblingPath.reverse();

    const binaryLeafIndex = Object.assign(new Array(TREE_HEIGHT).fill(0), decToBin(leafIndex));
    // console.log('calculateRootFromMembershipWitness');
    let nodeValue = leafValue;

    for (let i = 0; i < siblingPath.length; i++) {
        siblingPathValue = siblingPath[i];
        if (binaryLeafIndex[i] == 0) {
            nodeValue = concatenateThenHash(nodeValue, siblingPathValue);
        } else {
            nodeValue = concatenateThenHash(siblingPathValue, nodeValue);
        }
    }
    return nodeValue; // the root
}

// Recursive merkle tree root calculation
const calculateRoot = async (nonZeroLeaves, level = TREE_HEIGHT) => {
    let leaves = [...nonZeroLeaves]; // create a copy to avoid mutating the original

    if (leaves.length == 0) {
        return ZERO;
    }
    if (leaves.length % 2 == 1) {
        leaves = [...leaves, ZERO];
    }
    if (level == 1) {
        const result = concatenateThenHash(leaves[0], leaves[1]);
        return result;
    } else {
        const half = 2 ** level / 2;
        let RHS = leaves.length <= half ? ZERO : calculateRoot(leaves.slice(half), level - 1);
        let LHS = calculateRoot(leaves.slice(0, half), level - 1);
        [LHS, RHS] = await Promise.all([LHS, RHS]);
        const result = concatenateThenHash(LHS, RHS);
        return result;
    }
}

// FOR DEBUGGING THE TREE (prints literally every level of the tree)
/**
 * WARNING: horrendously inefficient!!!!!
 */
const calculateTree = (leaves, verbose = true) => {
    let treeLog = [];
    treeLog.push(leaves);
    leaves = Object.assign(new Array(2 ** TREE_HEIGHT).fill(ZERO), leaves);
    let children = leaves;
    let parents = []
    for (l = 1; l <= TREE_HEIGHT; l++) {
        for (i = 0; i < children.length - 1; i += 2) {
            parents.push(concatenateThenHash(children[i], children[i + 1]));
        }
        treeLog.push(parents.filter(n => n != ZERO));
        children = parents;
        parents = [];
    }
    if (verbose) console.dir(treeLog, { 'maxArrayLength': null });
    const root = children[0];
    return root;
}

// Generates a batch of dummy leafValues whose values are their index in the tree
// (converted to hex and left-padded with zeroes to a 256-bit value).
const generateNextBatch = (minLeafIndex, maxLeafIndex) => {
    let batch = [];
    for (let i = minLeafIndex; i <= maxLeafIndex; i++) {
        batch.push('0x' + i.toString(16).padStart(64, '0'));
    }
    return batch;
}

module.exports = {
    getNodeValuesFromIndices,
    calculateRootFromMembershipWitness,
    calculateRoot,
    calculateTree,
    generateNextBatch,
}