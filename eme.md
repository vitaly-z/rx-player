## Multiple keys per content handling

### Why having multiple encryption keys for a single content?

At Canal+, we encounter a lot of contents with multiple associated keys.
This advanced usage allows nice capabilities:

  - It adds the possibility of having different security restrictions depending
    on the quality played.

    Typically, we could offer poor quality with lower restrictions, thus
    guaranteeing than most user can have access to a content, while serving
    higher quality only to user able to guarantee stricter restriction, thus
    preventing the illegal copy of those better qualities.

    This can thus be seen as a compromise between accessibility and copy
    protection.

  - It also allows to offer different restrictions for different programs (or
    sub-parts) of a given content, e.g. by proposing different keys per-DASH
    Period.


### 1 license request => 1 key

The simplest way to handle contents with multiple keys is to perform a new
license request each time a new key is needed, with the license containing
only the asked key.

This is the default logic enabled by the RxPlayer, also called
the "`singleLicensePer: "init-data"`" mode due to the corresponding option.

Handling this in the `EMEManager` is straightforward: each time new
unknown encryption initialization data is encountered, the `EMEManager` will
load or create a `MediaKeySession` and perform a license request for it (note:
it might even not need to perform a request, if that `MediaKeySession` was a
cached or persisted one).

This simple implementation has however a disadvantage: for contents with
multiple keys, it might lead to multiple license requests. Requests can be
expensive in terms of time and ressources which means we might want to
optimize it.
This optimization is handled by the more complex implementation introduced
below.


### 1 license request => keys for the whole content

A more advanced way of handling contents with multiple keys is to perform only
a single license request when the first needed key is encountered. The license
would then contain all keys needed to decrypt the content (that is, even the
other keys which the player did not explicitely ask for).

This behavior is called the "`singleLicensePer: "content"`" mode due to the
corresponding RxPlayer option.

For this to work, a logic has to be added on the license server to recognize
which keys are part of which content, and to construct a response ideally
containing all other keys for that content.

A logic also has to be added to the RxPlayer, so that it can know which scope
each license will apply to. That way, it can even know when keys that should
have been present in a license have actually been voluntarily not included in
it by the license server. This generally happens when the latter does not trust
the CDM enough for providing it keys with high restrictions.



## ProcessedInitDataRecord



### New initialization data is received by the EMEManager

When receiving new Initialization Data, the `EMEManager` first checks if a
compatible `ProcessedInitDataRecord` for the current content exists.

#### No compatible `ProcessedInitDataRecord` exists

If it doesn't, it means that initialization data processed until now (if any)
does not lead to a session handling the corresponding key. In that case,
we continue the usual session creation process.

#### A compatible `ProcessedInitDataRecord` exists

If it does, it means that some previous initialization data processed from the
same content lead to a session already handling that key.
In that case, we perform several checks:
  - Was the whole related MediaKeySession blacklisted (due to a license
    request failure and the appropriate user configuration)?
      -> blacklist all Representations linked to that initialization data

  - Is the key id not handled by the related MediaKeySession?
      -> blacklist all Representations with that key id

      _Note: In the default `singleLicensePer` mode, to maximize 3.x.x backward
      retro-compatibility, the player will only blacklist Representations whose
      key id is explicitely in the related MediaKeySession's blacklist. This
      means that Representations with keys unexpectedly not present in the
      licence won't be blacklisted in that mode.

      In other modes, both explicitely blacklisted keys and not-present keys
      will have their Representations blacklisted._

  - Is the corresponding Session not loaded anymore (e.g. it was an old Session
    since removed from the cache)?
    We remove that `ProcessedInitDataRecord`.
