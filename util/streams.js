const { Transform } = require('stream');
const async = require('./async');

function partialMatcher(re) {
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
    constructor(search, replace) {
        super();

        if (!(search instanceof RegExp)) throw new Error('Replacer stream only accepts RegExp search values');

        let partial = '';
        this._transform = async function(chunk, encoding, callback) {
            // console.log(chunk.toString());
            const string = partial + chunk.toString();

            let replaced = await async.replace(string, search, replace);

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

const { parseXMLTag, getXMLTagRegex } = require('./xml');
class XMLTagReplacer extends Replacer {
    constructor(tag, replace, { attributes, contentsOnly = true } = {}) {
        const replacer = typeof replace === 'function' ? replace : () => replace;
        super(getXMLTagRegex(tag), async(match, opening, contents, closing) => {
            const { attributes } = parseXMLTag(match);
            if (contentsOnly) return opening + await replacer(contents, { attributes }) + closing;
            else return await replacer(match, { attributes });
        });
    }
}

module.exports = {
    XMLTagReplacer: (...args) => new XMLTagReplacer(...args),
};
