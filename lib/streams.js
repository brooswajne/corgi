const { Transform } = require('stream');
const async = require('./async');

function partialMatcher(re) { // TODO rewrite
    const source = re.source;
    let i = 0;

    function process() {
        let result = '';
        let tmp;

        function appendRaw(nbChars) {
            result += source.substr(i, nbChars);
            i += nbChars;
        }

        function appendOptional(nbChars) {
            result += '(?:' + source.substr(i, nbChars) + '|$)';
            i += nbChars;
        }

        while (i < source.length) {
            switch (source[i]) {
            case '\\':
                switch (source[i + 1]) {
                case 'c':
                    appendOptional(3);
                    break;
                case 'x':
                    appendOptional(4);
                    break;
                case 'u':
                    if (re.unicode) {
                        if (source[i + 2] === '{') {
                            appendOptional(source.indexOf('}', i) - i + 1);
                        } else {
                            appendOptional(6);
                        }
                    } else {
                        appendOptional(2);
                    }
                    break;
                default:
                    appendOptional(2);
                    break;
                }
                break;
            case '[':
                tmp = /\[(?:\\.|.)*?\]/g;
                tmp.lastIndex = i;
                tmp = tmp.exec(source);
                appendOptional(tmp[0].length);
                break;
            case '|':
            case '^':
            case '$':
            case '*':
            case '+':
            case '?':
                appendRaw(1);
                break;
            case '{':
                tmp = /\{\d+,?\d*\}/g;
                tmp.lastIndex = i;
                tmp = tmp.exec(source);
                if (tmp) {
                    appendRaw(tmp[0].length);
                } else {
                    appendOptional(1);
                }
                break;
            case '(':
                if (source[i + 1] == '?') {
                    switch (source[i + 2]) {
                    case ':':
                        result += '(?:';
                        i += 3;
                        result += process() + '|$)';
                        break;
                    case '=':
                        result += '(?=';
                        i += 3;
                        result += process() + ')';
                        break;
                    case '!':
                        tmp = i;
                        i += 3;
                        process();
                        result += source.substr(tmp, i - tmp);
                        break;
                    }
                } else {
                    appendRaw(1);
                    result += process() + '|$)';
                }
                break;
            case ')':
                ++i;
                return result;
            default:
                appendOptional(1);
                break;
            }
        }
        return result;
    }

    return new RegExp(process(), re.flags);
}
function partialMatch(str, regex) {
    if (str.match(regex)) return false;
    const matches = str.match(partialMatcher(regex))
        .filter(match => match); // no empty string matches
    return matches.length ? matches[0] : false;
}
class Replacer extends Transform {
    constructor(search, replace, {
        series = false,
    } = {}) {
        super();

        if (!(search instanceof RegExp)) throw new Error('Replacer stream only accepts RegExp search values');

        let partial = '';
        this._transform = async function(chunk, encoding, callback) {
            const string = partial + chunk.toString();

            let replaced = await async.replace(string, search, replace, { series });

            partial = partialMatch(replaced, search) || '';
            if (partial) {
                replaced = replaced.substring(0, replaced.length - partial.length);
            }
            this.push(replaced);
            callback();
        };
        this._flush = function(callback) {
            this.push(partial);
            callback();
        };
    }
}

const {
    getXMLTagRegex,
    parseXMLTag,
    setXMLTagAttributes,
} = require('./xml');
class XMLTagReplacer extends Replacer {
    constructor(tag, replace, {
        contentsOnly = false, // if should only replace the contents, leaving opener/closer intact
        ...replacerOptions
    } = {}) {
        const replacer = typeof replace === 'function' ? replace : () => replace;

        let idx = 0;
        const replaceCallback = async(matchedTag) => {
            const index = idx++;
            const parsed = parseXMLTag(matchedTag);
            const { attributes, contents } = parsed;
            if (parsed.selfClosing && contentsOnly) {
                const newContents = await replacer(contents, { attributes, index });
                const nonSelfClosing = `<${parsed.name}>${newContents}</${parsed.name}>`;
                return newContents
                    ? setXMLTagAttributes(nonSelfClosing, attributes)
                    : matchedTag; // leave as self-closing if possible
            }
            return contentsOnly
                ? parsed.opener + await replacer(contents, { attributes, index }) + parsed.closer
                : await replacer(matchedTag, { attributes, index });
        };

        super(getXMLTagRegex(tag), replaceCallback, replacerOptions);
    }
}

function awaitStreamEvent(event, { rejectOnError = true } = {}) {
    return (stream) => new Promise((resolve, reject) => {
        let errored = false;
        stream.on('error', function onStreamError(err) {
            errored = true;
            if (rejectOnError) reject(err);
        }).on(event, function onStreamAwaitedEvent() {
            if (rejectOnError && errored) return;
            resolve();
        });
    });
}

module.exports = {
    Replacer: (...args) => new Replacer(...args),
    XMLTagReplacer: (...args) => new XMLTagReplacer(...args),

    awaitStreamEvent,
    end: awaitStreamEvent('end'),
    finish: awaitStreamEvent('finish'),
};
