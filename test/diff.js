const format = require('xml-formatter');
const ignore = require('ignore');
const jsdiff = require('diff');
const JSZip = require('jszip');
const path = require('path');

const STRING_FILES = ['.xml', '.rels'];
module.exports = async function getDiff(buf1, buf2, {
    ignoreFiles = [],
    ignoreDirectories = true,
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

    for (const { file, versions } of toDiff) {
        const filetype = path.extname(file);
        const contents = await Promise.all(versions.map(f => f.async('nodebuffer')));

        const hasChanged = !contents[0].equals(contents[1]);
        if (!hasChanged) continue;

        if (STRING_FILES.includes(filetype)) {
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

            diff.push({
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
