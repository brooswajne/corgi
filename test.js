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

const FILE_OUTPUT_DIR = path.join(__dirname, './test/files/');
const testTemplater = (format) => {
    const rootDirectory = path.join(FILE_OUTPUT_DIR, format);
    if (!fs.existsSync(rootDirectory)) fs.mkdirSync(rootDirectory);

    return function test(title, templater, input, expectedOutput) {
        const shortTitle = title.toLowerCase()
            .substring('should '.length)
            .replace(/\s+/g, '-')
            .substring(0, 16);


        it(title, async function() {
            [ input, expectedOutput ] = await Promise.all([ input, expectedOutput ]); // if promises passed
            expect(input, 'templater test input is not a buffer').to.be.instanceof(Buffer);
            expect(expectedOutput, 'templater test expected output is not a buffer').to.be.instanceof(Buffer);

            const output = await templater.render(input, format);
            expect(output, 'templater output is not a buffer').to.be.instanceof(Buffer);

            const isEqual = output.equals(input);
            if (!isEqual) {
                const directory = path.join(rootDirectory, shortTitle);
                if (!fs.existsSync(directory)) fs.mkdirSync(directory);

                /* eslint-disable no-console */
                writeFile(`${directory}/expected.xlsx`, expectedOutput)
                    .catch((err) => console.error('Failed to write to', `${directory}/expected.xlsx`, err));
                writeFile(`${directory}/output.xlsx`, output)
                    .catch((err) => console.error('Failed to write to', `${directory}/output.xlsx`, err));
                /* eslint-enable no-console */

                throw new Error(`Output does not match expected, writing to directory: ${directory}`);
            }
        });
    };
};

describe('xlsx templater', function() {
    const { Templater } = corgi;
    const test = testTemplater('xlsx');

    it('should accept both filepaths and file streams', async function() {
        const templater = new Templater(() => '');

        const stream = await Excel();
        expect(async() => await templater.render(stream, 'xlsx')).to
            .not.throw();

        expect(async() => await templater.render('./test/empty.xlsx')).to
            .not.throw();
    });
    test('should leave non-templated spreadsheets unchanged',
        new Templater(() => ''),
        Excel([
            ['foo', 'bar', 'fizz'],
            ['bloop', 'blap', 'blip'],
        ]),
        Excel([
            ['foo', 'bar', 'fizz'],
            ['bloop', 'blap', 'blip'],
        ]),
    );
    test('should expand row blocks', // TODO: break up into multiple tests
        new Templater((tag) => ({
            'open0': corgi.block.open('0', []),
            'close0': corgi.block.close('0'),
            'open2': corgi.block.open('2', [ 1, 2 ]),
            'close2': corgi.block.close('2'),
            'open3': corgi.block.open('3', [ 1, 2, 3 ]),
            'close3': corgi.block.close('3'),
        }[tag])),
        Excel([
            [ '[[ open3 ]]',  'im expanded', '[[ close3 ]]', 'im not' ],
            [ 'neither',     'are',         'we' ],
            [ '[[ open0 ]]', 'we',          'are',         'gone',  '[[ close0 ]]' ],
            [ 'but',         '[[ open2 ]]',  'we',          'are',   '[[ close2 ]]' ],
        ], [
            [ '[[ open3 ]]', 'expand me', '[[ close3 ]]', 'not me', '[[ open2 ]]', 'me though', '[[ close2 ]]' ],
        ]),
        Excel([
            [ '[[ open3 ]]', 'im expanded', '[[ close3 ]]', 'im not' ],
            [ '[[ open3 ]]', 'im expanded', '[[ close3 ]]' ],
            [ '[[ open3 ]]', 'im expanded', '[[ close3 ]]' ],
            [ 'neither',    'are',         'we' ],
            [ 'but',        '[[ open2 ]]',  'we',          'are',   '[[ close2 ]]' ],
            [ null,         '[[ open2 ]]',  'we',          'are',   '[[ close2 ]]' ],
        ], [
            [ '[[ open3 ]]', 'expand me', '[[ close3 ]]', 'not me', '[[ open2 ]]', 'me though', '[[ close2 ]]' ],
            [ '[[ open3 ]]', 'expand me', '[[ close3 ]]', null,     '[[ open2 ]]', 'me though', '[[ close2 ]]' ],
            [ '[[ open3 ]]', 'expand me', '[[ close3 ]]', null,     null,          null,        null ],
        ]),
    );
    test('should expand column blocks',
        new Templater((tag) => ({
            'open0': corgi.block.open('0', []),
            'close0': corgi.block.close('0'),
            'open2': corgi.block.open('2', [ 1, 2 ]),
            'close2': corgi.block.close('2'),
            'open3': corgi.block.open('3', [ 1, 2, 3 ]),
            'close3': corgi.block.close('3'),
        }[tag])),
        Excel([
            [ '[[ open3 ]]',  'im',       'hi' ],
            [ 'expandme',     'not',      '[[ open0 ]]', 'wow' ],
            [ 'andme',        'expanded', 'bye' ],
            [ '[[ close3 ]]', 'hah',      '[[ close0 ]]', 'wee' ],
        ]),
        Excel([
            [ '[[ open3 ]]',  '[[ open3 ]]',  '[[ open3 ]]',  'im',       'hi' ],
            [ 'expandme',     'expandme',     'expandme',     'not',      'wow' ],
            [ 'andme',        'andme',        'andme',        'expanded' ],
            [ '[[ close3 ]]', '[[ close3 ]]', '[[ close3 ]]', 'hah',      'wee' ],
        ])
    );
});
