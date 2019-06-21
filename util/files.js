const fs = require('fs');

function readFile(...args) {
    return new Promise((resolve, reject) => {
        fs.readFile(...args, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

module.exports = { readFile };
