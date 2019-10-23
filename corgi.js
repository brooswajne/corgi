const path = require('path');
const JSZip = require('jszip');

const { readFile } = require('./lib/common');
const Errors = require('./errors');

const RENDERERS = {
    'xlsx': require('./templaters/xlsx'),
    // 'docx': require('./lib/docx'),
};
const TAG_FINDER_DEFAULT = /\[\[(.*?[^\\])\]\]/g; // finds eg. [[ my tag ]]

class Templater {
    constructor(parser, {
        tagFinder = TAG_FINDER_DEFAULT,
    } = {}) {
        this.parser = parser;
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

        const zip = await JSZip.loadAsync(source);
        const renderer = new RENDERERS[type](zip, {
            parser: this.parser,
            tagFinder: this.tagFinder,
        });

        await renderer.render();
        return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    }
}

module.exports = {
    Templater,
    Errors,

    block: {
        open: (block, data) => {
            return { type: 'block:open', block, data };
        },
        close: (block) => {
            return { type: 'block:close', block };
        },
    },
    data: (data) => {
        return { type: 'data', data };
    },
};
