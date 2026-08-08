#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(LiveSessionSync, RCTEventEmitter)

RCT_EXTERN_METHOD(updateLiveSession:(NSString *)sessionId name:(NSString *)name elapsed:(double)elapsed status:(NSString *)status)

RCT_EXTERN_METHOD(clearLiveSession)

@end
