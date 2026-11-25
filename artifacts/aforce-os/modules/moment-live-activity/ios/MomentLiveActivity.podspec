Pod::Spec.new do |s|
  s.name = 'MomentLiveActivity'
  s.version = '1.0.0'
  s.summary = 'Starts and ends the AFORCE Moment Live Activity'
  s.description = 'One Live Activity while a Moment is locked in. Carries no Moment title, place, time or score.'
  s.license = { :type => 'UNLICENSED' }
  s.author = 'AForce'
  s.homepage = 'https://www.joinaforce.com'
  s.platforms = { :ios => '15.1' }
  s.source = { :git => 'https://github.com/brandburrell2026/AForce-Command.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = 'ActivityKit'
  s.source_files = 'MomentLiveActivityModule.swift'
end
