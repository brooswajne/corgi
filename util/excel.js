function getWorksheetName(filepath) {
    if (!filepath.startsWith('xl/worksheets/')) return null;

    if (filepath.startsWith('xl/worksheets/_rels')) {
        return filepath.substring('xl/worksheets/_rels/'.length,
            filepath.length - '.rels'.length);
    } else {
        return filepath.substring('xl/worksheets/'.length);
    }
}
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
        let rem = (num - 1) % 26;
        num = Math.floor((num - 1) / 26);
        column = String.fromCharCode(65 + rem) + column;
    }
    return column;
}
function columnRange(start, end) {
    let [first, last] = [start,end].map(columnToNumber).sort((a, b) => a - b);

    let current = first;
    const cols = [];
    while (current <= last) {
        cols.push(numberToColumn(current));
        current += 1;
    }
    return cols;
}
module.exports = {
    getWorksheetName,
    parseCellReference,
    getCellContents,
    columnToNumber,
    numberToColumn,
    columnRange,
};
