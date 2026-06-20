Pod::Spec.new do |s|
  s.name           = 'LiveActivityExpo'
  s.version        = '1.0.0'
  s.summary        = 'Live Activity integration for Clear HiiT'
  s.homepage       = 'https://github.com/georgefromgib/hiit-timer'
  s.license        = { :type => 'MIT' }
  s.author         = { 'george' => 'george.gaskin.gg@gmail.com' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :path => '.' }
  s.source_files   = '*.swift'
  s.dependency 'ExpoModulesCore'
end
