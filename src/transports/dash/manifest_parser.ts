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

import {
  combineLatest as observableCombineLatest,
  concat as observableConcat,
  Observable,
  of as observableOf,
} from "rxjs";
import {
  filter,
  map,
  mergeMap,
} from "rxjs/operators";
import Manifest from "../../manifest";
import dashManifestParser, {
  IMPDParserResponse,
} from "../../parsers/manifest/dash";
import objectAssign from "../../utils/object_assign";
import request from "../../utils/request";
import {
  ILoaderDataLoadedValue,
  IManifestParserArguments,
  IManifestParserObservable,
  ITransportOptions,
} from "../types";
import returnParsedManifest from "../utils/return_parsed_manifest";

/**
 * Request external "xlink" ressource from a MPD.
 * @param {string} xlinkURL
 * @returns {Observable}
 */
function requestStringResource(
  url : string
) : Observable< ILoaderDataLoadedValue< string > > {
  return request({ url,
                   responseType: "text" })
    .pipe(filter((e) => e.type === "data-loaded"),
          map((e) => e.value));
}

/**
 * @param {Object} options
 * @returns {Function}
 */
export default function generateManifestParser(
  options : ITransportOptions
) : (x : IManifestParserArguments) => IManifestParserObservable {
  const { aggressiveMode,
          referenceDateTime } = options;
  const serverTimeOffset = options.serverSyncInfos !== undefined ?
    options.serverSyncInfos.serverTimestamp - options.serverSyncInfos.clientTime :
    undefined;
  return function manifestParser(
    args : IManifestParserArguments
  ) : IManifestParserObservable {
    const { response, scheduleRequest } = args;
    const argClockOffset = args.externalClockOffset;
    const loaderURL = args.url;
    const url = response.url ?? loaderURL;
    const data = typeof response.responseData === "string" ?
                   new DOMParser().parseFromString(response.responseData,
                                                   "text/xml") :
                   // TODO find a way to check if Document?
                   response.responseData as Document;
    const parserErrors = data.getElementsByTagName("parsererror");
    let parsingErrorStr : string | undefined;
    if (parserErrors.length > 0) {
      for (let i = 0; i < parserErrors.length; i++) {
        const content = parserErrors[i].textContent;
        if (content !== null) {
          parsingErrorStr = content + "\n";
        }
      }
    }
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    (window as any).MPDParsingError = parsingErrorStr;

    const MPDParsingInfos : any = {};
    MPDParsingInfos.fullMpd = typeof response.responseData === "string" ?
        response.responseData :
        "Error: Shouldn't be a document";

    if (typeof (window as any).url === "string" &&
        ((window as any).url as string).indexOf(".mpd") > 0)
    {
      MPDParsingInfos.url = (window as any).url;
      MPDParsingInfos.status = (window as any).status;
    }
    (window as any).MPDParsingInfos = MPDParsingInfos;
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */


    const externalClockOffset = serverTimeOffset ?? argClockOffset;
    const unsafelyBaseOnPreviousManifest = args.unsafeMode ? args.previousManifest :
                                                             null;
    const parsedManifest = dashManifestParser(data, { aggressiveMode:
                                                        aggressiveMode === true,
                                                      unsafelyBaseOnPreviousManifest,
                                                      url,
                                                      referenceDateTime,
                                                      externalClockOffset });
    return loadExternalResources(parsedManifest);

    function loadExternalResources(
      parserResponse : IMPDParserResponse
    ) : IManifestParserObservable {
      if (parserResponse.type === "done") {
        const { warnings, parsed } = parserResponse.value;
        const warningEvents = warnings.map(warning => ({ type: "warning" as const,
                                                         value: warning }));
        const manifest = new Manifest(parsed, options);
        return observableConcat(observableOf(...warningEvents),
                                returnParsedManifest(manifest, url));
      }

      const { ressources, continue: continueParsing } = parserResponse.value;

      const externalResources$ = ressources
        .map(resource => scheduleRequest(() => requestStringResource(resource)));

      return observableCombineLatest(externalResources$)
        .pipe(mergeMap(loadedResources => {
          const resources : Array<ILoaderDataLoadedValue<string>> = [];
          for (let i = 0; i < loadedResources.length; i++) {
            const resource = loadedResources[i];
            if (typeof resource.responseData !== "string") {
              throw new Error("External DASH resources should only be strings");
            }
            // Normally not needed but TypeScript is just dumb here
            resources.push(objectAssign(resource,
                                        { responseData: resource.responseData }));
          }
          return loadExternalResources(continueParsing(resources));
        }));
    }
  };
}
