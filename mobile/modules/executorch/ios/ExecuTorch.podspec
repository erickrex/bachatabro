require 'json'

package = JSON.parse(File.read(File.join(__dir__, '../package.json')))

Pod::Spec.new do |s|
  s.name         = "ExecuTorch"
  s.version      = package['version']
  s.summary      = package['description']
  s.homepage     = package['homepage']
  s.license      = package['license']
  s.authors      = package['author']

  s.platforms    = { :ios => "13.0" }
  s.source       = { :git => "https://github.com/bachatrainer/bachatrainer.git", :tag => "#{s.version}" }

  s.source_files = "*.{h,mm}"
  s.requires_arc = true

  # React Native dependencies
  s.dependency "React-Core"

  # ExecuTorch framework
  # Note: ExecuTorch.framework should be placed in ios/Frameworks/
  s.vendored_frameworks = "Frameworks/ExecuTorch.framework"
  
  # System frameworks
  s.frameworks = "CoreML", "Accelerate", "UIKit"
  
  # C++ settings
  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'CLANG_CXX_LIBRARY' => 'libc++',
    'FRAMEWORK_SEARCH_PATHS' => '$(inherited) $(PODS_ROOT)/../Frameworks'
  }
end
