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
import { Observable } from "rxjs";
import Manifest from "../../manifest";
/**
 * Keep the MediaSource duration up-to-date with the Manifest one on
 * subscription:
 * Set the current duration initially and then update if needed after
 * each Manifest updates.
 * @param {Object} manifest
 * @param {MediaSource} mediaSource
 * @returns {Observable}
 */
export default function DurationUpdater(manifest: Manifest, mediaSource: MediaSource): Observable<never>;
