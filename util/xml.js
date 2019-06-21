const ATTRIBUTE = /(\w*)="(.*?)"/g;
function parseXMLTag(tag) {
    const name = tag.match(/<(\w+)/)[1];

    const [ opener, contents ] = tag.match(new RegExp(`(<${name}.*?>)([^]*?)(</${name}>)`)).slice(1);
    const attributes = {};
    let attr = ATTRIBUTE.exec(opener);
    while (attr !== null) {
        attributes[attr[1]] = attr[2];
        attr = ATTRIBUTE.exec(opener);
    }
    ATTRIBUTE.lastIndex = 0;

    return { name, attributes, contents };
}
function getXMLTagRegex(tag) {
    return new RegExp(`(<${tag}.*?>)([^]*?)(</${tag}>)`, 'g');
}
function setXMLTagAttributes(tag, attributes) {
    const { name, attributes: oldAttributes } = parseXMLTag(tag);
    const newAttributes = Object.assign({}, oldAttributes, attributes);
    const attrs = Object.keys(newAttributes).reduce((attrs, attr) => {
        return attrs + `${attr}="${newAttributes[attr]}"`;
    }, '');
    return tag.replace(new RegExp(`<${name}.*?>`), `<${name} ${attrs}>`);
}

module.exports = {
    parseXMLTag,
    getXMLTagRegex,
    setXMLTagAttributes,
};
