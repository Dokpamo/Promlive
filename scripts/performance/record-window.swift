import Foundation
import AppKit
import ScreenCaptureKit
import CoreMedia
import AVFoundation

final class Capture: NSObject, SCStreamOutput, SCRecordingOutputDelegate, @unchecked Sendable {
  var frames: [[String: Double]] = []
  func stream(_ stream: SCStream, didOutputSampleBuffer buffer: CMSampleBuffer, of type: SCStreamOutputType) {
    guard type == .screen, let attachments = CMSampleBufferGetSampleAttachmentsArray(buffer, createIfNecessary: false) as? [[SCStreamFrameInfo:Any]], let row = attachments.first else { return }
    frames.append(["pts": CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(buffer)), "status": Double(row[.status] as? Int ?? -1)])
  }
  func recordingOutput(_ recordingOutput: SCRecordingOutput, didFailWithError error: Error) { print("recording error: \(error)") }
}
@main struct Main {
  static func main() async throws {
    _ = NSApplication.shared
    let pid = pid_t(CommandLine.arguments[1])!, url = URL(fileURLWithPath: CommandLine.arguments[2]), duration = UInt64(CommandLine.arguments[3])!
    let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
    let windows = content.windows.filter { $0.owningApplication?.processID == pid && $0.title == "Promlive" && $0.frame.height > 300 }
    guard windows.count == 1, let window = windows.first else { throw NSError(domain:"Expected one Promlive window",code:1) }
    let filter = SCContentFilter(desktopIndependentWindow: window)
    let config = SCStreamConfiguration()
    config.width = Int(window.frame.width) * 2; config.height = Int(window.frame.height) * 2
    config.minimumFrameInterval = CMTime(value:1,timescale:60); config.queueDepth = 5; config.showsCursor = false
    let capture = Capture(), queue = DispatchQueue(label:"benchmark.capture")
    let stream = SCStream(filter:filter, configuration:config, delegate:nil)
    try stream.addStreamOutput(capture, type:.screen, sampleHandlerQueue:queue)
    let recording = SCRecordingOutputConfiguration(); recording.outputURL = url; recording.outputFileType = .mp4
    let output = SCRecordingOutput(configuration:recording, delegate:capture)
    try stream.addRecordingOutput(output)
    try await stream.startCapture()
    try await Task.sleep(nanoseconds:duration*1_000_000_000)
    try? await stream.stopCapture()
    try await Task.sleep(nanoseconds:500_000_000)
    let frames = queue.sync { capture.frames }
    try JSONSerialization.data(withJSONObject:frames).write(to:url.appendingPathExtension("capture.json"))
    print("Recorded \(frames.count) capture samples to \(url.path)")
  }
}
