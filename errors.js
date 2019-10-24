class ParserError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

class TagParserError extends ParserError {
    constructor(tag, reason) {
        let message = `Unable to parse template tag: ${tag}`;
        if (reason) message += `\n${reason}`;
        super(message);
    }

    static MissingBlock(tag) {
        return new this(tag, 'Opening or closing a block without providing an identifier');
    }
}

class XMLParserError extends ParserError {
    constructor(tag, reason) {
        let message = `Unable to parse XML tag: ${tag}`;
        if (reason) message += `\n${reason}`;
        super(message);
    }
}

class RenderError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }

    static BlockMismatch() {
        return new this('Mismatched numbers of blocks opened and closed');
    }
    static UnclosedBlock(block) {
        return new this(`Block "${block}" is opened but never closed`);
    }
    static AmbiguousBlock(block) {
        return new this(`Multiple matching closers for block "${block}"`);
    }
}

class XLSXRenderError extends RenderError {
    constructor(message, { worksheet, cell } = {}) {
        const location = [];
        if (typeof worksheet !== 'undefined') location.push(worksheet);
        if (typeof cell !== 'undefined') location.push(cell);
        super(location.length ? `[${location.join(':')}] ${message}` : message);

        this.setWorksheet = function(worksheet) {
            return new XLSXRenderError(message, { worksheet, cell });
        };
        this.setCell = function(cell) {
            return new XLSXRenderError(message, { worksheet, cell });
        };
    }

    // static
}

// class DOCXRenderError extends RenderError

module.exports = {
    ParserError,
    TagParserError,
    XMLParserError,

    RenderError,
    XLSXRenderError,
};
