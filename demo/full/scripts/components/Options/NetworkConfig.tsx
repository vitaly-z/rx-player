import * as React from "react";
import Checkbox from "../CheckBox";
import DEFAULT_VALUES from "../../lib/defaultOptionsValues";
import PlayerOptionNumberInput from "./PlayerOptionNumberInput";

const { Fragment, useCallback, useEffect, useState } = React;

const DEFAULT_SEGMENT_RETRY =
  DEFAULT_VALUES.loadVideo.networkConfig.segmentRetry;
const DEFAULT_SEGMENT_REQUEST_TIMEOUT =
  DEFAULT_VALUES.loadVideo.networkConfig.segmentRequestTimeout;
const DEFAULT_MANIFEST_RETRY =
  DEFAULT_VALUES.loadVideo.networkConfig.manifestRetry;
const DEFAULT_MANIFEST_REQUEST_TIMEOUT =
  DEFAULT_VALUES.loadVideo.networkConfig.manifestRequestTimeout;
const DEFAULT_OFFLINE_RETRY =
  DEFAULT_VALUES.loadVideo.networkConfig.offlineRetry;

/**
 * @param {Object} props
 * @returns {Object}
 */
function RequestConfig({
  manifestRequestTimeout,
  manifestRetry,
  offlineRetry,
  onManifestRequestTimeoutChange,
  onManifestRetryChange,
  onOfflineRetryChange,
  onSegmentRequestTimeoutChange,
  onSegmentRetryChange,
  segmentRequestTimeout,
  segmentRetry,
}: {
  manifestRequestTimeout: number;
  manifestRetry: number;
  offlineRetry: number;
  onManifestRequestTimeoutChange: (val: number) => void;
  onManifestRetryChange: (val: number) => void,
  onOfflineRetryChange: (val: number) => void,
  onSegmentRequestTimeoutChange: (val: number) => void,
  onSegmentRetryChange: (val: number) => void,
  segmentRequestTimeout: number;
  segmentRetry: number;
}): JSX.Element {
  /* Value of the `segmentRetry` input */
  const [segmentRetryStr, setSegmentRetryStr] = useState(
    String(segmentRetry)
  );
  /* Value of the `segmentRequestTimeout` input */
  const [segmentRequestTimeoutStr, setSegmentRequestTimeoutStr] = useState(
    String(segmentRequestTimeout)
  );
  /* Value of the `manifestRetry` input */
  const [manifestRetryStr, setManifestRetryStr] = useState(
    String(manifestRetry)
  );
  /* Value of the `offlineRetry` input */
  const [offlineRetryStr, setOfflineRetryStr] = useState(
    String(offlineRetry)
  );
  /* Value of the `manifestRequestTimeout` input */
  const [
    manifestRequestTimeoutStr,
    setManifestRequestTimeoutStr
  ] = useState(
    String(manifestRequestTimeout)
  );
  /*
   * Keep track of the "limit segmentRetry" toggle:
   * `false` == checkbox enabled
   */
  const [isSegmentRetryLimited, setSegmentRetryLimit] = useState(
    segmentRetry !== Infinity
  );
  /*
   * Keep track of the "limit segmentRequestTimeout" toggle:
   * `false` == checkbox enabled
   */
  const [
    isSegmentRequestTimeoutLimited,
    setSegmentRequestTimeoutLimit
  ] = useState(
    segmentRequestTimeout !== -1
  );
  /*
   * Keep track of the "limit manifestRetry" toggle:
   * `false` == checkbox enabled
   */
  const [isManifestRetryLimited, setManifestRetryLimit] = useState(
    manifestRetry !== Infinity
  );
  /*
   * Keep track of the "limit offlineRetry" toggle:
   * `false` == checkbox enabled
   */
  const [isOfflineRetryLimited, setOfflineRetryLimit] = useState(
    offlineRetry !== Infinity
  );
  /*
   * Keep track of the "limit manifestRequestTimeout" toggle:
   * `false` == checkbox enabled
   */
  const [
    isManifestRequestTimeoutLimited,
    setManifestRequestTimeoutLimit
  ] = useState(
    manifestRequestTimeout !== -1
  );

  // Update manifestRequestTimeout when its linked text change
  useEffect(() => {
    // Note that this unnecessarily also run on first render - there seem to be
    // no quick and easy way to disable this in react.
    // This is not too problematic so I put up with it.
    let newVal = parseFloat(manifestRequestTimeoutStr);
    newVal = isNaN(newVal) ?
      DEFAULT_MANIFEST_REQUEST_TIMEOUT :
      newVal;
    onManifestRequestTimeoutChange(newVal);
  }, [manifestRequestTimeoutStr]);

  // Update manifestRetry when its linked text change
  useEffect(() => {
    let newVal = parseFloat(manifestRetryStr);
    newVal = isNaN(newVal) ?
      DEFAULT_MANIFEST_RETRY :
      newVal;
    onManifestRetryChange(newVal);
  }, [manifestRetryStr]);

  // Update segmentRequestTimeout when its linked text change
  useEffect(() => {
    let newVal = parseFloat(segmentRequestTimeoutStr);
    newVal = isNaN(newVal) ?
      DEFAULT_SEGMENT_REQUEST_TIMEOUT :
      newVal;
    onSegmentRequestTimeoutChange(newVal);
  }, [segmentRequestTimeoutStr]);

  // Update segmentRetry when its linked text change
  useEffect(() => {
    let newVal = parseFloat(segmentRetryStr);
    newVal = isNaN(newVal) ?
      DEFAULT_SEGMENT_RETRY :
      newVal;
    onSegmentRetryChange(newVal);
  }, [segmentRetryStr]);

  // Update offlineRetry when its linked text change
  useEffect(() => {
    let newVal = parseFloat(offlineRetryStr);
    newVal = isNaN(newVal) ?
      DEFAULT_OFFLINE_RETRY :
      newVal;
    onOfflineRetryChange(newVal);
  }, [offlineRetryStr]);

  const onChangeLimitSegmentRetry = useCallback(
    (isNotLimited: boolean) => {
      if (isNotLimited) {
        setSegmentRetryLimit(false);
        setSegmentRetryStr(String(Infinity));
      } else {
        setSegmentRetryLimit(true);
        setSegmentRetryStr(String(DEFAULT_SEGMENT_RETRY));
      }
    }, []);

  const onChangeLimitSegmentRequestTimeout = useCallback(
    (isNotLimited: boolean) => {
      if (isNotLimited) {
        setSegmentRequestTimeoutLimit(false);
        setSegmentRequestTimeoutStr(String(-1));
      } else {
        setSegmentRequestTimeoutLimit(true);
        setSegmentRequestTimeoutStr(String(DEFAULT_SEGMENT_REQUEST_TIMEOUT));
      }
    }, []);

  const onChangeLimitManifestRetry = useCallback(
    (isNotLimited: boolean) => {
      if (isNotLimited) {
        setManifestRetryLimit(false);
        setManifestRetryStr(String(Infinity));
      } else {
        setManifestRetryLimit(true);
        setManifestRetryStr(String(DEFAULT_MANIFEST_RETRY));
      }
    }, []);

  const onChangeLimitOfflineRetry = useCallback(
    (isNotLimited: boolean) => {
      if (isNotLimited) {
        setOfflineRetryLimit(false);
        setOfflineRetryStr(String(Infinity));
      } else {
        setOfflineRetryLimit(true);
        setOfflineRetryStr(String(DEFAULT_OFFLINE_RETRY));
      }
    }, []);

  const onChangeLimitManifestRequestTimeout = useCallback(
    (isNotLimited: boolean) => {
      if (isNotLimited) {
        setManifestRequestTimeoutLimit(false);
        setManifestRequestTimeoutStr(String(-1));
      } else {
        setManifestRequestTimeoutLimit(true);
        setManifestRequestTimeoutStr(String(DEFAULT_MANIFEST_REQUEST_TIMEOUT));
      }
    }, []);

  const onSegmentRetryResetClick = React.useCallback(() => {
    setSegmentRetryStr(String(DEFAULT_SEGMENT_RETRY));
    setSegmentRetryLimit(DEFAULT_SEGMENT_RETRY !== Infinity);
  }, []);

  const onSegmentTimeoutResetClick = React.useCallback(() => {
    setSegmentRequestTimeoutStr(String(DEFAULT_SEGMENT_REQUEST_TIMEOUT));
    setSegmentRequestTimeoutLimit(DEFAULT_SEGMENT_REQUEST_TIMEOUT !== Infinity);
  }, []);

  const onManifestRetryResetClick = React.useCallback(() => {
    setManifestRetryStr(String(DEFAULT_MANIFEST_RETRY));
    setManifestRetryLimit(DEFAULT_MANIFEST_RETRY !== Infinity);
  }, []);

  const onManifestTimeoutResetClick = React.useCallback(() => {
    setManifestRequestTimeoutStr(String(DEFAULT_MANIFEST_REQUEST_TIMEOUT));
    setManifestRequestTimeoutLimit(
      DEFAULT_MANIFEST_REQUEST_TIMEOUT !== Infinity
    );
  }, []);

  const onOfflineRetryResetClick = React.useCallback(() => {
    setOfflineRetryStr(String(DEFAULT_OFFLINE_RETRY));
    setOfflineRetryLimit(DEFAULT_OFFLINE_RETRY !== Infinity);
  }, []);

  return (
    <Fragment>
      <li>
        <PlayerOptionNumberInput
          ariaLabel="Segment retry option"
          label="segmentRetry"
          title="Segment Retry"
          valueAsString={segmentRetryStr}
          defaultValueAsNumber={DEFAULT_SEGMENT_RETRY}
          isDisabled={isSegmentRetryLimited === false}
          onUpdateValue={setSegmentRetryStr}
          onResetClick={onSegmentRetryResetClick}
        />
        <Checkbox
          className="playerOptionsCheckBox"
          ariaLabel="Segment retry limit option"
          name="segmentRetryLimit"
          checked={isSegmentRetryLimited === false}
          onChange={onChangeLimitSegmentRetry}
        >
          Do not limit
        </Checkbox>
        <span className="option-desc">
          {segmentRetry === Infinity || !isSegmentRetryLimited ?
            "Retry \"retryable\" segment requests with no limit" :
            `Retry "retryable" segment requests at most ${segmentRetry} time(s)`}
        </span>
      </li>

      <li>
        <PlayerOptionNumberInput
          ariaLabel="Segment Timeout option"
          label="segmentRequestTimeout"
          title="Segment Timeout"
          valueAsString={segmentRequestTimeoutStr}
          defaultValueAsNumber={DEFAULT_SEGMENT_REQUEST_TIMEOUT}
          isDisabled={isSegmentRequestTimeoutLimited === false}
          onUpdateValue={setSegmentRequestTimeoutStr}
          onResetClick={onSegmentTimeoutResetClick}
        />
        <Checkbox
          className="playerOptionsCheckBox"
          ariaLabel="Segment timeout limit option"
          name="segmentRequestTimeoutLimit"
          checked={isSegmentRequestTimeoutLimited === false}
          onChange={onChangeLimitSegmentRequestTimeout}
        >
          Do not limit
        </Checkbox>
        <span className="option-desc">
          {segmentRequestTimeout === -1 || !isSegmentRequestTimeoutLimited ?
            "Perform segment requests without timeout" :
            `Stop segment requests after ${segmentRequestTimeout} millisecond(s)`}
        </span>
      </li>

      <li>
        <PlayerOptionNumberInput
          ariaLabel="manifestRetry option"
          label="manifestRetry"
          title="Manifest Retry"
          valueAsString={manifestRetryStr}
          defaultValueAsNumber={DEFAULT_MANIFEST_RETRY}
          isDisabled={isManifestRetryLimited === false}
          onUpdateValue={setManifestRetryStr}
          onResetClick={onManifestRetryResetClick}
        />
        <Checkbox
          className="playerOptionsCheckBox"
          ariaLabel="Manifest retry limit option"
          name="manifestRetryLimit"
          checked={isManifestRetryLimited === false}
          onChange={onChangeLimitManifestRetry}
        >
          Do not limit
        </Checkbox>
        <span className="option-desc">
          {manifestRetry === Infinity || !isManifestRetryLimited ?
            "Retry \"retryable\" manifest requests with no limit" :
            `Retry "retryable" manifest requests at most ${manifestRetry} time(s)`}
        </span>
      </li>
      <li>
        <PlayerOptionNumberInput
          ariaLabel="offlineRetry option"
          label="offlineRetry"
          title="Offline Retry"
          valueAsString={offlineRetryStr}
          defaultValueAsNumber={DEFAULT_OFFLINE_RETRY}
          isDisabled={isOfflineRetryLimited === false}
          onUpdateValue={setOfflineRetryStr}
          onResetClick={onOfflineRetryResetClick}
        />
        <Checkbox
          className="playerOptionsCheckBox"
          ariaLabel="Offline retry limit option"
          name="offlineRetryLimit"
          checked={isOfflineRetryLimited === false}
          onChange={onChangeLimitOfflineRetry}
        >
          Do not limit
        </Checkbox>
        <span className="option-desc">
          {offlineRetry === Infinity || !isOfflineRetryLimited ?
            "Retry \"retryable\" requests when offline with no limit" :
            `Retry "retryable" requests when offline at most ${offlineRetry} time(s)`}
        </span>
      </li>

      <li>
        <PlayerOptionNumberInput
          ariaLabel="manifestRequestTimeout option"
          label="manifestRequestTimeout"
          title="Manifest Timeout"
          valueAsString={manifestRequestTimeoutStr}
          defaultValueAsNumber={DEFAULT_MANIFEST_REQUEST_TIMEOUT}
          isDisabled={isManifestRequestTimeoutLimited === false}
          onUpdateValue={setManifestRequestTimeoutStr}
          onResetClick={onManifestTimeoutResetClick}
        />
        <Checkbox
          className="playerOptionsCheckBox"
          ariaLabel="Manifest timeout limit option"
          name="manifestRequestTimeoutLimit"
          checked={isManifestRequestTimeoutLimited === false}
          onChange={onChangeLimitManifestRequestTimeout}
        >
          Do not limit
        </Checkbox>
        <span className="option-desc">
          {manifestRequestTimeout === -1 || !isManifestRequestTimeoutLimited ?
            "Perform manifest requests without timeout" :
            `Stop manifest requests after ${manifestRequestTimeout} millisecond(s)`}
        </span>
      </li>
    </Fragment>
  );
}

export default React.memo(RequestConfig);
