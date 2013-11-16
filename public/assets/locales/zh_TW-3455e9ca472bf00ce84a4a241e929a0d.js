// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/indexOf
if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function(searchElement /*, fromIndex */) {
    "use strict";

    if (this === void 0 || this === null) {
      throw new TypeError();
    }

    var t = Object(this);
    var len = t.length >>> 0;

    if (len === 0) {
      return -1;
    }

    var n = 0;
    if (arguments.length > 0) {
      n = Number(arguments[1]);
      if (n !== n) { // shortcut for verifying if it's NaN
        n = 0;
      } else if (n !== 0 && n !== (Infinity) && n !== -(Infinity)) {
        n = (n > 0 || -1) * Math.floor(Math.abs(n));
      }
    }

    if (n >= len) {
      return -1;
    }

    var k = n >= 0
          ? n
          : Math.max(len - Math.abs(n), 0);

    for (; k < len; k++) {
      if (k in t && t[k] === searchElement) {
        return k;
      }
    }

    return -1;
  };
}

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default handling of translation fallbacks to false
I18n.fallbacks = false;

// Set default separator
I18n.defaultSeparator = ".";

// Set current locale to null
I18n.locale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.fallbackRules = {};

I18n.pluralizationRules = {
  en: function (n) {
    return n == 0 ? ["zero", "none", "other"] : n == 1 ? "one" : "other";
  }
};

I18n.getFallbacks = function(locale) {
  if (locale === I18n.defaultLocale) {
    return [];
  } else if (!I18n.fallbackRules[locale]) {
    var rules = []
      , components = locale.split("-");

    for (var l = 1; l < components.length; l++) {
      rules.push(components.slice(0, l).join("-"));
    }

    rules.push(I18n.defaultLocale);

    I18n.fallbackRules[locale] = rules;
  }

  return I18n.fallbackRules[locale];
}

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  var options = options || {}
    , lookupInitialScope = scope
    , translations = this.prepareOptions(I18n.translations)
    , locale = options.locale || I18n.currentLocale()
    , messages = translations[locale] || {}
    , options = this.prepareOptions(options)
    , currentScope
  ;

  if (typeof(scope) == "object") {
    scope = scope.join(this.defaultSeparator);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.defaultSeparator + scope;
  }

  scope = scope.split(this.defaultSeparator);

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (!messages) {
    if (I18n.fallbacks) {
      var fallbacks = this.getFallbacks(locale);
      for (var fallback = 0; fallback < fallbacks.length; fallbacks++) {
        messages = I18n.lookup(lookupInitialScope, this.prepareOptions({locale: fallbacks[fallback]}, options));
        if (messages) {
          break;
        }
      }
    }

    if (!messages && this.isValidNode(options, "defaultValue")) {
        messages = options.defaultValue;
    }
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {}
    , opts
    , count = arguments.length
  ;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);
  var matches = message.match(this.PLACEHOLDER)
    , placeholder
    , value
    , name
  ;

  if (!matches) {
    return message;
  }

  for (var i = 0; placeholder = matches[i]; i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    value = options[name];

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    var regex = new RegExp(placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}"));
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  var translation = this.lookup(scope, options);

  try {
    if (typeof(translation) == "object") {
      if (typeof(options.count) == "number") {
        return this.pluralize(options.count, scope, options);
      } else {
        return translation;
      }
    } else {
      return this.interpolate(translation, options);
    }
  } catch (error) {
    return this.missingTranslation(scope);
  }
};

I18n.localize = function(scope, value) {
  switch (scope) {
    case "currency":
      return this.toCurrency(value);
    case "number":
      scope = this.lookup("number.format");
      return this.toNumber(value, scope);
    case "percentage":
      return this.toPercentage(value);
    default:
      if (scope.match(/^(date|time)/)) {
        return this.toTime(scope, value);
      } else {
        return value.toString();
      }
  }
};

I18n.parseDate = function(date) {
  var matches, convertedDate;

  // we have a date, so just return it.
  if (typeof(date) == "object") {
    return date;
  };

  // it matches the following formats:
  //   yyyy-mm-dd
  //   yyyy-mm-dd[ T]hh:mm::ss
  //   yyyy-mm-dd[ T]hh:mm::ss
  //   yyyy-mm-dd[ T]hh:mm::ssZ
  //   yyyy-mm-dd[ T]hh:mm::ss+0000
  //
  matches = date.toString().match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?(Z|\+0000)?/);

  if (matches) {
    for (var i = 1; i <= 6; i++) {
      matches[i] = parseInt(matches[i], 10) || 0;
    }

    // month starts on 0
    matches[2] -= 1;

    if (matches[7]) {
      convertedDate = new Date(Date.UTC(matches[1], matches[2], matches[3], matches[4], matches[5], matches[6]));
    } else {
      convertedDate = new Date(matches[1], matches[2], matches[3], matches[4], matches[5], matches[6]);
    }
  } else if (typeof(date) == "number") {
    // UNIX timestamp
    convertedDate = new Date();
    convertedDate.setTime(date);
  } else if (date.match(/\d+ \d+:\d+:\d+ [+-]\d+ \d+/)) {
    // a valid javascript format with timezone info
    convertedDate = new Date();
    convertedDate.setTime(Date.parse(date))
  } else {
    // an arbitrary javascript string
    convertedDate = new Date();
    convertedDate.setTime(Date.parse(date));
  }

  return convertedDate;
};

I18n.toTime = function(scope, d) {
  var date = this.parseDate(d)
    , format = this.lookup(scope)
  ;

  if (date.toString().match(/invalid/i)) {
    return date.toString();
  }

  if (!format) {
    return date.toString();
  }

  return this.strftime(date, format);
};

I18n.strftime = function(date, format) {
  var options = this.lookup("date");

  if (!options) {
    return date.toString();
  }

  options.meridian = options.meridian || ["AM", "PM"];

  var weekDay = date.getDay()
    , day = date.getDate()
    , year = date.getFullYear()
    , month = date.getMonth() + 1
    , hour = date.getHours()
    , hour12 = hour
    , meridian = hour > 11 ? 1 : 0
    , secs = date.getSeconds()
    , mins = date.getMinutes()
    , offset = date.getTimezoneOffset()
    , absOffsetHours = Math.floor(Math.abs(offset / 60))
    , absOffsetMinutes = Math.abs(offset) - (absOffsetHours * 60)
    , timezoneoffset = (offset > 0 ? "-" : "+") + (absOffsetHours.toString().length < 2 ? "0" + absOffsetHours : absOffsetHours) + (absOffsetMinutes.toString().length < 2 ? "0" + absOffsetMinutes : absOffsetMinutes)
  ;

  if (hour12 > 12) {
    hour12 = hour12 - 12;
  } else if (hour12 === 0) {
    hour12 = 12;
  }

  var padding = function(n) {
    var s = "0" + n.toString();
    return s.substr(s.length - 2);
  };

  var f = format;
  f = f.replace("%a", options.abbr_day_names[weekDay]);
  f = f.replace("%A", options.day_names[weekDay]);
  f = f.replace("%b", options.abbr_month_names[month]);
  f = f.replace("%B", options.month_names[month]);
  f = f.replace("%d", padding(day));
  f = f.replace("%e", day);
  f = f.replace("%-d", day);
  f = f.replace("%H", padding(hour));
  f = f.replace("%-H", hour);
  f = f.replace("%I", padding(hour12));
  f = f.replace("%-I", hour12);
  f = f.replace("%m", padding(month));
  f = f.replace("%-m", month);
  f = f.replace("%M", padding(mins));
  f = f.replace("%-M", mins);
  f = f.replace("%p", options.meridian[meridian]);
  f = f.replace("%S", padding(secs));
  f = f.replace("%-S", secs);
  f = f.replace("%w", weekDay);
  f = f.replace("%y", padding(year));
  f = f.replace("%-y", padding(year).replace(/^0+/, ""));
  f = f.replace("%Y", year);
  f = f.replace("%z", timezoneoffset);

  return f;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.format"),
    {precision: 3, separator: ".", delimiter: ",", strip_insignificant_zeros: false}
  );

  var negative = number < 0
    , string = Math.abs(number).toFixed(options.precision).toString()
    , parts = string.split(".")
    , precision
    , buffer = []
    , formattedNumber
  ;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length -3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
        separator: new RegExp(options.separator.replace(/\./, "\\.") + "$")
      , zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "")
    ;
  }

  return formattedNumber;
};

I18n.toCurrency = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.currency.format"),
    this.lookup("number.format"),
    {unit: "$", precision: 2, format: "%u%n", delimiter: ",", separator: "."}
  );

  number = this.toNumber(number, options);
  number = options.format
    .replace("%u", options.unit)
    .replace("%n", number)
  ;

  return number;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024
    , size = number
    , iterations = 0
    , unit
    , precision
  ;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", {count: size});
    precision = 0;
  } else {
    unit = this.t("number.human.storage_units.units." + [null, "kb", "mb", "gb", "tb"][iterations]);
    precision = (size - Math.floor(size) === 0) ? 0 : 1;
  }

  options = this.prepareOptions(
    options,
    {precision: precision, format: "%n%u", delimiter: ""}
  );

  number = this.toNumber(size, options);
  number = options.format
    .replace("%u", unit)
    .replace("%n", number)
  ;

  return number;
};

I18n.toPercentage = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.percentage.format"),
    this.lookup("number.format"),
    {precision: 3, separator: ".", delimiter: ""}
  );

  number = this.toNumber(number, options);
  return number + "%";
};

I18n.pluralizer = function(locale) {
  var pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(count, scope, options) {
  var translation;

  try { translation = this.lookup(scope, options); } catch (error) {}
  if (!translation) { return this.missingTranslation(scope); }

  options = this.prepareOptions(options);
  options.count = count.toString();

  var pluralizer = this.pluralizer(this.currentLocale());
  var key = pluralizer(Math.abs(count));
  var keys = ((typeof key == "object") && (key instanceof Array)) ? key : [key];

  var message = this.findAndTranslateValidNode(keys, translation);
  if (message == null) message = this.missingTranslation(scope, keys[0]);

  return this.interpolate(message, options);
};

I18n.missingTranslation = function(scope, key) {
  var message = '[' + this.currentLocale() + "." + scope;
  if (key) { message += "." + key; }
  return message + ']';
};

I18n.currentLocale = function() {
  return (I18n.locale || I18n.defaultLocale);
};

// shortcuts
I18n.t = I18n.translate;
I18n.l = I18n.localize;
I18n.p = I18n.pluralize;


MessageFormat = {locale: {}};
MessageFormat.locale.zh_TW = function ( n ) {
  return "other";
};

I18n.messageFormat = (function(formats){
      var f = formats;
      return function(key, options) {
        var fn = f[key];
        if(fn){
          try {
            return fn(options);
          } catch(err) {
            return err.message;
          }
        } else {
          return 'Missing Key: ' + key
        }
        return f[key](options);
      };
    })({});I18n.translations = {"zh_TW":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"tiny":{"half_a_minute":"\u003C 1分鐘","less_than_x_seconds":{"one":"\u003C 1秒","other":"\u003C %{count}秒"},"x_seconds":{"one":"1秒","other":"%{count}秒"},"less_than_x_minutes":{"one":"\u003C 1分鐘","other":"\u003C %{count}分鐘"},"x_minutes":{"one":"1分鐘","other":"%{count}分鐘"},"about_x_hours":{"one":"1小時","other":"%{count}小時"},"x_days":{"one":"1日","other":"%{count}日"},"about_x_years":{"one":"1年","other":"%{count}年"},"over_x_years":{"one":"\u003E 1年","other":"\u003E %{count}年"},"almost_x_years":{"one":"1年","other":"%{count}年"}},"medium":{"x_minutes":{"one":"1 分鐘","other":"%{count} 分鐘"},"x_hours":{"one":"1 小時","other":"%{count} 小時"},"x_days":{"one":"1 日","other":"%{count} 日"}},"medium_with_ago":{"x_minutes":{"one":"1 分鐘前","other":"%{count} 分鐘前"},"x_hours":{"one":"1 小時前","other":"%{count} 小時前"},"x_days":{"one":"1 日前","other":"%{count} 日前"}}},"share":{"topic":"分享一個到本主題的鏈接","post":"分享一個到本帖的鏈接","close":"關閉","twitter":"分享這個鏈接到 Twitter","facebook":"分享這個鏈接到 Facebook","google+":"分享這個鏈接到 Google+","email":"用電子郵件發送這個鏈接"},"edit":"編輯本主題的標題和分類","not_implemented":"非常抱歉，此功能暫時尚未實現！","no_value":"否","yes_value":"是","of_value":"之于","generic_error":"抱歉，發生了一個錯誤。","generic_error_with_reason":"抱歉，發生了一個錯誤: %{error}","log_in":"登錄","age":"壽命","last_post":"最後一帖","admin_title":"管理員","flags_title":"投訴","show_more":"顯示更多","links":"鏈接","faq":"常見問答（FAQ）","privacy_policy":"私隱政策","you":"你","or":"或","now":"剛剛","read_more":"閱讀更多","more":"更多","less":"更少","in_n_seconds":{"one":"一秒內","other":"{{count}}秒內"},"in_n_minutes":{"one":"一分鍾內","other":"{{count}}分鍾內"},"in_n_hours":{"one":"一小時內","other":"{{count}}小時內"},"in_n_days":{"one":"一天內","other":"{{count}}天內"},"suggested_topics":{"title":"推薦主題"},"bookmarks":{"not_logged_in":"抱歉，要給帖子加書簽，你必須先登錄。","created":"你給此帖的書簽已加上。","not_bookmarked":"你已經閱讀過此帖，點此給它加上書簽。","last_read":"這是你閱讀過的最後一帖。"},"new_topics_inserted":"{{count}} 個新主題。","show_new_topics":"點此顯示。","preview":"預覽","cancel":"取消","save":"保存修改","saving":"保存中……","saved":"已保存！","choose_topic":{"none_found":"沒有找到主題","title":{"search":"通過名稱、url或者id，搜索主題：","placeholder":"在此輸入主題標題"}},"user_action":{"user_posted_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E 發起 \u003Ca href='{{topicUrl}}'\u003E本主題\u003C/a\u003E","you_posted_topic":"\u003Ca href='{{userUrl}}'\u003E你\u003C/a\u003E 發起 \u003Ca href='{{topicUrl}}'\u003E本主題\u003C/a\u003E","user_replied_to_post":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E 回複 \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","you_replied_to_post":"\u003Ca href='{{userUrl}}'\u003E你\u003C/a\u003E 回複 \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","user_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E 回複 \u003Ca href='{{topicUrl}}'\u003E本主題\u003C/a\u003E","you_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003E你\u003C/a\u003E 回複 \u003Ca href='{{topicUrl}}'\u003E本主題\u003C/a\u003E","user_mentioned_user":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E 提到 \u003Ca href='{{user2Url}}'\u003E{{another_user}}\u003C/a\u003E","user_mentioned_you":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E 提到 \u003Ca href='{{user2Url}}'\u003E你\u003C/a\u003E","you_mentioned_user":"\u003Ca href='{{user1Url}}'\u003E你\u003C/a\u003E 提到 \u003Ca href='{{user2Url}}'\u003E{{user}}\u003C/a\u003E","posted_by_user":"發起人 \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","posted_by_you":"發起人 \u003Ca href='{{userUrl}}'\u003E你\u003C/a\u003E","sent_by_user":"發送人 \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","sent_by_you":"發送人 \u003Ca href='{{userUrl}}'\u003E你\u003C/a\u003E"},"user_action_groups":{"1":"發出的讚","2":"收到的讚","3":"書簽","4":"主題","5":"回複","6":"回應","7":"提到","9":"引用","10":"喜愛","11":"編輯","12":"發送項目","13":"收件箱"},"user":{"said":"{{username}} 說:","profile":"介紹信息","title":"用戶","mute":"防打擾","edit":"修改參數","download_archive":"下載我的帖子的存檔","private_message":"私人信息","private_messages":"消息","activity_stream":"活動","preferences":"設置","bio":"關於我","invited_by":"邀請者爲","trust_level":"用戶級別","notifications":"通知","dynamic_favicon":"在圖標顯示消息通知","external_links_in_new_tab":"始終在新的標簽頁打開外部鏈接","enable_quoting":"在高亮選擇文字時啓用引用回複","change":"更改","moderator":"{{user}} 是版主","admin":"{{user}} 是管理員","change_password":{"action":"修改","success":"（電子郵件已發送）","in_progress":"（正在發送電子郵件）","error":"（錯誤）"},"change_about":{"title":"更改關於我"},"change_username":{"action":"修改","title":"修改用戶名","confirm":"修改你的用戶名可能會導致一些相關後果，你真的確定要這麽做麽？","taken":"抱歉此用戶名已經有人使用了。","error":"在修改你的用戶名時發生了錯誤。","invalid":"此用戶名不合法，用戶名只能包含字母和數字"},"change_email":{"action":"修改","title":"修改電子郵箱","taken":"抱歉此電子郵箱不可用。","error":"抱歉在修改你的電子郵箱時發生了錯誤，可能此郵箱已經被使用了？","success":"我們發送了一封確認信到此郵箱地址，請按照郵箱內指示完成確認。"},"email":{"title":"電子郵箱","instructions":"你的電子郵箱絕不會公開給他人。","ok":"不錯哦，我們會發送電子郵件讓你確認。","invalid":"請填寫正確的電子郵箱地址。","authenticated":"你的電子郵箱已經被 {{provider}} 確認有效。","frequency":"只有當你最近一段時間沒有訪問時，我們才會把你未讀過的內容發送到你的電子郵箱。"},"name":{"title":"名字","instructions":"你的名字，不要求獨一無二（可以與他人的名字重複）。用于在@name匹配你時參考，只在你的用戶頁面顯示。","too_short":"你設置的名字太短了。","ok":"你的名字符合要求。"},"username":{"title":"用戶名","instructions":"必須是獨一無二的，中間不能有空格。其他人可以使用 @{{username}} 來提及你。","short_instructions":"其他人可以用 @{{username}} 來提及你。","available":"你的用戶名可用。","global_match":"電子郵箱與注冊用戶名相匹配。","global_mismatch":"已被人注冊。試試 {{suggestion}} ？","not_available":"不可用。試試 {{suggestion}} ？","too_short":"你設置的用戶名太短了。","too_long":"你設置的用戶名太長了。","checking":"查看用戶名是否可用……","enter_email":"找到用戶名，請輸入對應電子郵箱。"},"password_confirmation":{"title":"請再次輸入密碼"},"last_posted":"最後一帖","last_emailed":"最後一次電郵","last_seen":"最後一次見到","created":"創建時間","log_out":"登出","website":"網站","email_settings":"電子郵箱","email_digests":{"title":"當我不訪問此站時，向我的郵箱發送最新摘要","daily":"每天","weekly":"每周","bi_weekly":"每兩周"},"email_direct":"當有人引用你、回複你或提及你 @username 時發送一封郵件給你","email_private_messages":"當有人給你發私信時發送一封郵件給你","other_settings":"其它","new_topic_duration":{"label":"認爲主題是新主題，當","not_viewed":"我還沒有浏覽它們","last_here":"它們是在我最近一次訪問這裏之後發表的","after_n_days":{"one":"它們是昨天發表的","other":"它們是之前 {{count}} 天發表的"},"after_n_weeks":{"one":"它們是上周發表的","other":"它們是之前 {{count}} 周發表的"}},"auto_track_topics":"自動追蹤我進入的主題","auto_track_options":{"never":"從不","always":"始終","after_n_seconds":{"one":"1 秒之後","other":"{{count}} 秒之後"},"after_n_minutes":{"one":"1 分鍾之後","other":"{{count}} 分鍾之後"}},"invited":{"title":"邀請","user":"邀請用戶","none":"{{username}} 尚未邀請任何用戶到本站。","redeemed":"確認邀請","redeemed_at":"確認時間","pending":"待定邀請","topics_entered":"已進入的主題","posts_read_count":"已閱的帖子","rescind":"刪除邀請","rescinded":"邀請已刪除","time_read":"閱讀時間","days_visited":"訪問天數","account_age_days":"帳號存在天數"},"password":{"title":"密碼","too_short":"你設置的密碼太短了。","ok":"你設置的密碼符合要求。"},"ip_address":{"title":"最後使用的IP地址"},"avatar":{"title":"頭像"},"filters":{"all":"全部"},"stream":{"posted_by":"發帖人","sent_by":"發送時間","private_message":"私人信息","the_topic":"本主題"}},"loading":"載入中……","close":"關閉","learn_more":"了解更多……","year":"年","year_desc":"365天以前發表的主題","month":"月","month_desc":"30天以前發表的主題","week":"周","week_desc":"7天以前發表的主題","first_post":"第一帖","mute":"防打擾","unmute":"解除防打擾","best_of":{"title":"優秀","enabled_description":"你現在正在浏覽本主題的“優秀”視圖。","description":"此主題中有 \u003Cb\u003E{{count}}\u003C/b\u003E 個帖子，是不是有點多哦！你願意切換到只顯示最多交互和回複的帖子視圖麽？","enable":"切換到“優秀”視圖","disable":"取消“優秀”"},"private_message_info":{"title":"私下交流","invite":"邀請其他人……"},"email":"電子郵箱","username":"用戶名","last_seen":"最後一次見到","created":"創建時間","trust_level":"用戶級別","create_account":{"title":"創建帳號","action":"現在就創建一個！","invite":"還沒有帳號嗎？","failed":"出問題了，有可能這個電子郵箱已經被注冊了。試試忘記密碼鏈接"},"forgot_password":{"title":"忘記密碼","action":"我忘記了我的密碼","invite":"輸入你的用戶名和電子郵箱地址，我們會發送密碼重置郵件給你。","reset":"重置密碼","complete":"你很快會收到一封電子郵件，告訴你如何重置密碼。"},"login":{"title":"登錄","username":"登錄","password":"密碼","email_placeholder":"電子郵箱地址或用戶名","error":"未知錯誤","reset_password":"重置密碼","logging_in":"登錄中……","or":"或","authenticating":"驗證中……","awaiting_confirmation":"你的帳號尚未激活，點擊忘記密碼鏈接來重新發送激活郵件。","awaiting_approval":"你的帳號尚未被論壇版主批准。一旦你的帳號獲得批准，你會收到一封電子郵件。","not_activated":"你還不能登錄。我們之前在\u003Cb\u003E{{sentTo}}\u003C/b\u003E發送了一封激活郵件給你。請按照郵件中的介紹來激活你的帳號。","resend_activation_email":"點擊此處來重新發送激活郵件。","sent_activation_email_again":"我們在\u003Cb\u003E{{currentEmail}}\u003C/b\u003E又發送了一封激活郵件給你，郵件送達可能需要幾分鍾，有的電子郵箱服務商可能會認爲此郵件爲垃圾郵件，請檢查一下你郵箱的垃圾郵件文件夾。","google":{"title":"使用谷歌帳號登錄","message":"使用谷歌（Google）帳號驗證登錄（請確保沒有禁止浏覽器彈出對話框）"},"twitter":{"title":"使用推特帳號登錄","message":"使用推特(Twitter)帳號驗證登錄（請確保沒有禁止浏覽器彈出對話框）"},"facebook":{"title":"使用Facebook帳號登錄","message":"使用Facebook帳號驗證登錄（請確保沒有禁止浏覽器彈出對話框）"},"yahoo":{"title":"使用雅虎帳號登錄","message":"使用雅虎（Yahoo）帳號驗證登錄（請確保沒有禁止浏覽器彈出對話框）"},"github":{"title":"使用 GitHub 帳號登錄","message":"使用 GitHub 帳號驗證登錄（請確保沒有禁止浏覽器彈出對話框）"},"persona":{"title":"使用 Persona 帳號登錄","message":"使用 Mozilla Persona 帳號驗證登錄（請確保沒有禁止浏覽器彈出對話框）"}},"composer":{"posting_not_on_topic":"你正在回複主題 \"{{title}}\"，但是當前你正在浏覽的是另外一個主題。","saving_draft_tip":"保存中","saved_draft_tip":"已保存","saved_local_draft_tip":"已本地保存","similar_topics":"你的主題與此有些類似...","drafts_offline":"離線草稿","min_length":{"need_more_for_title":"請給標題再輸入至少 {{n}} 個字符","need_more_for_reply":"請給正文內容再輸入至少 {{n}} 個字符"},"save_edit":"保存編輯","reply_original":"回複原始帖","reply_here":"在此回複","reply":"回複","cancel":"取消","create_topic":"創建主題","create_pm":"創建私信","users_placeholder":"添加一個用戶","title_placeholder":"在此輸入你的標題，簡明扼要的用一句話說明討論的內容。","reply_placeholder":"在此輸入你的內容。你可以使用 Markdown（參考 http://wowubuntu.com/markdown/） 或 BBCode（參考 http://www.bbcode.org/reference.php） 來格式化內容。拖拽或粘貼一幅圖片到這兒即可將它上傳。","view_new_post":"浏覽你的新帖子。","saving":"保存中……","saved":"已保存！","saved_draft":"你有一個帖子草稿尚發表。在框中任意處點擊即可接著編輯。","uploading":"上傳中……","show_preview":"顯示預覽 \u0026raquo;","hide_preview":"\u0026laquo; 隱藏預覽","quote_post_title":"引用整個帖子","bold_title":"加粗","bold_text":"加粗文字","italic_title":"斜體","italic_text":"斜體文字","link_title":"鏈接","link_description":"在此輸入鏈接描述","link_dialog_title":"插入鏈接","link_optional_text":"可選標題","quote_title":"引用","quote_text":"引用","code_title":"代碼","code_text":"在此輸入代碼","upload_title":"圖片","upload_description":"在此輸入圖片描述","olist_title":"數字列表","ulist_title":"符號列表","list_item":"列表條目","heading_title":"標題","heading_text":"標題頭","hr_title":"分割線","undo_title":"撤銷","redo_title":"重做","help":"Markdown 編輯幫助","toggler":"隱藏或顯示編輯面板","admin_options_title":"本主題可選設置","auto_close_label":"自動關閉主題，過：","auto_close_units":"天"},"notifications":{"title":"使用 @name 提及到你，回複你的帖子和主題，私信等等的通知消息","none":"你當前沒有任何通知。","more":"浏覽以前的通知","mentioned":"\u003Cspan title='mentioned' class='icon'\u003E@\u003C/span\u003E {{username}} {{link}}","quoted":"\u003Ci title='quoted' class='icon icon-quote-right'\u003E\u003C/i\u003E {{username}} {{link}}","replied":"\u003Ci title='replied' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","posted":"\u003Ci title='replied' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","edited":"\u003Ci title='edited' class='icon icon-pencil'\u003E\u003C/i\u003E {{username}} {{link}}","liked":"\u003Ci title='liked' class='icon icon-heart'\u003E\u003C/i\u003E {{username}} {{link}}","private_message":"\u003Ci class='icon icon-envelope-alt' title='私信'\u003E\u003C/i\u003E {{username}} 發送給你一條私信：{{link}}","invited_to_private_message":"{{username}} 邀請你進行私下交流：{{link}}","invitee_accepted":"\u003Ci title='已接受你的邀請' class='icon icon-signin'\u003E\u003C/i\u003E {{username}} 已接受你的邀請","moved_post":"\u003Ci title='移動帖子' class='icon icon-arrow-right'\u003E\u003C/i\u003E {{username}} 已將帖子移動到 {{link}}","total_flagged":"被投訴帖子的總數"},"upload_selector":{"title":"插入圖片","from_my_computer":"來自我的設備","from_the_web":"來自網絡","remote_tip":"輸入圖片網絡，格式爲：http://example.com/image.jpg","local_tip":"點擊從你的設備中選擇一張圖片。","uploading":"上傳圖片中"},"search":{"title":"搜索主題、帖子、用戶或分類","placeholder":"在此輸入你的搜索條件","no_results":"沒有找到結果。","searching":"搜索中……","prefer":{"user":"搜索會優先列出@{{username}}的結果","category":"搜索會優先列出{{category}}的結果"}},"site_map":"去另一個主題列表或分類","go_back":"返回","current_user":"去你的用戶頁面","favorite":{"title":"收藏","help":{"star":"將此主題加入你的收藏列表","unstar":"將此主題從你的收藏列表中移除"}},"topics":{"none":{"favorited":"你尚未收藏任何主題。要收藏一個主題，點擊標題旁的星星圖標。","unread":"你沒有未閱主題。","new":"你沒有新主題可讀。","read":"你尚未閱讀任何主題。","posted":"你尚未在任何主題中發帖。","latest":"傷心啊，沒有主題。","hot":"沒有熱門主題。","category":"沒有 {{category}} 分類的主題。"},"bottom":{"latest":"沒有更多主題可看了。","hot":"沒有更多熱門主題可看了。","posted":"沒有更多已發布主題可看了。","read":"沒有更多已閱主題可看了。","new":"沒有更多新主題可看了。","unread":"沒有更多未閱主題可看了。","favorited":"沒有更多收藏主題可看了。","category":"沒有更多 {{category}} 分類的主題了。"}},"rank_details":{"toggle":"切換主題排名詳細","show":"顯示主題排名詳細信息","title":"主題排名詳細"},"topic":{"create":"創建主題","create_long":"創建一個新主題","private_message":"開啓一段私下交流","list":"主題","new":"新主題","title":"主題","loading_more":"載入更多主題中……","loading":"載入主題中……","invalid_access":{"title":"這是私密主題","description":"抱歉，你沒有訪問此主題的權限！"},"server_error":{"title":"載入主題失敗","description":"抱歉，無法載入此主題。有可能是網絡連接問題導致的，請重試。如果問題始終存在，請告訴我們。"},"not_found":{"title":"未找到主題","description":"抱歉，無法找到此主題。有可能它被論壇版主刪掉了？"},"unread_posts":"此主題中你有 {{unread}} 個帖子未閱","new_posts":"從你最近一次閱讀此主題後，又有 {{new_posts}} 個新帖子發表","likes":{"one":"此主題得到了一個讚","other":"此主題得到了 {{count}} 個讚"},"back_to_list":"返回主題列表","options":"主題選項","show_links":"顯示此主題中的鏈接","toggle_information":"切換主題詳細","read_more_in_category":"想閱讀更多內容？浏覽 {{catLink}} 或 {{latestLink}} 裏的其它主題。","read_more":"想閱讀更多內容？{{catLink}} 或 {{latestLink}}。","browse_all_categories":"浏覽所有分類","view_latest_topics":"浏覽熱門主題","suggest_create_topic":"這就創建一個主題吧！","read_position_reset":"你的閱讀位置已經被重置。","jump_reply_up":"跳轉至更早的回複","jump_reply_down":"跳轉至更晚的回複","deleted":"此主題已被刪除","auto_close_notice":"本主題將在%{timeLeft}後自動關閉","auto_close_title":"自動關閉設置","auto_close_save":"保存","auto_close_cancel":"取消","auto_close_remove":"不自動關閉該主題","progress":{"title":"主題進度","jump_top":"跳轉到第一帖","jump_bottom":"跳轉到最後一帖","total":"全部帖子","current":"當前帖"},"notifications":{"title":"","reasons":{"3_2":"因爲你在關注此主題，所以你將收到相關通知。","3_1":"因爲你創建了此主題，所以你將收到相關通知。","3":"因爲你在關注此主題，所以你將收到相關通知。","2_4":"因爲你在此主題內發表了回複，所以你將收到相關通知。","2_2":"因爲你在追蹤此主題，所以你將收到相關通知。","2":"因爲你\u003Ca href=\"/users/{{username}}/preferences\"\u003E閱讀了此主題\u003C/a\u003E，所以你將收到相關通知。","1":"因爲有人 @name 提及了你或回複了你的帖子，所以你將收到相關通知。","1_2":"僅當有人 @name 提及了你或回複了你的帖子，你才會收到相關通知。","0":"你將忽略關于此主題的所有通知。","0_2":"你將忽略關于此主題的所有通知。"},"watching":{"title":"關注","description":"與追蹤一樣，額外的是一旦有新帖子發表，你都會收到通知。"},"tracking":{"title":"追蹤","description":"關于你的未閱帖子、@name 提及與對你的帖子的回複，你都會收到通知。"},"regular":{"title":"常規","description":"只有當有人 @name 提及你或者回複你的帖子時，你才會收到通知。"},"muted":{"title":"防打擾","description":"你不會收到關于此主題的任何通知，也不會在你的未閱選項卡中顯示。"}},"actions":{"delete":"刪除主題","open":"打開主題","close":"關閉主題","auto_close":"自動關閉","unpin":"解除主題置頂","pin":"置頂主題","unarchive":"解除主題存檔","archive":"存檔主題","invisible":"使不可見","visible":"使可見","reset_read":"重置閱讀數據","multi_select":"選擇將被合並/拆分的帖子","convert_to_topic":"轉換到常規主題"},"reply":{"title":"回複","help":"開始給本主題撰寫回複"},"clear_pin":{"title":"清除置頂","help":"將本主題的置頂狀態清除，這樣它將不再始終顯示在主題列表頂部"},"share":{"title":"分享","help":"分享一個到本帖的鏈接"},"inviting":"邀請中……","invite_private":{"title":"邀請進行私下交流","email_or_username":"受邀人的電子郵箱或用戶名","email_or_username_placeholder":"電子郵箱地址或用戶名","action":"邀請","success":"謝謝！我們已經邀請該用戶參與此私下交流。","error":"抱歉，在邀請該用戶時發生了錯誤。"},"invite_reply":{"title":"邀請朋友來回複","action":"郵件邀請","help":"向你的朋友發送邀請，他們只需要一個點擊就能回複這個主題","email":"我們會給你的朋友發送一封郵件，他們只需要點擊其中的一個鏈接就可以回複這個主題了。","email_placeholder":"電子郵箱地址","success":"謝謝！我們已發送一個邀請郵件到\u003Cb\u003E{{email}}\u003C/b\u003E。當他們確認的時候我們會通知你。你也可以在你的用戶頁面的邀請選項卡下查看邀請狀態。","error":"抱歉，我們不能邀請此人，可能他/她已經是本站用戶了？"},"login_reply":"登錄來回複","filters":{"user":"你在浏覽 {{n_posts}} {{by_n_users}}.","n_posts":{"one":"一個帖子","other":"{{count}} 帖子"},"by_n_users":{"one":"一個指定用戶","other":"{{count}} 個用戶中的"},"best_of":"你在浏覽 {{n_best_posts}} {{of_n_posts}}.","n_best_posts":{"one":"一個優秀帖子","other":"{{count}} 優秀帖子"},"of_n_posts":{"one":"一個帖子中的","other":"{{count}} 個帖子中的"},"cancel":"再次顯示本主題下的所有帖子。"},"split_topic":{"title":"拆分主題","action":"拆分主題","topic_name":"新主題名：","error":"拆分主題時發生錯誤。","instructions":{"one":"你想如何移動該帖？","other":"你想如何移動你所選擇的這{{count}}篇帖子？"}},"merge_topic":{"title":"合並主題","action":"合並主題","error":"合並主題時發生錯誤。","instructions":{"one":"請選擇你想將那篇帖子移至其下的主題。","other":"請選擇你想將那{{count}}篇帖子移至其下的主題。"}},"multi_select":{"select":"選擇","selected":"已選擇（{{count}}）","delete":"刪除所選","cancel":"取消選擇","description":{"one":"你已選擇了\u003Cb\u003E一個\u003C/b\u003E帖子。","other":"你已選擇了\u003Cb\u003E{{count}}\u003C/b\u003E個帖子。"}}},"post":{"reply":"回複 {{replyAvatar}} {{username}} 發表的 {{link}}","reply_topic":"回複 {{link}}","quote_reply":"引用回複","edit":"編輯 {{link}}","post_number":"帖子 {{number}}","in_reply_to":"回複給","reply_as_new_topic":"回複爲新主題","continue_discussion":"從 {{postLink}} 繼續討論：","follow_quote":"跳轉至所引用的帖子","deleted_by_author":"（作者刪除了帖子）","expand_collapse":"展開/收縮","has_replies":{"one":"回複","other":"回複"},"errors":{"create":"抱歉，在創建你的帖子時發生了錯誤。請重試。","edit":"抱歉，在編輯你的帖子時發生了錯誤。請重試。","upload":"抱歉，在上傳文件時發生了錯誤。請重試。","image_too_large":"抱歉，你上傳的文件太大了（最大不能超過 {{max_size_kb}}kb），請調整文件大小後重新上傳。","too_many_uploads":"抱歉, 你只能一次上傳一張圖片。","upload_not_authorized":"抱歉, 你上傳的文件並不允許 (authorized extension: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"抱歉, 新用戶不能上傳圖片。","attachment_upload_not_allowed_for_new_user":"抱歉, 新用戶不能上傳附件。"},"abandon":"你確定要丟棄你的帖子嗎？","archetypes":{"save":"保存選項"},"controls":{"reply":"開始給本帖撰寫回複","like":"贊本帖","edit":"編輯本帖","flag":"投訴本帖以提醒論壇版主","delete":"刪除本帖","undelete":"恢複本帖","share":"分享一個到本帖的鏈接","more":"更多"},"actions":{"flag":"投訴","clear_flags":{"one":"清除投訴","other":"清除投訴"},"it_too":{"off_topic":"也投訴","spam":"也投訴","inappropriate":"也投訴","custom_flag":"也投訴","bookmark":"也做書簽","like":"也讚它","vote":"也對它投票"},"undo":{"off_topic":"撤銷投訴","spam":"撤銷投訴","inappropriate":"撤銷投訴","bookmark":"撤銷書簽","like":"撤銷贊","vote":"撤銷投票"},"people":{"off_topic":"{{icons}} 投訴它偏離主題","spam":"{{icons}} 投訴它爲垃圾信息","inappropriate":"{{icons}} 投訴它爲不當內容","notify_moderators":"{{icons}} 向版主投訴它","notify_moderators_with_url":"{{icons}} \u003Ca href='{{postUrl}}'\u003E通知了版主\u003C/a\u003E","notify_user":"{{icons}} 發起了一個私下交流","notify_user_with_url":"{{icons}} 發送了一條\u003Ca href='{{postUrl}}'\u003E私有消息\u003C/a\u003E","bookmark":"{{icons}} 對它做了書簽","like":"{{icons}} 贊了它","vote":"{{icons}} 對它投票"},"by_you":{"off_topic":"你投訴它偏離主題","spam":"你投訴它爲垃圾信息","inappropriate":"你投訴它爲不當內容","notify_moderators":"你向版主投訴了它","notify_user":"你對該用戶發起了一個私下交流","bookmark":"你對該帖做了書簽","like":"你贊了它","vote":"你對該帖投了票"},"by_you_and_others":{"off_topic":{"one":"你和另一個用戶投訴它偏離主題","other":"你和其他 {{count}} 個用戶投訴它偏離主題"},"spam":{"one":"你和另一個用戶投訴它爲垃圾信息","other":"你和其他 {{count}} 個用戶投訴它爲垃圾信息"},"inappropriate":{"one":"你和另一個用戶投訴它爲不當內容","other":"你和其他 {{count}} 個用戶投訴它爲不當內容"},"notify_moderators":{"one":"你和另一個用戶向版主投訴了它","other":"你和其他 {{count}} 個用戶向版主投訴了它"},"notify_user":{"one":"你和另一個用戶對該用戶發起了一個私下交流","other":"你和其他 {{count}} 個用戶對該用戶發起了一個私下交流"},"bookmark":{"one":"你和另一個用戶對該帖做了書簽","other":"你和其他 {{count}} 個用戶對該帖做了書簽"},"like":{"one":"你和另一個用戶贊了它","other":"你和其他 {{count}} 個用戶贊了它"},"vote":{"one":"你和另一個用戶對該帖投了票","other":"你和其他 {{count}} 個用戶對該帖投了票"}},"by_others":{"off_topic":{"one":"一個用戶投訴它偏離主題","other":"{{count}} 個用戶投訴它偏離主題"},"spam":{"one":"一個用戶投訴它爲垃圾信息","other":"{{count}} 個用戶投訴它爲垃圾信息"},"inappropriate":{"one":"一個用戶投訴它爲不當內容","other":"{{count}} 個用戶投訴它爲不當內容"},"notify_moderators":{"one":"一個用戶向版主投訴了它","other":"{{count}} 個用戶向版主投訴了它"},"notify_user":{"one":"一個用戶對該用戶發起了一個私下交流","other":"{{count}} 個用戶對該用戶發起了一個私下交流"},"bookmark":{"one":"一個用戶對該帖做了書簽","other":"{{count}} 個用戶對該帖做了書簽"},"like":{"one":"一個用戶贊了它","other":"{{count}} 個用戶贊了它"},"vote":{"one":"一個用戶對該帖投了票","other":"{{count}} 個用戶對該帖投了票"}}},"edits":{"one":"一次編輯","other":"{{count}}次編輯","zero":"未編輯"},"delete":{"confirm":{"one":"你確定要刪除此帖嗎？","other":"你確定要刪除這些帖子嗎？"}}},"category":{"none":"（未分類）","edit":"編輯","edit_long":"編輯分類","view":"浏覽分類下的主題","general":"通常","settings":"設置","delete":"刪除分類","create":"創建分類","save":"保存分類","creation_error":"創建此分類時發生了錯誤。","save_error":"在保存此分類時發生了錯誤。","more_posts":"浏覽全部 {{posts}} ……","name":"分類名稱","description":"描述","topic":"分類主題","badge_colors":"徽章顔色","background_color":"背景色","foreground_color":"前景色","name_placeholder":"應該簡明扼要。","color_placeholder":"任何網絡色彩","delete_confirm":"你確定要刪除此分類嗎？","delete_error":"在刪除此分類時發生了錯誤。","list":"列出分類","no_description":"本分類沒有描述信息。","change_in_category_topic":"訪問分類主題來編輯描述信息","hotness":"熱度","already_used":"此色彩已經被另一個分類使用","is_secure":"安全類型？","add_group":"添加分組","security":"安全","allowed_groups":"授權的分組：","auto_close_label":"自動關閉主題，過："},"flagging":{"title":"爲何要給投訴本帖？","action":"投訴帖子","take_action":"採取行動","notify_action":"通知","delete_spammer":"刪除濫發者","delete_confirm":"你將會從這用戶刪除 \u003Cb\u003E%{posts}\u003C/b\u003E 帖子及 \u003Cb\u003E%{topics}\u003C/b\u003E 主題, 刪除戶口, 及新增其電郵 \u003Cb\u003E%{email}\u003C/b\u003E 到永久封鎖列表. 你確定這用戶是濫發者?","yes_delete_spammer":"確定, 刪除濫發者","cant":"抱歉，當前你不能投訴本帖。","custom_placeholder_notify_user":"爲何你要私下聯系該用戶？","custom_placeholder_notify_moderators":"爲何本帖需要論壇版主的關注？爲何本帖需要論壇版主的關注？","custom_message":{"at_least":"輸入至少 {{n}} 個字符","more":"還差 {{n}} 個……","left":"還剩下 {{n}}"}},"topic_summary":{"title":"主題概要","links_shown":"顯示所有 {{totalLinks}} 個鏈接……","clicks":"點擊","topic_link":"主題鏈接"},"topic_statuses":{"locked":{"help":"本主題已關閉，不再接受新的回複"},"pinned":{"help":"本主題已置頂，它將始終顯示在它所屬分類的頂部"},"archived":{"help":"本主題已歸檔，即已經凍結，無法修改"},"invisible":{"help":"本主題不可見，它將不被顯示在主題列表中，只能通過一個直接鏈接來訪問"}},"posts":"帖子","posts_long":"本主題有 {{number}} 個帖子","original_post":"原始帖","views":"浏覽","replies":"回複","views_long":"本主題已經被浏覽過 {{number}} 次","activity":"活動","likes":"贊","top_contributors":"參與者","category_title":"分類","history":"曆史","changed_by":"由 {{author}}","categories_list":"分類列表","filters":{"latest":{"title":"最新","help":"最新發布的帖子"},"hot":{"title":"熱門","help":"最近最受歡迎的主題"},"favorited":{"title":"收藏","help":"你收藏的主題"},"read":{"title":"已閱","help":"你已經閱讀過的主題"},"categories":{"title":"分類","title_in":"分類 - {{categoryName}}","help":"歸屬于不同分類的所有主題"},"unread":{"title":{"zero":"未閱","one":"1個未閱主題","other":"{{count}}個未閱主題"},"help":"追蹤的主題中有未閱帖子的主題"},"new":{"title":{"zero":"新主題","one":"新主題（1）","other":"新主題（{{count}}）"},"help":"你最近一次訪問後的新主題，以及你追蹤的主題中有新帖子的主題"},"posted":{"title":"我的帖子","help":"你發表過帖子的主題"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}}（1）","other":"{{categoryName}}（{{count}}）"},"help":"在 {{categoryName}} 分類中熱門的主題"}},"browser_update":"抱歉, \u003Ca href=\"http://www.iteriter.com/faq/#browser\"\u003E你的瀏覽器版本太低，推薦使用Google Chrome\u003C/a\u003E. 請 \u003Ca href=\"http://www.google.com/chrome/\"\u003E升級你的浏覽器\u003C/a\u003E。","permission_types":{"full":"創建 / 回復 / 觀看","create_post":"回復 / 觀看","readonly":"觀看"},"type_to_filter":"輸入過濾條件……","admin":{"title":"論道 管理","moderator":"版主","dashboard":{"title":"管理面板","version":"安裝的版本","up_to_date":"你正在運行最新的論壇版本。","critical_available":"有一個關鍵更新可用。","updates_available":"目前有可用更新。","please_upgrade":"請升級！","no_check_performed":"沒有檢查更新. 請確定 sidekiq 正在運行.","stale_data":"A check for updates has not been performed lately. Ensure sidekiq is running.","installed_version":"已安裝","latest_version":"最新版本","problems_found":"你安裝的論壇目前有以下問題：","last_checked":"上次檢查","refresh_problems":"刷新","no_problems":"找不到問題.","moderators":"版主：","admins":"管理員：","blocked":"已封鎖:","suspended":"已禁止:","private_messages_short":"私信","private_messages_title":"私密信息","reports":{"today":"今天","yesterday":"昨天","last_7_days":"7 天以內","last_30_days":"30 天以內","all_time":"所有時間內","7_days_ago":"7 天之前","30_days_ago":"30 天之前","all":"全部","view_table":"以表格展示","view_chart":"以柱狀圖展示"}},"commits":{"latest_changes":"最後的改動: 請經常升級！","by":"來自"},"flags":{"title":"投訴","old":"過去的","active":"活躍的","agree_hide":"同意 (隱藏回復 + 發短消息)","agree_hide_title":"隱藏帖子及自動發短消息給該用戶, 使他編輯帖子","defer":"延遲","defer_title":"現時無須採取行動, 無限期延遲任何行動","clear":"清除投訴","clear_title":"撤銷本帖的所有投訴（已隱藏的帖子將會被取消隱藏）","delete":"刪除帖子","delete_title":"刪除帖子（如果它是主題第一帖，那麽將刪除主題）","disagree_unhide":"不同意 (取消隱藏帖子)","disagree_unhide_title":"刪除任何標記, 重新開放帖子","disagree":"不同意","disagree_title":"不同意投訴, 刪除帖子的任何標記","delete_spammer_title":"刪除濫發用戶及其所有帖子.","flagged_by":"投訴者爲","error":"出錯了","view_message":"查看消息","no_results":"沒有任何投訴"},"summary":{"action_type_3":{"one":"離題","other":"離題 x{{count}}"},"action_type_4":{"one":"不恰當","other":"不恰當 x{{count}}"},"action_type_6":{"one":"自定","other":"自定 x{{count}}"},"action_type_7":{"one":"自定","other":"自定 x{{count}}"},"action_type_8":{"one":"濫發","other":"濫發 x{{count}}"}},"groups":{"title":"群組","edit":"編輯群組","selector_placeholder":"添加用戶","name_placeholder":"組名，不能含有空格，與用戶名規則一致","about":"編輯群組成員及名稱","can_not_edit_automatic":"自動群組成員為自動決定, 管理用戶設定角色及級別","delete":"刪除","delete_confirm":"删除這個小組嗎？","delete_failed":"不能删除這個小組, 如是自動群組, 不能被删除"},"api":{"title":"應用開發接口（API）","long_title":"API信息","key":"密鑰","generate":"生成API密鑰","regenerate":"重新生成API密鑰","info_html":"API密鑰可以用來通過JSON調用創建和更新主題。","note_html":"請\u003Cstrong\u003E安全的\u003C/strong\u003E保管好本密鑰，任何擁有該密鑰的用戶可以使用它以論壇任何用戶的名義來發帖。"},"customize":{"title":"自定","long_title":"站點自定","header":"頭部","css":"層疊樣式表（CSS）","override_default":"覆蓋預設值？","enabled":"啓用？","preview":"預覽","undo_preview":"撤銷預覽","save":"保存","new":"新建","new_style":"新樣式","delete":"刪除","delete_confirm":"刪除本自定內容？","about":"站點定制允許你修改樣式表和站點頭部。選擇或者添加一個來開始編輯。"},"email":{"title":"記錄","sent_at":"發送時間","email_type":"郵件類型","to_address":"目的地址","test_email_address":"測試電子郵件地址","send_test":"發送測試電子郵件","sent_test":"已發送！","delivery_method":"發送方法","preview_digest":"前一個信息","preview_digest_desc":"這是一個能預覽從你的討論區發出的信息電子郵件內容的工具","refresh":"重新整理","format":"格式","html":"html","text":"文字","last_seen_user":"最後看見用戶:","reply_key":"回複金鑰","logs":null,"action":"行動","created_at":"創立","blocked_emails":{"title":"已封鎖的電郵","description":"當有人創建新用戶, 以下的電郵會被對比及封鎖註冊, 或採取其他行動.","email":"電郵地址","last_match_at":"最後符合","match_count":"個符合","actions":{"block":"封鎖","do_nothing":"不做任何動作"}},"staff_actions":{"title":"員工動作","instructions":"點擊用戶名及行動去過濾列表. 點擊頭像到用戶頁.","clear_filters":"顥示所有","staff_user":"員工用戶","target_user":"目標用戶","when":"當","context":"內容","details":"詳細內容","actions":{"delete_user":"刪除用戶","change_trust_level":"更改級別"}}},"impersonate":{"title":"假冒用戶","username_or_email":"用戶名或用戶電子郵件","help":"使用此工具來假冒一個用戶帳號以方便調試。","not_found":"無法找到該用戶。","invalid":"抱歉，你不能假冒該用戶。"},"users":{"title":"用戶","create":"添加管理員用戶","last_emailed":"最後一次郵寄","not_found":"抱歉，在我們的系統中此用戶名不存在。","active":"活躍","nav":{"active":"活躍","new":"新建","pending":"待定","admins":"管理員","moderators":"版主","suspended":"已禁止","blocked":"已封鎖"},"approved":"已批准？","approved_selected":{"one":"批准用戶","other":"批准用戶（{{count}}）"},"titles":{"active":"活動用戶","new":"新用戶","pending":"等待審核用戶","newuser":"信用等級爲0的用戶（新用戶）","basic":"信用等級爲1的用戶（基本用戶）","regular":"信用等級爲2的用戶（常訪問用戶）","leader":"信用等級爲3的用戶（高級用戶）","elder":"信用等級爲4的用戶（年長用戶）","admins":"管理員","moderators":"版主","suspended":"已禁止的用戶","blocked":"已封鎖的用戶"}},"user":{"suspend_failed":"禁止此用戶時發生了錯誤 {{error}}","unsuspend_failed":"解禁此用戶時發生了錯誤 {{error}}","suspend_duration":"你計劃禁止該用戶多久？（天）","delete_all_posts":"刪除所有帖子","suspend":"禁止","unsuspend":"解禁","suspended":"已禁止？","moderator":"版主？","admin":"管理員？","show_admin_profile":"管理員","refresh_browsers":"強制浏覽器刷新","show_public_profile":"顯示公開介紹","impersonate":"假冒用戶","revoke_admin":"吊銷管理員資格","grant_admin":"賦予管理員資格","revoke_moderation":"吊銷論壇版主資格","grant_moderation":"賦予論壇版主資格","reputation":"聲譽","permissions":"權限","activity":"活動","like_count":"收到的贊","private_topics_count":"私有主題數量","posts_read_count":"已閱帖子數量","post_count":"創建的帖子數量","topics_entered":"進入的主題數量","flags_given_count":"所做投訴數量","flags_received_count":"收到投訴數量","approve":"批准","approved_by":"批准人","time_read":"閱讀次數","delete":"刪除用戶","delete_forbidden":"此用戶還無法刪除，因爲他/她還有帖子。請先刪除該用戶的所有帖子。","delete_confirm":"你 確定 你要永久的從本站刪除此用戶？該操作無法撤銷！","deleted":"該用戶已被刪除。","delete_failed":"在刪除用戶時發生了錯誤。請確保刪除該用戶前刪除了該用戶的所有帖子。","send_activation_email":"發送激活郵件","activation_email_sent":"激活郵件已發送。","send_activation_email_failed":"在發送激活郵件時發生了錯誤。","activate":"激活帳號","activate_failed":"在激活用戶帳號時發生了錯誤。","deactivate_account":"停用帳號","deactivate_failed":"在停用用戶帳號時發生了錯誤。","unblock_failed":"在取消停用用戶帳號時發生了錯誤。","block_failed":"在封鎖用戶帳號時發生了錯誤。","deactivate_explanation":"停用用戶必須重新認證電郵","banned_explanation":"被停用用戶帳號不能登入","block_explanation":"被封鎖用戶帳號不能發言","trust_level_change_failed":"在更改用戶級別時發生了錯誤。"},"site_content":{"none":"選擇內容類型以開始編輯。","title":"內容","edit":"編輯站點內容"},"site_settings":{"show_overriden":"只顯示被覆蓋了預設值的","title":"設置","reset":"重置爲預設值","none":"沒有"}}}}};
I18n.locale = 'zh_TW';
// moment.js
// version : 2.0.0
// author : Tim Wood
// license : MIT
// momentjs.com

(function (undefined) {

    /************************************
        Constants
    ************************************/

    var moment,
        VERSION = "2.0.0",
        round = Math.round, i,
        // internal storage for language config files
        languages = {},

        // check for nodeJS
        hasModule = (typeof module !== 'undefined' && module.exports),

        // ASP.NET json date format regex
        aspNetJsonRegex = /^\/?Date\((\-?\d+)/i,
        aspNetTimeSpanJsonRegex = /(\-)?(\d*)?\.?(\d+)\:(\d+)\:(\d+)\.?(\d{3})?/,

        // format tokens
        formattingTokens = /(\[[^\[]*\])|(\\)?(Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|SS?S?|X|zz?|ZZ?|.)/g,
        localFormattingTokens = /(\[[^\[]*\])|(\\)?(LT|LL?L?L?|l{1,4})/g,

        // parsing tokens
        parseMultipleFormatChunker = /([0-9a-zA-Z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+)/gi,

        // parsing token regexes
        parseTokenOneOrTwoDigits = /\d\d?/, // 0 - 99
        parseTokenOneToThreeDigits = /\d{1,3}/, // 0 - 999
        parseTokenThreeDigits = /\d{3}/, // 000 - 999
        parseTokenFourDigits = /\d{1,4}/, // 0 - 9999
        parseTokenSixDigits = /[+\-]?\d{1,6}/, // -999,999 - 999,999
        parseTokenWord = /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i, // any word (or two) characters or numbers including two/three word month in arabic.
        parseTokenTimezone = /Z|[\+\-]\d\d:?\d\d/i, // +00:00 -00:00 +0000 -0000 or Z
        parseTokenT = /T/i, // T (ISO seperator)
        parseTokenTimestampMs = /[\+\-]?\d+(\.\d{1,3})?/, // 123456789 123456789.123

        // preliminary iso regex
        // 0000-00-00 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000
        isoRegex = /^\s*\d{4}-\d\d-\d\d((T| )(\d\d(:\d\d(:\d\d(\.\d\d?\d?)?)?)?)?([\+\-]\d\d:?\d\d)?)?/,
        isoFormat = 'YYYY-MM-DDTHH:mm:ssZ',

        // iso time formats and regexes
        isoTimes = [
            ['HH:mm:ss.S', /(T| )\d\d:\d\d:\d\d\.\d{1,3}/],
            ['HH:mm:ss', /(T| )\d\d:\d\d:\d\d/],
            ['HH:mm', /(T| )\d\d:\d\d/],
            ['HH', /(T| )\d\d/]
        ],

        // timezone chunker "+10:00" > ["10", "00"] or "-1530" > ["-15", "30"]
        parseTimezoneChunker = /([\+\-]|\d\d)/gi,

        // getter and setter names
        proxyGettersAndSetters = 'Date|Hours|Minutes|Seconds|Milliseconds'.split('|'),
        unitMillisecondFactors = {
            'Milliseconds' : 1,
            'Seconds' : 1e3,
            'Minutes' : 6e4,
            'Hours' : 36e5,
            'Days' : 864e5,
            'Months' : 2592e6,
            'Years' : 31536e6
        },

        unitAliases = {
            ms : 'millisecond',
            s : 'second',
            m : 'minute',
            h : 'hour',
            d : 'day',
            w : 'week',
            M : 'month',
            y : 'year'
        },

        // format function strings
        formatFunctions = {},

        // tokens to ordinalize and pad
        ordinalizeTokens = 'DDD w W M D d'.split(' '),
        paddedTokens = 'M D H h m s w W'.split(' '),

        formatTokenFunctions = {
            M    : function () {
                return this.month() + 1;
            },
            MMM  : function (format) {
                return this.lang().monthsShort(this, format);
            },
            MMMM : function (format) {
                return this.lang().months(this, format);
            },
            D    : function () {
                return this.date();
            },
            DDD  : function () {
                return this.dayOfYear();
            },
            d    : function () {
                return this.day();
            },
            dd   : function (format) {
                return this.lang().weekdaysMin(this, format);
            },
            ddd  : function (format) {
                return this.lang().weekdaysShort(this, format);
            },
            dddd : function (format) {
                return this.lang().weekdays(this, format);
            },
            w    : function () {
                return this.week();
            },
            W    : function () {
                return this.isoWeek();
            },
            YY   : function () {
                return leftZeroFill(this.year() % 100, 2);
            },
            YYYY : function () {
                return leftZeroFill(this.year(), 4);
            },
            YYYYY : function () {
                return leftZeroFill(this.year(), 5);
            },
            gg   : function () {
                return leftZeroFill(this.weekYear() % 100, 2);
            },
            gggg : function () {
                return this.weekYear();
            },
            ggggg : function () {
                return leftZeroFill(this.weekYear(), 5);
            },
            GG   : function () {
                return leftZeroFill(this.isoWeekYear() % 100, 2);
            },
            GGGG : function () {
                return this.isoWeekYear();
            },
            GGGGG : function () {
                return leftZeroFill(this.isoWeekYear(), 5);
            },
            e : function () {
                return this.weekday();
            },
            E : function () {
                return this.isoWeekday();
            },
            a    : function () {
                return this.lang().meridiem(this.hours(), this.minutes(), true);
            },
            A    : function () {
                return this.lang().meridiem(this.hours(), this.minutes(), false);
            },
            H    : function () {
                return this.hours();
            },
            h    : function () {
                return this.hours() % 12 || 12;
            },
            m    : function () {
                return this.minutes();
            },
            s    : function () {
                return this.seconds();
            },
            S    : function () {
                return ~~(this.milliseconds() / 100);
            },
            SS   : function () {
                return leftZeroFill(~~(this.milliseconds() / 10), 2);
            },
            SSS  : function () {
                return leftZeroFill(this.milliseconds(), 3);
            },
            Z    : function () {
                var a = -this.zone(),
                    b = "+";
                if (a < 0) {
                    a = -a;
                    b = "-";
                }
                return b + leftZeroFill(~~(a / 60), 2) + ":" + leftZeroFill(~~a % 60, 2);
            },
            ZZ   : function () {
                var a = -this.zone(),
                    b = "+";
                if (a < 0) {
                    a = -a;
                    b = "-";
                }
                return b + leftZeroFill(~~(10 * a / 6), 4);
            },
            z : function () {
                return this.zoneAbbr();
            },
            zz : function () {
                return this.zoneName();
            },
            X    : function () {
                return this.unix();
            }
        };

    function padToken(func, count) {
        return function (a) {
            return leftZeroFill(func.call(this, a), count);
        };
    }
    function ordinalizeToken(func, period) {
        return function (a) {
            return this.lang().ordinal(func.call(this, a), period);
        };
    }

    while (ordinalizeTokens.length) {
        i = ordinalizeTokens.pop();
        formatTokenFunctions[i + 'o'] = ordinalizeToken(formatTokenFunctions[i], i);
    }
    while (paddedTokens.length) {
        i = paddedTokens.pop();
        formatTokenFunctions[i + i] = padToken(formatTokenFunctions[i], 2);
    }
    formatTokenFunctions.DDDD = padToken(formatTokenFunctions.DDD, 3);


    /************************************
        Constructors
    ************************************/

    function Language() {

    }

    // Moment prototype object
    function Moment(config) {
        extend(this, config);
    }

    // Duration Constructor
    function Duration(duration) {
        var data = this._data = {},
            years = duration.years || duration.year || duration.y || 0,
            months = duration.months || duration.month || duration.M || 0,
            weeks = duration.weeks || duration.week || duration.w || 0,
            days = duration.days || duration.day || duration.d || 0,
            hours = duration.hours || duration.hour || duration.h || 0,
            minutes = duration.minutes || duration.minute || duration.m || 0,
            seconds = duration.seconds || duration.second || duration.s || 0,
            milliseconds = duration.milliseconds || duration.millisecond || duration.ms || 0;

        // representation for dateAddRemove
        this._milliseconds = milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 36e5; // 1000 * 60 * 60
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = days +
            weeks * 7;
        // It is impossible translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = months +
            years * 12;

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;
        seconds += absRound(milliseconds / 1000);

        data.seconds = seconds % 60;
        minutes += absRound(seconds / 60);

        data.minutes = minutes % 60;
        hours += absRound(minutes / 60);

        data.hours = hours % 24;
        days += absRound(hours / 24);

        days += weeks * 7;
        data.days = days % 30;

        months += absRound(days / 30);

        data.months = months % 12;
        years += absRound(months / 12);

        data.years = years;
    }


    /************************************
        Helpers
    ************************************/


    function extend(a, b) {
        for (var i in b) {
            if (b.hasOwnProperty(i)) {
                a[i] = b[i];
            }
        }
        return a;
    }

    function absRound(number) {
        if (number < 0) {
            return Math.ceil(number);
        } else {
            return Math.floor(number);
        }
    }

    // left zero fill a number
    // see http://jsperf.com/left-zero-filling for performance comparison
    function leftZeroFill(number, targetLength) {
        var output = number + '';
        while (output.length < targetLength) {
            output = '0' + output;
        }
        return output;
    }

    // helper function for _.addTime and _.subtractTime
    function addOrSubtractDurationFromMoment(mom, duration, isAdding, ignoreUpdateOffset) {
        var milliseconds = duration._milliseconds,
            days = duration._days,
            months = duration._months,
            minutes,
            hours,
            currentDate;

        if (milliseconds) {
            mom._d.setTime(+mom._d + milliseconds * isAdding);
        }
        // store the minutes and hours so we can restore them
        if (days || months) {
            minutes = mom.minute();
            hours = mom.hour();
        }
        if (days) {
            mom.date(mom.date() + days * isAdding);
        }
        if (months) {
            currentDate = mom.date();
            mom.date(1)
                .month(mom.month() + months * isAdding)
                .date(Math.min(currentDate, mom.daysInMonth()));
        }
        if (milliseconds && !ignoreUpdateOffset) {
            moment.updateOffset(mom);
        }
        // restore the minutes and hours after possibly changing dst
        if (days || months) {
            mom.minute(minutes);
            mom.hour(hours);
        }
    }

    // check if is an array
    function isArray(input) {
        return Object.prototype.toString.call(input) === '[object Array]';
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if (~~array1[i] !== ~~array2[i]) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function normalizeUnits(units) {
        return units ? unitAliases[units] || units.toLowerCase().replace(/(.)s$/, '$1') : units;
    }


    /************************************
        Languages
    ************************************/


    Language.prototype = {
        set : function (config) {
            var prop, i;
            for (i in config) {
                prop = config[i];
                if (typeof prop === 'function') {
                    this[i] = prop;
                } else {
                    this['_' + i] = prop;
                }
            }
        },

        _months : "January_February_March_April_May_June_July_August_September_October_November_December".split("_"),
        months : function (m) {
            return this._months[m.month()];
        },

        _monthsShort : "Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec".split("_"),
        monthsShort : function (m) {
            return this._monthsShort[m.month()];
        },

        monthsParse : function (monthName) {
            var i, mom, regex;

            if (!this._monthsParse) {
                this._monthsParse = [];
            }

            for (i = 0; i < 12; i++) {
                // make the regex if we don't have it already
                if (!this._monthsParse[i]) {
                    mom = moment([2000, i]);
                    regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                    this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (this._monthsParse[i].test(monthName)) {
                    return i;
                }
            }
        },

        _weekdays : "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),
        weekdays : function (m) {
            return this._weekdays[m.day()];
        },

        _weekdaysShort : "Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"),
        weekdaysShort : function (m) {
            return this._weekdaysShort[m.day()];
        },

        _weekdaysMin : "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
        weekdaysMin : function (m) {
            return this._weekdaysMin[m.day()];
        },

        weekdaysParse : function (weekdayName) {
            var i, mom, regex;

            if (!this._weekdaysParse) {
                this._weekdaysParse = [];
            }

            for (i = 0; i < 7; i++) {
                // make the regex if we don't have it already
                if (!this._weekdaysParse[i]) {
                    mom = moment([2000, 1]).day(i);
                    regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                    this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (this._weekdaysParse[i].test(weekdayName)) {
                    return i;
                }
            }
        },

        _longDateFormat : {
            LT : "h:mm A",
            L : "MM/DD/YYYY",
            LL : "MMMM D YYYY",
            LLL : "MMMM D YYYY LT",
            LLLL : "dddd, MMMM D YYYY LT"
        },
        longDateFormat : function (key) {
            var output = this._longDateFormat[key];
            if (!output && this._longDateFormat[key.toUpperCase()]) {
                output = this._longDateFormat[key.toUpperCase()].replace(/MMMM|MM|DD|dddd/g, function (val) {
                    return val.slice(1);
                });
                this._longDateFormat[key] = output;
            }
            return output;
        },

        isPM : function (input) {
            return ((input + '').toLowerCase()[0] === 'p');
        },

        _meridiemParse : /[ap]\.?m?\.?/i,
        meridiem : function (hours, minutes, isLower) {
            if (hours > 11) {
                return isLower ? 'pm' : 'PM';
            } else {
                return isLower ? 'am' : 'AM';
            }
        },

        _calendar : {
            sameDay : '[Today at] LT',
            nextDay : '[Tomorrow at] LT',
            nextWeek : 'dddd [at] LT',
            lastDay : '[Yesterday at] LT',
            lastWeek : '[Last] dddd [at] LT',
            sameElse : 'L'
        },
        calendar : function (key, mom) {
            var output = this._calendar[key];
            return typeof output === 'function' ? output.apply(mom) : output;
        },

        _relativeTime : {
            future : "in %s",
            past : "%s ago",
            s : "a few seconds",
            m : "a minute",
            mm : "%d minutes",
            h : "an hour",
            hh : "%d hours",
            d : "a day",
            dd : "%d days",
            M : "a month",
            MM : "%d months",
            y : "a year",
            yy : "%d years"
        },
        relativeTime : function (number, withoutSuffix, string, isFuture) {
            var output = this._relativeTime[string];
            return (typeof output === 'function') ?
                output(number, withoutSuffix, string, isFuture) :
                output.replace(/%d/i, number);
        },
        pastFuture : function (diff, output) {
            var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
            return typeof format === 'function' ? format(output) : format.replace(/%s/i, output);
        },

        ordinal : function (number) {
            return this._ordinal.replace("%d", number);
        },
        _ordinal : "%d",

        preparse : function (string) {
            return string;
        },

        postformat : function (string) {
            return string;
        },

        week : function (mom) {
            return weekOfYear(mom, this._week.dow, this._week.doy).week;
        },
        _week : {
            dow : 0, // Sunday is the first day of the week.
            doy : 6  // The week that contains Jan 1st is the first week of the year.
        }
    };

    // Loads a language definition into the `languages` cache.  The function
    // takes a key and optionally values.  If not in the browser and no values
    // are provided, it will load the language file module.  As a convenience,
    // this function also returns the language values.
    function loadLang(key, values) {
        values.abbr = key;
        if (!languages[key]) {
            languages[key] = new Language();
        }
        languages[key].set(values);
        return languages[key];
    }

    // Determines which language definition to use and returns it.
    //
    // With no parameters, it will return the global language.  If you
    // pass in a language key, such as 'en', it will return the
    // definition for 'en', so long as 'en' has already been loaded using
    // moment.lang.
    function getLangDefinition(key) {
        if (!key) {
            return moment.fn._lang;
        }
        if (!languages[key] && hasModule) {
            require('./lang/' + key);
        }
        return languages[key];
    }


    /************************************
        Formatting
    ************************************/


    function removeFormattingTokens(input) {
        if (input.match(/\[.*\]/)) {
            return input.replace(/^\[|\]$/g, "");
        }
        return input.replace(/\\/g, "");
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = "";
            for (i = 0; i < length; i++) {
                output += array[i] instanceof Function ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return m.lang().longDateFormat(input) || input;
        }

        while (i-- && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
        }

        if (!formatFunctions[format]) {
            formatFunctions[format] = makeFormatFunction(format);
        }

        return formatFunctions[format](m);
    }


    /************************************
        Parsing
    ************************************/


    // get the regex to find the next token
    function getParseRegexForToken(token, config) {
        switch (token) {
        case 'DDDD':
            return parseTokenThreeDigits;
        case 'YYYY':
            return parseTokenFourDigits;
        case 'YYYYY':
            return parseTokenSixDigits;
        case 'S':
        case 'SS':
        case 'SSS':
        case 'DDD':
            return parseTokenOneToThreeDigits;
        case 'MMM':
        case 'MMMM':
        case 'dd':
        case 'ddd':
        case 'dddd':
            return parseTokenWord;
        case 'a':
        case 'A':
            return getLangDefinition(config._l)._meridiemParse;
        case 'X':
            return parseTokenTimestampMs;
        case 'Z':
        case 'ZZ':
            return parseTokenTimezone;
        case 'T':
            return parseTokenT;
        case 'MM':
        case 'DD':
        case 'YY':
        case 'HH':
        case 'hh':
        case 'mm':
        case 'ss':
        case 'M':
        case 'D':
        case 'd':
        case 'H':
        case 'h':
        case 'm':
        case 's':
            return parseTokenOneOrTwoDigits;
        default :
            return new RegExp(token.replace('\\', ''));
        }
    }

    function timezoneMinutesFromString(string) {
        var tzchunk = (parseTokenTimezone.exec(string) || [])[0],
            parts = (tzchunk + '').match(parseTimezoneChunker) || ['-', 0, 0],
            minutes = +(parts[1] * 60) + ~~parts[2];

        return parts[0] === '+' ? -minutes : minutes;
    }

    // function to convert string input to date
    function addTimeToArrayFromToken(token, input, config) {
        var a, b,
            datePartArray = config._a;

        switch (token) {
        // MONTH
        case 'M' : // fall through to MM
        case 'MM' :
            datePartArray[1] = (input == null) ? 0 : ~~input - 1;
            break;
        case 'MMM' : // fall through to MMMM
        case 'MMMM' :
            a = getLangDefinition(config._l).monthsParse(input);
            // if we didn't find a month name, mark the date as invalid.
            if (a != null) {
                datePartArray[1] = a;
            } else {
                config._isValid = false;
            }
            break;
        // DAY OF MONTH
        case 'D' : // fall through to DDDD
        case 'DD' : // fall through to DDDD
        case 'DDD' : // fall through to DDDD
        case 'DDDD' :
            if (input != null) {
                datePartArray[2] = ~~input;
            }
            break;
        // YEAR
        case 'YY' :
            datePartArray[0] = ~~input + (~~input > 68 ? 1900 : 2000);
            break;
        case 'YYYY' :
        case 'YYYYY' :
            datePartArray[0] = ~~input;
            break;
        // AM / PM
        case 'a' : // fall through to A
        case 'A' :
            config._isPm = getLangDefinition(config._l).isPM(input);
            break;
        // 24 HOUR
        case 'H' : // fall through to hh
        case 'HH' : // fall through to hh
        case 'h' : // fall through to hh
        case 'hh' :
            datePartArray[3] = ~~input;
            break;
        // MINUTE
        case 'm' : // fall through to mm
        case 'mm' :
            datePartArray[4] = ~~input;
            break;
        // SECOND
        case 's' : // fall through to ss
        case 'ss' :
            datePartArray[5] = ~~input;
            break;
        // MILLISECOND
        case 'S' :
        case 'SS' :
        case 'SSS' :
            datePartArray[6] = ~~ (('0.' + input) * 1000);
            break;
        // UNIX TIMESTAMP WITH MS
        case 'X':
            config._d = new Date(parseFloat(input) * 1000);
            break;
        // TIMEZONE
        case 'Z' : // fall through to ZZ
        case 'ZZ' :
            config._useUTC = true;
            config._tzm = timezoneMinutesFromString(input);
            break;
        }

        // if the input is null, the date is not valid
        if (input == null) {
            config._isValid = false;
        }
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function dateFromArray(config) {
        var i, date, input = [];

        if (config._d) {
            return;
        }

        for (i = 0; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // add the offsets to the time to be parsed so that we can have a clean array for checking isValid
        input[3] += ~~((config._tzm || 0) / 60);
        input[4] += ~~((config._tzm || 0) % 60);

        date = new Date(0);

        if (config._useUTC) {
            date.setUTCFullYear(input[0], input[1], input[2]);
            date.setUTCHours(input[3], input[4], input[5], input[6]);
        } else {
            date.setFullYear(input[0], input[1], input[2]);
            date.setHours(input[3], input[4], input[5], input[6]);
        }

        config._d = date;
    }

    // date from string and format string
    function makeDateFromStringAndFormat(config) {
        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var tokens = config._f.match(formattingTokens),
            string = config._i,
            i, parsedInput;

        config._a = [];

        for (i = 0; i < tokens.length; i++) {
            parsedInput = (getParseRegexForToken(tokens[i], config).exec(string) || [])[0];
            if (parsedInput) {
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
            }
            // don't parse if its not a known token
            if (formatTokenFunctions[tokens[i]]) {
                addTimeToArrayFromToken(tokens[i], parsedInput, config);
            }
        }

        // add remaining unparsed input to the string
        if (string) {
            config._il = string;
        }

        // handle am pm
        if (config._isPm && config._a[3] < 12) {
            config._a[3] += 12;
        }
        // if is 12 am, change hours to 0
        if (config._isPm === false && config._a[3] === 12) {
            config._a[3] = 0;
        }
        // return
        dateFromArray(config);
    }

    // date from string and array of format strings
    function makeDateFromStringAndArray(config) {
        var tempConfig,
            tempMoment,
            bestMoment,

            scoreToBeat = 99,
            i,
            currentScore;

        for (i = 0; i < config._f.length; i++) {
            tempConfig = extend({}, config);
            tempConfig._f = config._f[i];
            makeDateFromStringAndFormat(tempConfig);
            tempMoment = new Moment(tempConfig);

            currentScore = compareArrays(tempConfig._a, tempMoment.toArray());

            // if there is any input that was not parsed
            // add a penalty for that format
            if (tempMoment._il) {
                currentScore += tempMoment._il.length;
            }

            if (currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempMoment;
            }
        }

        extend(config, bestMoment);
    }

    // date from iso format
    function makeDateFromString(config) {
        var i,
            string = config._i,
            match = isoRegex.exec(string);

        if (match) {
            // match[2] should be "T" or undefined
            config._f = 'YYYY-MM-DD' + (match[2] || " ");
            for (i = 0; i < 4; i++) {
                if (isoTimes[i][1].exec(string)) {
                    config._f += isoTimes[i][0];
                    break;
                }
            }
            if (parseTokenTimezone.exec(string)) {
                config._f += " Z";
            }
            makeDateFromStringAndFormat(config);
        } else {
            config._d = new Date(string);
        }
    }

    function makeDateFromInput(config) {
        var input = config._i,
            matched = aspNetJsonRegex.exec(input);

        if (input === undefined) {
            config._d = new Date();
        } else if (matched) {
            config._d = new Date(+matched[1]);
        } else if (typeof input === 'string') {
            makeDateFromString(config);
        } else if (isArray(input)) {
            config._a = input.slice(0);
            dateFromArray(config);
        } else {
            config._d = input instanceof Date ? new Date(+input) : new Date(input);
        }
    }


    /************************************
        Relative Time
    ************************************/


    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, lang) {
        return lang.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime(milliseconds, withoutSuffix, lang) {
        var seconds = round(Math.abs(milliseconds) / 1000),
            minutes = round(seconds / 60),
            hours = round(minutes / 60),
            days = round(hours / 24),
            years = round(days / 365),
            args = seconds < 45 && ['s', seconds] ||
                minutes === 1 && ['m'] ||
                minutes < 45 && ['mm', minutes] ||
                hours === 1 && ['h'] ||
                hours < 22 && ['hh', hours] ||
                days === 1 && ['d'] ||
                days <= 25 && ['dd', days] ||
                days <= 45 && ['M'] ||
                days < 345 && ['MM', round(days / 30)] ||
                years === 1 && ['y'] || ['yy', years];
        args[2] = withoutSuffix;
        args[3] = milliseconds > 0;
        args[4] = lang;
        return substituteTimeAgo.apply({}, args);
    }


    /************************************
        Week of Year
    ************************************/


    // firstDayOfWeek       0 = sun, 6 = sat
    //                      the day of the week that starts the week
    //                      (usually sunday or monday)
    // firstDayOfWeekOfYear 0 = sun, 6 = sat
    //                      the first week is the week that contains the first
    //                      of this day of the week
    //                      (eg. ISO weeks use thursday (4))
    function weekOfYear(mom, firstDayOfWeek, firstDayOfWeekOfYear) {
        var end = firstDayOfWeekOfYear - firstDayOfWeek,
            daysToDayOfWeek = firstDayOfWeekOfYear - mom.day(),
            adjustedMoment;


        if (daysToDayOfWeek > end) {
            daysToDayOfWeek -= 7;
        }

        if (daysToDayOfWeek < end - 7) {
            daysToDayOfWeek += 7;
        }

        adjustedMoment = moment(mom).add('d', daysToDayOfWeek);
        return {
            week: Math.ceil(adjustedMoment.dayOfYear() / 7),
            year: adjustedMoment.year()
        };
    }


    /************************************
        Top Level Functions
    ************************************/

    function makeMoment(config) {
        var input = config._i,
            format = config._f;

        if (input === null || input === '') {
            return null;
        }

        if (typeof input === 'string') {
            config._i = input = getLangDefinition().preparse(input);
        }

        if (moment.isMoment(input)) {
            config = extend({}, input);
            config._d = new Date(+input._d);
        } else if (format) {
            if (isArray(format)) {
                makeDateFromStringAndArray(config);
            } else {
                makeDateFromStringAndFormat(config);
            }
        } else {
            makeDateFromInput(config);
        }

        return new Moment(config);
    }

    moment = function (input, format, lang) {
        return makeMoment({
            _i : input,
            _f : format,
            _l : lang,
            _isUTC : false
        });
    };

    // creating with utc
    moment.utc = function (input, format, lang) {
        return makeMoment({
            _useUTC : true,
            _isUTC : true,
            _l : lang,
            _i : input,
            _f : format
        });
    };

    // creating with unix timestamp (in seconds)
    moment.unix = function (input) {
        return moment(input * 1000);
    };

    // duration
    moment.duration = function (input, key) {
        var isDuration = moment.isDuration(input),
            isNumber = (typeof input === 'number'),
            duration = (isDuration ? input._data : (isNumber ? {} : input)),
            matched = aspNetTimeSpanJsonRegex.exec(input),
            sign,
            ret;

        if (isNumber) {
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (matched) {
            sign = (matched[1] === "-") ? -1 : 1;
            duration = {
                y: 0,
                d: ~~matched[2] * sign,
                h: ~~matched[3] * sign,
                m: ~~matched[4] * sign,
                s: ~~matched[5] * sign,
                ms: ~~matched[6] * sign
            };
        }

        ret = new Duration(duration);

        if (isDuration && input.hasOwnProperty('_lang')) {
            ret._lang = input._lang;
        }

        return ret;
    };

    // version number
    moment.version = VERSION;

    // default format
    moment.defaultFormat = isoFormat;

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    moment.updateOffset = function () {};

    // This function will load languages and then set the global language.  If
    // no arguments are passed in, it will simply return the current global
    // language key.
    moment.lang = function (key, values) {
        var i;

        if (!key) {
            return moment.fn._lang._abbr;
        }
        if (values) {
            loadLang(key, values);
        } else if (!languages[key]) {
            getLangDefinition(key);
        }
        moment.duration.fn._lang = moment.fn._lang = getLangDefinition(key);
    };

    // returns language data
    moment.langData = function (key) {
        if (key && key._lang && key._lang._abbr) {
            key = key._lang._abbr;
        }
        return getLangDefinition(key);
    };

    // compare moment object
    moment.isMoment = function (obj) {
        return obj instanceof Moment;
    };

    // for typechecking Duration objects
    moment.isDuration = function (obj) {
        return obj instanceof Duration;
    };


    /************************************
        Moment Prototype
    ************************************/


    moment.fn = Moment.prototype = {

        clone : function () {
            return moment(this);
        },

        valueOf : function () {
            return +this._d + ((this._offset || 0) * 60000);
        },

        unix : function () {
            return Math.floor(+this / 1000);
        },

        toString : function () {
            return this.format("ddd MMM DD YYYY HH:mm:ss [GMT]ZZ");
        },

        toDate : function () {
            return this._offset ? new Date(+this) : this._d;
        },

        toISOString : function () {
            return formatMoment(moment(this).utc(), 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
        },

        toArray : function () {
            var m = this;
            return [
                m.year(),
                m.month(),
                m.date(),
                m.hours(),
                m.minutes(),
                m.seconds(),
                m.milliseconds()
            ];
        },

        isValid : function () {
            if (this._isValid == null) {
                if (this._a) {
                    this._isValid = !compareArrays(this._a, (this._isUTC ? moment.utc(this._a) : moment(this._a)).toArray());
                } else {
                    this._isValid = !isNaN(this._d.getTime());
                }
            }
            return !!this._isValid;
        },

        utc : function () {
            return this.zone(0);
        },

        local : function () {
            this.zone(0);
            this._isUTC = false;
            return this;
        },

        format : function (inputString) {
            var output = formatMoment(this, inputString || moment.defaultFormat);
            return this.lang().postformat(output);
        },

        add : function (input, val) {
            var dur;
            // switch args to support add('s', 1) and add(1, 's')
            if (typeof input === 'string') {
                dur = moment.duration(+val, input);
            } else {
                dur = moment.duration(input, val);
            }
            addOrSubtractDurationFromMoment(this, dur, 1);
            return this;
        },

        subtract : function (input, val) {
            var dur;
            // switch args to support subtract('s', 1) and subtract(1, 's')
            if (typeof input === 'string') {
                dur = moment.duration(+val, input);
            } else {
                dur = moment.duration(input, val);
            }
            addOrSubtractDurationFromMoment(this, dur, -1);
            return this;
        },

        diff : function (input, units, asFloat) {
            var that = this._isUTC ? moment(input).zone(this._offset || 0) : moment(input).local(),
                zoneDiff = (this.zone() - that.zone()) * 6e4,
                diff, output;

            units = normalizeUnits(units);

            if (units === 'year' || units === 'month') {
                diff = (this.daysInMonth() + that.daysInMonth()) * 432e5; // 24 * 60 * 60 * 1000 / 2
                output = ((this.year() - that.year()) * 12) + (this.month() - that.month());
                output += ((this - moment(this).startOf('month')) - (that - moment(that).startOf('month'))) / diff;
                if (units === 'year') {
                    output = output / 12;
                }
            } else {
                diff = (this - that) - zoneDiff;
                output = units === 'second' ? diff / 1e3 : // 1000
                    units === 'minute' ? diff / 6e4 : // 1000 * 60
                    units === 'hour' ? diff / 36e5 : // 1000 * 60 * 60
                    units === 'day' ? diff / 864e5 : // 1000 * 60 * 60 * 24
                    units === 'week' ? diff / 6048e5 : // 1000 * 60 * 60 * 24 * 7
                    diff;
            }
            return asFloat ? output : absRound(output);
        },

        from : function (time, withoutSuffix) {
            return moment.duration(this.diff(time)).lang(this.lang()._abbr).humanize(!withoutSuffix);
        },

        fromNow : function (withoutSuffix) {
            return this.from(moment(), withoutSuffix);
        },

        calendar : function () {
            var diff = this.diff(moment().startOf('day'), 'days', true),
                format = diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
            return this.format(this.lang().calendar(format, this));
        },

        isLeapYear : function () {
            var year = this.year();
            return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        },

        isDST : function () {
            return (this.zone() < this.clone().month(0).zone() ||
                this.zone() < this.clone().month(5).zone());
        },

        day : function (input) {
            var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
            if (input != null) {
                if (typeof input === 'string') {
                    input = this.lang().weekdaysParse(input);
                    if (typeof input !== 'number') {
                        return this;
                    }
                }
                return this.add({ d : input - day });
            } else {
                return day;
            }
        },

        month : function (input) {
            var utc = this._isUTC ? 'UTC' : '';
            if (input != null) {
                if (typeof input === 'string') {
                    input = this.lang().monthsParse(input);
                    if (typeof input !== 'number') {
                        return this;
                    }
                }
                this._d['set' + utc + 'Month'](input);
                moment.updateOffset(this);
                return this;
            } else {
                return this._d['get' + utc + 'Month']();
            }
        },

        startOf: function (units) {
            units = normalizeUnits(units);
            // the following switch intentionally omits break keywords
            // to utilize falling through the cases.
            switch (units) {
            case 'year':
                this.month(0);
                /* falls through */
            case 'month':
                this.date(1);
                /* falls through */
            case 'week':
            case 'day':
                this.hours(0);
                /* falls through */
            case 'hour':
                this.minutes(0);
                /* falls through */
            case 'minute':
                this.seconds(0);
                /* falls through */
            case 'second':
                this.milliseconds(0);
                /* falls through */
            }

            // weeks are a special case
            if (units === 'week') {
                this.weekday(0);
            }

            return this;
        },

        endOf: function (units) {
            return this.startOf(units).add(units, 1).subtract('ms', 1);
        },

        isAfter: function (input, units) {
            units = typeof units !== 'undefined' ? units : 'millisecond';
            return +this.clone().startOf(units) > +moment(input).startOf(units);
        },

        isBefore: function (input, units) {
            units = typeof units !== 'undefined' ? units : 'millisecond';
            return +this.clone().startOf(units) < +moment(input).startOf(units);
        },

        isSame: function (input, units) {
            units = typeof units !== 'undefined' ? units : 'millisecond';
            return +this.clone().startOf(units) === +moment(input).startOf(units);
        },

        min: function (other) {
            other = moment.apply(null, arguments);
            return other < this ? this : other;
        },

        max: function (other) {
            other = moment.apply(null, arguments);
            return other > this ? this : other;
        },

        zone : function (input) {
            var offset = this._offset || 0;
            if (input != null) {
                if (typeof input === "string") {
                    input = timezoneMinutesFromString(input);
                }
                if (Math.abs(input) < 16) {
                    input = input * 60;
                }
                this._offset = input;
                this._isUTC = true;
                if (offset !== input) {
                    addOrSubtractDurationFromMoment(this, moment.duration(offset - input, 'm'), 1, true);
                }
            } else {
                return this._isUTC ? offset : this._d.getTimezoneOffset();
            }
            return this;
        },

        zoneAbbr : function () {
            return this._isUTC ? "UTC" : "";
        },

        zoneName : function () {
            return this._isUTC ? "Coordinated Universal Time" : "";
        },

        daysInMonth : function () {
            return moment.utc([this.year(), this.month() + 1, 0]).date();
        },

        dayOfYear : function (input) {
            var dayOfYear = round((moment(this).startOf('day') - moment(this).startOf('year')) / 864e5) + 1;
            return input == null ? dayOfYear : this.add("d", (input - dayOfYear));
        },

        weekYear : function (input) {
            var year = weekOfYear(this, this.lang()._week.dow, this.lang()._week.doy).year;
            return input == null ? year : this.add("y", (input - year));
        },

        isoWeekYear : function (input) {
            var year = weekOfYear(this, 1, 4).year;
            return input == null ? year : this.add("y", (input - year));
        },

        week : function (input) {
            var week = this.lang().week(this);
            return input == null ? week : this.add("d", (input - week) * 7);
        },

        isoWeek : function (input) {
            var week = weekOfYear(this, 1, 4).week;
            return input == null ? week : this.add("d", (input - week) * 7);
        },

        weekday : function (input) {
            var weekday = (this._d.getDay() + 7 - this.lang()._week.dow) % 7;
            return input == null ? weekday : this.add("d", input - weekday);
        },

        isoWeekday : function (input) {
            // iso weeks start on monday, which is 1, so we subtract 1 (and add
            // 7 for negative mod to work).
            var weekday = (this._d.getDay() + 6) % 7;
            return input == null ? weekday : this.add("d", input - weekday);
        },

        // If passed a language key, it will set the language for this
        // instance.  Otherwise, it will return the language configuration
        // variables for this instance.
        lang : function (key) {
            if (key === undefined) {
                return this._lang;
            } else {
                this._lang = getLangDefinition(key);
                return this;
            }
        }
    };

    // helper for adding shortcuts
    function makeGetterAndSetter(name, key) {
        moment.fn[name] = moment.fn[name + 's'] = function (input) {
            var utc = this._isUTC ? 'UTC' : '';
            if (input != null) {
                this._d['set' + utc + key](input);
                moment.updateOffset(this);
                return this;
            } else {
                return this._d['get' + utc + key]();
            }
        };
    }

    // loop through and add shortcuts (Month, Date, Hours, Minutes, Seconds, Milliseconds)
    for (i = 0; i < proxyGettersAndSetters.length; i ++) {
        makeGetterAndSetter(proxyGettersAndSetters[i].toLowerCase().replace(/s$/, ''), proxyGettersAndSetters[i]);
    }

    // add shortcut for year (uses different syntax than the getter/setter 'year' == 'FullYear')
    makeGetterAndSetter('year', 'FullYear');

    // add plural methods
    moment.fn.days = moment.fn.day;
    moment.fn.months = moment.fn.month;
    moment.fn.weeks = moment.fn.week;
    moment.fn.isoWeeks = moment.fn.isoWeek;

    // add aliased format methods
    moment.fn.toJSON = moment.fn.toISOString;

    /************************************
        Duration Prototype
    ************************************/


    moment.duration.fn = Duration.prototype = {
        weeks : function () {
            return absRound(this.days() / 7);
        },

        valueOf : function () {
            return this._milliseconds +
              this._days * 864e5 +
              (this._months % 12) * 2592e6 +
              ~~(this._months / 12) * 31536e6;
        },

        humanize : function (withSuffix) {
            var difference = +this,
                output = relativeTime(difference, !withSuffix, this.lang());

            if (withSuffix) {
                output = this.lang().pastFuture(difference, output);
            }

            return this.lang().postformat(output);
        },

        add : function (input, val) {
            // supports only 2.0-style add(1, 's') or add(moment)
            var dur = moment.duration(input, val);

            this._milliseconds += dur._milliseconds;
            this._days += dur._days;
            this._months += dur._months;

            return this;
        },

        subtract : function (input, val) {
            var dur = moment.duration(input, val);

            this._milliseconds -= dur._milliseconds;
            this._days -= dur._days;
            this._months -= dur._months;

            return this;
        },

        get : function (units) {
            units = normalizeUnits(units);
            return this[units.toLowerCase() + 's']();
        },

        as : function (units) {
            units = normalizeUnits(units);
            return this['as' + units.charAt(0).toUpperCase() + units.slice(1) + 's']();
        },

        lang : moment.fn.lang
    };

    function makeDurationGetter(name) {
        moment.duration.fn[name] = function () {
            return this._data[name];
        };
    }

    function makeDurationAsGetter(name, factor) {
        moment.duration.fn['as' + name] = function () {
            return +this / factor;
        };
    }

    for (i in unitMillisecondFactors) {
        if (unitMillisecondFactors.hasOwnProperty(i)) {
            makeDurationAsGetter(i, unitMillisecondFactors[i]);
            makeDurationGetter(i.toLowerCase());
        }
    }

    makeDurationAsGetter('Weeks', 6048e5);
    moment.duration.fn.asMonths = function () {
        return (+this - this.years() * 31536e6) / 2592e6 + this.years() * 12;
    };


    /************************************
        Default Lang
    ************************************/


    // Set default language, other languages will inherit from English.
    moment.lang('en', {
        ordinal : function (number) {
            var b = number % 10,
                output = (~~ (number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });


    /************************************
        Exposing Moment
    ************************************/


    // CommonJS module is defined
    if (hasModule) {
        module.exports = moment;
    }
    /*global ender:false */
    if (typeof ender === 'undefined') {
        // here, `this` means `window` in the browser, or `global` on the server
        // add `moment` as a global object via a string identifier,
        // for Closure Compiler "advanced" mode
        this['moment'] = moment;
    }
    /*global define:false */
    if (typeof define === "function" && define.amd) {
        define("moment", [], function () {
            return moment;
        });
    }
}).call(this);
// moment.js language configuration
// language : traditional chinese (zh-tw)
// author : Ben : https://github.com/ben-lin

moment.lang('zh-tw', {
    months : "一月_二月_三月_四月_五月_六月_七月_八月_九月_十月_十一月_十二月".split("_"),
    monthsShort : "1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月".split("_"),
    weekdays : "星期日_星期一_星期二_星期三_星期四_星期五_星期六".split("_"),
    weekdaysShort : "週日_週一_週二_週三_週四_週五_週六".split("_"),
    weekdaysMin : "日_一_二_三_四_五_六".split("_"),
    longDateFormat : {
        LT : "Ah點mm",
        L : "YYYY年MMMD日",
        LL : "YYYY年MMMD日",
        LLL : "YYYY年MMMD日LT",
        LLLL : "YYYY年MMMD日ddddLT",
        l : "YYYY年MMMD日",
        ll : "YYYY年MMMD日",
        lll : "YYYY年MMMD日LT",
        llll : "YYYY年MMMD日ddddLT"
    },
    meridiem : function (hour, minute, isLower) {
        if (hour < 9) {
            return "早上";
        } else if (hour < 11 && minute < 30) {
            return "上午";
        } else if (hour < 13 && minute < 30) {
            return "中午";
        } else if (hour < 18) {
            return "下午";
        } else {
            return "晚上";
        }
    },
    calendar : {
        sameDay : '[今天]LT',
        nextDay : '[明天]LT',
        nextWeek : '[下]ddddLT',
        lastDay : '[昨天]LT',
        lastWeek : '[上]ddddLT',
        sameElse : 'L'
    },
    ordinal : function (number, period) {
        switch (period) {
        case "d" :
        case "D" :
        case "DDD" :
            return number + "日";
        case "M" :
            return number + "月";
        case "w" :
        case "W" :
            return number + "週";
        default :
            return number;
        }
    },
    relativeTime : {
        future : "%s內",
        past : "%s前",
        s : "幾秒",
        m : "一分鐘",
        mm : "%d分鐘",
        h : "一小時",
        hh : "%d小時",
        d : "一天",
        dd : "%d天",
        M : "一個月",
        MM : "%d個月",
        y : "一年",
        yy : "%d年"
    }
});

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
