const format = require('xml-formatter');
const ignore = require('ignore');
const jsdiff = require('diff');
const JSZip = require('jszip');
const path = require('path');

const { getSharedStringContents } = require('../lib/excel');
const {
    XMLTagReplacer,
    finish,
} = require('../lib/streams');

const STRING_FILES = ['.xml', '.rels'];

async function getSharedStrings(zip) {
    const file = zip.files['xl/sharedStrings.xml'];
    const sharedStrings = [];
    const getting = file.nodeStream().pipe(XMLTagReplacer(
        'si',
        (sharedString, { index: sharedStringID }) => sharedStrings[sharedStringID] = getSharedStringContents(sharedString),
        { contentsOnly: true },
    ));
    await finish(getting);
    return sharedStrings;
}

module.exports = async function getDiff(buf1, buf2, {
    ignoreFiles = [],
    ignoreDirectories = true,
    ignoreSharedStringOrder = false, // when diffing xlsx, whether sharedstrings order (therefore ids) matters
} = {}) {
    const diff = [];
    if (buf1.equals(buf2)) return diff;

    const [ zip1, zip2 ] = await Promise.all([ buf1, buf2 ].map(b => JSZip.loadAsync(b)));

    const matcher = ignore().add(ignoreFiles);
    const toDiff = [];
    for (const filename in zip1.files) {
        if (matcher.ignores(filename)) continue;
        const file = zip1.files[filename];
        if (ignoreDirectories && file.dir) continue;
        if (!(filename in zip2.files)) diff.push({
            type: 'removed',
            file: filename,
        });
        else toDiff.push({
            file: filename,
            versions: [ file, zip2.files[filename] ],
        });
    }
    for (const filename in zip2.files) {
        if (matcher.ignores(filename)) continue;
        const file = zip2.files[filename];
        if (ignoreDirectories && file.dir) continue;
        if (!(filename in zip1.files)) diff.push({
            type: 'added',
            file: filename,
        });
    }

    const sharedStrings = !ignoreSharedStringOrder ? []
        : await Promise.all([ zip1, zip2 ].map(getSharedStrings));

    for (const { file, versions } of toDiff) {
        const filetype = path.extname(file);
        const contents = await Promise.all(versions.map(f => f.async('nodebuffer')));

        const hasChanged = !contents[0].equals(contents[1]);
        if (!hasChanged) continue;

        if (ignoreSharedStringOrder && file === 'xl/sharedStrings.xml') {
            const sortedStrings = sharedStrings.map(s => Array.from(s).sort());
            const changes = [];
            for (let idx = 0; idx < sortedStrings[0].length; idx++) {
                const oldString = sortedStrings[0][idx];
                const newString = sortedStrings[1][idx];

                if (oldString !== newString) changes.push([
                    { type: 'removed', line: oldString },
                    ...idx < sortedStrings[1].length
                        ? [ { type: 'added', line: newString } ]
                        : [],
                ]);
            }
            for (let idx = sortedStrings[0].length; idx < sortedStrings[1].length; idx++) {
                const newString = sortedStrings[1][idx];
                changes.push([
                    { type: 'added', line: newString },
                ]);
            }
            if (changes.length) diff.push({
                type: 'changed',
                file: file,
                changes: changes,
            });
        } else if (STRING_FILES.includes(filetype)) {
            const formatted = contents.map(buf => format(buf.toString(), {
                lineSeparator: '\n',
            }));
            const fileDiff = jsdiff.diffLines(formatted[0], formatted[1]);

            const changes = [];
            for (let idx = 0; idx < fileDiff.length; idx++) {
                const { value, added, removed } = fileDiff[idx];
                if (!added && !removed) continue;

                const next = fileDiff[idx + 1];
                const changed = next.added === removed
                    && next.removed === added;

                const contextBefore = idx === 0 ? [] : fileDiff[idx - 1].value
                    .replace(/\n$/g, '')
                    .split('\n');
                if (changed) idx += 1;
                const contextAfter = idx >= fileDiff.length - 1 ? [] : fileDiff[idx + 1].value
                    .replace(/\n$/g, '')
                    .split('\n');

                changes.push([
                    ...contextBefore.slice(contextBefore.length - 2).map(l => {
                        return { type: 'context', line: l };
                    }),
                    ...value.replace(/\n$/g, '').split('\n').map(l => {
                        return { type: added ? 'added' : 'removed', line: l };
                    }),
                    ...changed ? fileDiff[idx].value.replace(/\n$/g, '').split('\n').map(l => {
                        return { type: added ? 'removed' : 'added', line: l };
                    }) : [],
                    ...contextAfter.slice(0, 2).map(l => {
                        return { type: 'context', line: l };
                    }),
                ]);
            }

            const isWorksheet = file.startsWith('xl/worksheets/')
                && !file.startsWith('xl/worksheets/_rels/');
            if (ignoreSharedStringOrder && isWorksheet) {
                const actualChanges = changes.reduce((actualChanges, change) => {
                    const isSharedStringIDChange = change[0].type === 'context' && /^\s*<c.*?(t="s".*?)?>$/.test(change[0].line)
                        && change[1].type === 'context' && /^\s*<v>$/.test(change[1].line)
                        && change[2].type === 'removed' && /^\s*\d+$/.test(change[2].line)
                        && change[3].type === 'added' && /^\s*\d+$/.test(change[3].line)
                        && change[4].type === 'context' && /^\s*<\/v>$/.test(change[4].line)
                        && change[5].type === 'context' && /^\s*<\/c>$/.test(change[5].line);
                    if (!isSharedStringIDChange) actualChanges.push(change);
                    else {
                        const cellRef = change[0].line.match(/^\s*<c.*?r="(\w+)".*?>$/)[1];

                        const oldSharedStringID = change[2].line.match(/^\s*(\d+)$/)[1];
                        const newSharedStringID = change[3].line.match(/^\s*(\d+)$/)[1];
                        const oldSharedString = sharedStrings[0][oldSharedStringID];
                        const newSharedString = sharedStrings[1][newSharedStringID];

                        if (oldSharedString !== newSharedString) actualChanges.push([
                            { type: 'context', line: `Cell ${cellRef}` },
                            { type: 'removed', line: oldSharedString },
                            { type: 'added', line: newSharedString },
                        ]);
                    }
                    return actualChanges;
                }, []);
                if (actualChanges.length) diff.push({
                    type: 'changed',
                    file: file,
                    changes: actualChanges,
                });
            } else diff.push({
                type: 'changed',
                file: file,
                changes: changes,
            });
        } else diff.push({
            type: 'changed',
            file: file,
        });
    }

    return diff.sort((a, b) => a.file.localeCompare(b.file));
};
