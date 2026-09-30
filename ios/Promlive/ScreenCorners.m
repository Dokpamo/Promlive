#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

@interface ScreenCorners : NSObject <RCTBridgeModule>
@end

@implementation ScreenCorners
RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

RCT_EXPORT_METHOD(getCorners:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
#if __IPHONE_OS_VERSION_MAX_ALLOWED >= 260000
  if (@available(iOS 26.0, *)) {
    UIWindow *window = nil;
    for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
      if (![scene isKindOfClass:UIWindowScene.class] || scene.activationState != UISceneActivationStateForegroundActive) continue;
      for (UIWindow *candidate in ((UIWindowScene *)scene).windows) {
        if (candidate.isKeyWindow) { window = candidate; break; }
      }
      if (window) break;
    }
    if (!window || CGRectIsEmpty(window.bounds)) { resolve(NSNull.null); return; }

    // Resolve against the actual window, including rotation and windowed iPad layouts.
    // Public UIKit geometry only: no private display-radius keys or device-name tables.
    UIView *probe = [[UIView alloc] initWithFrame:window.bounds];
    probe.userInteractionEnabled = NO;
    probe.accessibilityElementsHidden = YES;
    probe.alpha = 0;
    probe.cornerConfiguration = [UICornerConfiguration configurationWithRadius:UICornerRadius.containerConcentricRadius];
    [window addSubview:probe];
    [window layoutIfNeeded];
    [probe layoutIfNeeded];
    NSDictionary *corners = @{
      @"topLeft": @([probe effectiveRadiusForCorner:UIRectCornerTopLeft]),
      @"topRight": @([probe effectiveRadiusForCorner:UIRectCornerTopRight]),
      @"bottomLeft": @([probe effectiveRadiusForCorner:UIRectCornerBottomLeft]),
      @"bottomRight": @([probe effectiveRadiusForCorner:UIRectCornerBottomRight]),
    };
    [probe removeFromSuperview];
#if DEBUG
    NSLog(@"Promlive screen corners: %@", corners);
#endif
    resolve(corners);
    return;
  }
#endif
  // Older UIKit versions do not expose this geometry; JS retains its documented fallback.
  resolve(NSNull.null);
}
@end
