import SwiftUI

struct SessionRunView: View {
  let session: SessionDTO

  var body: some View {
    Text(session.name)
  }
}
