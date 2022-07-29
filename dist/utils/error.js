"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractError = void 0;
const lodash_1 = require("lodash");
function extractError(error) {
    var _a;
    if ((0, lodash_1.isEmpty)(error))
        return "An error is present, but could not be parsed";
    return error.error || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.error) || error.message || JSON.stringify(error);
}
exports.extractError = extractError;
