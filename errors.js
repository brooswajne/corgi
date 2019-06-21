class RenderError { }

class XLSXRenderError extends RenderError {
    constructor(message, { worksheet, cell } = {}) {
        super();

        let location = '';
        if (typeof worksheet !== 'undefined') location += worksheet + ':';
        if (typeof cell !== 'undefined') location += cell;
        this.toString = function() {
            return `[${location}] ${message}`;
        };

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
    RenderError,
    XLSXRenderError,
};
