# setAudioTrack

## Description

Change the current audio track.

The argument to this method is the wanted track's `id` property. This `id` can
for example be obtained on the corresponding track object returned by the
`getAvailableAudioTracks` method.

<div class="note">
Note for multi-Period contents:
<br>
This method will only have an effect on the
<a href="../../Getting_Started/Glossary.md#period">Period</a> that is currently
playing.  If you want to update the track for other Periods as well, you might
want to either:
<br>
<ul>
  <li>update the current video track once a `"periodChange"` event has been
  received.</li>
  <li>update first the preferred video tracks through the
  <a href="./setPreferredVideoTracks.md">setPreferredVideoTracks</a> method.
  </li>
</ul>
</div>

<div class="warning">
If used on Safari, in _DirectFile_ mode, the track change may change
the track on other track type (e.g. changing video track may change subtitle
track too).
This has two potential reasons :

<ul>
  <li>The HLS defines variants, groups of tracks that may be read together</li>
  <li>Safari may decide to enable a track for accessibility or user language
  convenience (e.g. Safari may switch subtitle to your OS language if you pick
  another audio language)
  You can know if another track has changed by listening to the corresponding
  events that the tracks have changed.</li>
</ul>
</div>

## Syntax

```js
player.setAudioTrack(audioTrackId);
```

 - **arguments**:

   1. _audioTrackId_ `string|number`: The `id` of the track you want to set

{
  trackId: "4",
  switchBetweenForcedTextTracks: true,
}

  - _switchBetweenForcedTextTracks_ `boolean`: If set to `true` and either if
    there's no text track currently set or if there is but it is a "forced" text
    track (i.e. whose `forced` property is set to `true`, see
    [getAvailableTextTracks](./getAvailableTextTracks.md) documentation for more
    information), the RxPlayer will, in order of preference:
     1. switch to another "forced" text track if that new track respects one of
        the following conditions:
        - it's in the same language than the switched audio track, or
        - it has no language it is set to
     2. If no such text track exists, it will disable the potential previous
        "forced" text track, no text track will thus be selected.

    The idea behind that option is that "forced" text tracks are generally set
    to be displayed when no other text track is displayed and they generally
    follow the language of the audio track.

    Thus you can set this option to `true` to switch between `forced` text
    tracks at the same time you update the audio track's language.
    The following behaviors should however be understood when using this option:
      - it won't switch the text track if a non-forced text track was previously
        selected.
      - it will disable the previous - possibly forced - text track if none
        exist associated to the new audio language set and if none exist without
        any language associated.
     To also switch the text track in those other situations, you can use the
     [`setTextTrack`](./setTextTrack.md) API.
