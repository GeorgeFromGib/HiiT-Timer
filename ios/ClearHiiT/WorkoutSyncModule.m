#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WorkoutSync, NSObject)

RCT_EXTERN_METHOD(syncSessionsData:(NSString *)json)

RCT_EXTERN_METHOD(syncPreferences:(BOOL)hideFolders)

@end
