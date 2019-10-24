class ParserError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

class XMLParserError extends ParserError {
    constructor(tag) {
        super(`Unable to parse XML tag: ${tag}`);
    }
}

class RenderError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

class XLSXRenderError extends RenderError {
    constructor(message, { worksheet, cell } = {}) {
        let location = '';
        if (typeof worksheet !== 'undefined') location += worksheet + ':';
        if (typeof cell !== 'undefined') location += cell;
        super(`[${location}] ${message}`);

        this.setWorksheet = function(worksheet) {
            return new XLSXRenderError(message, { worksheet, cell });
        };
        this.setCell = function(cell) {
            return new XLSXRenderError(message, { worksheet, cell });
        };
    }
}

// class DOCXRenderError extends RenderError

module.exports = {
    ParserError,
    XMLParserError,

    RenderError,
    XLSXRenderError,
};
