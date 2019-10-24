const { stringToRegex } = require('./common');
const { XMLParserError } = require('../errors');

const ATTRIBUTE = /(\w*)="(.*?)"/g;
const TAG_NAME = /<\s*(\w+)/;
const SELF_CLOSING = /\/\s*>$/;

const escape = (string) => string
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
const unescape = (xml) => xml
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&amp;/g, '&');

function parseXMLTag(tag) {
    if (!TAG_NAME.test(tag)) throw new XMLParserError(tag);

    const tagName = tag.match(TAG_NAME)[1];
    const isSelfClosing = SELF_CLOSING.test(tag);

    const splitter = new RegExp(`(<\\s*${tagName}.*?>)([^]*?)(<\\s*/\\s*${tagName}\\s*>)`);
    if (!isSelfClosing && !splitter.test(tag)) throw new XMLParserError(tag);

    const [ tagOpener, tagContents, tagCloser ] = isSelfClosing
        ? [ tag, '', tag ]
        : tag.match(splitter).slice(1);

    const tagAttributes = {};
    let attr = ATTRIBUTE.exec(tagOpener);
    while (attr !== null) {
        const [ attrName, attrValue ] = attr.slice(1);
        tagAttributes[unescape(attrName)] = unescape(attrValue);
        attr = ATTRIBUTE.exec(tagOpener);
    }
    ATTRIBUTE.lastIndex = 0;

    return {
        // parts of the tag
        opener: tagOpener,
        contents: unescape(tagContents),
        closer: tagCloser,
        // info about the tag
        name: unescape(tagName),
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

function setXMLTagAttributes(tag, attributes = {}) {
    const { name, attributes: oldAttributes } = parseXMLTag(tag);
    const newAttributes = Object.assign({}, oldAttributes, attributes);
    const attrs = Object.keys(newAttributes)
        .map((attr) => `${escape(attr)}="${escape(newAttributes[attr].toString())}"`)
        .join(' ');
    return Object.keys(attributes).length
        ? tag.replace(new RegExp(`<\\s*${name}.*?>`), `<${name} ${attrs}>`)
        : tag.replace(new RegExp(`<\\s*${name}.*?>`), `<${name}>`);
}

module.exports = {
    escape,
    unescape,

    getXMLTagRegex,
    setXMLTagAttributes,

    parseXMLTag,
};
