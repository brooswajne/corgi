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

const { TEST_MODE = 'default' } = process.env;
const GENERATE_OUTPUT = TEST_MODE !== 'clean';
const LOG_DIFFS = TEST_MODE === 'verbose';

const { expect } = require('chai');

const corgi = require('./corgi');
const Excel = require('./test/generators/xlsx');
const diff = require('./test/diff');
const { writeFile } = require('./lib/common');

const FILE_OUTPUT_DIR = path.join(__dirname, './test/generated/');
if (!fs.existsSync(FILE_OUTPUT_DIR)) fs.mkdirSync(FILE_OUTPUT_DIR);

const MAX_CHANGES_DISPLAYED = 5;
const MAX_DIRECTORY_LENGTH = 20;
const testTemplater = (format) => {
    const rootDirectory = path.join(FILE_OUTPUT_DIR, format);
    if (!fs.existsSync(rootDirectory)) fs.mkdirSync(rootDirectory);

    function test(title, templater, input, expectedOutput, {
        only = false,
        skip = false,
    } = {}) {
        const shortTitle = title.toLowerCase()
            .substring('should '.length)
            .replace(/\s+/g, '-')
            .substring(0, MAX_DIRECTORY_LENGTH);

        const run = only ? it.only
            : skip ? it.skip
            : it;
        run(title, async function() {
            [ input, expectedOutput ] = await Promise.all([ input, expectedOutput ]); // if promises passed
            expect(input, 'templater test input is not a buffer').to.be.instanceof(Buffer);
            expect(expectedOutput, 'templater test expected output is not a buffer').to.be.instanceof(Buffer);

            const output = await templater.render(input, format);
            expect(output, 'templater output is not a buffer').to.be.instanceof(Buffer);

            const differences = await diff(expectedOutput, output);
            if (differences.length) {
                const message = differences.map(({ type, file, changes }) => {
                    const message = [ `\x1b[33m     File ${type}: ${file}\x1b[0m` ];
                    if (!LOG_DIFFS) /* do nothing */;
                    else if (changes && changes.length > MAX_CHANGES_DISPLAYED) message.push(
                        `       \x1b[2m<${changes.length} changes>\x1b[0m`
                    );
                    else if (changes) message.push(changes.map(change => {
                        // each change is an array of lines with type: context/added/removed
                        return change.map(({ type, line }) => {
                            const color = type === 'context' ? '\x1b[37m'
                                : type === 'added' ? '\x1b[32m'
                                : '\x1b[31m';
                            const symbol = type === 'context' ? ''
                                : type === 'added' ? '+'
                                : '-';
                            return `${color}       ${symbol} ${line}\x1b[0m`;
                        }).join('\n');
                    }).join('\n\n'));
                    return message.join('\n');
                }).join('\n');

                const directory = path.join(rootDirectory, shortTitle);
                if (!fs.existsSync(directory)) fs.mkdirSync(directory);

                if (GENERATE_OUTPUT) {
                    /* eslint-disable no-console */
                    writeFile(`${directory}/expected.xlsx`, expectedOutput)
                        .catch((err) => console.error('Failed to write to', `${directory}/expected.xlsx`, err));
                    writeFile(`${directory}/output.xlsx`, output)
                        .catch((err) => console.error('Failed to write to', `${directory}/output.xlsx`, err));
                    /* eslint-enable no-console */
                }

                throw new Error('Output does not match expected:\n'
                    + message
                    + (GENERATE_OUTPUT ? `\n     \x1b[34mOutputting to directory ${directory}\x1b[0m` : ''));
            }
        });
    }
    test.only = (...args) => test(...args.slice(0, 4), {
        ...args[4],
        only: true,
    });
    test.skip = (...args) => test(...args.slice(0, 4), {
        ...args[4],
        skip: true,
    });

    return test;
};

const { Templater } = corgi;
describe('xlsx renderer', function() {
    const test = testTemplater('xlsx');

    it('should accept both filepaths and file streams', function(done) {
        const templater = new Templater(() => '');

        Promise.all([
            Excel().then((stream) => templater.render(stream, 'xlsx')),
            templater.render('./test/empty.xlsx'),
        ]).then(() => done(), done);
    });
    it('should require a filetype when passed a stream', function(done) {
        const templater = new Templater(() => '');

        Excel().then((stream) => templater.render(stream))
            .then(() => done('Did not throw'), () => done());
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

    describe('block expansion', function() {
        const simpleExpandingTemplater = new Templater({
            identify: (tag) => {
                const block = tag.match(/\d+/g)[0];
                return tag.includes('/')
                    ? corgi.block.close(block)
                    : corgi.block.open(block);
            },
            expand: (block) => Number(block),
        });

        test('should expand row blocks of differing sizes',
            simpleExpandingTemplater,
            Excel([
                [ '[[ 1 ]]', 'im expanded once', '[[ / 1 ]]' ],
            ], [
                [ '[[ 2 ]]', 'im expanded twice', '[[ / 2 ]]' ],
            ], [
                [ '[[ 10 ]]', 'im expanded ten times!', '[[ / 10 ]]' ],
            ]),
            Excel([
                [ null, 'im expanded once', null ],
            ], [
                ...new Array(2).fill([ null, 'im expanded twice', null ]),
            ], [
                ...new Array(10).fill([ null, 'im expanded ten times!', null ]),
            ]),
        );

        test('should expand column blocks of differing sizes',
            simpleExpandingTemplater,
            Excel([
                [ '[[ 1 ]]' ],
                [ 'im expanded once' ],
                [ '[[ / 1 ]]' ],
            ], [
                [ '[[ 2 ]]' ],
                [ 'im expanded twice' ],
                [ '[[ / 2 ]]' ],
            ], [
                [ '[[ 10 ]]' ],
                [ 'im expanded ten times!' ],
                [ '[[ / 10 ]]' ],
            ]),
            Excel([
                [ null ],
                [ 'im expanded once' ],
                [ null ],
            ], [
                new Array(2).fill(null),
                new Array(2).fill('im expanded twice'),
                new Array(2).fill(null),
            ], [
                new Array(10).fill(null),
                new Array(10).fill('im expanded ten times!'),
                new Array(10).fill(null),
            ])
        );

        test('should move surrounding cells',
            simpleExpandingTemplater,
            Excel([
                [ 'we',       'are',         'above',       'topright' ],
                [ '[[ 3 ]]',  'im expanded', '[[ / 3 ]]',   'im not'   ],
                [ 'we',       'are',         'below',       'botright' ],
            ], [
                [ 'we',       '[[ 3 ]]',     'we'       ],
                [ 'are',      'im expanded', 'are'      ],
                [ 'above',    '[[ / 3 ]]',   'below'    ],
                [ 'botleft',  'im not',      'botright' ],
            ]),
            Excel([
                [ 'we',       'are',         'above', 'topright' ],
                [ null,       'im expanded', null,    'im not'   ],
                [ null,       'im expanded', null                ],
                [ null,       'im expanded', null                ],
                [ 'we',       'are',         'below', 'botright' ],
            ], [
                [ 'we',       null,          null,          null,          'we'       ],
                [ 'are',      'im expanded', 'im expanded', 'im expanded', 'are'      ],
                [ 'above',    null,          null,          null,          'below'    ],
                [ 'botleft',  'im not',      'botright'                               ],
            ]),
        );

        test('should collapse empty blocks',
            simpleExpandingTemplater,
            Excel([
                [ 'we',       'are',         'above',     'topright' ],
                [ '[[ 0 ]] ', 'im expanded', '[[ / 0 ]]', 'im not'   ],
                [ 'we',       'are',         'below',     'botright' ],
            ], [
                [ 'top',   'in not',      'top'   ],
                [ 'we',    '[[ 0 ]]',     'we'    ],
                [ 'are',   'im expanded', 'are'   ],
                [ 'left',  '[[ / 0 ]]',   'right' ],
                [ 'bot',   'im not',      'bot'   ],
            ]),
            Excel([
                [ 'we',       'are',         'above',     'topright' ],
                [ 'we',       'are',         'below',     'im not'    ],
                [ null,       null,          null,        'botright' ],
            ], [
                [ 'top',   'in not',      'top'   ],
                [ 'we',    'we'                   ],
                [ 'are',   'are'                  ],
                [ 'left',  'right'                ],
                [ 'bot',   'im not',      'bot'   ],
            ]),
        );

        test('should expand multiple blocks independently',
            simpleExpandingTemplater,
            Excel([
                [ '[[ 2 ]]', 'twice',   '[[ 3 ]]',      '[[ / 2 ]]', '[[ 4 ]]', 'tres', '[[ / 4 ]]' ],
                [ 'nope',    'nah',     'thrice',       'no',        null,      'non'               ],
                [ 'nay',     '[[ 2 ]]', '[[ / 3 ]]wow', '[[ / 2 ]]', 'nopee'                        ],
            ]),
            Excel([
                [ null,   'twice',  null,     null,     null,     null,  null,   'tres', null  ],
                [ null,   'twice',  null,     null,     null,     null,  null,   'tres', null  ],
                [ null,   null,     null,     null,     null,     null,  null,   'tres', null  ],
                [ null,   null,     null,     null,     null,     null,  null,   'tres', null  ],
                [ 'nope', 'nah',    'thrice', 'thrice', 'thrice', 'no',  null,           'non' ],
                [ 'nay',  null,     'wow',    'wow',    'wow',    null,  'nopee'               ],
                [ null,   null,     'wow',    'wow',    'wow'                                  ],
            ]),
        );

        test('should parse templated tags',
            new Templater({
                identify: (tag) => tag.startsWith('open:')
                    ? corgi.block.open(tag.substring('open:'.length))
                    : tag.startsWith('close:') ? corgi.block.close(tag.substring('close:'.length))
                    : corgi.data(),
                expand: (block) => Number(block),
                evaluate: (tag, { cell, scopes }) => {
                    const scopesAsStrings = scopes.map(({ block, index }) => `[${block}.${index}]`);
                    return `${cell}:data:${tag}${scopesAsStrings.join('')}`;
                },
            }),
            Excel([
                [ '[[ open:3 ]]wow', '[[ foo ]]', '[[ bar ]][[ close:3 ]]', '[[ outside ]]' ],
            ]),
            Excel([
                [ 'wow', 'B1:data:foo[3.0]', 'C1:data:bar[3.0]', 'D1:data:outside' ],
                [ 'wow', 'B2:data:foo[3.1]', 'C2:data:bar[3.1]'                    ],
                [ 'wow', 'B3:data:foo[3.2]', 'C3:data:bar[3.2]'                    ],
            ]),
        );
    });
});
