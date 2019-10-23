/* eslint-env mocha */

process.on('unhandledRejection', function failTest(err) {
    // mocha doesn't fail test by default if async fn throws
    throw err;
});

// UNIT TESTS

const fs = require('fs');
const path = require('path');
const ignore = require('ignore')();

const IGNORED_FILES = fs.readFileSync(path.join(__dirname, '.gitignore'), { encoding: 'utf-8' })
    .split('\n');
ignore.add(IGNORED_FILES);
ignore.add(['.git']);

(function testDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        const relativePath = path.relative(__dirname, filePath);

        if (ignore.ignores(relativePath)) return;

        if (fs.statSync(filePath).isDirectory()) {
            testDir(filePath);
        } else if (file.endsWith('.test.js')) {
            const testTarget = filePath.replace(/\.test\.js$/, '.js');
            const testName = path.relative(__dirname, testTarget);
            describe(testName, function() {
                require(filePath)(require(testTarget));
            });
        }
    });
})(__dirname);


// END TO END TESTS

const { expect } = require('chai');

const corgi = require('./corgi');
const async = require('./lib/async');
const Excel = require('./test/excel');
const { writeFile } = require('./lib/common');

const json = {
    documents: [
        {
            name: 'document one.docx',
        },
        {
            name: 'document two.docx',
        },
        {
            name: 'document three.docx',
        },
    ],
};
async function parser(property, /* { scope, cache } */) {
    const time = Math.round(Math.random() * 1000);
    // console.time(`parsing, waiting ${time}`);
    await async.wait(time);
    // console.timeEnd(`parsing, waiting ${time}`);

    if (property.trim()[0] === '/') return corgi.block.close(property.trim().substring(1));

    const path = property.split(' ')
        .map(s => s.trim())
        .filter(s => s);

    const obj = path.reduce((prev, p) => {
        if (typeof prev === 'undefined') return prev;
        return prev[p];
    }, json);
    if (obj instanceof Array) return corgi.block.open(property.trim(), obj);
    return corgi.data(obj);
}

describe.skip('integration', function() {
    const { Templater } = corgi;
    let streamed;
    before(async function createTestSpreadsheets() {
        streamed = await Excel([
            ['foo', 'bar', 'fizz'],
            ['bloop', 'blap', 'blip'],
        ]);
        await writeFile('./test/files/foo.xlsx', streamed);
    });
    it('should render', async function() {
        const templater = new Templater(parser);
        await templater.render('./test/files/foo.xlsx');
    });
});
