function unique(array) {
    return array.filter((elt, idx) => array.indexOf(elt) === idx);
}

module.exports = {
    unique,
};
