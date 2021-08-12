// Move all HEVC (H265) qualities into a new track
function trackOrganizer(trackType, trackInfo, trackModifier) {
  if (trackType !== "video") {
    // ignore non-video tracks for now
    return;
  }

  // Create new track which will contain HEVC qualities coming originally
  // from this track.
  // This new track will have the same base characteristics (e.g. language,
  // accessibility properties etc.) than the current track.
  const toMove = [];
  for (let i = 0; i < trackInfo.representations.length; i++) {
    const representation = trackInfo.representations[i];
    if (representation.codecs.indexOf("hvc") >= 0) {
       // HEVC detected! Move it to our new track
       toMove.push(representation.id);
    }
  }
  if (toMove.length > 0) {
    trackModifier.createNewTrackFor(toMove);
  }
}

function trackOrganizer(trackType, trackInfo, trackModifier) {
  if (trackType !== "video") {
    // ignore non-video tracks for now
    return;
  }

  // Create new track which will contain HEVC qualities coming originally
  // from this track.
  // This new track will have the same base characteristics (e.g. language,
  // accessibility properties etc.) than the current track.
  for (let i = 0; i < trackInfo.representations.length; i++) {
    const representation = trackInfo.representations[i];
    if (representation.codecs.indexOf("hvc") >= 0) {
      trackModifier.removeRepresentation(representation.id);
    }
  }
}
