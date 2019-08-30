module.exports = {
    "env": {
        "node": true,
        "es6": true,
    },
    "parserOptions": {
        "ecmaVersion": 2019,
    },
    "extends": "eslint:recommended",
    "rules": {
        // errors
        "indent": ["error", 4],
        "linebreak-style": ["error", "unix"],
        "quotes": ["error", "single"],
        "semi": ["error", "always"],
        "no-console": "error",
        "no-unused-vars": ["error", {
            "args": "none",
            "ignoreRestSiblings": true,
        }],
        "eol-last": ["error", "always"],
        "dot-location": ["error", "property"],
        "no-useless-return": "error",
        "consistent-this": ["error", "self"],
        "camelcase": "error",
        "comma-dangle": ["error", "always-multiline"],
        "brace-style": ["error", "1tbs", {
            "allowSingleLine": true,
        }],
        "func-call-spacing": ["error", "never"],
        "block-spacing": ["error", "always"],
        "no-trailing-spaces": "error",
        "space-before-function-paren": ["error", "never"],
        "space-before-blocks": "error",
        "no-var": "error",
        "prefer-const": "error",
        "consistent-return": ["error", {
            "treatUndefinedAsUnspecified": true,
        }],
        // warnings
        "no-unneeded-ternary": "warn",
        "no-multiple-empty-lines": "warn",
        "keyword-spacing": "warn",
        "no-extra-parens": ["warn", "all"],
    },
    "overrides": [{
        "files": ["*.test.js"],
        "env": { "mocha": true },
    }],
};