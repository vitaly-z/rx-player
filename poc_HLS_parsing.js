var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

const attributeNameValue = /^((?:[A-Z0-9\-])*)=(.*)/

const attributeList = /^\#((?:[A-Z0-9-]){1,}):(.*)/

const splitter = /((?:[A-Z0-9\-])*=(?:(?:0x|0X)(?:[0-9A-F]){1,}[^,]?|[0-9]{1,20}[^,]?|-?[0-9]{1,}\.[0-9]{1,}[^,]?|"[^\x22\n\r]*?"[^,]?|[^\x22, ]*[^,]?|[0-9]*x[0-9]*[^,]?))/g

const attrValueRegex = {
  "hexadecimalSequence": /((?:0x|0X)(?:[0-9A-F]){1,}$)/, // e.g. 0x55
  "decimalInteger": /([0-9]{1,20}$)/, // e.g. 46464
  "signedDecimalFloatingPoint": /(-?[0-9]{1,}\.[0-9]{1,}$)/, // e.g. -2.64
  "quotedString": /(?:"([^\x22\n\r]*?)"$)/, // e.g. "helloooo"
  "enumaratedString": /(^[^\x22, ]*$)/, // e.g. SALUT
  "decimalResolution": /([0-9]*x[0-9]*$)/ // e.g. 56466x46464
} 

const sessionKeyValue = {
  "METHOD": "enumaratedString",
  "URI": "quotedString",
  "KEYFORMAT": "quotedString",
  "KEYFORMATVERSIONS": "quotedString"
}

const mediaValue = {
  "TYPE": "enumaratedString",
  "GROUP-ID": "quotedString",
  "NAME": "quotedString",
  "DEFAULT": "enumaratedString",
  "AUTOSELECT": "enumaratedString",
  "LANGUAGE": "quotedString",
  "URI": "quotedString"
}

const streamInfoValue = {
  "PROGRAM-ID": "decimalInteger",
  "BANDWIDTH": "decimalInteger",
  "CODECS": "quotedString",
  "AUDIO": "quotedString",
  "AUTOSELECT": "enumaratedString",
  "LANGUAGE": "quotedString",
  "URI": "quotedString"
}

const valueForTag = {
  "EXT-X-SESSION-KEY": sessionKeyValue,
  "EXT-X-KEY": sessionKeyValue,
  "EXT-X-MEDIA": mediaValue,
  "EXT-X-STREAM-INF": streamInfoValue,
}

const infosLineAfter = {
    "EXT-X-SESSION-KEY": false,
    "EXT-X-MEDIA": false,
    "EXT-X-STREAM-INF": true,
  }

const functionForTag = {
    "EXT-X-SESSION-KEY": (res) => {
        return {
            method: res["METHOD"],
            uri: res["URI"],
            keyFormat: res["KEYFORMAT"],
            KeyFormatVersion: res["KEYFORMATVERSIONS"]
        }
    },
    "EXT-X-KEY": (res) => {
        return {
            method: res["METHOD"],
            uri: res["URI"],
            keyFormat: res["KEYFORMAT"],
            KeyFormatVersion: res["KEYFORMATVERSIONS"]
        }
    },
    "EXT-X-MEDIA": (res) => {
        return {
            type: res["TYPE"],
            groupId: res["GROUP-ID"],
            name: res["NAME"],
            default: res["DEFAULT"] === "YES",
            autoSelect: res["AUTOSELECT"] === "YES",
            language: res["LANGUAGE"],
            uri: res["URI"]
        }
    },
    "EXT-X-STREAM-INF": (res) => {
        return {
            programId: res["PROGRAM-ID"],
            bandwidth: res["BANDWIDTH"],
            codecs: res["CODECS"],
            audio: res["AUDIO"],
        }
    },
  }

  const names = {
    "EXT-X-SESSION-KEY": "sessionKey",
    "EXT-X-SESSION-KEY": "key",
    "EXT-X-MEDIA": "renditions",
    "EXT-X-STREAM-INF": "variantStream"
  }

  const directValues = {
    "EXT-X-VERSION": (parsedManifest, line) => {
        parsedManifest.version = line.match(/^#EXT-X-VERSION:([0-9])/)[1];
    },
    "EXT-X-TARGETDURATION": (parsedManifest, line) => {
        parsedManifest.targetDuration = line.match(/^#EXT-X-TARGETDURATION:([0-9])/)[1];
    },
    "EXTINF": (parsedManifest, line) => {
        parsedManifest.inf = line.match(/^#EXTINF:([0-9]*(?:.[0-9]{1,})?)/)[1];
        if(parsedManifest.totalDuration == null) { parsedManifest.totalDuration = 0 }; 
        parsedManifest.totalDuration += parseInt(parsedManifest.inf);  
    },
    "EXT-X-BYTERANGE": (parsedManifest, line, upperLine) => {
        const match = line.match(/#EXT-X-BYTERANGE:([0-9]*)@([0-9]*)/);
        if(parsedManifest.byteRanges == null){
            parsedManifest.byteRanges = [];
        }
        parsedManifest.byteRanges.push({
            up: parseInt(match[2]),
            duration: parseInt(match[1]),
            to: parseInt(match[1])+parseInt(match[2]),
            uri: upperLine,
            inf: parsedManifest.inf
        })
    }
  }

function parseDocument(base) {
  const parsedManifest = {};
  const newLineChar = /\r\n|\n|\r/g;
  const linified = base.split(newLineChar);

  if (!linified[0].match(/^#EXTM3U( |\t|\n|\r|$)/)) {
    throw new Error("Can't parse HLS: Invalid File.");
  }

  let result = [];
  for(let i = 1; i < linified.length; i++){
    if(linified[i].indexOf("#EXT-X-ENDLIST") >= 0){
        break;
    }
    const tagName = linified[i].match(attributeList) ? linified[i].match(attributeList)[1] : null;
      // Tags with direct values
    if(directValues[tagName] != null){
        directValues[tagName](parsedManifest, linified[i], linified[i+1]);
    // Tags with AttrName=AttrValue
    } else if(attributeList.test(linified[i])){
        const {res, name, suppInfos} = testBuild(linified[i], linified[i+1]);
        const obj = {};
        if(suppInfos){ 
            res["content"] = suppInfos;
        }
        obj[names[name]] = res;
        result.push(obj);
    }
  }
  const playlist = result;

  delete parsedManifest.inf;

parsedManifest.renditions = playlist
    .filter((element) => element.renditions)
    .map((element) => element.renditions);

parsedManifest.variantStream = playlist
    .filter((element) => element.variantStream)
    .map((element) => element.variantStream);

parsedManifest.sessionKey = playlist
    .filter((emt) => emt.sessionKey)
    .map((emt) => emt.sessionKey)[0];

parsedManifest.key = playlist
    .filter((emt) => emt.key)
    .map((emt) => emt.key)[0];

delete parsedManifest.byteRanges;

return parsedManifest;
}

function testBuild(line, infoLine){
  const tagName = line.match(attributeList)[1];
  const tagValue = line.match(attributeList)[2];

  const suppInfos = infosLineAfter[tagName] ? infoLine : undefined;
  if(tagName == null || tagValue == null){
    throw new Error("No Tag in Line.");
  }

  let res = {};

  const possibleValues = valueForTag[tagName];
  const tagValues = tagValue.match(splitter);
  tagValues.forEach((tagValue) => {
    const attrName = tagValue.match(attributeNameValue)[1];
    const attrValue = tagValue.match(attributeNameValue)[2];

    if(attrName == null || attrValue == null || possibleValues == null){
      throw new Error("Problems.");
      
    }
    const regex = possibleValues[attrName];

    const value = attrValue.match(attrValueRegex[regex])[1];
    res[attrName] = value;
  });

  const trans = functionForTag[tagName](res);
  return {res: trans, name: tagName, suppInfos};
}

function download(url){
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send();
    return xhr.responseText;
}

const baseUrl = 'http://hls-od-mycanal-aka.canal-plus.com/replay/cplus/hls/cpl100002147-ant-1195354-1/';
const manifest = download('http://hls-od-mycanal-aka.canal-plus.com/replay/cplus/hls/cpl100002147-ant-1195354-1/ANT_1195354_1.m3u8');

const parsedHLS = parseDocument(manifest);

parsedHLS.renditions.forEach((playlist) => {
    const uri = baseUrl + playlist.uri;
    const file = download(uri);
    playlist.stream = parseDocument(file);
});

parsedHLS.variantStream.forEach((playlist) => {
    const uri = baseUrl + playlist.content;
    const file = download(uri);
    playlist.stream = parseDocument(file);
});

parsedHLS.totalDuration = parsedHLS.renditions.reduce((a,b) => {
    if(b.stream.totalDuration > a){
        return b.stream.totalDuration;
    }
    return a;
}, parsedHLS.totalDuration || 0);

parsedHLS.totalDuration = parsedHLS.variantStream.reduce((a,b) => {
    if(b.stream.totalDuration > a){
        return b.stream.totalDuration;
    }
    return a;
}, parsedHLS.totalDuration || 0);

parsedHLS.targetDuration = parsedHLS.renditions.reduce((a,b) => {
    if(b.stream.targetDuration > a){
        return b.stream.targetDuration;
    }
    return a;
}, parsedHLS.targetDuration || 0);

parsedHLS.targetDuration = parsedHLS.variantStream.reduce((a,b) => {
    if(b.stream.targetDuration > a){
        return b.stream.targetDuration;
    }
    return a;
}, parsedHLS.targetDuration || 0);

// export interface IParsedManifest {
//     // required
//     availabilityStartTime : number;
//     duration: number;
//     id: string;
//     periods: IParsedPeriod[];
//     transportType: string; // "smooth", "dash" etc.
//     type: string; // "static" or "dynamic" TODO isLive?
//     uris: string[]; // uris where the manifest can be refreshed
  
//     // optional
//     availabilityEndTime?: number;
//     maxSegmentDuration?: number;
//     maxSubsegmentDuration?: number;
//     minBufferTime?: number;
//     minimumTime? : number;
//     minimumUpdatePeriod?: number;
//     presentationLiveGap?: number;
//     profiles?: string;
//     publishTime?: number;
//     suggestedPresentationDelay?: number;
//     timeShiftBufferDepth?: number;
//   }

// // Build adaptation/reps with rendition
// parsedHLS.renditions.map((rendition) => {

// })

// // Build adapt/rep with streamInfos

// // Build manifest

// const manifest = {
//     availabilityStartTime: 0,
//     duration: parsedHLS.totalDuration,
//     id: "test-id",
//     transportType: "HLS",
//     type: "static",
//     uris: string['http://hls-od-mycanal-aka.canal-plus.com/replay/cplus/hls/cpl100002147-ant-1195354-1/ANT_1195354_1.m3u8'],
//     maxSegmentDuration: parsedHLS.targetDuration
// }

console.log(JSON.stringify(parsedHLS, null, " "));