const {
    constructArray,
    unique,
} = require('../lib/common');
const {
    columnOrdering,
    columnRange,
    columnToNumber,
    getCellContents,
    getWorksheetName,
    numberToColumn,
    parseCellReference,
} = require('../lib/excel');
const { XMLTagReplacer } = require('../lib/streams');
const {
    parseXMLTag,
    getXMLTagRegex,
    setXMLTagAttributes,
} = require('../lib/xml');
const { XLSXRenderError: RenderError } = require('../errors'); // TODO: all error messages standardised in errors.js, eg. XLSX.Unclosed(block, cell), GENERIC.Mismatch()
const { replace } = require('../lib/async');

const expandRows = (blocks, dimensionChanges) => XMLTagReplacer('row', (row, { attributes }) => {
    const { rowsAdded } = dimensionChanges;

    let rowNumber = parseInt(attributes['r']);
    const rowBlocks = blocks.filter(block => block.row === rowNumber);

    if (rowsAdded !== 0) { // row has been moved down/up by some other rows being expanded
        rowNumber += rowsAdded;
        row = setXMLTagAttributes(row.replace(getXMLTagRegex('c'), (cell) => {
            const { attributes } = parseXMLTag(cell);
            const { col } = parseCellReference(attributes['r']);
            return setXMLTagAttributes(cell, { 'r': col + rowNumber });
        }), { 'r': rowNumber });
    }

    if (!rowBlocks.length) return row;

    const blocksData = rowBlocks.map(block => block.data);
    const rowsToCreate = Math.max(...blocksData.map(d => d.length));
    const newRows = constructArray(rowsToCreate, (idx) => {
        if (idx === 0) return row;

        const blockColumns = rowBlocks
            .filter((block, num) => idx < blocksData[num].length)
            .map(block => columnRange(...block.col));
        const columnsToCopy = blockColumns
            .reduce((arr, cols) => [...arr, ...cols], []) // flatten
            .filter(unique())
            .sort(columnOrdering);

        const newRow = rowNumber + idx;
        return setXMLTagAttributes(row.replace(getXMLTagRegex('c'), (cell) => {
            const { attributes } = parseXMLTag(cell);
            const { col } = parseCellReference(attributes['r']);
            return columnsToCopy.includes(col) ? setXMLTagAttributes(cell, {
                'r': col + newRow,
            }) : '';
        }), {
            'r': newRow,
            'spans': columnToNumber(columnsToCopy[0]) + ':' + columnToNumber(columnsToCopy[1]),
        });
    });

    dimensionChanges.rowsAdded += rowsToCreate - 1;

    return newRows.join('');
}, { contentsOnly: false });
const expandCols = (blocks, dimensionChanges) => XMLTagReplacer('row', (row, { attributes }) => {
    const rowNumber = parseInt(attributes['r']);
    const rowBlocks = blocks.filter(block => block.row[0] <= rowNumber && rowNumber <= block.row[1]);

    let colsAdded = 0;
    return row.replace(getXMLTagRegex('c'), (cell) => {
        const { attributes } = parseXMLTag(cell);
        let { col } = parseCellReference(attributes['r']);
        const originalCol = col;
        const colBlocks = rowBlocks.filter(block => block.col === col);

        if (colsAdded !== 0) { // cells has been moved left/right by some other cells being expanded
            col = numberToColumn(columnToNumber(col) + colsAdded);
            cell = setXMLTagAttributes(cell, { 'r': col + rowNumber });
        }

        if (!colBlocks.length) return cell;

        const blocksData = colBlocks.map(block => block.data);
        const colsToCreate = Math.max(...blocksData.map(d => d.length));
        const newCells = constructArray(colsToCreate, (idx) => {
            const newCol = numberToColumn(columnToNumber(col) + idx);

            return setXMLTagAttributes(cell, { 'r': newCol + rowNumber });
        });
        colsAdded += colsToCreate - 1;

        if (!(col in dimensionChanges.colsAdded)) dimensionChanges.colsAdded[originalCol] = colsToCreate - 1;
        else dimensionChanges.colsAdded[originalCol] = Math.max(dimensionChanges.colsAdded[originalCol], colsToCreate - 1);

        return newCells.join('');
    });
}, { contentsOnly: false });
const updateDimensions = (dimensionChanges) => XMLTagReplacer('dimension', (dimension, { attributes }) => {
    const colsAdded = Object.values(dimensionChanges.colsAdded)
        .reduce((sum, added) => sum + added, 0);

    const [ oldStart, oldEnd ] = attributes['ref'].split(':');
    const { col, row } = parseCellReference(oldEnd);

    const newRow = row + dimensionChanges.rowsAdded;
    const newCol = numberToColumn(columnToNumber(col) + colsAdded);

    return setXMLTagAttributes(dimension, {
        'ref': `${oldStart}:${newCol}${newRow}`,
    });
}, { contentsOnly: false });
const updateColumns = (dimensionChanges) => XMLTagReplacer('col', (col, { attributes }) => {
    const min = Number(attributes['min']);
    const max = Number(attributes['max']);

    const colsAddedBefore = Object.keys(dimensionChanges.colsAdded).reduce((colsAddedBefore, col) => {
        const isBefore = columnToNumber(col) < min;
        if (!isBefore) return colsAddedBefore;
        const colsAdded = dimensionChanges.colsAdded[col];
        return colsAddedBefore + colsAdded;
    }, 0);
    const colsAddedDuring = Object.keys(dimensionChanges.colsAdded).reduce((colsAddedDuring, col) => {
        const colNum = columnToNumber(col);
        const isDuring = min <= colNum && colNum <= max;
        if (!isDuring) return colsAddedDuring;
        const colsAdded = dimensionChanges.colsAdded[col];
        return colsAddedDuring + colsAdded;
    }, 0);

    const newMin = min + colsAddedBefore;
    const newMax = max + colsAddedBefore + colsAddedDuring;
    return newMax < newMin ? '' : setXMLTagAttributes(col, {
        'min': newMin,
        'max': newMax,
    });
}, { contentsOnly: false });

class XLSXTemplater {
    constructor(zip, { parser, tagFinder }) {
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
                        if (zip.files[file].dir) return worksheets;

                        const sheetName = getWorksheetName(file);
                        if (!(sheetName in worksheets)) worksheets[sheetName] = {
                            path: `xl/worksheets/${sheetName}`,
                        };

                        const type = file.startsWith('xl/worksheets/_rels/')
                            ? 'rels' : 'sheet';
                        worksheets[sheetName][type] = zip.files[file].nodeStream();

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
        this.parse = (property) => parser(property, { cache });
        this.tagFinder = tagFinder;
    }

    async render() {
        const { openers, closers } = await this.findBlocks();
        console.log({ openers, closers });
        const blocks = await this.resolveBlocks(openers, closers);
        console.log({ blocks });

        await this.expandWorksheets(blocks);
    }

    // traverse sharedStrings.xml to find strings corresponding to blocks which need to be expanded
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
                    const parsed = await this.parse(tag.trim());

                    if (parsed.type.startsWith('block:')) {
                        if (!parsed.block) reject(new RenderError('Block is required when opening/closing'));
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

    // traverse a worksheet's cells, matching to those strings which needed to be expanded from findBlocks()
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
                if (sharedString in openers) openers[sharedString].forEach(block => {
                    openBlocks.push({
                        row: row,
                        col: col,
                        block: block.block,
                        data: block.data,
                    });
                });
                if (sharedString in closers) closers[sharedString].forEach(block => {
                    closedBlocks.push({
                        row: row,
                        col: col,
                        block: block.block,
                        data: block.data,
                    });
                });
            })).on('finish', () => {
                if (openBlocks.length !== closedBlocks.length) return void reject(new RenderError('Mismatched numbers of openers and closers'));

                for (const opener of openBlocks) {
                    const closers = closedBlocks.filter(closer => closer.block === opener.block);
                    const sameRow = closers.filter(closer => closer.row === opener.row);
                    const sameCol = closers.filter(closer => closer.col === opener.col);

                    if (!sameRow.length && !sameCol.length) return void reject(new RenderError(
                        `Unclosed block "${opener.block}"`,
                        { cell: opener.col + opener.row },
                    ));
                    else if (sameRow.length === 1 && !sameCol.length) blocks.row.push({
                        row: opener.row,
                        col: [opener.col, sameRow[0].col],
                        block: opener.block,
                        data: opener.data,
                    });
                    else if (sameCol.length === 1 && !sameRow.length) blocks.col.push({
                        row: [opener.row, sameCol[0].row],
                        col: opener.col,
                        block: opener.block,
                        data: opener.data,
                    });
                    else return void reject(new RenderError(
                        `Multiple matching closers for block "${opener.block}"`,
                        { cell: opener.col + opener.row },
                    ));
                }

                resolve(blocks);
            });
        });
    }
    // traverse all worksheets, matching cells to those strings which needed to be expanded from findBlocks()
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
        // expand
        const worksheets = this.worksheets;
        const dimensionChanges = {};
        await Promise.all(Object.keys(worksheets).map(async(ws) => {
            dimensionChanges[ws] = {
                colsAdded: {},
                rowsAdded: 0,
            };
            const expanded = worksheets[ws].sheet
                .pipe(expandCols(blocks[ws].col, dimensionChanges[ws]))
                .pipe(expandRows(blocks[ws].row, dimensionChanges[ws]));
            await this.update(worksheets[ws].path, expanded);
        }));
        // update dimensions
        const expanded = this.worksheets;
        await Promise.all(Object.keys(dimensionChanges).map(async(ws) => {
            const updated = expanded[ws].sheet
                .pipe(updateDimensions(dimensionChanges[ws]))
                .pipe(updateColumns(dimensionChanges[ws]));
            await this.update(expanded[ws].path, updated);
        }));
    }
}

module.exports = XLSXTemplater;
