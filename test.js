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
const Excel = require('./test/excel');
const { writeFile } = require('./lib/common');

const compareBuffers = (testName, expected, actual) => {
    expect(expected, 'test expectation is not a buffer').to.be.instanceof(Buffer);
    expect(actual, 'test result is not a buffer').to.be.instanceof(Buffer);
    const isEqual = expected.equals(actual);
    if (!isEqual) {
        /* eslint-disable no-console */
        writeFile(`./test/files/${testName}-expected.xlsx`, expected)
            .catch((err) => console.error('Failed to write to', `./test/files/${testName}-expected.xlsx`));
        writeFile(`./test/files/${testName}-actual.xlsx`, actual)
            .catch((err) => console.error('Failed to write to', `./test/files/${testName}-actual.xlsx`));
        /* eslint-enable no-console */
    }
    expect(isEqual, `file does not match expectation: ${testName}`).to.be.true;
};

describe('renderer', function() {
    const { Templater } = corgi;

    it('should accept both filepaths and file streams', async function() {
        const templater = new Templater(() => '');

        const stream = await Excel();
        expect(async() => await templater.render(stream, 'xlsx')).to
            .not.throw();

        expect(async() => await templater.render('./test/empty.xlsx')).to
            .not.throw();
    });
    it('should leave non-templated spreadsheets unchanged', async function() {
        const templater = new Templater(() => '');

        const basic = await Excel([
            ['foo', 'bar', 'fizz'],
            ['bloop', 'blap', 'blip'],
        ]);
        const rendered = await templater.render(basic, 'xlsx');
        compareBuffers('unchanged', basic, rendered);
    });
});
