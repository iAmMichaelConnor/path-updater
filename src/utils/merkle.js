const { TREE_HEIGHT } = require("../config");

function rightShift(integer, shift) {
    return Math.floor(integer / 2 ** shift);
}

function leftShift(integer, shift) {
    return integer * 2 ** shift;
}

// INDEX CONVERSIONS

function leafIndexToNodeIndex(_leafIndex, _height = TREE_HEIGHT) {
    const leafIndex = Number(_leafIndex);
    const treeWidth = 2 ** _height;
    return leafIndex + treeWidth - 1;
}

function nodeIndexToLeafIndex(_nodeIndex, _height = TREE_HEIGHT) {
    const nodeIndex = Number(_nodeIndex);
    const treeWidth = 2 ** _height;
    return nodeIndex + 1 - treeWidth;
}


// 'DECIMAL' NODE INDICES

function siblingNodeIndex(_nodeIndex) {
    const nodeIndex = Number(_nodeIndex);
    /*
    odd? then the node is a left-node, so sibling is to the right.
    even? then the node is a right-node, so sibling is to the left.
    */
    return nodeIndex % 2 === 1 ? nodeIndex + 1 : nodeIndex - 1;
}

function parentNodeIndex(_nodeIndex) {
    const nodeIndex = Number(_nodeIndex);
    return nodeIndex % 2 === 1 ? rightShift(nodeIndex, 1) : rightShift(nodeIndex - 1, 1);
}


// COMPLEX TREE FUNCTIONS

/**
 * Recursively calculate the indices of the path from a particular leaf up to the root.
 * @param {integer} nodeIndex - the nodeIndex of the leaf for which we wish to calculate the siblingPathIndices. Not to be confused with leafIndex.
 */
function getPathIndices(_nodeIndex) {
    const nodeIndex = Number(_nodeIndex);
    if (nodeIndex === 0) return [0]; // terminal case

    const indices = getPathIndices(parentNodeIndex(nodeIndex));

    // push this node to the final output array, as we escape from the recursion:
    indices.push(nodeIndex);
    return indices;
}

/**
 * Recursively calculate the indices of the sibling path of a particular leaf up to the root.
 * @param {integer} nodeIndex - the nodeIndex of the leaf for which we wish to calculate the siblingPathIndices. Not to be confused with leafIndex.
 * NOTE: you might want to remove the root from the returned array.
 */
function getSiblingPathIndices(_nodeIndex) {
    const nodeIndex = Number(_nodeIndex);
    if (nodeIndex === 0) return [0]; // terminal case

    const indices = getSiblingPathIndices(parentNodeIndex(nodeIndex));

    // push the sibling of this node to the final output array, as we escape from the recursion:
    indices.push(siblingNodeIndex(nodeIndex));
    return indices;
}

module.exports = {
    rightShift,
    leafIndexToNodeIndex,
    nodeIndexToLeafIndex,
    parentNodeIndex,
    getPathIndices,
    getSiblingPathIndices,
}