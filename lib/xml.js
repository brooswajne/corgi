const { stringToRegex } = require('./common');

const ATTRIBUTE = /(\w*)="(.*?)"/g;
const TAG_NAME = /<\s*(\w+)/;
const SELF_CLOSING = /\/\s*>$/;

function parseXMLTag(tag) {
    const tagName = tag.match(TAG_NAME)[1];
    const isSelfClosing = SELF_CLOSING.test(tag);

    const [ tagOpener, tagContents, tagCloser ] = isSelfClosing
        ? [ tag, '', tag ]
        : tag.match(new RegExp(`(<\\s*${tagName}.*?>)([^]*?)(<\\s*/\\s*${tagName}\\s*>)`)).slice(1);

    const tagAttributes = {};
    let attr = ATTRIBUTE.exec(tagOpener);
    while (attr !== null) {
        const [ attrName, attrValue ] = attr.slice(1);
        tagAttributes[attrName] = attrValue;
        attr = ATTRIBUTE.exec(tagOpener);
    }
    ATTRIBUTE.lastIndex = 0;

    return {
        // parts of the tag
        opener: tagOpener,
        contents: tagContents,
        closer: tagCloser,
        // info about the tag
        name: tagName,
        attributes: tagAttributes,
        // meta
        selfClosing: isSelfClosing,
    };
}

function getXMLTagRegex(tag) {
    tag = stringToRegex(tag);
    return new RegExp(
        `<\\s*${tag}(?: .*?)?(?:/>|>` // opener (or self-closing)
        + '[^]*?' // contents
        + `<\\s*/\\s*${tag}\\s*>)`, // closer
        'g'
    );
}

function setXMLTagAttributes(tag, attributes) {
    const { name, attributes: oldAttributes } = parseXMLTag(tag);
    const newAttributes = Object.assign({}, oldAttributes, attributes);
    const attrs = Object.keys(newAttributes).reduce((attrs, attr) => {
        return attrs + `${attr}="${newAttributes[attr]}"`;
    }, '');
    return Object.keys(attributes).length
        ? tag.replace(new RegExp(`<\\s*${name}.*?>`), `<${name} ${attrs}>`)
        : tag.replace(new RegExp(`<\\s*${name}.*?>`), `<${name}>`);
}

module.exports = {
    getXMLTagRegex,
    parseXMLTag,
    setXMLTagAttributes,
};
