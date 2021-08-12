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

// import { isCodecSupported } from "../compat";
// import { IContentProtection } from "../core/eme";
// import log from "../log";
import {isCodecSupported} from "../compat";
import { ICustomError } from "../errors";
import {
  IParsedAdaptation,
  // IContentProtections,
  IParsedManifest,
  IParsedPeriod,
  IParsedRepresentation,
} from "../parsers/manifest";
import objectAssign from "../utils/object_assign";
import { IAdaptationType } from "./types";
// import { IRepresentationIndex } from "./representation_index";
// import {
//   IAdaptationType,
//   IHDRInformation,
// } from "./types";

export type IManifestBuilderOutput = IParsedManifest & {
  manifestUpdateUrl : string | undefined;
  minorErrors : ICustomError[];
  periods : IProcessedPeriod[];
};

export type IProcessedPeriod = IParsedPeriod & {
  adaptations : Partial<Record<IAdaptationType, IProcessedAdaptation>>;
};

export type IProcessedAdaptation = IParsedAdaptation & {
  representations : IProcessedRepresentation[];
};
export type IProcessedRepresentation = IParsedRepresentation & {
  isSupported: boolean;
};


export function buildManifest(
  parsed : IParsedManifest,
  manifestUpdateUrl : string | undefined
) : IManifestBuilderOutput {
  const minorErrors : ICustomError[] = [];
  const periods = parsed.periods.map(p => processPeriod(p, minorErrors));
  return objectAssign({}, parsed, {
    minorErrors,
    manifestUpdateUrl,
    periods,
  });
}

function processAdaptation(parsed : IParsedAdaptation) : IProcessedAdaptation {
  const representations: parsed.representations.map(processAdaptation);
  return objectAssign(parsed, { representations });
}

function processRepresentation(
  parsed : IParsedRepresentation
) : IProcessedRepresentation {
  const isSupported = isCodecSupported(
    `${parsed.mimeType ?? ""};codecs="${parsed.codecs ?? ""}"`
  );
  return objectAssign(parsed, { isSupported });
}

function processPeriod(
  parsed : IParsedPeriod,
  minorErrors : ICustomError[]
) : IProcessedPeriod {
}
