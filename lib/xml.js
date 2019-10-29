const { stringToRegex } = require('./common');
const { XMLParserError } = require('../errors');

const ATTRIBUTE = /(\w*)="(.*?)"/g;
const TAG_NAME = /<\s*(\w+)/;
const SELF_CLOSING = /\/\s*>$/;

const escape = (string) => string
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
const unescape = (xml) => xml
    .toString()
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
        `<\\s*${tag}(?: .*?)?(?:/\\s*>|>` // opener (or self-closing)
        + '[^]*?' // contents
        + `<\\s*/\\s*${tag}\\s*>)`, // closer
        'g'
    );
}

function setXMLTagAttributes(tag, attributes = {}) {
    const {
        attributes: oldAttributes,
        name,
        selfClosing,
    } = parseXMLTag(tag);

    const newAttributes = Object.assign({}, oldAttributes, attributes);
    for (const attr in attributes) {
        // setting an attribute to `null` deletes it
        if (attributes[attr] === null) delete newAttributes[attr];
    }

    const attrs = Object.keys(newAttributes)
        .map((attr) => `${escape(attr)}="${escape(newAttributes[attr])}"`)
        .join(' ');
    return Object.keys(attributes).length
        ? tag.replace(new RegExp(`<\\s*${name}.*?>`), `<${name} ${attrs}${selfClosing ? ' /' : ''}>`)
        : tag.replace(new RegExp(`<\\s*${name}.*?>`), `<${name}${selfClosing ? ' /' : ''}>`);
}

function setXMLTagContents(tag, contents, {
    allowSelfClosing = true,
} = {}) {
    const {
        name,
        opener,
        closer,
        selfClosing,
    } = parseXMLTag(tag);

    const makeSelfClosing = allowSelfClosing && contents == null;
    if (makeSelfClosing) {
        return selfClosing
            ? tag
            : opener.replace(/>$/, '/>');
    } else {
        return selfClosing
            ? opener.replace(/\/\\s*>$/, '>') + escape(contents) + `</${name}>`
            : opener + escape(contents) + closer;
    }
}

module.exports = {
    escape,
    unescape,

    getXMLTagRegex,
    setXMLTagAttributes,
    setXMLTagContents,

    parseXMLTag,
};
