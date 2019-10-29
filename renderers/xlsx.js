const { TAG_TYPES } = require('../lib/enums');
const {
    TagParserError,
    XLSXRenderError: RenderError,
} = require('../errors');
const {
    constructArray,
} = require('../lib/common');
const {
    columnsInclude,
    columnToNumber,
    getCellContents,
    getSharedStringContents,
    getWorksheetName,
    setCellContents,
    numberToColumn,
    parseCellReference,
} = require('../lib/excel');
const {
    XMLTagReplacer,
    finish,
} = require('../lib/streams');
const {
    parseXMLTag,
    getXMLTagRegex,
    setXMLTagAttributes,
    setXMLTagContents,
} = require('../lib/xml');
const { replace } = require('../lib/async');

const expandRows = (blocks, dimensionChanges) => XMLTagReplacer('row', (row, { attributes }) => { // TODO: this happens after expandCols, put it below
    const { rowsAdded } = dimensionChanges;

    let rowNumber = parseInt(attributes['r']);
    const rowBlocks = blocks.row.filter(block => block.row === rowNumber);

    if (rowsAdded !== 0) { // row has been moved down/up by some other rows being expanded
        rowNumber += rowsAdded;
        row = setXMLTagAttributes(row.replace(getXMLTagRegex('c'), (cell) => {
            const { attributes } = parseXMLTag(cell);
            const { col } = parseCellReference(attributes['r']);
            return setXMLTagAttributes(cell, { 'r': col + rowNumber });
        }), { 'r': rowNumber });
    }

    if (!rowBlocks.length) return row;

    const blockSizes = rowBlocks.map(block => block.size);
    const rowsToCreate = Math.max(...blockSizes);
    const newRows = constructArray(rowsToCreate, (idx) => {
        if (idx === 0) return row;
        const newRowNum = rowNumber + idx;

        // blocks which get expanded this far (have at least size `idx`)
        const thisRowBlocks = rowBlocks
            .filter((block, num) => idx < blockSizes[num]);
        // logic to figure out if a column from the original row should be copied this far
        const thisRowBlocksIncludes = thisRowBlocks
            .map((block) => columnsInclude(block.col[0], block.col[1]));
        const shouldCopy = (col) => thisRowBlocksIncludes
            .some((includes) => includes(col));

        let minCol = Infinity;
        let maxCol = -Infinity;
        const newRow = row.replace(getXMLTagRegex('c'), (cell) => {
            const { attributes } = parseXMLTag(cell);
            const { col } = parseCellReference(attributes['r']);

            if (!shouldCopy(col)) return '';

            const colNum = columnToNumber(col);
            if (colNum < minCol) minCol = colNum;
            if (colNum > maxCol) maxCol = colNum;

            return setXMLTagAttributes(cell, { 'r': `${col}${newRowNum}` });
        });

        if (![ minCol, maxCol ].every(Number.isFinite)) throw new Error(`Unable to update row span: ${row}`);
        return setXMLTagAttributes(newRow, {
            'r': newRowNum,
            'spans': columnToNumber(minCol) + ':' + columnToNumber(maxCol),
        });
    });

    dimensionChanges.rowsAdded += rowsToCreate - 1;

    return newRows.join('');
});
const expandCols = (blocks, dimensionChanges) => XMLTagReplacer('row', (row, { attributes }) => {
    const rowNumber = parseInt(attributes['r']);
    const colBlocks = blocks.col.filter(block => block.row[0] <= rowNumber && rowNumber <= block.row[1]);

    // keep track of cells which moved column, so we can update the positions of rowBlocks
    const movedColumns = {};

    let colsAdded = 0;
    row = row.replace(getXMLTagRegex('c'), (cell) => {
        const { attributes } = parseXMLTag(cell);
        let { col } = parseCellReference(attributes['r']);
        const originalCol = col;
        const thisCellBlocks = colBlocks.filter(block => block.col === col);

        if (colsAdded !== 0) { // cells has been moved left/right by some other cells being expanded
            col = numberToColumn(columnToNumber(col) + colsAdded);
            cell = setXMLTagAttributes(cell, { 'r': col + rowNumber });
        }

        // prepare to store which columns this one was moved to
        if (colsAdded !== 0 || thisCellBlocks.length) movedColumns[originalCol] = [ col, col ];

        if (!thisCellBlocks.length) return cell;

        const blockSizes = colBlocks.map(block => block.size);
        const colsToCreate = Math.max(...blockSizes);
        const newCells = constructArray(colsToCreate, (idx) => {
            const newCol = numberToColumn(columnToNumber(col) + idx);
            return setXMLTagAttributes(cell, { 'r': newCol + rowNumber });
        });
        colsAdded += colsToCreate - 1;

        if (!(col in dimensionChanges.colsAdded)) dimensionChanges.colsAdded[originalCol] = colsToCreate - 1;
        else dimensionChanges.colsAdded[originalCol] = Math.max(dimensionChanges.colsAdded[originalCol], colsToCreate - 1);

        movedColumns[originalCol][1] = numberToColumn(columnToNumber(col) + colsToCreate - 1);
        return newCells.join('');
    });

    const rowBlocks = blocks.row.filter(block => block.row === rowNumber);
    for (const block of rowBlocks) {
        const [ startCol, endCol ] = block.col;
        if (startCol in movedColumns) block.col[0] = movedColumns[startCol][0];
        if (endCol in movedColumns) block.col[1] = movedColumns[endCol][1];
    }

    const [ oldStart, oldEnd ] = attributes['spans'].split(':');
    const newEnd = Number(oldEnd) + colsAdded;
    return setXMLTagAttributes(row, { 'spans': `${oldStart}:${newEnd}` });
});
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
});
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
});

const SHARED_STRINGS = 'xl/sharedStrings.xml';
const POSSIBLE_TAG_TYPES = Object.values(TAG_TYPES);
class XLSX {
    constructor(zip) {
        Object.defineProperties(this, {
            sharedStrings: {
                get() {
                    return zip.files[SHARED_STRINGS].nodeStream();
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
                    for (const ws in worksheets) {
                        if (!('sheet' in worksheets[ws])) throw new Error(`Relationships file for worksheet ${ws} exists, but no content was found`);
                    }
                    return worksheets;
                },
            },
        });

        // update the contents of a file in the archive
        this.update = (file, stream) => zip.file(file, stream);
        // NOTE: JSZip keeps file contents internally as promise-based
        // so setting contents to a stream is instantaneous
        // (operation that takes time is reading a file's content)
    }

    // traverse sharedStrings.xml to find strings corresponding to blocks which need to be expanded
    async findBlocks(tagFinder, identify) {
        const openers = {};
        const closers = {};
        const toParse = new Map();

        const traverse = async(sharedString, { index: sharedStringID }) => {
            const blocksOpened = [];
            const blocksClosed = [];
            // replace is just to iterate, doesn't actually change the string value
            sharedString = await replace(sharedString, tagFinder, async(match, tag) => {
                tag = tag.trim();

                const parsed = await identify(tag);
                if (!parsed) throw TagParserError.Unidentified(match);
                const { type } = parsed;
                if (!POSSIBLE_TAG_TYPES.includes(type)) throw TagParserError.UnrecognisedType(match, type);

                switch (type) {
                case TAG_TYPES.BLOCK_OPEN:
                    if (!parsed.block) throw TagParserError.MissingBlock(match);
                    blocksOpened.push(parsed.block);
                    return '';
                case TAG_TYPES.BLOCK_CLOSE:
                    if (!parsed.block) throw TagParserError.MissingBlock(match);
                    blocksClosed.push(parsed.block);
                    return '';
                default:
                    toParse.set(sharedStringID, []);
                    return match;
                }
            });

            blocksOpened.forEach((block) => {
                if (!(sharedStringID in openers)) openers[sharedStringID] = [];
                openers[sharedStringID].push(block);
            });
            blocksClosed.forEach((block) => {
                if (!(sharedStringID in closers)) closers[sharedStringID] = [];
                closers[sharedStringID].push(block);
            });

            return sharedString;
        };

        const traversing = this.sharedStrings
            .pipe(XMLTagReplacer('si', traverse, { contentsOnly: true }));
        this.update(SHARED_STRINGS, traversing);

        await finish(traversing);
        return { openers, closers, toParse };
    }

    // traverse a worksheet's cells, matching to those strings which needed to be expanded from findBlocks()
    async resolveWorksheetBlocks(sheet, openers, closers) {
        const openBlocks = [];
        const closedBlocks = [];

        const resolve = sheet.pipe(XMLTagReplacer('c', (cell, { attributes }) => {
            const isSharedString = attributes['t'] === 's';
            if (!isSharedString) return;

            const { row, col } = parseCellReference(attributes['r']);
            const sharedString = getCellContents(cell);
            for (const block of openers[sharedString] || []) openBlocks.push({
                row: row,
                col: col,
                block: block,
            });
            for (const block of closers[sharedString] || []) closedBlocks.push({
                row: row,
                col: col,
                block: block,
            });
        }));
        await finish(resolve);

        if (openBlocks.length !== closedBlocks.length) throw RenderError.BlockMismatch();

        const blocks = { row: [], col: [] };
        for (const opener of openBlocks) {
            const closers = closedBlocks.filter(closer => closer.block === opener.block);
            const sameRow = closers.filter(closer => closer.row === opener.row);
            const sameCol = closers.filter(closer => closer.col === opener.col);

            if (!sameRow.length && !sameCol.length) throw RenderError.UnclosedBlock(opener.block)
                .setCell(opener.col + opener.row);
            else if (sameRow.length === 1 && !sameCol.length) blocks.row.push({
                row: opener.row,
                col: [opener.col, sameRow[0].col],
                block: opener.block,
            });
            else if (sameCol.length === 1 && !sameRow.length) blocks.col.push({
                row: [opener.row, sameCol[0].row],
                col: opener.col,
                block: opener.block,
            });
            else throw RenderError.AmbiguousBlock(opener.block)
                .setCell(opener.col + opener.row);
        }

        return blocks;
    }
    // traverse all worksheets, matching cells to those strings which needed to be expanded from findBlocks()
    async resolveBlocks(openers, closers, expand) {
        // resolve block positions
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

        // resolve block sizes
        await Promise.all(Object.keys(blocks).map(ws => {
            return Promise.all([
                blocks[ws].row,
                blocks[ws].col,
            ].map(arr => Promise.all(arr.map(async(block, idx) => {
                const blockSize = await expand(block.block, {
                    worksheet: ws,
                    row: block.row,
                    col: block.col,
                });
                arr[idx].size = blockSize;
            }))));
        }));

        return blocks;
    }

    // given previously resolved blocks, expand worksheet rows/columns as necessary
    async expandWorksheets(blocks) {
        // expand
        const worksheets = this.worksheets;
        const dimensionChanges = {};
        await Promise.all(Object.keys(worksheets).map(async(ws) => {
            dimensionChanges[ws] = {
                colsAdded: {},
                rowsAdded: 0,
            };
            const expanding = worksheets[ws].sheet
                .pipe(expandCols(blocks[ws], dimensionChanges[ws]))
                .pipe(expandRows(blocks[ws], dimensionChanges[ws],));
            this.update(worksheets[ws].path, expanding);
            await finish(expanding);
        }));
        // update dimensions
        const expanded = this.worksheets;
        for (const ws in dimensionChanges) {
            const updating = expanded[ws].sheet
                .pipe(updateDimensions(dimensionChanges[ws]))
                .pipe(updateColumns(dimensionChanges[ws]));
            this.update(expanded[ws].path, updating);
        }
    }

    // figure out which scopes the sharedStrings in toParse need to be resolved against
    async resolveSharedStringScopes(toParse, blocks) {
        let totalSharedStringCount = 0;

        const worksheets = this.worksheets;
        await Promise.all(Object.keys(worksheets).map(async(ws) => {
            const worksheetBlocks = blocks[ws];
            const stream = worksheets[ws].sheet.pipe(XMLTagReplacer('c', (cell, { attributes }) => {
                if (attributes['t'] !== 's') return cell;

                totalSharedStringCount += 1;
                const sharedStringID = Number(getCellContents(cell));
                if (!toParse.has(sharedStringID)) return cell;

                const { row, col } = parseCellReference(attributes['r']);

                const rowBlocks = worksheetBlocks.row.filter(block => {
                    const endRow = block.row + block.size;
                    return block.row <= row && row <= endRow
                        && columnsInclude(block.col[0], block.col[1])(col);
                }).map(block => ({
                    block: block.block,
                    index: row - block.row,
                }));
                const colBlocks = worksheetBlocks.col.filter(block => {
                    const endCol = numberToColumn(columnToNumber(block.col) + block.size);
                    return block.row[0] <= row && row <= block.row[1]
                        && columnsInclude(block.col, endCol)(col);
                }).map(block => ({
                    block: block.block,
                    index: columnToNumber(col) - columnToNumber(block.col),
                }));

                toParse.get(sharedStringID).push({
                    worksheet: ws,
                    cell: attributes['r'],
                    scopes: rowBlocks.concat(colBlocks),
                });

                return cell;
            }, { contentsOnly: true }));
            // even though we're not actually updating the worksheet contents, need to do this otherwise its stream is already consumed
            this.update(worksheets[ws].path, stream);
            await finish(stream);
        }));

        return { totalSharedStringCount };
    }
    async pruneSharedStrings(used) {
        // map old sharedString to its new id
        const moved = new Map(used.entries());

        let pruned = 0;
        let uniqueSharedStringCount = 0;
        const seen = new Map();
        const pruning = this.sharedStrings.pipe(XMLTagReplacer('si', (sharedString, { index: sharedStringID }) => {
            // prune all unused strings
            const isUnused = !used.has(sharedStringID);
            if (isUnused) {
                pruned += 1;
                return '';
            }

            // prune all empty strings
            const string = getSharedStringContents(sharedString);
            const isEmpty = !string;
            if (isEmpty) {
                pruned += 1;
                moved.set(sharedStringID, null);
                return '';
            }

            // prune all duplicate strings
            const isDuplicate = seen.has(string);
            if (isDuplicate) {
                pruned += 1;
                moved.set(sharedStringID, seen.get(string));
                return '';
            }

            // unpruned, but id might have changed due to previous prunings
            const newSharedStringID = moved.get(sharedStringID) - pruned;
            moved.set(sharedStringID, newSharedStringID);

            uniqueSharedStringCount += 1;
            return sharedString;
        }));
        this.update(SHARED_STRINGS, pruning);
        await finish(pruning);

        // update worksheets cells to point to new sharedstring locations post-pruning

        let totalSharedStringCount = 0;
        const worksheets = this.worksheets;
        await Promise.all(Object.keys(worksheets).map(async(ws) => {
            const updating = worksheets[ws].sheet.pipe(XMLTagReplacer('c', (cell, { attributes }) => {
                if (attributes['t'] !== 's') return cell;

                const sharedStringID = Number(getCellContents(cell));
                const newSharedStringID = moved.get(sharedStringID);

                if (newSharedStringID === null) {
                    const { t, r, ...extraAttributes } = attributes;
                    const remainingAttributes = Object.keys(extraAttributes).length;
                    return remainingAttributes
                        ? setXMLTagContents(setXMLTagAttributes(cell, { t: null }), null)
                        : '';
                } else totalSharedStringCount += 1;

                return setCellContents(cell, newSharedStringID);
            })).pipe(XMLTagReplacer('row', (row, { attributes }) => {
                const { contents } = parseXMLTag(row);
                if (contents.trim()) return row;

                const { r, spans, ...extraAttributes } = attributes;
                const remainingAttributes = Object.keys(extraAttributes).length;
                return remainingAttributes ? row
                    : '';
            }));
            this.update(worksheets[ws].path, updating);
            await finish(updating);
        }));

        const updatedCounts = this.sharedStrings.pipe(XMLTagReplacer('sst', (sst) => setXMLTagAttributes(sst, {
            count: totalSharedStringCount,
            uniqueCount: uniqueSharedStringCount,
        })));
        this.update(SHARED_STRINGS, updatedCounts);
    }
    async updateSharedStrings(toParse, {
        blocks,
        evaluate,
        tagFinder,
    }) {
        // get total number of sharedStrings used, and update toParse to figure out which scopes its strings need to be resolved against

        await this.resolveSharedStringScopes(toParse, blocks);

        // parse each sharedString in toParse against each of its scopes

        const updateSharedString = async(sharedString, { index: sharedStringID }) => {
            if (!toParse.has(sharedStringID)) return sharedString;

            const scopes = toParse.get(sharedStringID);
            const evaluateScope = (scope) => replace(
                sharedString,
                tagFinder,
                (match, tag) => evaluate(tag.trim(), scope)
            );

            const newStrings = await Promise.all(scopes.map(evaluateScope));
            return newStrings.join('');
        };
        const updated = this.sharedStrings.pipe(XMLTagReplacer('si', updateSharedString));
        this.update(SHARED_STRINGS, updated);

        // update cell sharedString references to point to newly created strings for its scope

        const sharedStringsUsed = new Set();
        const added = Array.from(toParse).reduce((added, [ id, created ]) => {
            added[id] = created.length - 1;
            return added;
        }, []);
        const worksheets = this.worksheets;
        await Promise.all(Object.keys(worksheets).map(async(ws) => {
            const updating = worksheets[ws].sheet.pipe(XMLTagReplacer('c', (cell, { attributes }) => {
                if (attributes['t'] !== 's') return cell;

                const sharedStringID = Number(getCellContents(cell));
                const addedBefore = added.slice(0, sharedStringID);
                const totalAdded = toParse.has(sharedStringID)
                    ? toParse.get(sharedStringID).findIndex(({ cell }) => cell === attributes['r'])
                        + addedBefore.reduce((sum, strings) => sum + strings, 0)
                    : addedBefore.reduce((sum, strings) => sum + strings, 0);

                const newSharedStringID = sharedStringID + totalAdded;
                sharedStringsUsed.add(newSharedStringID);
                return setCellContents(cell, newSharedStringID.toString());
            }));
            this.update(worksheets[ws].path, updating);
            await finish(updating);
        }));

        // remove unused/duplicate/empty strings

        await this.pruneSharedStrings(sharedStringsUsed);
    }
}

module.exports = async function render(zip, tagFinder, parser) {
    const xlsx = new XLSX(zip);

    const {
        openers,
        closers,
        toParse,
    } = await xlsx.findBlocks(tagFinder, parser.identify);
    const blocks = await xlsx.resolveBlocks(openers, closers, parser.expand);

    await xlsx.expandWorksheets(blocks);

    await xlsx.updateSharedStrings(toParse, {
        blocks: blocks,
        evaluate: parser.evaluate,
        tagFinder: tagFinder,
    });
};
