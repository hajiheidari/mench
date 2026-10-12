Pod::Spec.new do |s|
  s.name           = 'GameCenter'
  s.version        = '1.0.0'
  s.summary        = 'Game Center sign-in, leaderboard scores and achievements'
  s.author         = 'Espadna'
  s.homepage       = 'https://espadna.com/mench-app/'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.0'
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'GameKit'
  s.source_files = '**/*.{h,m,swift}'
end
