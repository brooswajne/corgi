const { expect } = require('chai');
const { Readable, Writable, Transform } = require('stream');

class InputStream extends Readable {
    constructor(input) {
        super();

        let remaining = input;
        this._read = function(size) {
            if (!remaining) return void this.push(null);
            this.push(remaining.substr(0, size));
            remaining = remaining.substr(size);
        };
    }
}
class OutputWatcher extends Writable {
    constructor(callback = () => null) {
        super();

        let output = '';
        this._write = function(chunk, encoding, cb) {
            output += chunk.toString();
            cb();
        };
        this._final = function(cb) {
            callback(output);
            cb();
        };
    }
}
function testTransformStreams(streams, input, output) {
    const piped = streams.reduce((stream, next) => {
        return stream.pipe(next);
    }, new InputStream(input));
    piped.pipe(new OutputWatcher(str => {
        expect(str).to.equal(output);
    }));
}

class ChunkSplitter extends Transform {
    constructor(chunkSize) {
        super();

        this._transform = function(chunk, encoding, callback) {
            let string = chunk.toString();
            while (string.length > 0) {
                this.push(string.substring(0, chunkSize));
                string = string.substring(chunkSize);
            }
            callback();
        };
    }
}

module.exports = {
    ChunkSplitter: (...args) => new ChunkSplitter(...args),
    InputStream: (...args) => new InputStream(...args),
    OutputWatcher: (...args) => new OutputWatcher(...args),

    testTransformStreams,
};
