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

import PPromise from "pinkie";
import log from "../../../../../log";
import assertUnreachable from "../../../../../utils/assert_unreachable";
import noop from "../../../../../utils/noop";
import parseMpdIr, {
  IIrParserResponse,
  ILoadedXlinkData,
} from "../../common";
import {
  IMPDIntermediateRepresentation,
  IPeriodIntermediateRepresentation,
} from "../../node_parser_types";
import {
  IDashParserResponse,
  ILoadedResource,
  IMPDParserArguments,
} from "../../parsers_types";
import {
  IngoingMessageType,
  IWorkerOutgoingMessage,
  OutgoingMessageType,
} from "../worker/worker_types";
import { generateRootChildrenParser } from "./generators";
import { generateXLinkChildrenParser } from "./generators/XLink";
import ParsersStack from "./parsers_stack";

export type IMPDParsingResult = [ IMPDIntermediateRepresentation | null, Error[] ];
export type IXlinkParsingResult = [ IPeriodIntermediateRepresentation[], Error[] ];

let timer = 0;

export default class DashWasmParser {
  /**
   * Current "status" of the DASH-WASM parser.
   *
   * Can be either:
   *   - "uninitialized": Its `initialize` method hasn't been called yet.
   *   - "initializing": The `DashWasmParser` is in the process of fetching
   *     and instantiating the WebAssembly code.
   *   - "initialized": The `DashWasmParser` is ready to parse.
   *   - "failure": The `DashWasmParser` initialization failed.
   */
  public status : "uninitialized" |
                  "initializing" |
                  "initialized" |
                  "failure";

  private _worker : Worker |
                    null;

  private _initInfo : {
    /**
     * Promise used to notify of the initialization status.
     * `null` when no initialization has happened yet.
     */
    promise : Promise<void> | null;
    callbacks : { resolve : () => void;
                  reject : (err : Error) => void; } |
                null;
  };

  private _currentParsingOperation :
    null |

    { type : "mpd";
      data : { mpd? : IMPDIntermediateRepresentation };
      warnings : Error[];
      resolve : (res : IMPDParsingResult) => void;
      reject : (err : Error) => void; } |

    { type : "xlink";
      data : { periods : IPeriodIntermediateRepresentation[] };
      warnings : Error[];
      resolve : (res : IXlinkParsingResult) => void;
      reject : (err : Error) => void; };


  /** Abstraction simplifying the exploitation of the DASH-WASM parser's events. */
  private _parsersStack : ParsersStack;

  /**
   * Create a new `DashWasmParser`.
   * @param {object} opts
   */
  constructor() {
    this._parsersStack = new ParsersStack();
    this._worker = null;
    this._initInfo = { promise: null,
                       callbacks: null };
    this._currentParsingOperation = null;
    this.status = "uninitialized";
  }

  /**
   * Returns Promise that will resolve when the initialization has ended (either
   * with success, in which cases the Promise resolves, either with failure, in
   * which case it rejects the corresponding error).
   *
   * This is actually the exact same Promise than the one returned by the first
   * `initialize` call.
   *
   * If that method was never called, returns a rejecting Promise.
   * @returns {Promise}
   */
  public waitForInitialization() : Promise<void> {
    return this._initInfo?.promise ??
           PPromise.reject("No initialization performed yet.");
  }

  private _onWorkerMessage(evt : MessageEvent<IWorkerOutgoingMessage[]>) : void {
    const p = performance.now();
    const msgs = evt.data;
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      switch (msg[0]) {

        case OutgoingMessageType.Attribute:
          // Call the active "attributeParser"
          this._parsersStack.attributeParser(msg[2], msg[1]);
          break;

        case OutgoingMessageType.TagOpen:
          // Call the active "childrenParser"
          this._parsersStack.childrenParser(msg[1]);
          break;

        case OutgoingMessageType.TagClose:
          // Only pop current parsers from the `parsersStack` if that tag was the
          // active one.
          this._parsersStack.popIfCurrent(msg[1]);
          break;

        case OutgoingMessageType.ParserWarning:
          const errorMsg = new TextDecoder().decode(msg[1]);
          if (this._currentParsingOperation?.type === "mpd") {
            this._currentParsingOperation.warnings.push(new Error(errorMsg));
          }
          break;

        case OutgoingMessageType.MPDParsingFinished:
          if (this._currentParsingOperation === null ||
              this._currentParsingOperation.type !== "mpd")
          {
            log.warn("DASH-WASM: MPD parsing finished but no MPD parsing was pending.");
          } else {
            const { data, warnings, resolve } = this._currentParsingOperation;
            this._currentParsingOperation = null;
            this._parsersStack.reset();
            resolve([data.mpd ?? null, warnings]);
          }
          break;

        case OutgoingMessageType.MPDParsingError:
          if (this._currentParsingOperation === null ||
              this._currentParsingOperation.type !== "mpd")
          {
            log.warn("DASH-WASM: MPD parsing failed but no MPD parsing was pending.");
          } else {
            const err = new Error(msg[1]);
            const { reject } = this._currentParsingOperation;
            this._currentParsingOperation = null;
            this._parsersStack.reset();
            reject(err);
          }
          break;

        case OutgoingMessageType.XLinkParsingFinished:
          if (this._currentParsingOperation === null ||
              this._currentParsingOperation.type !== "xlink")
          {
            log.warn("DASH-WASM: xlink parsing finished but no xlink parsing " +
                     "was pending.");
          } else {
            const { data, warnings, resolve } = this._currentParsingOperation;
            this._currentParsingOperation = null;
            this._parsersStack.reset();
            resolve([data.periods, warnings]);
          }
          break;

        case OutgoingMessageType.XLinkParsingError:
          if (this._currentParsingOperation === null ||
              this._currentParsingOperation.type !== "xlink")
          {
            log.warn("DASH-WASM: xlink parsing failed but no xlink parsing " +
                     "was pending.");
          } else {
            const err = new Error(msg[1]);
            const { reject } = this._currentParsingOperation;
            this._currentParsingOperation = null;
            this._parsersStack.reset();
            reject(err);
          }
          break;

        case OutgoingMessageType.Initialized:
          this.status = "initialized";
          if (this._initInfo.callbacks === null) {
            log.warn("DASH-WASM: Parser initialized but no initialization was pending.");
          } else {
            const { resolve } = this._initInfo.callbacks;
            this._initInfo.callbacks = null;
            resolve();
          }
          break;

        case OutgoingMessageType.InitializationError:
          this.status = "failure";
          if (this._initInfo.callbacks === null) {
            log.warn("DASH-WASM: Parser initialization failed but no " +
                     "initialization was pending.");
          } else {
            const err = new Error(msg[1]);
            const { reject } = this._initInfo.callbacks;
            this._initInfo.callbacks = null;
            reject(err);
          }
          break;

        case OutgoingMessageType.InitializationWarning:
          log.warn(msg[1]);
          break;

        default:
          assertUnreachable(msg);
      }
    }
    timer += (performance.now() - p);
  }

  public async initialize(opts : IDashWasmParserOptions) : Promise<void> {
    if (this.status !== "uninitialized") {
      return PPromise.reject(new Error("DashWasmParser already initialized."));
    } else if (!this.isCompatible()) {
      this.status = "failure";
      return PPromise.reject(new Error("Target not compatible with WebAssembly."));
    }
    this.status = "initializing";

    const worker = new Worker(opts.workerUrl);
    this._worker = worker;
    worker.onmessage = this._onWorkerMessage.bind(this);

    this._initInfo.promise = new PPromise<void>((resolve, reject) => {
      this._initInfo.callbacks = { resolve, reject };
    });
    worker.postMessage({ type: IngoingMessageType.Initialize,
                         wasmUrl: opts.wasmUrl });
    return this._initInfo.promise;
  }

  /**
   * @param {Document} manifest - Original manifest as returned by the server
   * @param {Object} args
   * @returns {Object}
   */
  public runWasmParser(
    mpd : ArrayBuffer,
    args : IMPDParserArguments
  ) : Promise<IDashParserResponse<string> | IDashParserResponse<ArrayBuffer>> {
    timer = 0;
    return this._parseMpd(mpd).then(([mpdIR, warnings]) => {
      if (mpdIR === null) {
        throw new Error("DASH Parser: Unknown error while parsing the MPD");
      }
      const ret = parseMpdIr(mpdIR, args, warnings);
      console.warn("!!!!!!!!! Parse Main thread", timer);
      return this._processParserReturnValue(ret);
    });
  }

  /**
   * Return `true` if the current plaform is compatible with WebAssembly and the
   * TextDecoder interface (for faster UTF-8 parsing), which are needed features
   * for the `DashWasmParser`.
   * @returns {boolean}
   */
  public isCompatible() : boolean {
    return typeof WebAssembly === "object" &&
           typeof WebAssembly.instantiate === "function" &&
           typeof window.TextDecoder === "function";
  }

  private _parseMpd(
    mpd : ArrayBuffer
  ) : Promise<[IMPDIntermediateRepresentation | null,
               Error[]]>
  {
    if (this._worker === null) {
      throw new Error("DashWasmParser not initialized");
    }
    if (this._currentParsingOperation !== null) {
      throw new Error("Parsing operation already pending.");
    }

    const rootObj : { mpd? : IMPDIntermediateRepresentation } = {};
    const rootChildrenParser = generateRootChildrenParser(rootObj, this._parsersStack);
    this._parsersStack.pushParsers(null, rootChildrenParser, noop);

    this._worker.postMessage({ type: IngoingMessageType.ParseMpd, mpd }, [mpd]);
    return new PPromise((resolve, reject) => {
      this._currentParsingOperation = { type: "mpd",
                                        data: rootObj,
                                        warnings: [],
                                        resolve,
                                        reject };
    });
  }

  private _parseXlink(
    xlinkData : ArrayBuffer
  ) : Promise<[IPeriodIntermediateRepresentation[],
               Error[]]>
  {
    if (this._worker === null) {
      throw new Error("DashWasmParser not initialized");
    }
    if (this._currentParsingOperation !== null) {
      throw new Error("Parsing operation already pending.");
    }

    const rootObj : { periods : IPeriodIntermediateRepresentation[] } =
      { periods: [] };

    const xlinkParser = generateXLinkChildrenParser(rootObj, this._parsersStack);
    this._parsersStack.pushParsers(null, xlinkParser, noop);

    this._worker.postMessage({ type: IngoingMessageType.ParseXlink,
                               xlink: xlinkData },
                             [xlinkData]);
    return new PPromise((resolve, reject) => {
      this._currentParsingOperation = { type: "xlink",
                                        data: rootObj,
                                        warnings: [],
                                        resolve,
                                        reject };
    });
  }

  /**
   * Handle `parseMpdIr` return values, asking for resources if they are needed
   * and pre-processing them before continuing parsing.
   *
   * @param {Object} initialRes
   * @returns {Object}
   */
  private _processParserReturnValue(
    initialRes : IIrParserResponse
  ) : Promise<IDashParserResponse<string> | IDashParserResponse<ArrayBuffer>> {
    if (initialRes.type === "done") {
      return PPromise.resolve(initialRes);

    } else if (initialRes.type === "needs-clock") {
      const continueParsingMPD = (
        loadedClock : Array<ILoadedResource<string>>
      ) : Promise<IDashParserResponse<string> | IDashParserResponse<ArrayBuffer>> => {
        if (loadedClock.length !== 1) {
          throw new Error("DASH parser: wrong number of loaded ressources.");
        }
        const newRet = initialRes.value.continue(loadedClock[0].responseData);
        return this._processParserReturnValue(newRet);
      };
      return PPromise.resolve({ type: "needs-resources",
                                value: { urls: [initialRes.value.url],
                                         format: "string",
                                         continue : continueParsingMPD } });

    } else if (initialRes.type === "needs-xlinks") {
      const continueParsingMPD = async (
        loadedXlinks : Array<ILoadedResource<ArrayBuffer>>
      ) : Promise<IDashParserResponse<string> | IDashParserResponse<ArrayBuffer>> => {
        const resourceInfos : ILoadedXlinkData[] = [];
        for (let i = 0; i < loadedXlinks.length; i++) {
          const { responseData: xlinkData,
                  receivedTime,
                  sendingTime,
                  url } = loadedXlinks[i];
          const [periodsIr,
                 periodsIRWarnings] = await this._parseXlink(xlinkData);
          resourceInfos.push({ url,
                               receivedTime,
                               sendingTime,
                               parsed: periodsIr,
                               warnings: periodsIRWarnings });
        }
        const newRet = initialRes.value.continue(resourceInfos);
        return this._processParserReturnValue(newRet);
      };

      return PPromise.resolve({ type: "needs-resources",
                                value: { urls: initialRes.value.xlinksUrls,
                                         format: "arraybuffer",
                                         continue : continueParsingMPD } });
    } else {
      assertUnreachable(initialRes);
    }
  }
}

/** Options needed when constructing the DASH-WASM parser. */
export interface IDashWasmParserOptions {
  wasmUrl : string;
  workerUrl : string;
}
