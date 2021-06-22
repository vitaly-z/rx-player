const representationPickerCtrl = new RepresentationPickerController({
  initialBitrate,
  lowLatencyMode,
  throttlers,
});

representationPickerCtrl.setMaxVideoBitrate(22555);

const audioPicker = representationPickerCtrl
  .registerPicker({ period, type: "audio" }, representations);

// AdaptationStream
audioPicker.start(clock$, abrEvents$)
  .subscribe();

// Public API
function setMaxVideoBitrate(btr) {
  representationPickerCtrl.setMaxVideoBitrate(btr);
}

function lockVideoRepresentation(id) {
  const period = this.__priv_contentInfos.currentPeriod;
  const representations = representationPickerCtrl
    .getAvailableRepresentations({ period, type: "video" });
  if (representations === null) {
    throw new Error();
  }

  if (!representations.includes(id)) {
    throw new Error();
  }

  representationPickerCtrl.lockVideoRepresentation({ period, type: "video" },
                                                     id);
}

function lockVideoRepresentation(id) {
  const period = this.__priv_contentInfos.currentPeriod;
  const videoPicker = representationPickerCtrl
    .getPicker({ period, type: "video" });
  if (videoPicker === null) {
    throw new Error();
  }

  const representations = videoPicker.getAvailableRepresentations();
  if (!representations.includes(id)) {
    throw new Error();
  }

  videoPicker.lockRepresentation(id);
}

function unlockVideoRepresentation() {

}

function isVideoRepresentationLocked() {
}

class RepresentationPicker {
  constructor(representations) {}
  lockRepresentation(id) {},
  unlockRepresentation() {},
  isRepresentationLocked() {},

  start(clock$, abrEvents$) {
    return
  }
}


// const picker = representationPickerStore.registerPicker({ period, type: adaptation.type },
//                                                         representations);
// // AdaptationStream
// picker.start(clock$, abrEvents$).subscribe

// // API
const audioPicker = representationPickerStore.getPicker({ period, type: adaptation.type });
// picker.getAvailableRepresentations();
// picker.lockRepresentation(representation.id);
// picker.unlockRepresentation();

// representationPickerStore.setMinAudioBitrate(500);

// representationPickerStore.removePicker({ period, type: adaptation.type });
// representationPickerStore.reset();
