Pod::Spec.new do |s|
  s.name           = 'RewardedAds'
  s.version        = '1.0.0'
  s.summary        = 'Rewarded video ads for shop coins (Appodeal)'
  s.author         = 'Espadna'
  s.homepage       = 'https://espadna.com/mench-app/'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.0'
  s.dependency 'ExpoModulesCore'
  # Appodeal and the networks it mediates (no Google AdMob). The adapters
  # come from Appodeal's spec repo; plugins/withRewardedAds adds it to the
  # Podfile. Versions follow react-native-appodeal 4.3.0's list.
  s.dependency 'Appodeal', '4.3.0'
  s.dependency 'AppodealIABAdapter', '3.5.2.0'
  s.dependency 'AppodealBidMachineAdapter', '3.7.1.0'
  s.dependency 'AppodealAppLovinAdapter', '13.6.4.0'
  s.dependency 'AppodealUnityAdapter', '4.17.0.0'
  s.dependency 'AppodealMintegralAdapter', '8.1.3.0'
  s.source_files = '**/*.{h,m,swift}'
end
