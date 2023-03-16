"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinReferences = exports.extractReferences = void 0;
const extractReferences = (referencesString) => {
    var _a, _b;
    return (_b = (_a = referencesString === null || referencesString === void 0 ? void 0 : referencesString.split) === null || _a === void 0 ? void 0 : _a.call(referencesString, ", ")) !== null && _b !== void 0 ? _b : [];
};
exports.extractReferences = extractReferences;
const joinReferences = (references) => {
    var _a, _b;
    return (_b = (_a = references === null || references === void 0 ? void 0 : references.join) === null || _a === void 0 ? void 0 : _a.call(references, ", ")) !== null && _b !== void 0 ? _b : "";
};
exports.joinReferences = joinReferences;
