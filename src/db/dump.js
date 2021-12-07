let path = require('path');
let util = require('util');

// https://github.com/nisaacson/leveldb-json/blob/master/bin/dump-to-json

let fs = require('fs');
let Writable = require('stream').Writable;

function Writer(filePath) {
    Writable.call(this, { objectMode: true });
    this._writeStream = fs.createWriteStream(filePath);
}
util.inherits(Writer, Writable);

Writer.prototype._write = function (chunk, encoding, done) {
    const obj = { [chunk.key]: JSON.parse(chunk.value) };
    let jsonObj = JSON.stringify(obj);
    let line = jsonObj + '\n';
    this._writeStream.write(line);
    this.emit('dumped', JSON.stringify(chunk));
    done();
}

function dumpToJson(filePath, db) {
    if (!db) {
        throw new Error('leveldb instance required as second argument');
    }
    let writer = new Writer(filePath);
    let readStream = db.createReadStream();
    readStream.pipe(writer);

    return writer;
}

module.exports = function (fileName, db) {
    let filePath = path.resolve(fileName);
    return dumpToJson(filePath, db);
}