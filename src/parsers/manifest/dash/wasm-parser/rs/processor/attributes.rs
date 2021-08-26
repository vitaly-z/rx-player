use crate::errors::ParsingError;
use crate::events::AttributeName::{*, self};
use crate::events::TagName;
use crate::onTagOpen2;

// pub fn report_segment_template_attrs(tag_bs : &quick_xml::events::BytesStart) {
//     for res_attr in tag_bs.attributes() {
//         match res_attr {
//             Ok(attr) => match attr.key {
//                 b"initialization" => InitializationMedia.try_report_as_string(&attr),
//                 b"index" => Index.try_report_as_string(&attr),
//                 b"timescale" => TimeScale.try_report_as_u64(&attr),
//                 b"presentationTimeOffset" =>
//                     PresentationTimeOffset.try_report_as_f64(&attr),
//                 b"indexRange" =>
//                     IndexRange.try_report_as_range(&attr),
//                 b"IndexRangeExact" =>
//                     IndexRangeExact.try_report_as_bool(&attr),
//                 b"availabilityTimeOffset" => match attr.value.as_ref() {
//                     b"INF" => AvailabilityTimeOffset.report(f64::INFINITY),
//                     _ => AvailabilityTimeOffset.try_report_as_u64(&attr),
//                 },
//                 b"availabilityTimeComplete" =>
//                     AvailabilityTimeComplete.try_report_as_bool(&attr),
//                 b"duration" =>
//                     Duration.try_report_as_u64(&attr),
//                 b"startNumber" =>
//                     StartNumber.try_report_as_u64(&attr),
//                 b"media" => Media.try_report_as_string(&attr),
//                 b"bitstreamSwitching" => BitstreamSwitching.try_report_as_bool(&attr),
//                 _ => {},
//             },
//             Err(err) => ParsingError::from(err).report_err(),
//         };
//     };
// }

// pub fn report_segment_base_attrs(tag_bs : &quick_xml::events::BytesStart) {
//     for res_attr in tag_bs.attributes() {
//         match res_attr {
//             Ok(attr) => match attr.key {
//                 b"timescale" => TimeScale.try_report_as_u64(&attr),
//                 b"presentationTimeOffset" =>
//                     PresentationTimeOffset.try_report_as_f64(&attr),
//                 b"indexRange" => IndexRange.try_report_as_range(&attr),
//                 b"indexRangeExact" => IndexRangeExact.try_report_as_bool(&attr),
//                 b"availabilityTimeOffset" => match attr.value.as_ref() {
//                     b"INF" => AvailabilityTimeOffset.report(f64::INFINITY),
//                     _ => AvailabilityTimeOffset.try_report_as_u64(&attr),
//                 },
//                 b"availabilityTimeComplete" =>
//                     AvailabilityTimeComplete.try_report_as_bool(&attr),
//                 b"duration" =>
//                     Duration.try_report_as_u64(&attr),
//                 b"startNumber" =>
//                     StartNumber.try_report_as_u64(&attr),
//                 _ => {},
//             },
//             Err(err) => ParsingError::from(err).report_err(),
//         };
//     };
// }

// /// Report attributes encountered in an `<Initialization>` element.
// pub fn report_initialization_attrs(tag_bs : &quick_xml::events::BytesStart) {
//     for res_attr in tag_bs.attributes() {
//         match res_attr {
//             Ok(attr) => match attr.key {
//                 b"range" => InitializationRange.try_report_as_range(&attr),
//                 b"sourceURL" => InitializationMedia.try_report_as_string(&attr),
//                 _ => {},
//             },
//             Err(err) => ParsingError::from(err).report_err(),
//         };
//     };
// }

// pub fn report_segment_url_attrs(tag_bs : &quick_xml::events::BytesStart) {
//     for res_attr in tag_bs.attributes() {
//         match res_attr {
//             Ok(attr) => match attr.key {
//                 b"index" => Index.try_report_as_string(&attr),
//                 b"indexRange" => IndexRange.try_report_as_range(&attr),
//                 b"media" => Media.try_report_as_string(&attr),
//                 b"mediaRange" => MediaRange.try_report_as_range(&attr),
//                 _ => {},
//             },
//             Err(err) => ParsingError::from(err).report_err(),
//         };
//     };
// }

// pub fn report_event_stream_attrs(tag_bs : &quick_xml::events::BytesStart) {
//     for res_attr in tag_bs.attributes() {
//         match res_attr {
//             Ok(attr) => match attr.key {
//                 b"schemeIdUri" => SchemeIdUri.try_report_as_string(&attr),
//                 b"value" => SchemeValue.try_report_as_string(&attr),
//                 b"timescale" => TimeScale.try_report_as_u64(&attr),
//                 _ => {},
//             },
//             Err(err) => ParsingError::from(err).report_err(),
//         };
//     };
// }

// pub fn report_event_stream_event_attrs(tag_bs : &quick_xml::events::BytesStart) {
//     for res_attr in tag_bs.attributes() {
//         match res_attr {
//             Ok(attr) => match attr.key {
//                 b"presentationTime" => EventPresentationTime.try_report_as_u64(&attr),
//                 b"duration" => Duration.try_report_as_u64(&attr),
//                 b"id" => Id.try_report_as_string(&attr),
//                 _ => {},
//             },
//             Err(err) => ParsingError::from(err).report_err(),
//         };
//     };
// }

//use std::ffi::CString;

//#[repr(C)]
//enum ParsedAttribute<T> {
//    Nothing,
//    Value(T),

//    /// CString (nul-terminated CString) for now for simplicity reasons with
//    /// regards to FFI.
//    ///
//    /// TODO solution with raw pointer + length?
//    Failure(CString),
//    // Failure(*const  u8, i32),
//}

//impl<T> Default for ParsedAttribute<T> {
//    fn default() -> Self { ParsedAttribute::Nothing }
//}

//use std::borrow::Cow;

//#[repr(C)]
//#[derive(Default)]
//struct MpdAttributes<'a> {
//    id: ParsedAttribute<&'a [u8]>,
//    profiles: ParsedAttribute<&'a [u8]>,
//    mpd_type: ParsedAttribute<&'a [u8]>,
//    availability_start_time: ParsedAttribute<&'a [u8]>,
//    availability_end_time: ParsedAttribute<&'a [u8]>,
//    publish_time: ParsedAttribute<&'a [u8]>,
//    media_presentation_duration: ParsedAttribute<f64>,
//    minimum_update_period: ParsedAttribute<f64>,
//    min_buffer_time: ParsedAttribute<f64>,
//    time_shift_buffer_depth: ParsedAttribute<f64>,
//    suggested_presentation_delay: ParsedAttribute<f64>,
//    max_segment_duration: ParsedAttribute<f64>,
//    max_subsegment_duration: ParsedAttribute<f64>,
//}

//fn extract_iso_8601_duration_attr(
//    attr_val : &Cow<[u8]>
//) -> ParsedAttribute<f64> {
//    use crate::utils::*;
//    match parse_iso_8601_duration(&attr_val) {
//        Ok(val) => ParsedAttribute::Value(val),
//        Err(error) => ParsedAttribute::Failure(error.into())
//    }
//}

pub fn parse_mpd_attrs(
    e : &quick_xml::events::BytesStart,
    attr_list : &mut AttributeList
) {
    for res_attr in e.attributes() {
        match res_attr {
            Ok(attr) => match attr.key {
                b"id" => attr_list.add_string(Id, &attr),
                b"profiles" => attr_list.add_string(Profiles, &attr),
                b"type" => attr_list.add_string(Type, &attr),
                b"availabilityStartTime" =>
                    attr_list.add_string(AvailabilityStartTime, &attr),
                b"availabilityEndTime" =>
                    attr_list.add_string(AvailabilityEndTime, &attr),
                b"publishTime" => attr_list.add_string(PublishTime, &attr),
                b"mediaPresentationDuration" =>
                    attr_list.add_iso_8601_duration(MediaPresentationDuration, &attr),
                b"minimumUpdatePeriod" =>
                    attr_list.add_iso_8601_duration(MinimumUpdatePeriod, &attr),
                b"minBufferTime" => attr_list.add_iso_8601_duration(MinBufferTime, &attr),
                b"timeShiftBufferDepth" =>
                    attr_list.add_iso_8601_duration(TimeShiftBufferDepth, &attr),
                b"suggestedPresentationDelay" =>
                    attr_list.add_iso_8601_duration(SuggestedPresentationDelay, &attr),
                b"maxSegmentDuration" =>
                    attr_list.add_iso_8601_duration(MaxSegmentDuration, &attr),
                b"maxSubsegmentDuration" =>
                    attr_list.add_iso_8601_duration(MaxSubsegmentDuration, &attr),
                _ => {},
            },
            Err(err) => ParsingError::from(err).report_err(),
        };
    };
}

pub fn parse_period_attrs(
    e : &quick_xml::events::BytesStart,
    attr_list : &mut AttributeList
) {
    for res_attr in e.attributes() {
        match res_attr {
            Ok(attr) => match attr.key {
                b"id" => attr_list.add_string(Id, &attr),
                b"start" => attr_list.add_iso_8601_duration(Start, &attr),
                b"duration" => attr_list.add_iso_8601_duration(Duration, &attr),
                b"bitstreamSwitching" => attr_list.add_bool(BitstreamSwitching, &attr),
                b"xlink:href" => attr_list.add_string(XLinkHref, &attr),
                b"xlink:actuate" => attr_list.add_string(XLinkActuate, &attr),
                _ => {},
            },
            Err(err) => ParsingError::from(err).report_err(),
        };
    };
}

pub fn parse_adaptation_set_attrs(
    e : &quick_xml::events::BytesStart,
    attr_list : &mut AttributeList
) {
    for res_attr in e.attributes() {
        match res_attr {
            Ok(attr) => match attr.key {
                b"id" => attr_list.add_string(Id, &attr),
                b"group" => attr_list.add_u64(Group, &attr),
                b"lang" => attr_list.add_string(Language, &attr),
                b"contentType" => attr_list.add_string(ContentType, &attr),
                b"par" => attr_list.add_string(Par, &attr),
                b"minBandwidth" => attr_list.add_u64(MinBandwidth, &attr),
                b"maxBandwidth" => attr_list.add_u64(MaxBandwidth, &attr),
                b"minWidth" => attr_list.add_u64(MinWidth, &attr),
                b"maxWidth" => attr_list.add_u64(MaxWidth, &attr),
                b"minHeight" => attr_list.add_u64(MinHeight, &attr),
                b"maxHeight" => attr_list.add_u64(MaxHeight, &attr),
                b"minFrameRate" => attr_list.add_string(MinFrameRate, &attr),
                b"maxFrameRate" => attr_list.add_string(MaxFrameRate, &attr),
                b"selectionPriority" => attr_list.add_u64(SelectionPriority, &attr),
                b"segmentAlignment" => attr_list.add_u64_or_bool(SegmentAlignment, &attr),
                b"subsegmentAlignment" =>
                    attr_list.add_u64_or_bool(SubsegmentAlignment, &attr),
                b"bitstreamSwitching" => attr_list.add_bool(BitstreamSwitching, &attr),
                b"audioSamplingRate" => attr_list.add_string(AudioSamplingRate, &attr),
                b"codecs" => attr_list.add_string(Codecs, &attr),
                b"profiles" => attr_list.add_string(Profiles, &attr),
                b"segmentProfiles" => attr_list.add_string(SegmentProfiles, &attr),
                b"mimeType" => attr_list.add_string(MimeType, &attr),
                b"codingDependency" => attr_list.add_bool(CodingDependency, &attr),
                b"frameRate" => attr_list.add_string(FrameRate, &attr),
                b"height" => attr_list.add_u64(Height, &attr),
                b"width" => attr_list.add_u64(Width, &attr),
                b"maxPlayoutRate" => attr_list.add_f64(MaxPlayoutRate, &attr),
                b"maxSAPPeriod" => attr_list.add_f64(MaxSAPPeriod, &attr),
                _ => {},
            },
            Err(err) => ParsingError::from(err).report_err(),
        };
    };
}

pub fn parse_base_url_attrs(
    e : &quick_xml::events::BytesStart,
    attr_list : &mut AttributeList
) {
    for res_attr in e.attributes() {
        match res_attr {
            Ok(attr) => if let b"availabilityTimeOffset" = attr.key {
                match attr.value.as_ref() {
                    b"INF" => attr_list.add_raw_f64(AvailabilityTimeOffset, f64::INFINITY),
                    _ => attr_list.add_f64(AvailabilityTimeOffset, &attr),
                }
            },
            Err(err) => ParsingError::from(err).report_err(),
        };
    };
}

pub fn parse_scheme_attrs(
    e : &quick_xml::events::BytesStart,
    attr_list : &mut AttributeList
) {
    for res_attr in e.attributes() {
        match res_attr {
            Ok(attr) => match attr.key {
                b"schemeIdUri" => attr_list.add_string(SchemeIdUri, &attr),
                b"value" => attr_list.add_string(SchemeValue, &attr),
                _ => {},
            },
            Err(err) => ParsingError::from(err).report_err(),
        };
    };
}

pub fn parse_content_component_attrs(
    e : &quick_xml::events::BytesStart,
    attr_list : &mut AttributeList
) {
    for res_attr in e.attributes() {
        match res_attr {
            Ok(attr) => match attr.key {
                b"id" => attr_list.add_string(Id, &attr),
                b"lang" => attr_list.add_string(Language, &attr),
                b"contentType" => attr_list.add_string(ContentType, &attr),
                b"par" => attr_list.add_string(Par, &attr),
                _ => {},
            },
            Err(err) => ParsingError::from(err).report_err(),
        };
    };
}

pub fn parse_content_protection_attrs(
    e : &quick_xml::events::BytesStart,
    attr_list : &mut AttributeList
) {
    for res_attr in e.attributes() {
        match res_attr {
            Ok(attr) => match attr.key {
                b"schemeIdUri" => attr_list.add_string(SchemeIdUri, &attr),
                b"value" => attr_list.add_string(ContentProtectionValue, &attr),

                // TODO convert hex to bytes here?
                b"cenc:default_KID" => attr_list.add_string(ContentProtectionKeyId, &attr),
                _ => {},
            },
            Err(err) => ParsingError::from(err).report_err(),
        };
    };
}

pub fn parse_representation_attrs(
    e : &quick_xml::events::BytesStart,
    attr_list : &mut AttributeList
) {
    for res_attr in e.attributes() {
        match res_attr {
            Ok(attr) => match attr.key {
                b"id" => attr_list.add_string(Id, &attr),
                b"audioSamplingRate" => attr_list.add_string(AudioSamplingRate, &attr),
                b"bandwidth" => attr_list.add_u64(Bitrate, &attr),
                b"codecs" => attr_list.add_string(Codecs, &attr),
                b"codingDependency" => attr_list.add_bool(CodingDependency, &attr),
                b"frameRate" => attr_list.add_string(FrameRate, &attr),
                b"height" => attr_list.add_u64(Height, &attr),
                b"width" => attr_list.add_u64(Width, &attr),
                b"maxPlayoutRate" => attr_list.add_f64(MaxPlayoutRate, &attr),
                b"maxSAPPeriod" => attr_list.add_f64(MaxSAPPeriod, &attr),
                b"mimeType" => attr_list.add_string(MimeType, &attr),
                b"profiles" => attr_list.add_string(Profiles, &attr),
                b"qualityRanking" => attr_list.add_u64(QualityRanking, &attr),
                b"segmentProfiles" => attr_list.add_string(SegmentProfiles, &attr),
                _ => {},
            },
            Err(err) => ParsingError::from(err).report_err(),
        };
    };
}

#[repr(C)]
pub struct AttributeList {
    inner: Vec<u8>,
}

impl AttributeList {
    pub fn new() -> Self {
        Self { inner: Vec::new() }
    }

    pub fn add_string(
        &mut self,
        attr_name : AttributeName,
        attr : &quick_xml::events::attributes::Attribute
    ) {
        match attr.unescaped_value() {
            Ok(val) => {
                // UNSAFE:
                // The following line is unsafe because we're transmuting from
                // a u32 to a [u8; 4], so it can be pushed to the AttributeList.
                //
                // Though it should be OK because we know that we're currently
                // in a 32 bit little-endian WASM environment, so we know both
                // that the [u8; 4] form is valid and how to reconstruct it as
                // a 32 bit integer on the JS-side.
                //
                // XXX TODO it's possible that there is no perf improvement in
                // transmuting here, check.
                let len = unsafe { std::mem::transmute::<u32, [u8; 4]>(val.len() as u32) };

                self.inner.push(attr_name as u8);
                self.inner.extend(len);
                self.inner.extend(val.iter());
            },
            Err(_) =>
                ParsingError("Could not escape original value".to_owned())
                .report_err(),
        }
    }

    pub fn add_iso_8601_duration(
        &mut self,
        attr_name : AttributeName,
        attr : &quick_xml::events::attributes::Attribute
    ) {
        match crate::utils::parse_iso_8601_duration(&attr.value) {
            Ok(val) => {
                // UNSAFE: WASM offers guarantee about endianness
                // and Rust guarantee about the memory layout of an
                // f64, so we should be good to be able to
                // re-construct the float on the JS-side.
                let val = unsafe { std::mem::transmute::<f64, [u8; 8]>(val) };
                self.inner.push(attr_name as u8);
                self.inner.extend(val);
            },
            Err(error) => error.report_err(),
        }
    }

    pub fn add_f64(
        &mut self,
        attr_name : AttributeName,
        attr : &quick_xml::events::attributes::Attribute
    ) {
        match crate::utils::parse_f64(&attr.value) {
            Ok(val) => {
                // UNSAFE: WASM offers guarantee about endianness
                // and Rust guarantee about the memory layout of an
                // f64, so we should be good to be able to
                // re-construct the float on the JS-side.
                let val = unsafe { std::mem::transmute::<f64, [u8; 8]>(val) };
                self.inner.push(attr_name as u8);
                self.inner.extend(val);
            },
            Err(error) => error.report_err(),
        }
    }

    // XXX TODO check DASH-IF
    pub fn add_raw_f64(
        &mut self,
        attr_name : AttributeName,
        val : f64
    ) {
        // UNSAFE: WASM offers guarantee about endianness
        // and Rust guarantee about the memory layout of an
        // f64, so we should be good to be able to
        // re-construct the float on the JS-side.
        let val = unsafe { std::mem::transmute::<f64, [u8; 8]>(val) };
        self.inner.push(attr_name as u8);
        self.inner.extend(val);
    }

    pub fn add_u64(
        &mut self,
        attr_name : AttributeName,
        attr : &quick_xml::events::attributes::Attribute
    ) {
        match crate::utils::parse_u64(&attr.value) {
            Ok(val) => {
                // UNSAFE: WASM offers guarantee about endianness
                // and Rust guarantee about the memory layout of an
                // f64, so we should be good to be able to
                // re-construct the u64 on the JS-side.
                let val = unsafe { std::mem::transmute::<f64, [u8; 8]>(val as f64) };
                self.inner.push(attr_name as u8);
                self.inner.extend(val);
            },
            Err(error) => error.report_err(),
        }
    }

    pub fn add_u64_or_bool(
        &mut self,
        attr_name : AttributeName,
        attr : &quick_xml::events::attributes::Attribute
    ) {
        match crate::utils::parse_u64_or_bool(&attr.value) {
            Ok(val) => {
                // UNSAFE: WASM offers guarantee about endianness
                // and Rust guarantee about the memory layout of an
                // f64, so we should be good to be able to
                // re-construct the float on the JS-side.
                let val = unsafe { std::mem::transmute::<f64, [u8; 8]>(val) };
                self.inner.push(attr_name as u8);
                self.inner.extend(val);
            },
            Err(error) => error.report_err(),
        }
    }

    pub fn add_bool(
        &mut self,
        attr_name : AttributeName,
        attr : &quick_xml::events::attributes::Attribute
    ) {
        match crate::utils::parse_bool(&attr.value) {
            Ok(val) => {
                // UNSAFE: WASM offers guarantee about endianness
                // and Rust guarantee about the memory layout of an
                // f64, so we should be good to be able to
                // re-construct the float on the JS-side.
                let val = if val { 1 } else { 0 };
                self.inner.push(attr_name as u8);
                self.inner.push(val);
            },
            Err(error) => error.report_err(),
        }
    }

    // XXX TODO get_inner_ref?

    pub fn as_ptr(&self) -> *const u8 {
        self.inner.as_ptr()
    }

    pub fn len(&self) -> usize {
        self.inner.len()
    }

    pub fn clear(&mut self) {
        self.inner.clear()
    }

    pub fn send_as(&mut self, tag_name: TagName) {
        // UNSAFE: XXX TODO
        unsafe { onTagOpen2(tag_name, self.as_ptr(), self.len()) };
        self.clear();
    }
}
