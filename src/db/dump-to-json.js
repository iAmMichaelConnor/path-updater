
// https://github.com/nisaacson/leveldb-json/blob/master/bin/dump-to-json

const path = require('path');

let dumpToJson = require('./dump');
let { db } = require('./db');
let filePath = path.resolve('./src/db/dump.json');

function run() {
    let writer = dumpToJson(filePath, db);

    writer.on('dumped', function (chunk) {
        let row = JSON.parse(chunk);
        console.log('dumped row, key: ' + row.key + ', value: ' + row.value);
    });
    writer.on('finish', function () {
        console.log('wrote to json file:\n' + filePath + '\n');
    });
}

// node -e 'require("./src/db/dump-to-json").run()'
module.exports = { run };