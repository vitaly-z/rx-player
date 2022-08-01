/**
 * Copyright 2015 CANAL+ Group
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import arrayFind from "../../../utils/array_find";
/**
 * Extends a capabilities array with others.
 * @param {Array<Object>} target
 * @param {Array<Object>} objects
 * @returns {Array.<Object>}
 */
export function extend(target, objects) {
    objects.forEach(function (obj) {
        obj.forEach(function (element) {
            if (typeof element === "string") {
                if (arrayFind(target, function (targetElement) { return targetElement === element; }) === undefined) {
                    target.push(element);
                }
            }
            else {
                var entry = Object.entries(element)[0];
                var key_1 = entry[0], value = entry[1];
                var foundTargetElement = arrayFind(target, function (targetElement) {
                    return typeof targetElement !== "string" &&
                        targetElement[key_1] !== undefined &&
                        targetElement[key_1].length > 0;
                });
                if (foundTargetElement === undefined) {
                    var toPush = {};
                    toPush[key_1] = extend([], [value]);
                    target.push(toPush);
                }
                else {
                    var targetElementToExtend = foundTargetElement;
                    targetElementToExtend[key_1] = extend(targetElementToExtend[key_1], [value]);
                }
            }
        });
    });
    return target;
}
/**
 * From input config object and probed capabilities, create
 * probed configuration object.
 * @param {Array<Object>} capabilities
 * @param {Object} configuration
 * @returns {Object}
 */
export function filterConfigurationWithCapabilities(capabilities, configuration) {
    var probedConfig = {};
    capabilities.forEach(function (capability) {
        if (typeof capability === "string") {
            if (configuration[capability] !== undefined) {
                probedConfig[capability] =
                    configuration[capability];
            }
        }
        else {
            var _a = Object.entries(capability)[0], key = _a[0], value = _a[1];
            var newConfiguration = configuration[key] === undefined ?
                {} :
                configuration[key];
            var subProbedConfig = filterConfigurationWithCapabilities(value, newConfiguration);
            if (Object.keys(subProbedConfig).length > 0 ||
                (configuration[key] != null &&
                    Object.keys(configuration[key]).length === 0)) {
                probedConfig[key] = subProbedConfig;
            }
        }
    });
    return probedConfig;
}
