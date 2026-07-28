// ios/Shared/DeepLink.swift
import Foundation

/// Parses the "start this session" deep link the RecentSessionComplication
/// widget's tap target opens, e.g. hiitwatch://run?id=abc123. Returns nil for
/// any other scheme/host, or a missing id, so the caller can silently ignore it.
func sessionId(fromDeepLinkURL url: URL) -> String? {
  guard url.scheme == "hiitwatch", url.host == "run" else { return nil }
  return URLComponents(url: url, resolvingAgainstBaseURL: false)?
    .queryItems?
    .first(where: { $0.name == "id" })?
    .value
}
