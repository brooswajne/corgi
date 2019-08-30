function parseCellReference(reference) {
    return {
        row: parseInt(reference.match(/\d+/g)[0]),
        col: reference.match(/[A-Z]+/g)[0],
    };
}
function getCellContents(cell) {
    return cell.match('<v>(.*)</v>')[1];
}

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

// TODO generator versions of these for more efficient iterating
function columnRange(start, end) {
    const [ first, last ] = [ start, end ]
        .sort(columnOrdering)
        .map(columnToNumber);

    let current = first;
    const cols = [];
    while (current <= last) {
        cols.push(numberToColumn(current));
        current += 1;
    }
    return cols;
}
function cellRange(start, end) {
    const [ first, last ] = [ start, end ]
        .sort(cellOrdering)
        .map(parseCellReference);

    const cells = [];
    for (const col of columnRange(first.col, last.col)) {
        for (let row = first.row; row <= last.row; row++) {
            cells.push(`${col}${row}`);
        }
    }
    return cells;
}

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
    parseCellReference,
    getCellContents,
    // column helpers
    columnToNumber,
    numberToColumn,
    // range helpers
    columnRange,
    cellRange,
    // comparators
    columnOrdering,
    cellOrdering,
    // misc
    getWorksheetName,
    truncateContents,
};
