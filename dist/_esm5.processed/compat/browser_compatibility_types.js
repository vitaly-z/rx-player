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
import isNullOrUndefined from "../utils/is_null_or_undefined";
import isNode from "./is_node";
var win = isNode ? undefined :
    window;
/** MediaSource implementation, including vendored implementations. */
var MediaSource_ = win === undefined ? undefined :
    !isNullOrUndefined(win.MediaSource) ? win.MediaSource :
        !isNullOrUndefined(win.MozMediaSource) ? win.MozMediaSource :
            !isNullOrUndefined(win.WebKitMediaSource) ? win.WebKitMediaSource :
                win.MSMediaSource;
/** List an HTMLMediaElement's possible values for its readyState property. */
var READY_STATES = { HAVE_NOTHING: 0,
    HAVE_METADATA: 1,
    HAVE_CURRENT_DATA: 2,
    HAVE_FUTURE_DATA: 3,
    HAVE_ENOUGH_DATA: 4 };
export { MediaSource_, READY_STATES, };
