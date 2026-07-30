#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(LiveSessionSync, NSObject)

RCT_EXTERN_METHOD(updateLiveSession:(NSString *)sessionId name:(NSString *)name elapsed:(double)elapsed status:(NSString *)status)

RCT_EXTERN_METHOD(clearLiveSession)

@end
