#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WorkoutSync, NSObject)

RCT_EXTERN_METHOD(ping)

RCT_EXTERN_METHOD(syncSessionsData:(NSString *)json)

@end
