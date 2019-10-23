const {
    getWorksheetName,
    parseCellReference,
    getCellContents,
    columnRange,
} = require('../lib/excel');
const { XMLTagReplacer } = require('../lib/streams');
const {
    parseXMLTag,
    getXMLTagRegex,
    setXMLTagAttributes,
} = require('../lib/xml');
const { XLSXRenderError: RenderError } = require('../errors');
const { replace } = require('../lib/async');

function expandCols(blocks) {
    // console.log(blocks);
    return XMLTagReplacer('c', (cell, { attributes }) => {
        const { row, col } = parseCellReference(attributes['r']);
        const colBlocks = blocks.filter(block => block.col === col);
        const colBlocksInRow = colBlocks.filter(block => block.row[0] <= row && block.row[1] <= row);
        // console.log(attributes['r'], colBlocksInRow);
        // console.log(cell);
        return cell;
    });
}
function expandRows(blocks) {
    return XMLTagReplacer('row', (row, { attributes }) => {
        const rowNumber = parseInt(attributes['r']);
        const rowBlocks = blocks.filter(block => block.row === rowNumber);
        if (!rowBlocks.length) return row;

        // console.log(row, rowBlocks);
        const blocksData = rowBlocks.map(block => block.data);
        const rowsToCreate = Math.max(...blocksData.map(d => d.length));
        const newRows = (new Array(rowsToCreate)).fill(row)
            .map((row, idx) => {
                const blockColumns = rowBlocks
                    .filter((block, num) => idx < blocksData[num].length)
                    .map(block => columnRange(...block.col));
                const columnsToCopy = blockColumns
                    .reduce((arr, cols) => [...arr, ...cols])
                    .filter((col, idx, cols) => cols.indexOf(col) === idx);

                const newRow = rowNumber + idx;
                return setXMLTagAttributes(row.replace(getXMLTagRegex('c'), cell => {
                    const { attributes } = parseXMLTag(cell);
                    const { col } = parseCellReference(attributes['r']);
                    return columnsToCopy.includes(col) ? setXMLTagAttributes(cell, {
                        'r': col + newRow,
                    }) : '';
                }), { 'r': newRow });
            });
        // console.log(newRows);
        return newRows.join('');
    }, { contentsOnly: false });
}
class XLSXTemplater {
    constructor(zip, templatr) {
        Object.defineProperties(this, {
            sharedStrings: {
                get() {
                    return zip.files['xl/sharedStrings.xml'].nodeStream();
                },
            },
            worksheets: {
                get() {
                    const worksheets = Object.keys(zip.files).reduce((worksheets, file) => {
                        if (!file.startsWith('xl/worksheets/')) return worksheets;

                        const sheetName = getWorksheetName(file);
                        if (!(sheetName in worksheets)) worksheets[sheetName] = {
                            path: `xl/worksheets/${sheetName}`,
                        };

                        if (file.startsWith('xl/worksheets/_rels/')) {
                            worksheets[sheetName]['rels'] = zip.files[file].nodeStream();
                        } else {
                            worksheets[sheetName]['sheet'] = zip.files[file].nodeStream();
                        }
                        return worksheets;
                    }, {});
                    Object.keys(worksheets).forEach(name => {
                        if (!('sheet' in worksheets[name]))
                            throw new Error(`Worksheet ${name} has rels but no xml`);
                    });
                    return worksheets;
                },
            },
        });
        this.update = function(file, stream) {
            return new Promise((resolve, reject) => {
                const buffers = [];
                stream.on('data', data => buffers.push(data));
                stream.on('error', err => reject(err));
                stream.on('end', () => {
                    zip.file(file, Buffer.concat(buffers));
                    resolve();
                });
            });
        };

        const cache = new Map();
        this.parse = function(property) {
            return templatr.parser(property, { cache });
        };
        this.tagFinder = templatr.tagFinder;
    }

    async render() {
        const { openers, closers } = await this.findBlocks();
        console.log({ openers, closers });
        const blocks = await this.resolveBlocks(openers, closers);
        console.log({ blocks });

        await this.expandWorksheets(blocks);
    }

    findBlocks() {
        return new Promise((resolve, reject) => {
            const openers = {};
            const closers = {};

            let counter = 0;
            const traverse = async(sharedString) => {
                const sharedStringID = counter++;
                const blocksOpened = [];
                const blocksClosed = [];
                await replace(sharedString, this.tagFinder, async(match, tag) => {
                    const parsed = await this.parse(tag);

                    if (parsed.type.startsWith('block:')) {
                        if (!parsed.block) reject('Block is required when opening/closing');
                    } else return;

                    if (parsed.type === 'block:open') {
                        const existing = blocksClosed.find(b => b.block === parsed.block);
                        if (existing) blocksClosed.splice(blocksClosed.indexOf(existing), 1);
                        else blocksOpened.push({ block: parsed.block, data: parsed.data });
                    } else if (parsed.type === 'block:close') {
                        const existing = blocksOpened.find(b => b.block === parsed.block);
                        if (existing) blocksOpened.splice(blocksOpened.indexOf(existing), 1);
                        else blocksClosed.push({ block: parsed.block, data: parsed.data });
                    }
                });

                blocksOpened.forEach(block => {
                    if (!(sharedStringID in openers)) openers[sharedStringID] = [];
                    openers[sharedStringID].push(block);
                });
                blocksClosed.forEach(block => {
                    if (!(sharedStringID in closers)) closers[sharedStringID] = [];
                    closers[sharedStringID].push(block);
                });
            };

            this.sharedStrings
                .pipe(XMLTagReplacer('si', traverse))
                .on('finish', () => resolve({ openers, closers }));
        });
    }

    resolveWorksheetBlocks(sheet, openers, closers) {
        return new Promise((resolve, reject) => {
            const blocks = { row: [], col: [] };

            const openBlocks = [];
            const closedBlocks = [];
            sheet.pipe(XMLTagReplacer('c', (cell, { attributes }) => {
                const isSharedString = attributes['t'] === 's';
                if (!isSharedString) return;

                const { row, col } = parseCellReference(attributes['r']);
                const sharedString = getCellContents(cell);
                if (sharedString in openers) {
                    openers[sharedString].forEach(block => {
                        openBlocks.push({
                            row: row,
                            col: col,
                            block: block.block,
                            data: block.data,
                        });
                    });
                }
                if (sharedString in closers) {
                    closers[sharedString].forEach(block => {
                        closedBlocks.push({
                            row: row,
                            col: col,
                            block: block.block,
                            data: block.data,
                        });
                    });
                }
            })).on('finish', () => {
                if (openBlocks.length !== closedBlocks.length)
                    reject(new RenderError('Mismatched numbers of openers and closers'));

                openBlocks.forEach(opener => {
                    const closers = closedBlocks.filter(closer => closer.block === opener.block);
                    const sameRow = closers.filter(closer => closer.row === opener.row);
                    const sameCol = closers.filter(closer => closer.col === opener.col);

                    if (!sameRow.length && !sameCol.length) {
                        reject(new RenderError(`Unclosed block "${opener.block}"`, { cell: opener.col + opener.row }));
                    } else if (sameRow.length === 1 && !sameCol.length) {
                        blocks.row.push({
                            row: opener.row,
                            col: [opener.col, sameRow[0].col],
                            block: opener.block,
                            data: opener.data,
                        });
                    } else if (sameCol.length === 1 && !sameRow.length) {
                        blocks.col.push({
                            row: [opener.row, sameCol[0].row],
                            col: opener.col,
                            block: opener.block,
                            data: opener.data,
                        });
                    } else {
                        reject(new RenderError(`Multiple matching closers for block "${opener.block}"`, { cell: opener.col + opener.row }));
                    }
                });

                resolve(blocks);
            });
        });
    }
    async resolveBlocks(openers, closers) {
        const worksheets = this.worksheets;
        const blocks = {};
        await Promise.all(Object.keys(worksheets).map(async(ws) => {
            const worksheetBlocks = await this.resolveWorksheetBlocks(worksheets[ws].sheet, openers, closers)
                .catch((err) => {
                    if (err instanceof RenderError) throw err.setWorksheet(ws);
                    else throw err;
                });
            blocks[ws] = worksheetBlocks;
        }));
        return blocks;
    }

    async expandWorksheets(blocks) {
        const worksheets = this.worksheets;
        await Promise.all(Object.keys(worksheets).map(async(ws) => {
            const expanded = worksheets[ws].sheet
                .pipe(expandCols(blocks[ws].col, this.parse))
                .pipe(expandRows(blocks[ws].row, this.parse));
            await this.update(worksheets[ws].path, expanded);
        }));
    }
}

module.exports = XLSXTemplater;
