// Encodes rendered frames plus a WAV mix into an H.264 / AAC MP4 with
// AVFoundation, so the pipeline needs nothing beyond macOS.
//
//   swift encode.swift <framesDir> <mix.wav> <out.mp4> <width> <height> <videoBitrate> [fps]
import AVFoundation
import CoreGraphics
import ImageIO

let a = CommandLine.arguments
let framesDir = URL(fileURLWithPath: a[1])
let wavURL = URL(fileURLWithPath: a[2])
let outURL = URL(fileURLWithPath: a[3])
let W = Int(a[4])!, H = Int(a[5])!, bitrate = Int(a[6])!
let fps = Int32(a.count > 7 ? Int(a[7])! : 30)
try? FileManager.default.removeItem(at: outURL)

let frames = try FileManager.default.contentsOfDirectory(atPath: framesDir.path)
  .filter { $0.hasSuffix(".jpg") }.sorted()

let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true

let vIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: W, AVVideoHeightKey: H,
  AVVideoCompressionPropertiesKey: [
    AVVideoAverageBitRateKey: bitrate,
    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    AVVideoMaxKeyFrameIntervalKey: Int(fps) * 2,
  ],
])
vIn.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: vIn, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
  kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H,
])
writer.add(vIn)

let audioAsset = AVURLAsset(url: wavURL)
let aTrack = audioAsset.tracks(withMediaType: .audio)[0]
let reader = try AVAssetReader(asset: audioAsset)
let aOut = AVAssetReaderTrackOutput(track: aTrack, outputSettings: [
  AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMBitDepthKey: 16,
  AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false,
])
reader.add(aOut)
let aIn = AVAssetWriterInput(mediaType: .audio, outputSettings: [
  AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 48000, AVNumberOfChannelsKey: 2, AVEncoderBitRateKey: 192000,
])
aIn.expectsMediaDataInRealTime = false
writer.add(aIn)

writer.startWriting()
reader.startReading()
writer.startSession(atSourceTime: .zero)

func pixelBuffer(_ url: URL) -> CVPixelBuffer? {
  guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
        let img = CGImageSourceCreateImageAtIndex(src, 0, nil),
        let pool = adaptor.pixelBufferPool else { return nil }
  var pb: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pb)
  guard let buf = pb else { return nil }
  CVPixelBufferLockBaseAddress(buf, [])
  let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buf), width: W, height: H, bitsPerComponent: 8,
                      bytesPerRow: CVPixelBufferGetBytesPerRow(buf), space: CGColorSpaceCreateDeviceRGB(),
                      bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
  ctx.interpolationQuality = .high
  ctx.draw(img, in: CGRect(x: 0, y: 0, width: W, height: H))
  CVPixelBufferUnlockBaseAddress(buf, [])
  return buf
}

// Feed whichever input is ready; AVAssetWriter does the interleaving itself.
// (Gating one track on the other's timestamp can deadlock: each waits for the other.)
var vi = 0
var vDone = false, aDone = false
while !(vDone && aDone) {
  var progressed = false
  if !vDone && vIn.isReadyForMoreMediaData {
    if vi < frames.count, let pb = pixelBuffer(framesDir.appendingPathComponent(frames[vi])) {
      adaptor.append(pb, withPresentationTime: CMTime(value: CMTimeValue(vi), timescale: fps))
      vi += 1
      if vi % 300 == 0 { print("frame \(vi) / \(frames.count)") }
    } else {
      vIn.markAsFinished(); vDone = true
    }
    progressed = true
  }
  if !aDone && aIn.isReadyForMoreMediaData {
    if let sb = aOut.copyNextSampleBuffer() { aIn.append(sb) } else { aIn.markAsFinished(); aDone = true }
    progressed = true
  }
  if !progressed { usleep(1000) }
}

let sem = DispatchSemaphore(value: 0)
writer.finishWriting { sem.signal() }
sem.wait()
if writer.status != .completed { print("failed:", writer.error as Any); exit(1) }
print("wrote \(outURL.path) — \(frames.count) frames")
