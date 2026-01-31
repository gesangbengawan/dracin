const { TDLib } = require('tdl-tdlib-addon');
const path = require('path');
const lib = path.join(__dirname, 'libtdjson.so');
console.log("Loading", lib);
try {
    new TDLib(lib);
    console.log("Success");
} catch (e) {
    console.error(e);
}
