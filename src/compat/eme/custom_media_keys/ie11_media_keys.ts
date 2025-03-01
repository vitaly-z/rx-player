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

import EventEmitter from "../../../utils/event_emitter";
import TaskCanceller from "../../../utils/task_canceller";
import wrapInPromise from "../../../utils/wrapInPromise";
import { ICompatHTMLMediaElement } from "../../browser_compatibility_types";
import * as events from "../../event_listeners";
import {
  MSMediaKeysConstructor,
  MSMediaKeys,
  MSMediaKeySession,
} from "./ms_media_keys_constructor";
import {
  ICustomMediaKeys,
  ICustomMediaKeySession,
  ICustomMediaKeyStatusMap,
  IMediaKeySessionEvents,
} from "./types";

class IE11MediaKeySession
  extends EventEmitter<IMediaKeySessionEvents>
  implements ICustomMediaKeySession
{
  public readonly update: (license: Uint8Array) => Promise<void>;
  public readonly closed: Promise<void>;
  public expiration: number;
  public keyStatuses: ICustomMediaKeyStatusMap;
  private readonly _mk: MSMediaKeys;
  private readonly _sessionClosingCanceller: TaskCanceller;
  private _ss: MSMediaKeySession | undefined;
  constructor(mk: MSMediaKeys) {
    super();
    this.expiration = NaN;
    this.keyStatuses = new Map();
    this._mk = mk;
    this._sessionClosingCanceller = new TaskCanceller();
    this.closed = new Promise((resolve) => {
      this._sessionClosingCanceller.signal.register(() => resolve());
    });
    this.update = (license: Uint8Array) => {
      return new Promise((resolve, reject) => {
        if (this._ss === undefined) {
          return reject("MediaKeySession not set.");
        }
        try {
          resolve(
            (this._ss.update as (
              license : Uint8Array,
              sessionId : string
            ) => void)(license, "")
          );
        } catch (err) {
          reject(err);
        }
      });
    };
  }
  generateRequest(_initDataType: string, initData: BufferSource): Promise<void> {
    return new Promise((resolve) => {
      const initDataU8 =
        initData instanceof Uint8Array  ? initData :
        initData instanceof ArrayBuffer ? new Uint8Array(initData) :
                                          new Uint8Array(initData.buffer);
      this._ss = this._mk.createSession("video/mp4", initDataU8);
      events.onKeyMessage(this._ss, (evt) => {
        this.trigger((evt as Event).type ?? "message", evt as Event);
      }, this._sessionClosingCanceller.signal);
      events.onKeyAdded(this._ss, (evt) => {
        this.trigger((evt as Event).type ?? "keyadded", evt as Event);
      }, this._sessionClosingCanceller.signal);
      events.onKeyError(this._ss, (evt) => {
        this.trigger((evt as Event).type ?? "keyerror", evt as Event);
      }, this._sessionClosingCanceller.signal);
      resolve();
    });
  }
  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this._ss != null) {
        this._ss.close();
        this._ss = undefined;
      }
      this._sessionClosingCanceller.cancel();
      resolve();
    });
  }
  load(): Promise<boolean> {
    return Promise.resolve(false);
  }
  remove(): Promise<void> {
    return Promise.resolve();
  }
  get sessionId(): string {
    return this._ss?.sessionId ?? "";
  }
}

class IE11CustomMediaKeys implements ICustomMediaKeys {
  private _videoElement?: ICompatHTMLMediaElement;
  private _mediaKeys?: MSMediaKeys;

  constructor(keyType: string) {
    if (MSMediaKeysConstructor === undefined) {
      throw new Error("No MSMediaKeys API.");
    }
    this._mediaKeys = new MSMediaKeysConstructor(keyType);
  }

  _setVideo(videoElement: HTMLMediaElement): Promise<unknown> {
    return wrapInPromise(() => {
      this._videoElement = videoElement as ICompatHTMLMediaElement;
      if (this._videoElement.msSetMediaKeys !== undefined) {
        this._videoElement.msSetMediaKeys(this._mediaKeys);
      }
    });
  }

  createSession(/* sessionType */): ICustomMediaKeySession {
    if (this._videoElement === undefined || this._mediaKeys === undefined) {
      throw new Error("Video not attached to the MediaKeys");
    }
    return new IE11MediaKeySession(this._mediaKeys);
  }

  setServerCertificate(): Promise<void> {
    throw new Error("Server certificate is not implemented in your browser");
  }
}

export default function getIE11MediaKeysCallbacks() : {
  isTypeSupported: (keyType: string) => boolean;
  createCustomMediaKeys: (keyType: string) => IE11CustomMediaKeys;
  setMediaKeys: (
    elt: HTMLMediaElement,
    mediaKeys: MediaKeys|ICustomMediaKeys|null
  ) => Promise<unknown>;
} {
  const isTypeSupported = (keySystem: string, type?: string|null) => {
    if (MSMediaKeysConstructor === undefined) {
      throw new Error("No MSMediaKeys API.");
    }
    if (type !== undefined) {
      return MSMediaKeysConstructor.isTypeSupported(keySystem, type);
    }
    return MSMediaKeysConstructor.isTypeSupported(keySystem);
  };
  const createCustomMediaKeys = (keyType: string) =>
    new IE11CustomMediaKeys(keyType);
  const setMediaKeys = (
    elt: HTMLMediaElement,
    mediaKeys: MediaKeys|ICustomMediaKeys|null
  ): Promise<unknown> => {
    if (mediaKeys === null) {
      // msSetMediaKeys only accepts native MSMediaKeys as argument.
      // Calling it with null or undefined will raise an exception.
      // There is no way to unset the mediakeys in that case, so return here.
      return Promise.resolve(undefined);
    }
    if (!(mediaKeys instanceof IE11CustomMediaKeys)) {
      throw new Error("Custom setMediaKeys is supposed to be called " +
                      "with IE11 custom MediaKeys.");
    }
    return mediaKeys._setVideo(elt);
  };
  return {
    isTypeSupported,
    createCustomMediaKeys,
    setMediaKeys,
  };
}

export { MSMediaKeysConstructor };
