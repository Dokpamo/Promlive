#import <React/RCTView.h>
#import <React/RCTViewManager.h>
#import <QuartzCore/QuartzCore.h>

@class PromliveKeyboardView;

// CADisplayLink retains its target; keep the mounted React view weak.
@interface ChatKeyboardFrameTarget : NSObject
@property (nonatomic, weak) PromliveKeyboardView *owner;
- (void)tick:(CADisplayLink *)link;
@end

@interface PromliveKeyboardView : RCTView
@property (nonatomic) BOOL keyboardRoot;
@property (nonatomic) BOOL chatBody;
@property (nonatomic) BOOL trackDockOffset;
@property (nonatomic) CGFloat dockFraction;
@property (nonatomic) CGFloat bottomInset;
@property (nonatomic, copy) RCTDirectEventBlock onKeyboardDockFrame;
- (void)keyboardFrame;
- (void)resumeKeyboardFrames;
@end

@implementation ChatKeyboardFrameTarget
- (void)tick:(CADisplayLink *)link { [self.owner keyboardFrame]; }
@end

// Layout-guide changes also arrive during an interactive dismissal. Wake the
// coordinator when the probe moves, without running a display link while idle.
@interface ChatKeyboardProbe : UIView
@property (nonatomic, weak) PromliveKeyboardView *owner;
@end
@implementation ChatKeyboardProbe
- (void)setFrame:(CGRect)frame
{
  BOOL changed = !CGRectEqualToRect(self.frame, frame);
  [super setFrame:frame];
  if (changed) [self.owner resumeKeyboardFrames];
}
- (void)setBounds:(CGRect)bounds
{
  BOOL changed = !CGRectEqualToRect(self.bounds, bounds);
  [super setBounds:bounds];
  if (changed) [self.owner resumeKeyboardFrames];
}
- (void)setCenter:(CGPoint)center
{
  BOOL changed = !CGPointEqualToPoint(self.center, center);
  [super setCenter:center];
  if (changed) [self.owner resumeKeyboardFrames];
}
@end

@implementation PromliveKeyboardView {
  ChatKeyboardProbe *_keyboardProbe;
  CADisplayLink *_displayLink;
  NSHashTable<PromliveKeyboardView *> *_participants;
  __weak PromliveKeyboardView *_root;
  __weak UIScrollView *_messages;
  CGFloat _previousViewportHeight;
  CGFloat _lastDockOffset;
  CGFloat _lastCoveredHeight;
  CFTimeInterval _trackUntil;
  NSUInteger _settledFrames;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if ((self = [super initWithFrame:frame])) {
    _participants = [NSHashTable weakObjectsHashTable];
    _lastDockOffset = CGFLOAT_MAX;
    _lastCoveredHeight = CGFLOAT_MAX;
  }
  return self;
}

- (void)setKeyboardRoot:(BOOL)value
{
  _keyboardRoot = value;
  if (value && !_keyboardProbe) {
    // A public layout guide follows docked, interactive and interrupted keyboard
    // motion. Its presentation geometry supplies the actual displayed frame,
    // rather than starting a second animation from a JS notification.
    _keyboardProbe = [ChatKeyboardProbe new];
    _keyboardProbe.owner = self;
    _keyboardProbe.translatesAutoresizingMaskIntoConstraints = NO;
    _keyboardProbe.userInteractionEnabled = NO;
    _keyboardProbe.accessibilityElementsHidden = YES;
    [self addSubview:_keyboardProbe];
    self.keyboardLayoutGuide.followsUndockedKeyboard = NO;
    [NSLayoutConstraint activateConstraints:@[
      [_keyboardProbe.topAnchor constraintEqualToAnchor:self.keyboardLayoutGuide.topAnchor],
      [_keyboardProbe.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
      [_keyboardProbe.widthAnchor constraintEqualToConstant:1],
      [_keyboardProbe.heightAnchor constraintEqualToConstant:1],
    ]];
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(keyboardWillChange:)
      name:UIKeyboardWillChangeFrameNotification object:nil];
  }
  [self connect];
}

- (void)keyboardWillChange:(NSNotification *)notification
{
  NSTimeInterval duration = [notification.userInfo[UIKeyboardAnimationDurationUserInfoKey] doubleValue];
  _trackUntil = CACurrentMediaTime() + duration + 0.1;
  [self resumeKeyboardFrames];
}

- (void)resumeKeyboardFrames
{
  if (_keyboardRoot) {
    _settledFrames = 0;
    _displayLink.paused = NO;
  } else {
    [_root resumeKeyboardFrames];
  }
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  // Fabric can restore a full-height scroll frame after a content update.
  [self resumeKeyboardFrames];
}

- (void)setBottomInset:(CGFloat)value { _bottomInset = value; [self resumeKeyboardFrames]; }
- (void)setDockFraction:(CGFloat)value { _dockFraction = value; [self resumeKeyboardFrames]; }
- (void)setChatBody:(BOOL)value { _chatBody = value; [self resumeKeyboardFrames]; }

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  [self connect];
}

- (void)didMoveToSuperview
{
  [super didMoveToSuperview];
  [self connect];
}

- (void)connect
{
  PromliveKeyboardView *oldRoot = _root;
  if (oldRoot) [oldRoot->_participants removeObject:self];
  _root = nil;
  if (!self.window) {
    [_displayLink invalidate];
    _displayLink = nil;
    _messages = nil;
    _previousViewportHeight = 0;
    return;
  }
  if (_keyboardRoot) {
    if (!_displayLink) {
      ChatKeyboardFrameTarget *target = [ChatKeyboardFrameTarget new];
      target.owner = self;
      _displayLink = [CADisplayLink displayLinkWithTarget:target selector:@selector(tick:)];
      [_displayLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
    }
  } else {
    for (UIView *parent = self.superview; parent; parent = parent.superview) {
      if ([parent isKindOfClass:PromliveKeyboardView.class] && ((PromliveKeyboardView *)parent).keyboardRoot) {
        PromliveKeyboardView *root = (PromliveKeyboardView *)parent;
        _root = root;
        [root->_participants addObject:self];
        [root resumeKeyboardFrames];
        break;
      }
    }
  }
}

- (void)dealloc
{
  [_displayLink invalidate];
  [NSNotificationCenter.defaultCenter removeObserver:self];
}

- (void)keyboardFrame
{
  if (!self.window || !_keyboardRoot || CGRectIsEmpty(self.bounds)) return;
  CALayer *displayed = _keyboardProbe.layer.presentationLayer ?: _keyboardProbe.layer;
  CGFloat covered = MAX(0, CGRectGetHeight(self.bounds) - CGRectGetMinY(displayed.frame));
  // All participants are updated together, before the same display commit.
  [UIView performWithoutAnimation:^{
    for (PromliveKeyboardView *view in self->_participants) [view applyCoveredHeight:covered];
  }];
  _settledFrames = fabs(_lastCoveredHeight - covered) < 0.1 ? _settledFrames + 1 : 0;
  _lastCoveredHeight = covered;
  if (_settledFrames >= 3 && CACurrentMediaTime() >= _trackUntil && _keyboardProbe.layer.animationKeys.count == 0) {
    _displayLink.paused = YES;
  }
}

- (UIScrollView *)findMessages:(UIView *)view
{
  if ([view isKindOfClass:UIScrollView.class]) return (UIScrollView *)view;
  for (UIView *child in view.subviews) {
    UIScrollView *found = [self findMessages:child];
    if (found) return found;
  }
  return nil;
}

- (void)applyCoveredHeight:(CGFloat)covered
{
  CGFloat offset = MAX(0, covered - _bottomInset);
  CGFloat dockOffset = -offset * _dockFraction;
  // Ignore late React transform writes. The mirrored prop is only for Fabric's
  // measurement/Pressability coordinates; UIKit owns the visible motion.
  // Fabric wraps legacy views in its own component view. Move that wrapper,
  // which is also the node whose transform React mirrors for hit testing.
  // Moving the paper view as well would apply the keyboard offset twice.
  UIView *motionView = [NSStringFromClass(self.superview.class) isEqualToString:@"RCTLegacyViewManagerInteropComponentView"]
    ? self.superview : self;
  CGAffineTransform transform = CGAffineTransformMakeTranslation(0, dockOffset);
  if (!CGAffineTransformEqualToTransform(motionView.transform, transform)) {
    if (motionView == self) [super setTransform:transform];
    else motionView.transform = transform;
  }
  if (_trackDockOffset && fabs(_lastDockOffset - dockOffset) > 0.1) {
    _lastDockOffset = dockOffset;
    if (_onKeyboardDockFrame) _onKeyboardDockFrame(@{@"translationY": @(dockOffset)});
  }
  if (!_chatBody) return;
  if (!_messages) {
    _messages = [self findMessages:self];
    _previousViewportHeight = CGRectGetHeight(_messages.bounds);
  }
  UIScrollView *scroll = _messages;
  if (!scroll || CGRectIsEmpty(self.bounds)) return;
  CGFloat height = MAX(0, CGRectGetHeight(self.bounds) - offset);
  if (fabs(CGRectGetHeight(scroll.bounds) - height) < 0.1 && fabs(_previousViewportHeight - height) < 0.1) return;
  CGFloat oldMax = MAX(0, scroll.contentSize.height - _previousViewportHeight);
  CGFloat newMax = MAX(0, scroll.contentSize.height - height);
  CGPoint position = scroll.contentOffset;
  if (!scroll.dragging && oldMax - position.y <= 80) position.y += newMax - oldMax;
  position.y = MIN(newMax, MAX(0, position.y));
  _previousViewportHeight = height;
  CGRect frame = scroll.frame;
  frame.size.height = height;
  scroll.frame = frame;
  [scroll setContentOffset:position animated:NO];
}

- (void)setTransform:(CGAffineTransform)transform { /* Native keyboard frames own this property. */ }
@end

@interface PromliveKeyboardViewManager : RCTViewManager
@end

@implementation PromliveKeyboardViewManager
RCT_EXPORT_MODULE(PromliveKeyboardView)
- (UIView *)view { return [PromliveKeyboardView new]; }
RCT_EXPORT_VIEW_PROPERTY(keyboardRoot, BOOL)
RCT_EXPORT_VIEW_PROPERTY(chatBody, BOOL)
RCT_EXPORT_VIEW_PROPERTY(trackDockOffset, BOOL)
RCT_EXPORT_VIEW_PROPERTY(dockFraction, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(bottomInset, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(onKeyboardDockFrame, RCTDirectEventBlock)
RCT_CUSTOM_VIEW_PROPERTY(transform, CATransform3D, PromliveKeyboardView) {}
@end
