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
import DEFAULT_CONFIG from "./default_config";
import deepMerge from "./utils/deep_merge";
var ConfigHandler = /** @class */ (function () {
    function ConfigHandler() {
        this._config = DEFAULT_CONFIG;
    }
    ConfigHandler.prototype.update = function (config) {
        var newConfig = deepMerge(this._config, config);
        this._config = newConfig;
    };
    ConfigHandler.prototype.getCurrent = function () {
        return this._config;
    };
    return ConfigHandler;
}());
var configHandler = new ConfigHandler();
export default configHandler;
