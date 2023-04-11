"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractError = void 0;
const lodash_1 = require("lodash");
function extractError(error) {
    if ((0, lodash_1.isEmpty)(error))
        return "An error is present, but could not be parsed";
    return JSON.stringify(error);
}
exports.extractError = extractError;
