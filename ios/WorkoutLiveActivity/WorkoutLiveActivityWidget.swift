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

private func timerText(_ endDate: Date, font: Font) -> some View {
    Text(timerInterval: Date.now...endDate, countsDown: true)
        .monospacedDigit()
        .font(font)
        .foregroundColor(.white)
}

struct WorkoutLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            // Lock Screen / Notification banner view
            HStack(spacing: 16) {
                Circle()
                    .fill(Color(hex: context.state.phaseColor))
                    .frame(width: 10, height: 10)
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
                        Circle()
                            .fill(Color(hex: context.state.phaseColor))
                            .frame(width: 10, height: 10)
                        Text(context.state.phaseLabel)
                            .font(.system(size: 15, weight: .black))
                            .foregroundColor(Color(hex: context.state.phaseColor))
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    timerText(context.state.endDate, font: .system(size: 28, weight: .bold, design: .monospaced))
                        .padding(.trailing, 8)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.attributes.sessionName)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.white.opacity(0.5))
                        .padding(.bottom, 4)
                }
            } compactLeading: {
                Circle()
                    .fill(Color(hex: context.state.phaseColor))
                    .frame(width: 8, height: 8)
                    .padding(.leading, 4)
            } compactTrailing: {
                timerText(context.state.endDate, font: .system(size: 13, weight: .semibold, design: .monospaced))
                    .padding(.trailing, 4)
                    .minimumScaleFactor(0.7)
            } minimal: {
                Circle()
                    .fill(Color(hex: context.state.phaseColor))
                    .frame(width: 8, height: 8)
            }
        }
    }
}
