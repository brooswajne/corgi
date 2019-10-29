const path = require('path');
const JSZip = require('jszip');

const ERROR_CLASSES = require('./errors');
const ENUMS = require('./lib/enums');
const { readFile } = require('./lib/common');

const RENDERERS = {
    'xlsx': require('./renderers/xlsx'),
    // 'docx': require('./lib/docx'),
};
const { TAG_TYPES } = ENUMS;
const TAG_FINDER_DEFAULT = /\[\[(.*?[^\\])\]\]/g; // finds eg. [[ my tag ]]

class Templater {
    constructor(parser, {
        tagFinder = TAG_FINDER_DEFAULT,
    } = {}) {
        if (!parser) throw new TypeError('No parser specified');
        const { // support passing a single, multi-purpose function
            identify = parser,
            expand = parser,
            evaluate = parser,
        } = parser;
        this.parser = { identify, expand, evaluate };
        this.tagFinder = tagFinder;
    }

    async render(src, type) {
        if (!src) throw new Error('File argument is required');

        const source = typeof src === 'string' ? await readFile(src) : src;
        if (!type) {
            if (typeof src === 'string') type = path.extname(src).substring(1);
            else throw new Error('Type argument is required when not passing a filepath');
        }
        if (!(type in RENDERERS)) throw new Error('Filetype not supported');
        const render = RENDERERS[type];

        const zip = await JSZip.loadAsync(source);
        await render(zip, this.tagFinder, this.parser);

        return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    }
}

Object.assign(Templater, {
    ...ERROR_CLASSES,
    ...ENUMS,
    Templater,

    block: {
        open: (block) => ({ type: TAG_TYPES.BLOCK_OPEN, block: block }),
        close: (block) => ({ type: TAG_TYPES.BLOCK_CLOSE, block: block }),
    },
    data: () => ({ type: TAG_TYPES.DATA }),
});

module.exports = Templater;
