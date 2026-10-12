Pod::Spec.new do |s|
  s.name           = 'CloudBackup'
  s.version        = '1.0.0'
  s.summary        = 'Keeps a small value in iCloud key-value storage'
  s.author         = 'Espadna'
  s.homepage       = 'https://espadna.com/mench-app/'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
end
