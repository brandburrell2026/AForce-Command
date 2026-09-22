Pod::Spec.new do |s|
  s.name = 'SkinIAImageFeatures'
  s.version = '1.0.0'
  s.summary = 'Ephemeral on-device SkinIA image feature extraction'
  s.description = 'Extracts derived visual metrics from an in-memory Expo camera image reference.'
  s.license = { :type => 'UNLICENSED' }
  s.author = 'AForce'
  s.homepage = 'https://www.joinaforce.com'
  s.platforms = { :ios => '15.1' }
  s.source = { :git => 'https://github.com/brandburrell2026/AForce-Command.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision'
  s.source_files = '**/*.{h,m,mm,swift}'
end
