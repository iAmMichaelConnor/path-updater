const level = require('level');
const fs = require('fs');


// 1) Create our database, supply location and options.
//    This will create or open the underlying store.
const db = level('my-db');

const write = async (key, value) => {
    // console.log('writing to db:', key, value);
    await db.put(key.toString(), JSON.stringify(value));
    // console.log('success!');
}

// for batch write operations:
/** 
 * @param {Array} ops From the readme of leveldb:
const ops = [
  { type: 'del', key: 'father' },
  { type: 'put', key: 'name', value: 'Yuri Irsenovich Kim' },
  { type: 'put', key: 'dob', value: '16 February 1941' },
  { type: 'put', key: 'spouse', value: 'Kim Young-sook' },
  { type: 'put', key: 'occupation', value: 'Clown' }
]
 */
const batchWrite = async ops => {
    // console.log('batch-writing to db:', ops);
    // console.log('batch-writing to db:');
    // console.time('write time');
    try {
        await db.batch(ops);
        // console.log('success!');
    } catch (err) {
        console.log(err);
        throw new Error(err);
    }
    // console.timeEnd('write time');
}


const read = async key => {
    // console.log('Reading from db for key:', key);
    let result = await db.get(key)
    // console.log('result', result);
    result = JSON.parse(result);
    // console.log('final result', result);
    return result;
}

const filePath = './dump.json';

const writeToJsonFile = data => {
    fs.writeFileSync(filePath, JSON.stringify(data), (err) => {
        if (err) {
            throw err;
        }
        // console.log("JSON data is saved.");
    });
}

const countKeys = async () => {
    let counter = 0;
    return new Promise((resolve, reject) => {
        db.createReadStream()
            .on('data', data => {
                // console.log(data.key, '=', data.value);
                counter++;
            })
            .on('error', err => {
                console.log('Oh my!', err);
                reject();
            })
            .on('close', () => {
                // console.log('Stream closed');
            })
            .on('end', () => {
                // console.log('Stream ended');
                console.log("Number of keys in DB:", counter);
                resolve(counter);
            })
    });

}

module.exports = { db, read, write, batchWrite, countKeys };
