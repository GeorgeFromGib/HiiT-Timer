#import <React/RCTBridgeModule.h>

RCT_EXTERN_MODULE(LiveActivityModule, NSObject)

RCT_EXTERN_METHOD(
    startActivity:(NSString *)sessionName
    phase:(NSString *)phase
    phaseLabel:(NSString *)phaseLabel
    timeRemaining:(nonnull NSNumber *)timeRemaining
    phaseColor:(NSString *)phaseColor
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
    updateActivity:(NSString *)phase
    phaseLabel:(NSString *)phaseLabel
    timeRemaining:(nonnull NSNumber *)timeRemaining
    phaseColor:(NSString *)phaseColor
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
    endActivity:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)
