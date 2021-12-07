const assert = require('assert');
const { TREE_HEIGHT, ZERO } = require('../src/config');
const { write, read, db, batchWrite, countKeys } = require('../src/db/db');
const { updateNodes, getNumberOfHashes } = require('../src/update-frontier');
const { calculateCoordsToStoreFromBatch } = require('../src/update-sibling-paths');
const { removeDuplicates } = require('../src/utils/array');
const { leafIndexToNodeIndex, getSiblingPathIndices } = require('../src/utils/merkle');
const { floorLog2 } = require('../src/utils/number');
const { getNodeValuesFromIndices, calculateRootFromMembershipWitness, calculateRoot, calculateTree, generateNextBatch } = require('./helper-functions');

const AUTOMATE_INPUTS = true;
const NUMBER_OF_OWNED_LEAVES = 100;
const MAX_OWNED_LEAF_INDEX = 128000;
const NUMBER_OF_BATCHES = 200;
const AVG_BATCH_SIZE = 2048;
const FUZZY_BATCH_SIZES = false;
const LOG_EVERY_N_BATCHES = 10;
const SPEED_TEST = false; // WARNING: this skips correctness checks. Set to `false` when changing the code, to catch errors!

let ownedLeafIndices = AUTOMATE_INPUTS ? Array(NUMBER_OF_OWNED_LEAVES).fill(0) : [3];
let ownedLeafValues = [];  // dummies will be generated during the tests
let batchMaxLeafIndices = AUTOMATE_INPUTS ? Array(NUMBER_OF_BATCHES).fill(0) : [7, 15, 31, 39]; // Note: you must ensure the indices specified here fit within the tree as specified by config.TREE_HEIGHT.

const generateTestData = () => {
    if (!AUTOMATE_INPUTS) return;
    const rnd = max => Math.floor(Math.random() * max);
    ownedLeafIndices = removeDuplicates(ownedLeafIndices.map(() => rnd(MAX_OWNED_LEAF_INDEX)).sort((a, b) => a - b));
    batchMaxLeafIndices = FUZZY_BATCH_SIZES ?
        removeDuplicates(batchMaxLeafIndices.map(() => rnd(AVG_BATCH_SIZE * NUMBER_OF_BATCHES)).sort((a, b) => a - b)) :
        Array.from({ length: batchMaxLeafIndices.length }, (_, i) => (i + 1) * AVG_BATCH_SIZE - 1);


    console.log("Generated random ownedLeafIndices:", ownedLeafIndices);
    console.log("Generated random batchMaxLeafIndices:", batchMaxLeafIndices);
    // console.dir(batchMaxLeafIndices, { maxArrayLength: null });
    // console.dir(batchMaxLeafIndices.slice(1).map((v, i) => v - batchMaxLeafIndices[i]), { maxArrayLength: null });
    console.log('Max batchLeafIndex', batchMaxLeafIndices[batchMaxLeafIndices.length - 1])
};

// Inefficient, but this is merely a stub preprocessing step.
// The roots will be directly queryable from calldata in reality.
preCalculateSubtreeDataForTestBatches = async batchMaxLeafIndices => {
    console.log('Performing slow precalculations before running the tests...')
    let minLeafIndex = 0;

    // An array with each element either `null` or a valid root value
    const subTreesData = [];

    for (let i = 0; i < batchMaxLeafIndices.length; i++) {
        if ((i + 1) % LOG_EVERY_N_BATCHES == 0) {
            console.log("Still precomputing... we're up to batch", i + 1);
        }
        const maxLeafIndex = batchMaxLeafIndices[i];
        const width = maxLeafIndex - minLeafIndex + 1;
        const height = floorLog2(width);
        const batchIsAPowerOf2 = 2 ** height == width; // the batch _might_ be subtree-worthy
        const batchCanBeASubtree = batchIsAPowerOf2 && minLeafIndex % width == 0; // if this holds, the min leafIndex aligns with the left-most leaf of a subtree with nextPowerOf2 leaves.

        let subTreeData;
        if (batchCanBeASubtree) {
            // If we don't own any leaves in the batch, we can insert the subtree root without hashing (in our tests) anything below it.
            const ignoreBatchLeaves = !ownedLeafIndices.some(
                ownedLeafIndex => ownedLeafIndex <= maxLeafIndex && ownedLeafIndex >= minLeafIndex
            );
            if (ignoreBatchLeaves) {
                subTreeData = {
                    root: await calculateRoot(generateNextBatch(minLeafIndex, maxLeafIndex), height),
                    height,
                    width,
                    minLeafIndex,
                    maxLeafIndex,
                }
                subTreesData.push(subTreeData);
                minLeafIndex = maxLeafIndex + 1;
                continue;
            }
        }

        subTreesData.push(null);
        minLeafIndex = maxLeafIndex + 1;
    }

    return subTreesData;
};

// Hard-coded frontier for sha256
// Notice: the frontier doesn't include the root.
// Notice: the frontier's 0th element is the leaf level of the tree.
const initialFrontier = Array(TREE_HEIGHT).fill(ZERO);


// TEST HELPER FUNCTIONS

let allLeaves = [];

// closure
const updateAllLeaves = newLeaves => {
    allLeaves = [...allLeaves, ...newLeaves];
    // Maybe check why the test before this failed.
    if (!batchMaxLeafIndices.includes(allLeaves.length - 1)) throw new Error(`bad leaf appending ${allLeaves.length - 1}`)
    if (allLeaves.length > 2 ** TREE_HEIGHT) throw new Error('TOO MANY LEAVES ADDED!!!');
};

let maxLeafIndex;
let minLeafIndex;
let leafIndexCount;
let leafIndexCountPerLogCycle;
let hashCount;
let hashCountPerLogCycle;
let dbKeyCount;
let dbKeyCountPerLogCycle;

const logBenchmarks = async (i, numberOfLeaves, numberOfHashes) => {
    leafIndexCount += numberOfLeaves;
    leafIndexCountPerLogCycle += numberOfLeaves;
    hashCount += numberOfHashes;
    hashCountPerLogCycle += numberOfHashes;
    if ((i + 1) % LOG_EVERY_N_BATCHES == 0) {
        console.timeEnd('timer');

        console.log('batch', i + 1);
        console.log(`total leafCount: ${leafIndexCount}, leafCount this cycle: ${leafIndexCountPerLogCycle}, total hashCount: ${hashCount}, hashCount this cycle: ${hashCountPerLogCycle}`);

        if (!SPEED_TEST) {
            const newDBKeyCount = await countKeys();
            dbKeyCountPerLogCycle = newDBKeyCount - dbKeyCount;
            dbKeyCount = newDBKeyCount;
            console.log(`total dbKeyCount: ${dbKeyCount}, db data added this cycle: ${dbKeyCountPerLogCycle}`);
        }

        leafIndexCountPerLogCycle = 0;
        hashCountPerLogCycle = 0;
        console.time('timer');
    }
};

const resetBenchmarks = () => {
    leafIndexCount = 0;
    leafIndexCountPerLogCycle = 0;
    hashCount = 0;
    hashCountPerLogCycle = 0;
    dbKeyCount = 0;
    dbKeyCountPerLogCycle = 0;
    console.timeEnd('timer');
    console.time('timer');
    console.timeEnd('totalTimer');
    console.time('totalTimer');
}


// DB INSERTION FUNCTIONS:

// one-at-a-time insertion
const writeNodeValue = async node => {
    await write(node.nodeIndex, node.value);
}



// TESTS

beforeAll(async () => {
    generateTestData();
    await db.clear();
    await write('frontier', initialFrontier);
    await write('root', ZERO);
})

describe('Initial tests that should run first', function () {
    it('should have ascending batch indices', function () {
        const isAscending = a => a.slice(1)
            .map((e, i) => e > a[i])
            .every(x => x);
        assert.equal(isAscending(batchMaxLeafIndices), true);
    });

    it('check the tree is big enough', function () {
        assert.equal(2 ** TREE_HEIGHT >= batchMaxLeafIndices[batchMaxLeafIndices.length - 1], true);
    });

    it('should have written the frontier & root to db', async function () {
        const readFrontier = await read('frontier');
        const readRoot = await read('root');
        const calculatedRoot = await calculateRoot(allLeaves)
        initialFrontier.forEach((e, i) => {
            assert.equal(readFrontier[i], e);
        });
        assert.equal(readRoot, calculatedRoot);
    });
})

describe.skip('Add batches and store minimal data', function () {

    beforeAll(async () => {
        resetBenchmarks();
    })

    afterAll(() => {
        console.timeEnd('totalTimer');
    })

    let prevIndex = -1;

    for (let i = 0; i < batchMaxLeafIndices.length; i++) {
        it('Stores the latest frontier & sufficient sibling node values for owned leaf membership proofs', async () => {

            maxLeafIndex = batchMaxLeafIndices[i];
            minLeafIndex = prevIndex + 1;

            const batchLeafValues = generateNextBatch(minLeafIndex, maxLeafIndex);


            // SIBLING PATH CALCS
            // We generated dummy-testing leaf values for the batch.
            // If any leafIndices in the batch match the indices we own, let's grab those dummy
            // testing values. 
            ownedLeafIndices.forEach(leafIndex => {
                batchLeafValues.forEach((batchLeafValue, j) => {
                    let batchLeafIndex = minLeafIndex + j;
                    if (leafIndex == batchLeafIndex && !ownedLeafValues.includes(batchLeafValue)) {
                        ownedLeafValues.push(batchLeafValue);
                    }
                });
            });

            const [coordsWhichChangeTheSiblingPath, coordsWhichLieOnTheSiblingPathAndFrontier] = calculateCoordsToStoreFromBatch(ownedLeafIndices, minLeafIndex, maxLeafIndex);


            // FRONTIER & ROOT CALCS
            // We read from the DB to test that what we previously wrote was correct.
            // In practice, we can keep this in memory when syncing.
            const frontier = await read('frontier');

            // Batch db insertion:
            let nodesToStoreFromBatch = [];
            // Closure with access to nodesToStoreFromBatch, coordsWhichChangeTheSiblingPath, coordsWhichLieOnTheSiblingPathAndFrontier
            // Queue nodes and only write at the end of the batch.
            const collectThenWriteNodeValues = async ({ value, nodeIndex }) => {
                // Push an object designed for leveldb batch insertion:
                nodesToStoreFromBatch.push({
                    type: 'put',
                    key: nodeIndex.toString(),
                    value: JSON.stringify(value),
                });
                if (nodesToStoreFromBatch.length == coordsWhichChangeTheSiblingPath.length + coordsWhichLieOnTheSiblingPathAndFrontier.length) {
                    await batchWrite(nodesToStoreFromBatch);
                    nodesToStoreFromBatch = [];
                }
            };

            const [root, newFrontier, numberOfHashesActual] = await updateNodes(
                batchLeafValues,
                minLeafIndex,
                frontier,
                coordsWhichChangeTheSiblingPath,
                coordsWhichLieOnTheSiblingPathAndFrontier,
                collectThenWriteNodeValues, // alternatively, you could specify `writeNodeValue` here.
            );

            const numberOfHashesExpected = getNumberOfHashes(maxLeafIndex, minLeafIndex);
            assert.equal(numberOfHashesActual, numberOfHashesExpected);

            // STORE NEW DATA IN DB
            await write('frontier', newFrontier);
            await write('root', root);

            // console.log('frontier:', i, newFrontier)


            await logBenchmarks(i, maxLeafIndex - minLeafIndex + 1, numberOfHashesActual);



            if (!SPEED_TEST) {
                // FOR TESTING ONLY: FRONTIER CALCS

                // Here we make sure the newly stored frontier can be used to 
                // correctly recalculate the root (vs a naive merkle tree root calc)
                updateAllLeaves(batchLeafValues);
                const expectedRoot = await calculateRoot(allLeaves);
                // const checkRoot = calculateTree(allLeaves, true); // For debugging only - don't use a big TREE_HEIGHT if using this, because it's super inefficient.
                assert.equal(root, expectedRoot);


                // FOR TESTING ONLY: SIBLING PATH CALCS

                // Here we make sure we can calculate the root for all owned leaves
                // solely from the minimal information stored in the db.
                for (let i = 0; i < ownedLeafIndices.length; i++) {
                    const ownedLeafIndex = ownedLeafIndices[i];
                    if (ownedLeafIndex > maxLeafIndex) continue; // can't compute a path for a leaf that hasn't been added to the tree yet. Wait for a future batch.

                    const siblingPathIndices = getSiblingPathIndices(
                        leafIndexToNodeIndex(ownedLeafIndex, TREE_HEIGHT)
                    ).slice(1);

                    // Gets from the db:
                    const siblingPathNodeValues = await getNodeValuesFromIndices(siblingPathIndices);
                    const ownedLeafValue = ownedLeafValues[i];

                    // console.log('ownedLeafIndex', ownedLeafIndex);
                    // console.log('ownedLeafValue', ownedLeafValue)
                    // console.log('siblingPathIndices', siblingPathIndices);
                    // console.log('siblingPathNodeValues', siblingPathNodeValues);

                    const calculatedRoot = calculateRootFromMembershipWitness(ownedLeafValue, ownedLeafIndex, siblingPathNodeValues);
                    assert.equal(calculatedRoot, root);
                }
            }



            // NEXT LOOP
            prevIndex = maxLeafIndex;

        }, 3600000); // <-- long jest timeout

    }
});

describe('As above, but insert subtree roots of batches with no owned leaves', function () {

    let subTreesData;
    let prevIndex = -1;

    const getUpperTreeLeafIndexFromTreeLeafIndex = (leafIndex, subTreeHeight) => {
        let upperTreeLeafIndex = leafIndex;
        for (let l = 0; l < subTreeHeight; l++) {
            upperTreeLeafIndex >>= 1;
        }
        return upperTreeLeafIndex;
    }

    const updateCoord = (coord, subTreeHeight) => {
        let newCoord = [];
        newCoord[0] = getUpperTreeLeafIndexFromTreeLeafIndex(coord[0], subTreeHeight);
        newCoord[1] = coord[1] - subTreeHeight;
        if (coord[1] < subTreeHeight) throw new Error('None of the owned leaves should have siblings within this subtree. Perhaps this batch has been miscalculated to be a subtree by mistake.')
        return newCoord;
    }

    const insertSubtree = async subTreeData => {
        const { root: subTreeRoot, height: subTreeHeight, maxLeafIndex, minLeafIndex } = subTreeData;

        const frontier = await read('frontier');
        const upperTreeFrontier = frontier.slice(subTreeHeight);
        const upperTreeLeafIndex = getUpperTreeLeafIndexFromTreeLeafIndex(maxLeafIndex, subTreeHeight);

        // console.log("SUBTREE ROOT BEING INSERTED: root:", subTreeRoot, "subTreeHeight:", subTreeHeight, "maxLeafIndex:", maxLeafIndex, "upperTreeLeafIndex:", upperTreeLeafIndex);

        const [coordsWhichChangeTheSiblingPath, coordsWhichLieOnTheSiblingPathAndFrontier] = calculateCoordsToStoreFromBatch(ownedLeafIndices, minLeafIndex, maxLeafIndex);

        // The coords were for the full-sized tree. We need to convert them to coords for the upper tree:
        upperTreeCoordsWhichChangeTheSiblingPath = coordsWhichChangeTheSiblingPath.map(coord => updateCoord(coord, subTreeHeight));
        upperTreeCoordsWhichLieOnTheSiblingPathAndFrontier = coordsWhichLieOnTheSiblingPathAndFrontier.map(coord => updateCoord(coord, subTreeHeight));

        // Batch db insertion:
        let nodesToStoreFromBatch = [];
        // Closure with access to nodesToStoreFromBatch, coordsWhichChangeTheSiblingPath, coordsWhichLieOnTheSiblingPathAndFrontier
        // Queue nodes and only write at the end of the batch.
        const collectThenWriteNodeValues = async ({ value, nodeIndex }) => {
            // Push an object designed for leveldb batch insertion:
            nodesToStoreFromBatch.push({
                type: 'put',
                key: nodeIndex.toString(),
                value: JSON.stringify(value),
            });
            if (nodesToStoreFromBatch.length == coordsWhichChangeTheSiblingPath.length + coordsWhichLieOnTheSiblingPathAndFrontier.length) {
                await batchWrite(nodesToStoreFromBatch);
                nodesToStoreFromBatch = [];
            }
        };

        const [upperTreeRoot, newUpperTreeFrontier, numberOfHashesActual] = await updateNodes(
            [subTreeRoot],
            upperTreeLeafIndex,
            upperTreeFrontier,
            upperTreeCoordsWhichChangeTheSiblingPath,
            upperTreeCoordsWhichLieOnTheSiblingPathAndFrontier,
            collectThenWriteNodeValues,
            TREE_HEIGHT - subTreeHeight,
        );

        // create a new frontier as a combo of the newUpperFrontier and the lower level nodes of the original full-tree-height frontier.
        let newFrontier = [...new Array(subTreeHeight).fill(null), ...newUpperTreeFrontier].map((n, i) => {
            return n ??= frontier[i];
        });

        return [upperTreeRoot, newFrontier, numberOfHashesActual];
    }

    beforeAll(async () => {
        subTreesData = await preCalculateSubtreeDataForTestBatches(batchMaxLeafIndices);
        allLeaves = [];
        await db.clear();
        await write('frontier', initialFrontier);
        await write('root', ZERO);
        resetBenchmarks();
    }, 3600000); // <-- long jest timeout

    afterAll(() => {
        console.timeEnd('totalTimer');
    });

    for (let i = 0; i < batchMaxLeafIndices.length; i++) {
        it('Inserts just the root of batches which dont contain owned leaves', async () => {

            maxLeafIndex = batchMaxLeafIndices[i];
            minLeafIndex = prevIndex + 1;
            const subTreeData = subTreesData[i];
            const batchLeafValues = generateNextBatch(minLeafIndex, maxLeafIndex);

            let root, newFrontier, numberOfHashesActual;

            if (subTreeData) {
                // Then we can insert the subtree's root at a higher level of the tree.
                [root, newFrontier, numberOfHashesActual] = await insertSubtree(subTreeData);
            } else {
                // TODO: put this stuff in a separate function?

                // SIBLING PATH CALCS
                // We generated dummy-testing leaf values for the batch.
                // If any leafIndices in the batch match the indices we own, let's grab those dummy
                // testing values. 
                ownedLeafIndices.forEach(leafIndex => {
                    batchLeafValues.forEach((batchLeafValue, j) => {
                        let batchLeafIndex = minLeafIndex + j;
                        if (leafIndex == batchLeafIndex && !ownedLeafValues.includes(batchLeafValue)) {
                            ownedLeafValues.push(batchLeafValue);
                        }
                    });
                });

                const [coordsWhichChangeTheSiblingPath, coordsWhichLieOnTheSiblingPathAndFrontier] = calculateCoordsToStoreFromBatch(ownedLeafIndices, minLeafIndex, maxLeafIndex);


                // FRONTIER & ROOT CALCS
                // We read from the DB to test that what we previously wrote was correct.
                // In practice, we can keep this in memory when syncing.
                const frontier = await read('frontier');

                // Batch db insertion:
                let nodesToStoreFromBatch = [];
                // Closure with access to nodesToStoreFromBatch, coordsWhichChangeTheSiblingPath, coordsWhichLieOnTheSiblingPathAndFrontier
                // Queue nodes and only write at the end of the batch.
                const collectThenWriteNodeValues = async ({ value, nodeIndex }) => {
                    // Push an object designed for leveldb batch insertion:
                    nodesToStoreFromBatch.push({
                        type: 'put',
                        key: nodeIndex.toString(),
                        value: JSON.stringify(value),
                    });
                    if (nodesToStoreFromBatch.length == coordsWhichChangeTheSiblingPath.length + coordsWhichLieOnTheSiblingPathAndFrontier.length) {
                        await batchWrite(nodesToStoreFromBatch);
                        nodesToStoreFromBatch = [];
                    }
                };

                [root, newFrontier, numberOfHashesActual] = await updateNodes(
                    batchLeafValues,
                    minLeafIndex,
                    frontier,
                    coordsWhichChangeTheSiblingPath,
                    coordsWhichLieOnTheSiblingPathAndFrontier,
                    collectThenWriteNodeValues, // alternatively, you could specify `writeNodeValue` here.
                );

                const numberOfHashesExpected = getNumberOfHashes(maxLeafIndex, minLeafIndex);
                assert.equal(numberOfHashesActual, numberOfHashesExpected);

            }


            // STORE NEW DATA IN DB
            await write('frontier', newFrontier);
            await write('root', root);


            // console.log('frontier:', i, newFrontier)



            await logBenchmarks(i, maxLeafIndex - minLeafIndex + 1, numberOfHashesActual);



            if (!SPEED_TEST) {
                // FOR TESTING ONLY: FRONTIER CALCS

                // Here we make sure the newly stored frontier can be used to 
                // correctly recalculate the root (vs a naive merkle tree root calc)
                updateAllLeaves(batchLeafValues);
                const expectedRoot = await calculateRoot(allLeaves);
                // const checkRoot = calculateTree(allLeaves, true); // For debugging only - don't use a big TREE_HEIGHT if using this, because it's super inefficient.

                assert.equal(root, expectedRoot);


                // FOR TESTING ONLY: SIBLING PATH CALCS

                // Here we make sure we can calculate the root for all owned leaves
                // solely from the minimal information stored in the db.
                for (let i = 0; i < ownedLeafIndices.length; i++) {
                    const ownedLeafIndex = ownedLeafIndices[i];
                    if (ownedLeafIndex > maxLeafIndex) continue; // can't compute a path for a leaf that hasn't been added to the tree yet. Wait for a future batch.

                    const siblingPathIndices = getSiblingPathIndices(
                        leafIndexToNodeIndex(ownedLeafIndex, TREE_HEIGHT)
                    ).slice(1);


                    // Gets from the db:
                    const siblingPathNodeValues = await getNodeValuesFromIndices(siblingPathIndices);
                    const ownedLeafValue = ownedLeafValues[i];
                    // console.log('ownedLeafIndex', ownedLeafIndex);
                    // console.log('ownedLeafValue', ownedLeafValue)
                    // console.log('siblingPathIndices', siblingPathIndices);
                    // console.log('siblingPathNodeValues', siblingPathNodeValues);

                    const calculatedRoot = calculateRootFromMembershipWitness(ownedLeafValue, ownedLeafIndex, siblingPathNodeValues);
                    assert.equal(calculatedRoot, root);
                }
            }



            // NEXT LOOP
            prevIndex = maxLeafIndex;

        }, 3600000); // <-- long jest timeout

    }
});