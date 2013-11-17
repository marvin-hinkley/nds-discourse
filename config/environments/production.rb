Discourse::Application.configure do
  # Settings specified here will take precedence over those in config/application.rb

  # Code is not reloaded between requests
  config.cache_classes = true

  # Full error reports are disabled and caching is turned on
  config.consider_all_requests_local       = false
  config.action_controller.perform_caching = true

  # Disable Rails's static asset server (Apache or nginx will already do this)
  config.serve_static_assets = false

  # Compress JavaScripts and CSS
  config.assets.compress = true

  # stuff should be pre-compiled
  config.assets.compile = false

  # Generate digests for assets URLs
  config.assets.digest = true

  # Specifies the header that your server uses for sending files
  config.action_dispatch.x_sendfile_header = 'X-Accel-Redirect' # for nginx

  # Enable locale fallbacks for I18n (makes lookups for any locale fall back to
  # the I18n.default_locale when a translation can not be found)
  config.i18n.fallbacks = true
  # Send deprecation notices to registered listeners
  config.active_support.deprecation = :notify

  # this will cause all handlebars templates to be pre-compiles, making your page faster
  config.handlebars.precompile = true

  # allows admins to use mini profiler
  config.enable_mini_profiler = true
  config.assets.initialize_on_precompile = false
  # allows Cross-origin resource sharing (CORS) for API access in JavaScript (default to false for security).
  # See the initializer and https://github.com/cyu/rack-cors for configuration documentation.
  #
  # config.enable_rack_cors = false
  # config.rack_cors_origins = ['*']
  # config.rack_cors_resource = ['*', { :headers => :any, :methods => [:get, :post, :options] }]

  # Discourse strongly recommend you use a CDN.
  # For origin pull cdns all you need to do is register an account and configure
  # config.action_controller.asset_host = "http://YOUR_CDN_HERE"

  # a comma delimited list of emails your devs have
  # developers have god like rights and may impersonate anyone in the system
  # normal admins may only impersonate other moderators (not admins)
  if emails = ENV["DEVELOPER_EMAILS"]
    config.developer_emails = emails.split(",")
  end
  config.action_mailer.delivery_method = :smtp
  config.action_mailer.smtp_settings = {
       :port =>           '587',
       :address =>        'smtp.mandrillapp.com',
       :user_name =>      ENV['MANDRILL_USERNAME'],
       :password =>       ENV['MANDRILL_APIKEY'],
       :domain =>         'heroku.com',
       :authentication => :plain
  }
end
