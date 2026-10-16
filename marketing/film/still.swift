// Grabs stills from an encoded film to check it: swift still.swift <film.mp4> <outDir> <t1> [t2 ...]
import AVFoundation
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let gen = AVAssetImageGenerator(asset: asset)
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
print("duration", asset.duration.seconds, "tracks", asset.tracks.map { $0.mediaType.rawValue })
for s in a.dropFirst(3) {
  let t = CMTime(seconds: Double(s)!, preferredTimescale: 600)
  let img = try gen.copyCGImage(at: t, actualTime: nil)
  let url = URL(fileURLWithPath: a[2]).appendingPathComponent("still-\(s).jpg") as CFURL
  let dest = CGImageDestinationCreateWithURL(url, UTType.jpeg.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, img, nil)
  CGImageDestinationFinalize(dest)
}
print("ok")
