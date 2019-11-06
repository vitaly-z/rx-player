/**
 * Copyright 2019 CANAL+ Group
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

import "@babel/polyfill";
import { IDBPDatabase } from "idb";
import { AsyncSubject } from "rxjs";

import DownloadManager from "./apis/downloader/downloadManager";
import {
  offlineManifestLoader,
  getBuilderFormatted,
} from "./apis/downloader/manifest";
import { setUpDb } from "./apis/transactionDB/dbSetUp";
import {
  checkForPauseAMovie,
  checkForResumeAPausedMovie,
  IndexDBError,
  checkInitDownloaderOptions,
  ValidationArgsError,
  SegmentConstuctionError,
} from "./utils";

import EventEmitter from "../../../utils/event_emitter";
import PPromise from "../../../utils/promise";
import { IActivePauses, IActiveDownload } from "./apis/transports/types";
import {
  IDownload2GoEvents,
  IEmitterTrigger,
  IStoredManifest,
  IGlobalSettings,
  IInitSettings,
  ISegmentsSortedByRepresentationID,
  IContentLoader,
} from "./types";
import { IContentProtection } from "./apis/drm/types";

/**
 * Instanciate a D2G downloader.
 * @param {Object<{nameDB, storeManifestEvery}>} IOptionsStarter
 * @return {IPublicAPI} IPublicAPI
 */
class D2G extends EventEmitter<IDownload2GoEvents> {
  public readonly nameDB: string;
  private db: IDBPDatabase | null;
  private emitter: IEmitterTrigger<IDownload2GoEvents>;
  private activeDownloads: IActiveDownload;
  private activePauses: IActivePauses;

  constructor(options: IGlobalSettings = {}) {
    super();
    this.nameDB = options.nameDB || "d2g-canalplus";
    this.activeDownloads = {};
    this.activePauses = {};
    this.db = null;
    this.emitter = {
      trigger: (eventName, payload) => this.trigger(eventName, payload),
    };
  }

  /**
   * Initialize an IndexDB instance.
   * @returns {Promise<void>}
   */
  async initDB(): Promise<IDBPDatabase> {
    return new Promise((resolve, reject) => {
      setUpDb(this.nameDB)
        .then(db => {
          this.db = db;
          resolve(db);
        })
        .catch(error => {
          this.trigger("error", { action: "initDB", error });
          reject(error);
        });
    });
  }

  /**
   * Start a download from scratch.
   * @param {Object<ISettingsDownloader>} settings
   * @returns {Promise.<void>}
   */
  async download(options: IInitSettings): Promise<void> {
    try {
      const db = this.db;
      if (db === null) {
        throw new Error("The IndexDB database has not been created!");
      }
      await checkInitDownloaderOptions(options, db, this.activeDownloads);
      const { metaData, contentID, transport } = options;
      const pause$ = new AsyncSubject<void>();
      this.activePauses[contentID] = pause$;
      const downloadManager = new DownloadManager({
        emitter: this.emitter,
        db,
      });
      const initDownloadSub = downloadManager
        .initDownload(options, pause$)
        .subscribe(
          ([download]) => {
            if (download === null) {
              return;
            }
            const { progress, manifest, audio, video, text, size } = download;
            if (manifest === null) {
              return;
            }
            db.put("manifests", {
              contentID,
              transport,
              manifest,
              builder: { video, audio, text },
              progress,
              size,
              duration: manifest.getDuration(),
              ...(metaData && { metaData }),
            });
          },
          error => this.trigger("error", { action: "init-downloader", error }),
          () => console.warn(`DOWNLOAD INIT COMPLETE: ${options.contentID}`),
        );
      this.activeDownloads[contentID] = initDownloadSub;
    } catch (error) {
      this.trigger("error", {
        action: "init-downloader",
        error,
        contentID: options.contentID,
      });
    }
  }

  /**
   * Resume a download already started earlier.
   * @param {string} contentID
   * @returns {Promise.<void>}
   */
  async resume(contentID: string): Promise<void> {
    try {
      const db = this.db;
      if (db === null) {
        throw new Error("The IndexDB database has not been created!");
      }
      if (!contentID) {
        throw new Error("You must specify a valid contentID for resuming.");
      }
      const storedManifest: IStoredManifest = await db.get(
        "manifests",
        contentID,
      );
      checkForResumeAPausedMovie(storedManifest, this.activeDownloads);
      const pause$ = new AsyncSubject<void>();
      this.activePauses[contentID] = pause$;
      const downloadManager = new DownloadManager({
        emitter: this.emitter,
        db,
      });
      const { metaData, transport } = storedManifest;
      const resumeDownloadSub = downloadManager
        .resumeDownload(storedManifest, pause$)
        .subscribe(
          ([download]) => {
            if (download === null) {
              return;
            }
            const { progress, manifest, audio, video, text, size } = download;
            if (manifest === null) {
              return;
            }
            db.put("manifests", {
              contentID,
              transport,
              builder: { video, audio, text },
              progress,
              size,
              duration: storedManifest.duration,
              ...(metaData && { metaData }),
            });
          },
          error =>
            this.trigger("error", { action: "resume-downloader", error }),
          () => console.warn(`DOWNLOAD INIT COMPLETE: ${contentID}`),
        );
      this.activeDownloads[contentID] = resumeDownloadSub;
    } catch (error) {
      this.trigger("error", { action: "resume-downloader", error, contentID });
    }
  }

  /**
   * Pause a download already started earlier.
   * @param {string} contentID
   * @returns {void}
   */
  pause(contentID: string): void {
    try {
      checkForPauseAMovie(contentID);
      const activeDownloads = this.activeDownloads;
      const activePauses = this.activePauses;
      if (!activeDownloads[contentID] && !activePauses[contentID]) {
        throw new ValidationArgsError(`Invalid contentID given: ${contentID}`);
      }
      activePauses[contentID].next();
      activePauses[contentID].complete();
      activeDownloads[contentID].unsubscribe();
      delete activeDownloads[contentID];
      delete activePauses[contentID];
    } catch (e) {
      this.trigger("error", {
        action: "pause",
        contentID,
        error: e || new Error("A Unexpected error happened"),
      });
    }
  }

  /**
   * Get all the downloaded entry (manifest) partially or fully downloaded.
   * @returns {Promise.<IStoredManifest[]|void>}
   */
  getAllDownloadedMovies(): Promise<IStoredManifest[] | undefined> | void {
    try {
      if (!this.db) {
        throw new Error("The IndexDB database has not been created!");
      }
      return this.db.getAll("manifests");
    } catch (e) {
      this.trigger("error", {
        action: "getAllDownloadedMovies",
        error: new IndexDBError(e.message),
      });
    }
  }

  /**
   * Get a singleMovie ready to be played by the rx-player,
   * could be fully or partially downloaded.
   * @param {string} contentID
   * @returns {Promise.<IContentLoader|void>}
   */
  async getSingleContent(contentID: string): Promise<IContentLoader | void> {
    try {
      if (!this.db) {
        throw new Error("The IndexDB database has not been created!");
      }
      const [contentManifest, contentProtection]: [
        IStoredManifest?,
        IContentProtection?,
      ] = await PPromise.all([
        this.db.get("manifests", contentID),
        this.db.get("drm", contentID),
      ]);
      if (contentManifest == undefined) {
        throw new SegmentConstuctionError(
          `No Manifest found for current content ${contentID}`,
        );
      }
      const segmentsSortedByRepresentationID: ISegmentsSortedByRepresentationID = {};
      const indexTx = this.db
        .transaction("segments", "readonly")
        .objectStore("segments")
        .index("contentID");
      let cursor = await indexTx.openCursor(IDBKeyRange.only(contentID));
      while (cursor) {
        const currSegmentRepresenationID = cursor.value.representationID;
        if (
          !segmentsSortedByRepresentationID[currSegmentRepresenationID] &&
          cursor !== null
        ) {
          segmentsSortedByRepresentationID[currSegmentRepresenationID] = [];
          segmentsSortedByRepresentationID[currSegmentRepresenationID].push({
            ...cursor.value,
          });
          cursor = await cursor.continue();
        }
        if (cursor !== null) {
          segmentsSortedByRepresentationID[currSegmentRepresenationID].push({
            ...cursor.value,
          });
          cursor = await cursor.continue();
        }
      }
      if (Object.keys(segmentsSortedByRepresentationID).length === 0) {
        throw new SegmentConstuctionError(
          `No Segments found for current content ${contentID}`,
        );
      }
      const {
        progress,
        transport,
        size,
        metaData,
        manifest,
        duration,
      } = contentManifest;

      return {
        progress,
        size,
        transport,
        contentID,
        contentProtection,
        ...(metaData && { metaData }),
        offlineManifest: offlineManifestLoader(
          manifest,
          segmentsSortedByRepresentationID,
          getBuilderFormatted(contentManifest),
          duration,
          progress.percentage === 100,
        ),
      };
    } catch (e) {
      this.trigger("error", {
        action: "getSingleMovie",
        contentID,
        error: e || new Error("A Unexpected error happened"),
      });
    }
  }

  async getAvailableSpaceOnDevice() {
    if (!navigator.storage || !navigator.storage.estimate) {
      return null;
    }
    const { quota, usage } = await navigator.storage.estimate();
    if (!quota || !usage) {
      return null;
    }
    return {
      total: quota / 1e6,
      used: usage / 1e6,
    };
  }

  /**
   * Delete an entry partially or fully downloaded and stop the download
   * if the content is downloading, then delete.
   * @param {string} contentID
   * @returns {Promise.<void>}
   */
  async deleteDownloadedMovie(contentID: string): Promise<void> {
    try {
      const activeDownloads = this.activeDownloads;
      const activePauses = this.activePauses;
      const db = this.db;
      if (!db) {
        throw new Error("The IndexDB database has not been created!");
      }
      if (activeDownloads[contentID] && activePauses[contentID]) {
        activePauses[contentID].next();
        activePauses[contentID].complete();
        activeDownloads[contentID].unsubscribe();
        delete activeDownloads[contentID];
        delete activePauses[contentID];
      }
      const indexTx = db
        .transaction("segments", "readwrite")
        .objectStore("segments")
        .index("contentID");
      let cursor = await indexTx.openCursor(IDBKeyRange.only(contentID));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      await PPromise.all([
        db.delete("drm", contentID),
        db.delete("manifests", contentID),
      ]);
    } catch (e) {
      this.trigger("error", {
        action: "delete-download",
        contentID,
        error: e || new Error("A Unexpected error happened"),
      });
    }
  }
}

window.__DEV__ = true;
window.d2g = D2G;
window.__LOGGER_LEVEL__ = true;

export default D2G;
