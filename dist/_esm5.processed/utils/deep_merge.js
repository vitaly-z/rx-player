var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import objectAssign from "./object_assign";
/**
 * Check if an item is an object
 * @param item
 * @returns {boolean}
 */
function isObject(item) {
    return (item !== null
        && item !== undefined
        && !Array.isArray(item)
        && typeof item === "object");
}
/**
 * Deeply merge nested objects
 * @param target
 * @param sources
 * @returns output : merged object
 */
export default function deepMerge(target) {
    var _a, _b;
    var sources = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        sources[_i - 1] = arguments[_i];
    }
    if (sources.length === 0) {
        return target;
    }
    var source = sources.shift();
    if (isObject(target) && isObject(source)) {
        for (var key in source) {
            if (isObject(source[key])) {
                if (target[key] === undefined) {
                    objectAssign(target, (_a = {}, _a[key] = {}, _a));
                }
                var newTarget = target[key];
                deepMerge(newTarget, source[key]);
            }
            else {
                objectAssign(target, (_b = {}, _b[key] = source[key], _b));
            }
        }
    }
    return deepMerge.apply(void 0, __spreadArray([target], sources, false));
}
