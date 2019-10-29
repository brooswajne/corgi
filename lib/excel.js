const { numericalOrdering } = require('./common');
const {
    getXMLTagRegex,
    parseXMLTag,
    setXMLTagContents,
} = require('./xml');
const { XMLParserError } = require('../errors');

function parseCellReference(reference) {
    return {
        row: parseInt(reference.match(/\d+/g)[0]),
        col: reference.match(/[A-Z]+/g)[0],
    };
}

function getContents(contentNode) {
    const nodeRegex = getXMLTagRegex(contentNode);
    return (tag) => {
        const node = tag.match(nodeRegex);
        if (!node) return null;
        if (node.length > 1) throw XMLParserError.UnexpectedContents(tag);

        const { contents } = parseXMLTag(node[0]);
        return contents;
    };
}
function setContents(contentNode) {
    const nodeRegex = getXMLTagRegex(contentNode);
    return (tag, value) => {
        const matches = tag.match(nodeRegex);
        if (!matches) return null;
        if (matches.length > 1) throw XMLParserError.UnexpectedContents(tag);

        const node = nodeRegex.exec(tag);
        return tag.substring(0, node.index)
            + setXMLTagContents(node[0], value)
            + tag.substring(node.index + node[0].length);
    };
}
const getCellContents = getContents('v');
const setCellContents = setContents('v');
const getSharedStringContents = getContents('t');
const setSharedStringContents = setContents('t');

function columnToNumber(col) {
    if (typeof col !== 'string' || !col.length) return -1;
    const chars = col.split('');
    return chars.reduce((total, char, idx) => {
        return total + 26**(chars.length - idx - 1) * (char.charCodeAt(0) - 64);
    }, 0);
}
function numberToColumn(num) {
    let column = '';
    while (num > 0) {
        const rem = (num - 1) % 26;
        num = Math.floor((num - 1) / 26);
        column = String.fromCharCode(65 + rem) + column;
    }
    return column;
}

function* iterateRows(start, end) {
    for (let current = start; current <= end; current++) yield current;
}
const rowRange = (start, end) => Array.from(iterateRows(start, end));
function* iterateColumns(start, end) {
    const [ first, last ] = [ start, end ]
        .sort(columnOrdering)
        .map(columnToNumber);

    for (let current = first; current <= last; current++) yield numberToColumn(current);
}
const columnRange = (start, end) => Array.from(iterateColumns(start, end));
function* iterateCells(start, end) {
    const [ first, last ] = [ start, end ]
        .sort(cellOrdering)
        .map(parseCellReference);

    for (const col of iterateColumns(first.col, last.col)) {
        for (const row of iterateRows(first.row, last.row)) yield `${col}${row}`;
    }
}
const cellRange = (start, end) => Array.from(iterateCells(start, end));

function columnOrdering(col1, col2) {
    if (col1.length != col2.length) return col1.length - col2.length;
    if (col1.toLowerCase() < col2.toLowerCase()) return -1;
    if (col1.toLowerCase() > col2.toLowerCase()) return 1;
    return 0;
}
function cellOrdering(cell1, cell2) {
    const { row: row1, col: col1 } = parseCellReference(cell1);
    const { row: row2, col: col2 } = parseCellReference(cell2);

    const colOrder = columnOrdering(col1, col2);
    if (colOrder) return colOrder;
    return row1 - row2;
}

// given `col1`, `col2`, returns a function which checks if `col` is in between the two columns
function columnsInclude(col1, col2) {
    return (col) => columnOrdering(col1, col) !== 1
        && columnOrdering(col, col2) !== 1;
}
function rowsInclude(row1, row2) {
    return (row) => row1 <= row && row <= row2;
}
function cellsInclude(cell1, cell2) {
    return (cell) => cellOrdering(cell1, cell) !== 1
        && cellOrdering(cell, cell2) !== 1;
}

function getWorksheetName(filepath) {
    if (!filepath.startsWith('xl/worksheets/')) return null;

    if (filepath.startsWith('xl/worksheets/_rels')) {
        return filepath.substring('xl/worksheets/_rels/'.length,
            filepath.length - '.rels'.length);
    } else {
        return filepath.substring('xl/worksheets/'.length);
    }
}
const MAX_CELL_CHARACTERS = 32767; //https://support.office.com/en-ie/article/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3
const BROKEN_ESCAPE_CODE = /(&[^;]*)$/g;
function truncateContents(contents) {
    if (contents.toString().length > MAX_CELL_CHARACTERS) {
        const substr = contents
            .substring(0, MAX_CELL_CHARACTERS - 4)
            .replace(BROKEN_ESCAPE_CODE, '');
        return substr + '...';
    } else {
        return contents;
    }
}

module.exports = {
    // cell helpers
    getCellContents,
    getSharedStringContents,
    setCellContents,
    setSharedStringContents,
    parseCellReference,
    // column helpers
    columnToNumber,
    numberToColumn,
    // range helpers
    cellRange,
    columnRange,
    iterateCells,
    iterateColumns,
    iterateRows,
    rowRange,
    // comparators
    cellOrdering,
    cellsInclude,
    columnOrdering,
    columnsInclude,
    rowOrdering: numericalOrdering,
    rowsInclude,
    // misc
    getWorksheetName,
    truncateContents,
};
