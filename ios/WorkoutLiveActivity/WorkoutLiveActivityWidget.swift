import ActivityKit
import SwiftUI
import WidgetKit

private extension Color {
    init(hex: String) {
        var hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        if hex.count == 3 {
            hex = hex.map { "\($0)\($0)" }.joined()
        }
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        self.init(
            red: Double((int >> 16) & 0xFF) / 255,
            green: Double((int >> 8) & 0xFF) / 255,
            blue: Double(int & 0xFF) / 255
        )
    }
}

private func phaseSymbol(_ phase: String) -> String {
    switch phase {
    case "warmup":   return "sun.max"
    case "work":     return "flame"
    case "cooldown": return "snowflake"
    default:         return "pause"
    }
}

private func timerText(_ endUnix: Double, font: Font) -> some View {
    let end = Date(timeIntervalSince1970: endUnix)
    return Text(timerInterval: Date.now...end, countsDown: true)
        .monospacedDigit()
        .font(font)
        .foregroundColor(.white)
}

struct WorkoutLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            // Lock Screen / Notification banner view
            HStack(spacing: 16) {
                Image(systemName: phaseSymbol(context.state.phase))
                    .foregroundColor(Color(hex: context.state.phaseColor))
                    .font(.system(size: 16, weight: .semibold))
                Text(context.state.phaseLabel)
                    .font(.system(size: 16, weight: .black))
                    .foregroundColor(Color(hex: context.state.phaseColor))
                Spacer()
                timerText(context.state.endDate, font: .system(size: 32, weight: .bold, design: .monospaced))
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .background(.black.opacity(0.8))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 8) {
                        Image(systemName: phaseSymbol(context.state.phase))
                            .foregroundColor(Color(hex: context.state.phaseColor))
                            .font(.system(size: 15, weight: .semibold))
                        Text(context.state.phaseLabel)
                            .font(.system(size: 15, weight: .black))
                            .foregroundColor(Color(hex: context.state.phaseColor))
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    timerText(context.state.endDate, font: .system(size: 28, weight: .bold, design: .monospaced))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.trailing, 8)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.attributes.sessionName)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.white.opacity(0.5))
                        .padding(.bottom, 4)
                }
            } compactLeading: {
                HStack(spacing: 4) {
                    Image(systemName: phaseSymbol(context.state.phase))
                        .foregroundColor(Color(hex: context.state.phaseColor))
                        .font(.system(size: 11, weight: .semibold))
                    Text(context.state.phaseLabel)
                        .font(.system(size: 11, weight: .black))
                        .foregroundColor(Color(hex: context.state.phaseColor))
                }
                .padding(.leading, 4)
            } compactTrailing: {
                timerText(context.state.endDate, font: .system(size: 13, weight: .semibold, design: .monospaced))
                    .padding(.trailing, 4)
                    .minimumScaleFactor(0.7)
            } minimal: {
                Image(systemName: phaseSymbol(context.state.phase))
                    .foregroundColor(Color(hex: context.state.phaseColor))
                    .font(.system(size: 10, weight: .semibold))
            }
        }
    }
}
