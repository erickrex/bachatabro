//
//  ExecuTorchModule.mm
//  Bachata Bro
//
//  React Native bridge for PyTorch ExecuTorch
//

#import "ExecuTorchModule.h"
#import <React/RCTLog.h>
#import <React/RCTUtils.h>

// ExecuTorch C++ headers
// Note: These will be available after adding ExecuTorch framework
// #import <executorch/extension/module/module.h>
// #import <executorch/extension/tensor/tensor.h>

#import <UIKit/UIKit.h>
#import <CoreML/CoreML.h>
#import <Accelerate/Accelerate.h>

@implementation ExecuTorchModule {
    // Module instance (will be initialized when ExecuTorch is added)
    // std::unique_ptr<torch::executor::Module> _module;
    
    BOOL _modelLoaded;
    NSString *_currentDelegate;
    NSMutableArray<NSNumber *> *_inferenceTimes;
    NSInteger _totalInferences;
}

RCT_EXPORT_MODULE();

- (instancetype)init {
    self = [super init];
    if (self) {
        _modelLoaded = NO;
        _currentDelegate = @"none";
        _inferenceTimes = [NSMutableArray array];
        _totalInferences = 0;
    }
    return self;
}

#pragma mark - Public Methods

RCT_EXPORT_METHOD(loadModel:(NSString *)modelPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        // Validate model path
        if (![[NSFileManager defaultManager] fileExistsAtPath:modelPath]) {
            reject(@"MODEL_NOT_FOUND", @"Model file not found at path", nil);
            return;
        }
        
        RCTLogInfo(@"Loading ExecuTorch model from: %@", modelPath);
        
        // TODO: Load ExecuTorch model
        // This will be implemented once ExecuTorch framework is added
        // _module = std::make_unique<torch::executor::Module>([modelPath UTF8String]);
        
        // For now, simulate successful load
        _modelLoaded = YES;
        
        RCTLogInfo(@"Model loaded successfully");
        resolve(@YES);
        
    } @catch (NSException *exception) {
        _modelLoaded = NO;
        reject(@"LOAD_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(setDelegate:(NSString *)delegate
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!_modelLoaded) {
        reject(@"MODEL_NOT_LOADED", @"Model must be loaded before setting delegate", nil);
        return;
    }
    
    @try {
        RCTLogInfo(@"Setting delegate: %@", delegate);
        
        // Validate delegate
        if (![delegate isEqualToString:@"coreml"] &&
            ![delegate isEqualToString:@"none"]) {
            reject(@"INVALID_DELEGATE", @"Invalid delegate for iOS. Use 'coreml' or 'none'", nil);
            return;
        }
        
        // TODO: Configure ExecuTorch delegate
        // This will be implemented once ExecuTorch framework is added
        
        _currentDelegate = delegate;
        
        RCTLogInfo(@"Delegate set to: %@", delegate);
        resolve(@YES);
        
    } @catch (NSException *exception) {
        reject(@"DELEGATE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(runInference:(NSDictionary *)imageData
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!_modelLoaded) {
        reject(@"MODEL_NOT_LOADED", @"Model must be loaded before running inference", nil);
        return;
    }
    
    @try {
        NSTimeInterval startTime = [[NSDate date] timeIntervalSince1970] * 1000;
        
        // Extract image data
        NSNumber *width = imageData[@"width"];
        NSNumber *height = imageData[@"height"];
        NSString *data = imageData[@"data"];
        
        if (!width || !height || !data) {
            reject(@"INVALID_INPUT", @"Missing required image data fields", nil);
            return;
        }
        
        // Preprocess image
        UIImage *image = [self decodeImage:data];
        if (!image) {
            reject(@"IMAGE_DECODE_ERROR", @"Failed to decode image", nil);
            return;
        }
        
        // Resize to model input size (192x192)
        UIImage *resizedImage = [self resizeImage:image toSize:CGSizeMake(192, 192)];
        
        // Convert to tensor format
        NSArray<NSNumber *> *tensorData = [self imageToTensor:resizedImage];
        
        // TODO: Run ExecuTorch inference
        // This will be implemented once ExecuTorch framework is added
        // auto outputs = _module->forward({tensorData});
        
        // For now, return mock keypoints
        NSArray *keypoints = [self generateMockKeypoints];
        
        NSTimeInterval endTime = [[NSDate date] timeIntervalSince1970] * 1000;
        double inferenceTime = endTime - startTime;
        
        // Track metrics
        [_inferenceTimes addObject:@(inferenceTime)];
        _totalInferences++;
        
        // Keep only last 100 inference times
        if (_inferenceTimes.count > 100) {
            [_inferenceTimes removeObjectAtIndex:0];
        }
        
        NSDictionary *result = @{
            @"keypoints": keypoints,
            @"inferenceTime": @(inferenceTime)
        };
        
        resolve(result);
        
    } @catch (NSException *exception) {
        reject(@"INFERENCE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getPerformanceMetrics:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if (_inferenceTimes.count == 0) {
            resolve(@{
                @"averageFPS": @0,
                @"averageLatency": @0,
                @"p50Latency": @0,
                @"p95Latency": @0,
                @"p99Latency": @0,
                @"totalInferences": @0
            });
            return;
        }
        
        // Calculate average latency
        double sum = 0;
        for (NSNumber *time in _inferenceTimes) {
            sum += [time doubleValue];
        }
        double avgLatency = sum / _inferenceTimes.count;
        double avgFPS = 1000.0 / avgLatency;
        
        // Calculate percentiles
        NSArray *sortedTimes = [_inferenceTimes sortedArrayUsingSelector:@selector(compare:)];
        NSInteger p50Index = (NSInteger)(sortedTimes.count * 0.5);
        NSInteger p95Index = (NSInteger)(sortedTimes.count * 0.95);
        NSInteger p99Index = (NSInteger)(sortedTimes.count * 0.99);
        
        NSDictionary *metrics = @{
            @"averageFPS": @(avgFPS),
            @"averageLatency": @(avgLatency),
            @"p50Latency": sortedTimes[p50Index],
            @"p95Latency": sortedTimes[p95Index],
            @"p99Latency": sortedTimes[p99Index],
            @"totalInferences": @(_totalInferences)
        };
        
        resolve(metrics);
        
    } @catch (NSException *exception) {
        reject(@"METRICS_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(resetMetrics:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    [_inferenceTimes removeAllObjects];
    _totalInferences = 0;
    resolve(@YES);
}

RCT_EXPORT_METHOD(unloadModel:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        // TODO: Unload ExecuTorch model
        // _module.reset();
        
        _modelLoaded = NO;
        _currentDelegate = @"none";
        [_inferenceTimes removeAllObjects];
        _totalInferences = 0;
        
        RCTLogInfo(@"Model unloaded");
        resolve(@YES);
        
    } @catch (NSException *exception) {
        reject(@"UNLOAD_ERROR", exception.reason, nil);
    }
}

#pragma mark - Helper Methods

- (UIImage *)decodeImage:(NSString *)data {
    // Handle base64 encoded image
    if ([data hasPrefix:@"data:image"]) {
        NSRange range = [data rangeOfString:@"base64,"];
        if (range.location != NSNotFound) {
            NSString *base64String = [data substringFromIndex:range.location + range.length];
            NSData *imageData = [[NSData alloc] initWithBase64EncodedString:base64String options:0];
            return [UIImage imageWithData:imageData];
        }
    }
    
    // Handle file URI
    if ([data hasPrefix:@"file://"]) {
        NSString *path = [data substringFromIndex:7];
        return [UIImage imageWithContentsOfFile:path];
    }
    
    // Handle asset URI
    if ([data hasPrefix:@"asset://"]) {
        NSString *assetName = [data substringFromIndex:8];
        return [UIImage imageNamed:assetName];
    }
    
    return nil;
}

- (UIImage *)resizeImage:(UIImage *)image toSize:(CGSize)size {
    UIGraphicsBeginImageContextWithOptions(size, NO, 1.0);
    [image drawInRect:CGRectMake(0, 0, size.width, size.height)];
    UIImage *resizedImage = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();
    return resizedImage;
}

- (NSArray<NSNumber *> *)imageToTensor:(UIImage *)image {
    // Convert UIImage to RGB tensor (1, 3, 192, 192)
    CGImageRef cgImage = image.CGImage;
    size_t width = CGImageGetWidth(cgImage);
    size_t height = CGImageGetHeight(cgImage);
    
    // Allocate buffer for pixel data
    NSMutableData *pixelData = [NSMutableData dataWithLength:width * height * 4];
    unsigned char *pixels = (unsigned char *)[pixelData mutableBytes];
    
    // Create bitmap context
    CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
    CGContextRef context = CGBitmapContextCreate(
        pixels,
        width,
        height,
        8,
        width * 4,
        colorSpace,
        kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big
    );
    
    CGContextDrawImage(context, CGRectMake(0, 0, width, height), cgImage);
    CGContextRelease(context);
    CGColorSpaceRelease(colorSpace);
    
    // Convert to normalized float tensor [0, 1]
    NSMutableArray *tensorData = [NSMutableArray arrayWithCapacity:width * height * 3];
    
    for (size_t i = 0; i < width * height; i++) {
        size_t pixelIndex = i * 4;
        float r = pixels[pixelIndex] / 255.0f;
        float g = pixels[pixelIndex + 1] / 255.0f;
        float b = pixels[pixelIndex + 2] / 255.0f;
        
        [tensorData addObject:@(r)];
        [tensorData addObject:@(g)];
        [tensorData addObject:@(b)];
    }
    
    return tensorData;
}

- (NSArray *)generateMockKeypoints {
    // Generate 17 mock keypoints for testing
    NSMutableArray *keypoints = [NSMutableArray arrayWithCapacity:17];
    
    for (int i = 0; i < 17; i++) {
        [keypoints addObject:@{
            @"x": @(0.5 + (arc4random_uniform(100) - 50) / 200.0),
            @"y": @(0.5 + (arc4random_uniform(100) - 50) / 200.0),
            @"confidence": @(0.8 + (arc4random_uniform(20)) / 100.0)
        }];
    }
    
    return keypoints;
}

// Required for RCTBridgeModule
+ (BOOL)requiresMainQueueSetup {
    return NO;
}

@end
