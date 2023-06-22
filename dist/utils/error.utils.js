"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractError = void 0;
function extractError(error) {
    if (typeof error === "string")
        return error;
    if (error instanceof Error)
        return error.message;
    return JSON.stringify(error);
}
exports.extractError = extractError;
