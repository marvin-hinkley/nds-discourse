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
MessageFormat.locale.zh_CN = function ( n ) {
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
    })({"topic.read_more_MF" : function(d){
var r = "";
r += "There ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "is <a href='/unread'>1 unread</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "are <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " unread</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["zh_CN"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "is ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>1 new</a> topic";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "are ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " new</a> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["zh_CN"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " remaining, or ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "browse other topics in ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
return r;
},
"false" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += " ";
return r;
}});I18n.translations = {"zh_CN":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"tiny":{"half_a_minute":"刚刚","less_than_x_seconds":{"one":"\u003C 1秒","other":"\u003C %{count}秒"},"x_seconds":{"one":"1秒","other":"%{count}秒"},"less_than_x_minutes":{"one":"\u003C 1分钟","other":"\u003C %{count}分钟"},"x_minutes":{"one":"1分钟","other":"%{count}分钟"},"about_x_hours":{"one":"1小时","other":"%{count}小时"},"x_days":{"one":"1天","other":"%{count}天"},"about_x_years":{"one":"1年","other":"%{count}年"},"over_x_years":{"one":"\u003E 1年","other":"\u003E %{count}年"},"almost_x_years":{"one":"1年","other":"%{count}年"}},"medium":{"x_minutes":{"one":"1分钟","other":"%{count}分钟"},"x_hours":{"one":"1小时","other":"%{count}小时"},"x_days":{"one":"1天","other":"%{count}天"}},"medium_with_ago":{"x_minutes":{"one":"1分钟前","other":"%{count}分钟前"},"x_hours":{"one":"1小时之前","other":"%{count}小时之前"},"x_days":{"one":"1天前","other":"%{count}天前"}}},"share":{"topic":"分享一个到本主题的链接","post":"分享一个到#%{postNumber}帖的链接","close":"关闭","twitter":"分享这个链接到 Twitter","facebook":"分享这个链接到 Facebook","google+":"分享这个链接到 Google+","email":"用电子邮件发送这个链接"},"edit":"编辑本主题的标题和分类","not_implemented":"非常抱歉，此功能暂时尚未实现！","no_value":"否","yes_value":"是","of_value":"/","generic_error":"抱歉，发生了一个错误。","generic_error_with_reason":"发生了一个错误：%{error}","log_in":"登录","age":"时间","last_post":"最后一帖","joined":"加入时间：","admin_title":"管理员","flags_title":"报告","show_more":"显示更多","links":"链接","faq":"常见问答（FAQ）","privacy_policy":"隐私政策","mobile_view":"移动视图","desktop_view":"桌面视图","you":"你","or":"或","now":"刚刚","read_more":"阅读更多","more":"更多","less":"更少","never":"从未","daily":"每天","weekly":"每周","every_two_weeks":"每两周","character_count":{"one":"{{count}} 个字符","other":"{{count}} 个字符"},"in_n_seconds":{"one":"一秒内","other":"{{count}}秒内"},"in_n_minutes":{"one":"一分钟内","other":"{{count}}分钟内"},"in_n_hours":{"one":"一小时内","other":"{{count}}小时内"},"in_n_days":{"one":"一天内","other":"{{count}}天内"},"suggested_topics":{"title":"推荐主题"},"bookmarks":{"not_logged_in":"抱歉，要给帖子加书签，你必须先登录。","created":"你给此帖的书签已加上。","not_bookmarked":"你已经阅读过此帖，点此给它加上书签。","last_read":"这是你阅读过的最后一帖。"},"new_topics_inserted":"{{count}} 个新主题。","show_new_topics":"点此显示。","preview":"预览","cancel":"取消","save":"保存修改","saving":"保存中……","saved":"已保存！","upload":"上传","uploading":"上传中……","uploaded":"上传完成！","choose_topic":{"none_found":"没有找到主题","title":{"search":"通过名称、URL或者ID，搜索主题：","placeholder":"在此输入主题标题"}},"user_action":{"user_posted_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E 发起 \u003Ca href='{{topicUrl}}'\u003E本主题\u003C/a\u003E","you_posted_topic":"\u003Ca href='{{userUrl}}'\u003E你\u003C/a\u003E 发起 \u003Ca href='{{topicUrl}}'\u003E本主题\u003C/a\u003E","user_replied_to_post":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E 回复 \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","you_replied_to_post":"\u003Ca href='{{userUrl}}'\u003E你\u003C/a\u003E 回复 \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","user_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E 回复 \u003Ca href='{{topicUrl}}'\u003E本主题\u003C/a\u003E","you_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003E你\u003C/a\u003E 回复 \u003Ca href='{{topicUrl}}'\u003E本主题\u003C/a\u003E","user_mentioned_user":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E 提到 \u003Ca href='{{user2Url}}'\u003E{{another_user}}\u003C/a\u003E","user_mentioned_you":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E 提到 \u003Ca href='{{user2Url}}'\u003E你\u003C/a\u003E","you_mentioned_user":"\u003Ca href='{{user1Url}}'\u003E你\u003C/a\u003E 提到 \u003Ca href='{{user2Url}}'\u003E{{user}}\u003C/a\u003E","posted_by_user":"发起人 \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","posted_by_you":"发起人 \u003Ca href='{{userUrl}}'\u003E你\u003C/a\u003E","sent_by_user":"发送人 \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","sent_by_you":"发送人 \u003Ca href='{{userUrl}}'\u003E你\u003C/a\u003E"},"user_action_groups":{"1":"给出的赞","2":"收到的赞","3":"书签","4":"主题","5":"回复","6":"回应","7":"提到","9":"引用","10":"喜爱","11":"编辑","12":"发送条目","13":"收件箱"},"categories":{"all":"所有分类","only_category":"只看{{categoryName}}","category":"分类","posts":"帖子","topics":"主题","latest":"最新","latest_by":"最新发表：","toggle_ordering":"排序控制","subcategories":"子分类："},"user":{"said":"{{username}} 说：","profile":"个人简介","show_profile":"访问个人简介","mute":"防打扰","edit":"修改参数","download_archive":"下载我的帖子的存档","private_message":"私信","private_messages":"消息","activity_stream":"活动","preferences":"设置","bio":"关于我","invited_by":"邀请者为","trust_level":"用户级别","notifications":"通知","dynamic_favicon":"在标签页图标上动态显示未读消息提醒","external_links_in_new_tab":"始终在新的标签页打开外部链接","enable_quoting":"在高亮选择文字时启用引用回复","change":"修改","moderator":"{{user}} 是版主","admin":"{{user}} 是管理员","deleted":"（已删除）","messages":{"all":"所有","mine":"我的","unread":"未读"},"change_password":{"success":"（电子邮件已发送）","in_progress":"（正在发送电子邮件）","error":"（错误）","action":"发送密码重置邮件"},"change_about":{"title":"更改个人简介"},"change_username":{"title":"修改用户名","confirm":"修改你的用户名可能会导致一些相关后果，你真的确定要这么做么？","taken":"抱歉此用户名已经有人使用了。","error":"在修改你的用户名时发生了错误。","invalid":"此用户名不合法，用户名只能包含字母和数字"},"change_email":{"title":"修改电子邮箱","taken":"抱歉此电子邮箱不可用。","error":"抱歉在修改你的电子邮箱时发生了错误，可能此邮箱已经被使用了？","success":"我们发送了一封确认信到此邮箱地址，请按照邮箱内指示完成确认。"},"change_avatar":{"title":"修改头像","gravatar":"\u003Ca href='//gravatar.com/emails' target='_blank'\u003EGravatar\u003C/a\u003E头像，基于：","gravatar_title":"修改你在Gravatar的头像","uploaded_avatar":"自定义图片","uploaded_avatar_empty":"添加自定义图片","upload_title":"上传图片","image_is_not_a_square":"注意：你的图片将被剪裁为正方形。"},"email":{"title":"电子邮箱","instructions":"你的电子邮箱绝不会公开给他人。","ok":"不错哦，我们会发送电子邮件让你确认。","invalid":"请填写正确的电子邮箱地址。","authenticated":"你的电子邮箱已经被 {{provider}} 确认有效。","frequency":"只有当你最近一段时间没有访问时，我们才会把你未读过的内容发送到你的电子邮箱。"},"name":{"title":"名字","instructions":"你的名字，不要求独一无二（可以与他人的名字重复）。用于在@name匹配你时参考，只在你的用户页面显示。","too_short":"你设置的名字太短了。","ok":"你的名字符合要求。"},"username":{"title":"用户名","instructions":"必须是独一无二的，中间不能有空格。其他人可以使用 @{{username}} 来提及你。","short_instructions":"其他人可以用 @{{username}} 来提及你。","available":"你的用户名可用。","global_match":"电子邮箱与注册用户名相匹配。","global_mismatch":"已被人注册。试试 {{suggestion}} ？","not_available":"不可用。试试 {{suggestion}} ？","too_short":"你设置的用户名太短了。","too_long":"你设置的用户名太长了。","checking":"查看用户名是否可用……","enter_email":"找到用户名，请输入对应电子邮箱。"},"password_confirmation":{"title":"请再次输入密码"},"last_posted":"最后一帖","last_emailed":"最后一次邮寄","last_seen":"最后一次见到","created":"创建时间","log_out":"登出","website":"网站","email_settings":"电子邮箱","email_digests":{"title":"当我不访问此站时，向我的邮箱发送最新摘要","daily":"每天","weekly":"每周","bi_weekly":"每两周"},"email_direct":"当有人引用你、回复你或提及你 @username 时发送一封邮件给你","email_private_messages":"当有人给你发私信时发送一封邮件给你","email_always":"即使在论坛中是活跃状态也接收电子邮件提醒和摘要","other_settings":"其它","new_topic_duration":{"label":"认为主题是新主题，当","not_viewed":"我还没有浏览它们","last_here":"它们是在我最近一次访问这里之后发表的","after_n_days":{"one":"它们是昨天发表的","other":"它们是之前 {{count}} 天发表的"},"after_n_weeks":{"one":"它们是上周发表的","other":"它们是之前 {{count}} 周发表的"}},"auto_track_topics":"自动追踪我进入的主题","auto_track_options":{"never":"从不","always":"始终","after_n_seconds":{"one":"1 秒之后","other":"{{count}} 秒之后"},"after_n_minutes":{"one":"1 分钟之后","other":"{{count}} 分钟之后"}},"invited":{"search":"输入以搜索邀请……","title":"邀请","user":"邀请用户","none":"没有找到任何邀请。","truncated":"只显示前{{count}}个邀请。","redeemed":"确认邀请","redeemed_at":"确认时间","pending":"待定邀请","topics_entered":"已进入的主题","posts_read_count":"已读的帖子","rescind":"删除邀请","rescinded":"邀请已删除","time_read":"阅读时间","days_visited":"访问天数","account_age_days":"账号存在天数","create":"邀请朋友"},"password":{"title":"密码","too_short":"你设置的密码太短了。","ok":"你设置的密码符合要求。"},"ip_address":{"title":"最后使用的IP地址"},"avatar":{"title":"头像"},"title":{"title":"头衔"},"filters":{"all":"全部"},"stream":{"posted_by":"发帖人","sent_by":"发送时间","private_message":"私信","the_topic":"本主题"}},"loading":"载入中……","close":"关闭","learn_more":"了解更多……","year":"年","year_desc":"365天以前发表的主题","month":"月","month_desc":"30天以前发表的主题","week":"周","week_desc":"7天以前发表的主题","first_post":"第一帖","mute":"防打扰","unmute":"解除防打扰","best_of":{"title":"优秀","enabled_description":"你现在正在浏览本主题的“优秀”视图。","description":"此主题中有 \u003Cb\u003E{{count}}\u003C/b\u003E 个帖子，是不是有点多哦！你愿意切换到只显示最多交互和回复的帖子视图么？","enable":"切换到“优秀”视图","disable":"取消“优秀”"},"private_message_info":{"title":"私下交流","invite":"邀请其他人……","remove_allowed_user":"是否将{{name}}从本条私信中移除？"},"email":"电子邮箱","username":"用户名","last_seen":"最后一次见到","created":"创建时间","trust_level":"用户级别","create_account":{"title":"创建帐号","action":"现在就创建一个！","invite":"还没有帐号吗？","failed":"出问题了，有可能这个电子邮箱已经被注册了。试试忘记密码链接"},"forgot_password":{"title":"忘记密码","action":"我忘记了我的密码","invite":"输入你的用户名和电子邮箱地址，我们会发送密码重置邮件给你。","reset":"重置密码","complete":"你很快会收到一封电子邮件，告诉你如何重置密码。"},"login":{"title":"登录","username":"登录","password":"密码","email_placeholder":"电子邮箱地址或用户名","error":"未知错误","reset_password":"重置密码","logging_in":"登录中……","or":"或","authenticating":"验证中……","awaiting_confirmation":"你的帐号尚未激活，点击忘记密码链接来重新发送激活邮件。","awaiting_approval":"你的帐号尚未被论坛版主批准。一旦你的帐号获得批准，你会收到一封电子邮件。","requires_invite":"抱歉，本论坛仅接受邀请注册。","not_activated":"你还不能登录。我们之前在\u003Cb\u003E{{sentTo}}\u003C/b\u003E发送了一封激活邮件给你。请按照邮件中的介绍来激活你的帐号。","resend_activation_email":"点击此处来重新发送激活邮件。","sent_activation_email_again":"我们在\u003Cb\u003E{{currentEmail}}\u003C/b\u003E又发送了一封激活邮件给你，邮件送达可能需要几分钟，有的电子邮箱服务商可能会认为此邮件为垃圾邮件，请检查一下你邮箱的垃圾邮件文件夹。","google":{"title":"使用Google帐号登录","message":"使用Google帐号验证登录（请确保没有禁止浏览器弹出对话框）"},"twitter":{"title":"使用Twitter帐号登录","message":"使用Twitter帐号验证登录（请确保没有禁止浏览器弹出对话框）"},"facebook":{"title":"使用Facebook帐号登录","message":"使用Facebook帐号验证登录（请确保没有禁止浏览器弹出对话框）"},"cas":{"title":"使用CAS登录","message":"使用CAS（单点登录）帐号验证登录（请确保没有禁止浏览器弹出对话框）"},"yahoo":{"title":"使用Yahoo帐号登录","message":"使用Yahoo帐号验证登录（请确保没有禁止浏览器弹出对话框）"},"github":{"title":"使用 GitHub 帐号登录","message":"使用 GitHub 帐号验证登录（请确保没有禁止浏览器弹出对话框）"},"persona":{"title":"使用 Persona 帐号登录","message":"使用 Mozilla Persona 帐号验证登录（请确保没有禁止浏览器弹出对话框）"}},"composer":{"posting_not_on_topic":"你正在回复主题 \"{{title}}\"，但是当前你正在浏览的是另外一个主题。","saving_draft_tip":"保存中","saved_draft_tip":"已保存","saved_local_draft_tip":"已本地保存","similar_topics":"你的主题与此有些类似...","drafts_offline":"离线草稿","min_length":{"need_more_for_title":"请给标题再输入至少 {{n}} 个字符","need_more_for_reply":"请给正文内容再输入至少 {{n}} 个字符"},"error":{"title_missing":"缺少标题。","title_too_short":"标题太短，至少{{min}}个字符。","title_too_long":"标题太长，至多{{max}}个字符。","post_missing":"内容不能为空。","post_length":"内容太少，至少{{min}}个字符。","category_missing":"必须要选择一个分类。"},"save_edit":"保存编辑","reply_original":"回复原始帖","reply_here":"在此回复","reply":"回复","cancel":"取消","create_topic":"创建主题","create_pm":"创建私信","users_placeholder":"添加一个用户","title_placeholder":"在此输入你的标题，简明扼要的用一句话说明讨论的内容。","reply_placeholder":"在此输入你的内容。你可以使用 Markdown（参考 http://wowubuntu.com/markdown/） 或 BBCode（参考 http://www.bbcode.org/reference.php） 来格式化内容。拖拽或粘贴一幅图片到这儿即可将它上传。","view_new_post":"浏览你的新帖子。","saving":"保存中……","saved":"已保存！","saved_draft":"你有一个帖子草稿尚发表。在框中任意处点击即可接着编辑。","uploading":"上传中……","show_preview":"显示预览 \u0026raquo;","hide_preview":"\u0026laquo; 隐藏预览","quote_post_title":"引用整个帖子","bold_title":"加粗","bold_text":"加粗文字","italic_title":"斜体","italic_text":"斜体文字","link_title":"链接","link_description":"在此输入链接描述","link_dialog_title":"插入链接","link_optional_text":"可选标题","quote_title":"引用","quote_text":"引用","code_title":"预格式化文本","code_text":"在此输入预格式化文本","upload_title":"图片","upload_description":"在此输入图片描述","olist_title":"数字列表","ulist_title":"符号列表","list_item":"列表条目","heading_title":"标题","heading_text":"标题头","hr_title":"分割线","undo_title":"撤销","redo_title":"重做","help":"Markdown 编辑帮助","toggler":"隐藏或显示编辑面板","admin_options_title":"本主题可选设置","auto_close_label":"自动关闭主题，过：","auto_close_units":"天"},"notifications":{"title":"使用 @name 提及到你，回复你的帖子和主题，私信等等的通知消息","none":"你当前没有任何通知。","more":"浏览以前的通知","mentioned":"\u003Cspan title='mentioned' class='icon'\u003E@\u003C/span\u003E {{username}} {{link}}","quoted":"\u003Ci title='quoted' class='icon icon-quote-right'\u003E\u003C/i\u003E {{username}} {{link}}","replied":"\u003Ci title='replied' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","posted":"\u003Ci title='replied' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","edited":"\u003Ci title='edited' class='icon icon-pencil'\u003E\u003C/i\u003E {{username}} {{link}}","liked":"\u003Ci title='liked' class='icon icon-heart'\u003E\u003C/i\u003E {{username}} {{link}}","private_message":"\u003Ci class='icon icon-envelope-alt' title='私信'\u003E\u003C/i\u003E {{username}} 发送给你一条私信：{{link}}","invited_to_private_message":"{{username}} 邀请你进行私下交流：{{link}}","invitee_accepted":"\u003Ci title='已接受你的邀请' class='icon icon-signin'\u003E\u003C/i\u003E {{username}} 已接受你的邀请","moved_post":"\u003Ci title='移动帖子' class='icon icon-arrow-right'\u003E\u003C/i\u003E {{username}} 移动了该帖： {{link}}","total_flagged":"被报告帖子的总数"},"upload_selector":{"title":"插入图片","title_with_attachments":"上传图片或文件","from_my_computer":"来自我的设备","from_the_web":"来自网络","remote_tip":"输入图片的网址，格式为：http://example.com/image.jpg","remote_tip_with_attachments":"输入图片或文件的网址，格式为：http://example.com/file.ext （支持的格式： {{authorized_extensions}}）。","local_tip":"点击从你的设备中选择一张图片。","local_tip_with_attachments":"点击从你的设备中选择图片或文件（支持的格式： {{authorized_extensions}}）。","hint":"（你也可以通过拖放至编辑器的方式来上传）","hint_for_chrome":"（你也可以通过拖放或复制粘帖至编辑器的方式来上传）","uploading":"上传图片中"},"search":{"title":"搜索主题、帖子、用户或分类","placeholder":"在此输入你的搜索条件","no_results":"没有找到结果。","searching":"搜索中……","prefer":{"user":"优先显示 @{{username}} 的搜索结果","category":"优先显示 {{category}} 分类下的结果"}},"site_map":"去另一个主题列表或分类","go_back":"返回","current_user":"去你的用户页面","favorite":{"title":"收藏","help":{"star":"将此主题加入你的收藏列表","unstar":"将此主题从你的收藏列表中移除"}},"topics":{"none":{"favorited":"你尚未收藏任何主题。要收藏一个主题，点击标题旁的星星图标。","unread":"你没有未阅主题。","new":"你没有新主题可读。","read":"你尚未阅读任何主题。","posted":"你尚未在任何主题中发帖。","latest":"伤心啊，没有主题。","hot":"没有热门主题。","category":"没有 {{category}} 分类的主题。"},"bottom":{"latest":"没有更多主题可看了。","hot":"没有更多热门主题可看了。","posted":"没有更多已发布主题可看了。","read":"没有更多已阅主题可看了。","new":"没有更多新主题可看了。","unread":"没有更多未阅主题可看了。","favorited":"没有更多收藏主题可看了。","category":"没有更多 {{category}} 分类的主题了。"}},"rank_details":{"toggle":"切换主题排名详细","show":"显示主题排名详细信息","title":"主题排名详细"},"topic":{"filter_to":"只显示本主题中由{{username}}发表的{{post_count}}个帖子","create":"创建主题","create_long":"创建一个新主题","private_message":"开启一段私下交流","list":"主题","new":"新主题","new_topics":{"one":"1个新主题","other":"{{count}}个新主题"},"unread_topics":{"one":"1个未读主题","other":"{{count}}个未读主题"},"title":"主题","loading_more":"载入更多主题中……","loading":"载入主题中……","invalid_access":{"title":"这是私密主题","description":"抱歉，你没有访问此主题的权限！"},"server_error":{"title":"载入主题失败","description":"抱歉，无法载入此主题。有可能是网络连接问题导致的，请重试。如果问题始终存在，请告诉我们。"},"not_found":{"title":"未找到主题","description":"抱歉，无法找到此主题。有可能它被论坛版主删掉了？"},"unread_posts":{"one":"此主题中你有一个帖子未阅","other":"此主题中你有 {{unread}} 个帖子未阅"},"new_posts":{"other":"从你最近一次阅读此主题后，又有 {{new_posts}} 个新帖子发表"},"likes":{"one":"此主题得到了一个赞","other":"此主题得到了 {{count}} 个赞"},"back_to_list":"返回主题列表","options":"主题选项","show_links":"显示此主题中的链接","toggle_information":"切换主题详细","read_more_in_category":"想阅读更多内容？浏览 {{catLink}} 或 {{latestLink}} 里的其它主题。","read_more":"想阅读更多内容？{{catLink}} 或 {{latestLink}}。","browse_all_categories":"浏览所有分类","view_latest_topics":"浏览热门主题","suggest_create_topic":"这就创建一个主题吧！","read_position_reset":"你的阅读位置已经被重置。","jump_reply_up":"跳转至更早的回复","jump_reply_down":"跳转至更晚的回复","deleted":"此主题已被删除","auto_close_notice":"本主题将在%{timeLeft}后自动关闭","auto_close_title":"自动关闭设置","auto_close_save":"保存","auto_close_remove":"不要自动关闭该主题","progress":{"title":"主题进度","jump_top":"跳转到第一帖","jump_bottom":"跳转到最后一帖","total":"全部帖子","current":"当前帖"},"notifications":{"title":"","reasons":{"3_2":"因为你在关注此主题，所以你将收到相关通知。","3_1":"因为你创建了此主题，所以你将收到相关通知。","3":"因为你在关注此主题，所以你将收到相关通知。","2_4":"因为你在此主题内发表了回复，所以你将收到相关通知。","2_2":"因为你在追踪此主题，所以你将收到相关通知。","2":"因为你\u003Ca href=\"/users/{{username}}/preferences\"\u003E阅读了此主题\u003C/a\u003E，所以你将收到相关通知。","1":"因为有人 @name 提及了你或回复了你的帖子，所以你将收到相关通知。","1_2":"仅当有人 @name 提及了你或回复了你的帖子，你才会收到相关通知。","0":"你将忽略关于此主题的所有通知。","0_2":"你将忽略关于此主题的所有通知。"},"watching":{"title":"关注","description":"与追踪一样，额外的是一旦有新帖子发表，你都会收到通知。"},"tracking":{"title":"追踪","description":"关于你的未阅帖子、@name 提及与对你的帖子的回复，你都会收到通知。"},"regular":{"title":"常规","description":"只有当有人 @name 提及你或者回复你的帖子时，你才会收到通知。"},"muted":{"title":"防打扰","description":"你不会收到关于此主题的任何通知，也不会在你的未阅选项卡中显示。"}},"actions":{"recover":"撤销删除主题","delete":"删除主题","open":"打开主题","close":"关闭主题","auto_close":"自动关闭","unpin":"解除主题置顶","pin":"置顶主题","unarchive":"解除主题存档","archive":"存档主题","invisible":"使不可见","visible":"使可见","reset_read":"重置阅读数据","multi_select":"选择将被合并/拆分的帖子","convert_to_topic":"转换到常规主题"},"reply":{"title":"回复","help":"开始给本主题撰写回复"},"clear_pin":{"title":"清除置顶","help":"将本主题的置顶状态清除，这样它将不再始终显示在主题列表顶部"},"share":{"title":"分享","help":"分享一个到本帖的链接"},"inviting":"邀请中……","invite_private":{"title":"邀请进行私下交流","email_or_username":"受邀人的电子邮箱或用户名","email_or_username_placeholder":"电子邮箱地址或用户名","action":"邀请","success":"谢谢！我们已经邀请该用户参与此私下交流。","error":"抱歉，在邀请该用户时发生了错误。"},"invite_reply":{"title":"邀请朋友来回复","action":"邮件邀请","help":"向你的朋友发送邀请，他们只需要一个点击就能回复这个主题","to_topic":"我们会给你的朋友发送一封邮件，他/她只需点击其中的一个链接，就可以无需登录直接回复这个主题。","to_forum":"我们会给你的朋友发送一封邮件，他/她只需点击其中的链接，就可以注册加入这个论坛。","email_placeholder":"电子邮箱地址","success":"谢谢！我们已发送一个邀请邮件到\u003Cb\u003E{{email}}\u003C/b\u003E。当他们确认的时候我们会通知你。你也可以在你的用户页面的邀请选项卡下查看邀请状态。","error":"抱歉，我们不能邀请此人，可能他/她已经是本站用户了？"},"login_reply":"登录后回复","filters":{"user":"你在浏览 {{n_posts}} {{by_n_users}}.","n_posts":{"one":"一个帖子","other":"{{count}} 帖子"},"by_n_users":{"one":"一个指定用户","other":"{{count}} 个用户中的"},"best_of":"你在浏览 {{n_best_posts}} {{of_n_posts}}.","n_best_posts":{"one":"一个优秀帖子","other":"{{count}} 优秀帖子"},"of_n_posts":{"one":"一个帖子中的","other":"{{count}} 个帖子中的"},"cancel":"再次显示本主题下的所有帖子。"},"split_topic":{"title":"拆分主题","action":"拆分主题","topic_name":"新主题名","error":"拆分主题时发生错误。","instructions":{"one":"你想如何移动该帖？","other":"你想如何移动你所选择的这{{count}}篇帖子？"}},"merge_topic":{"title":"合并主题","action":"合并主题","error":"合并主题时发生错误。","instructions":{"one":"请选择你想将那篇帖子移至其下的主题。","other":"请选择你想将那{{count}}篇帖子移至其下的主题。"}},"multi_select":{"select":"选择","selected":"已选择（{{count}}）","select_replies":"选择并回复","delete":"删除所选","cancel":"取消选择","description":{"one":"你已选择了\u003Cb\u003E一个\u003C/b\u003E帖子。","other":"你已选择了\u003Cb\u003E{{count}}\u003C/b\u003E个帖子。"}}},"post":{"reply":"回复 {{replyAvatar}} {{username}} 发表的 {{link}}","reply_topic":"回复 {{link}}","quote_reply":"引用回复","edit":"编辑 {{link}}","post_number":"帖子 {{number}}","in_reply_to":"回复给","last_edited_on":"最后修改于","reply_as_new_topic":"回复为新主题","continue_discussion":"从 {{postLink}} 继续讨论：","follow_quote":"跳转至所引用的帖子","deleted_by_author":{"one":"(该帖已被作者撤销，如无报告则将在 %{count} 小时后自动被删除。)","other":"(该帖已被作者撤销，如无报告则将在 %{count} 小时后自动被删除。)"},"deleted_by":"删除者为","expand_collapse":"展开/收缩","has_replies":{"one":"回复","other":"回复"},"errors":{"create":"抱歉，在创建你的帖子时发生了错误。请重试。","edit":"抱歉，在编辑你的帖子时发生了错误。请重试。","upload":"抱歉，在上传文件时发生了错误。请重试。","attachment_too_large":"抱歉，你上传的附件太大了（最大不能超过 {{max_size_kb}}kb）。","image_too_large":"抱歉，你上传的图片太大了（最大不能超过 {{max_size_kb}}kb），请调整文件大小后重新上传。","too_many_uploads":"抱歉, 你只能一次上传一张图片。","upload_not_authorized":"抱歉, 你不能上传此类型文件（可上传的文件类型有: {{authorized_extensions}}）。","image_upload_not_allowed_for_new_user":"抱歉，新注册用户无法上传图片。","attachment_upload_not_allowed_for_new_user":"抱歉，新注册用户无法上传附件。"},"abandon":"你确定要丢弃你的帖子吗？","archetypes":{"save":"保存选项"},"controls":{"reply":"开始给本帖撰写回复","like":"赞本帖","edit":"编辑本帖","flag":"报告本帖以提醒论坛版主","delete":"删除本帖","undelete":"恢复本帖","share":"分享一个到本帖的链接","more":"更多","delete_replies":{"confirm":{"one":"是否同时删除该帖的1条回复？","other":"是否同时删除该帖的{{count}}条回复？"},"yes_value":"是，删除回复","no_value":"否，仅删除该帖"}},"actions":{"flag":"报告","clear_flags":{"one":"清除报告","other":"清除报告"},"it_too":{"off_topic":"也报告","spam":"也报告","inappropriate":"也报告","custom_flag":"也报告","bookmark":"也做书签","like":"也赞它","vote":"也对它投票"},"undo":{"off_topic":"撤销报告","spam":"撤销报告","inappropriate":"撤销报告","bookmark":"撤销书签","like":"撤销赞","vote":"撤销投票"},"people":{"off_topic":"{{icons}} 报告它偏离主题","spam":"{{icons}} 报告它为垃圾信息","inappropriate":"{{icons}} 报告它为不当内容","notify_moderators":"{{icons}} 向版主报告它","notify_moderators_with_url":"{{icons}} \u003Ca href='{{postUrl}}'\u003E通知了版主\u003C/a\u003E","notify_user":"{{icons}} 发起了一个私下交流","notify_user_with_url":"{{icons}} 发送了一条\u003Ca href='{{postUrl}}'\u003E私有消息\u003C/a\u003E","bookmark":"{{icons}} 对它做了书签","like":"{{icons}} 赞了它","vote":"{{icons}} 对它投票"},"by_you":{"off_topic":"你报告它偏离主题","spam":"你报告它为垃圾信息","inappropriate":"你报告它为不当内容","notify_moderators":"你向版主报告了它","notify_user":"你对该用户发起了一个私下交流","bookmark":"你对该帖做了书签","like":"你赞了它","vote":"你对该帖投了票"},"by_you_and_others":{"off_topic":{"one":"你和另一个用户报告它偏离主题","other":"你和其他 {{count}} 个用户报告它偏离主题"},"spam":{"one":"你和另一个用户报告它为垃圾信息","other":"你和其他 {{count}} 个用户报告它为垃圾信息"},"inappropriate":{"one":"你和另一个用户报告它为不当内容","other":"你和其他 {{count}} 个用户报告它为不当内容"},"notify_moderators":{"one":"你和另一个用户向版主报告了它","other":"你和其他 {{count}} 个用户向版主报告了它"},"notify_user":{"one":"你和另一个用户对该用户发起了一个私下交流","other":"你和其他 {{count}} 个用户对该用户发起了一个私下交流"},"bookmark":{"one":"你和另一个用户对该帖做了书签","other":"你和其他 {{count}} 个用户对该帖做了书签"},"like":{"one":"你和另一个用户赞了它","other":"你和其他 {{count}} 个用户赞了它"},"vote":{"one":"你和另一个用户对该帖投了票","other":"你和其他 {{count}} 个用户对该帖投了票"}},"by_others":{"off_topic":{"one":"一个用户报告它偏离主题","other":"{{count}} 个用户报告它偏离主题"},"spam":{"one":"一个用户报告它为垃圾信息","other":"{{count}} 个用户报告它为垃圾信息"},"inappropriate":{"one":"一个用户报告它为不当内容","other":"{{count}} 个用户报告它为不当内容"},"notify_moderators":{"one":"一个用户向版主报告了它","other":"{{count}} 个用户向版主报告了它"},"notify_user":{"one":"一个用户对该用户发起了一个私下交流","other":"{{count}} 个用户对该用户发起了一个私下交流"},"bookmark":{"one":"一个用户对该帖做了书签","other":"{{count}} 个用户对该帖做了书签"},"like":{"one":"一个用户赞了它","other":"{{count}} 个用户赞了它"},"vote":{"one":"一个用户对该帖投了票","other":"{{count}} 个用户对该帖投了票"}}},"edits":{"one":"一次编辑","other":"{{count}}次编辑","zero":"未编辑"},"delete":{"confirm":{"one":"你确定要删除此帖吗？","other":"你确定要删除这些帖子吗？"}}},"category":{"can":"能够","none":"（未分类）","choose":"选择分类……","edit":"编辑","edit_long":"编辑分类","view":"浏览分类下的主题","general":"通常","settings":"设置","delete":"删除分类","create":"创建分类","save":"保存分类","creation_error":"创建此分类时发生了错误。","save_error":"在保存此分类时发生了错误。","more_posts":"浏览全部 {{posts}} ……","name":"分类名称","description":"描述","topic":"分类主题","badge_colors":"徽章颜色","background_color":"背景色","foreground_color":"前景色","name_placeholder":"应该简明扼要。","color_placeholder":"任何网络色彩","delete_confirm":"你确定要删除此分类吗？","delete_error":"在删除此分类时发生了错误。","list":"列出分类","no_description":"本分类没有描述信息。","change_in_category_topic":"访问分类主题来编辑描述信息","hotness":"热度","already_used":"此色彩已经被另一个分类使用","security":"安全","auto_close_label":"自动关闭主题，过：","edit_permissions":"编辑权限","add_permission":"添加权限","this_year":"今年","position":"位置","parent":"上级分类"},"flagging":{"title":"为何要报告本帖？","action":"报告帖子","take_action":"立即执行","notify_action":"通知","delete_spammer":"删除垃圾发布者","delete_confirm":"你将删除该用户的 \u003Cb\u003E%{posts}\u003C/b\u003E 个帖子和 \u003Cb\u003E%{topics}\u003C/b\u003E 个主题，删除该账户，阻止其IP地址 \u003Cb\u003E%{ip_address}\u003C/b\u003E 再次注册，并将其邮件地址 \u003Cb\u003E%{email}\u003C/b\u003E 加入黑名单。确定吗？","yes_delete_spammer":"确定","cant":"抱歉，当前你不能报告本帖。","custom_placeholder_notify_user":"为何你要私下联系该用户？","custom_placeholder_notify_moderators":"为何本帖需要论坛版主的关注？为何本帖需要论坛版主的关注？","custom_message":{"at_least":"输入至少 {{n}} 个字符","more":"还差 {{n}} 个……","left":"还剩下 {{n}}"}},"topic_summary":{"title":"主题概要","links_shown":"显示所有 {{totalLinks}} 个链接……","clicks":"点击","topic_link":"主题链接"},"topic_statuses":{"locked":{"help":"本主题已关闭，不再接受新的回复"},"pinned":{"help":"本主题已置顶，它将始终显示在它所属分类的顶部"},"archived":{"help":"本主题已归档，即已经冻结，无法修改"},"invisible":{"help":"本主题不可见，它将不被显示在主题列表中，只能通过一个直接链接来访问"}},"posts":"帖子","posts_long":"本主题有 {{number}} 个帖子","original_post":"原始帖","views":"浏览","replies":"回复","views_long":"本主题已经被浏览过 {{number}} 次","activity":"活动","likes":"赞","likes_long":"本主题已有 {{number}} 次赞","top_contributors":"参与者","category_title":"分类","history":"历史","changed_by":"由 {{author}}","categories_list":"分类列表","filters":{"latest":{"title":"最新","help":"最新发布的帖子"},"hot":{"title":"热门","help":"最近最受欢迎的主题"},"favorited":{"title":"收藏","help":"你收藏的主题"},"read":{"title":"已阅","help":"你已经阅读过的主题"},"categories":{"title":"分类","title_in":"分类 - {{categoryName}}","help":"归属于不同分类的所有主题"},"unread":{"title":{"zero":"未阅","one":"1个未阅主题","other":"{{count}}个未阅主题"},"help":"追踪的主题中有未阅帖子的主题"},"new":{"title":{"zero":"新主题","one":"新主题（1）","other":"新主题（{{count}}）"},"help":"你最近一次访问后的新主题，以及你追踪的主题中有新帖子的主题"},"posted":{"title":"我的帖子","help":"你发表过帖子的主题"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}}（1）","other":"{{categoryName}}（{{count}}）"},"help":"在 {{categoryName}} 分类中热门的主题"}},"browser_update":"抱歉, \u003Ca href=\"http://www.iteriter.com/faq/#browser\"\u003E你的浏览器版本太低，推荐使用Chrome\u003C/a\u003E. 请 \u003Ca href=\"http://www.google.com/chrome/\"\u003E升级你的浏览器\u003C/a\u003E。","permission_types":{"full":"阅读，创建帖子和主题","create_post":"阅读和创建帖子","readonly":"只读"},"type_to_filter":"输入过滤条件……","admin":{"title":"Discourse管理","moderator":"版主","dashboard":{"title":"管理面板","last_updated":"最近更新于：","version":"安装的版本","up_to_date":"你正在运行最新的论坛版本。","critical_available":"有一个关键更新可用。","updates_available":"目前有可用更新。","please_upgrade":"请升级！","no_check_performed":"检测更新未执行，请确保 sidekiq 在正常运行。","stale_data":"最近一次检查更新未执行，请确保 sidekiq 在正常运行。","version_check_pending":"看来你最近刚更新过。太棒了！","installed_version":"已安装","latest_version":"最新版本","problems_found":"你安装的论坛目前有以下问题：","last_checked":"上次检查","refresh_problems":"刷新","no_problems":"找不到问题.","moderators":"版主：","admins":"管理员：","blocked":"禁止参与讨论:","suspended":"禁止登录","private_messages_short":"私信","private_messages_title":"私密信息","reports":{"today":"今天","yesterday":"昨天","last_7_days":"7 天以内","last_30_days":"30 天以内","all_time":"所有时间内","7_days_ago":"7 天之前","30_days_ago":"30 天之前","all":"全部","view_table":"以表格展示","view_chart":"以柱状图展示"}},"commits":{"latest_changes":"最后的改动: 请经常升级！","by":"来自"},"flags":{"title":"报告","old":"过去的","active":"活跃的","agree_hide":"批准（隐藏并发送私信）","agree_hide_title":"隐藏帖子并自动发送私信给作者使其修改","defer":"推迟","defer_title":"现在不执行任何操作，对此帖子报告的操作推迟到晚些时候甚至永远","delete_post":"删除帖子","delete_post_title":"删除此帖，如果这是这个主题内的第一篇帖子则删除主题","disagree_unhide":"不批准（不隐藏）","disagree_unhide_title":"清除此帖的任何报告，并使其重新可见","disagree":"不批准","disagree_title":"不批准此帖的报告，并清除此贴的任何报告","delete_spammer_title":"删除该用户及其所有帖子和主题。","flagged_by":"报告者为","error":"出错了","view_message":"查看消息","no_results":"没有报告","summary":{"action_type_3":{"one":"题外话","other":"题外话 x{{count}}"},"action_type_4":{"one":"不当内容","other":"不当内容 x{{count}}"},"action_type_6":{"one":"自定义","other":"自定义 x{{count}}"},"action_type_7":{"one":"自定义","other":"自定义 x{{count}}"},"action_type_8":{"one":"垃圾","other":"垃圾 x{{count}}"}}},"groups":{"title":"群组","edit":"编辑群组","selector_placeholder":"添加用户","name_placeholder":"组名，不能含有空格，与用户名规则一致","about":"在这里编辑群组的名字和成员","can_not_edit_automatic":"这是一个自动划分的群组，管理员用来分配角色和管理用户等级","delete":"删除","delete_confirm":"删除这个小组吗？","delete_failed":"无法删除小组。如果该小组是自动生成的，则不可删除。"},"api":{"generate_master":"生成主API密钥","none":"当前没有活动的API密钥。","user":"用户","title":"应用开发接口（API）","key":"API密钥","generate":"生成","regenerate":"重新生成","revoke":"撤销","confirm_regen":"确定要用新的API密钥替代该密钥？","confirm_revoke":"确定要撤销该密钥？","info_html":"API密钥可以用来通过JSON调用创建和更新主题。","all_users":"所有用户","note_html":"请\u003Cstrong\u003E安全地\u003C/strong\u003E保管好本密钥，任何拥有该密钥的用户可以使用它以论坛任何用户的名义来发帖。"},"customize":{"title":"定制","long_title":"站点定制","header":"头部","css":"层叠样式表（CSS）","mobile_header":"移动版Header","mobile_css":"移动版样式表","override_default":"覆盖缺省值？","enabled":"启用？","preview":"预览","undo_preview":"撤销预览","save":"保存","new":"新建","new_style":"新样式","delete":"删除","delete_confirm":"删除本定制内容？","about":"站点定制允许你修改样式表和站点头部。选择或者添加一个来开始编辑。"},"email":{"title":"电子邮件","settings":"设置","logs":"日志","sent_at":"发送时间","user":"用户","email_type":"邮件类型","to_address":"目的地址","test_email_address":"测试电子邮件地址","send_test":"发送测试电子邮件","sent_test":"已发送！","delivery_method":"发送方式","preview_digest":"预览","preview_digest_desc":"以下是摘要邮件内容的预览。","refresh":"刷新","format":"格式","html":"html","text":"text","last_seen_user":"用户最后登录时间:","reply_key":"回复关键字"},"logs":{"title":"日志","action":"操作","created_at":"创建","last_match_at":"最近匹配","match_count":"匹配","ip_address":"IP","delete":"删除","edit":"编辑","save":"保存","screened_actions":{"block":"阻挡","do_nothing":"无操作"},"staff_actions":{"title":"管理人员操作","instructions":"点击用户名和操作可以过滤列表。点击头像可以访问用户个人页面。","clear_filters":"显示全部","staff_user":"管理人员","target_user":"目标用户","subject":"主题","when":"时间","context":"环境","details":"详情","previous_value":"之前","new_value":"新建","diff":"差别","show":"显示","modal_title":"详情","no_previous":"没有之前的值。","deleted":"没有新的值。记录被删除。","actions":{"delete_user":"删除用户","change_trust_level":"更改信任等级","change_site_setting":"更改站点设置","change_site_customization":"更改站点自定义","delete_site_customization":"删除站点自定义","ban_user":"禁止用户","unban_user":"解禁用户"}},"screened_emails":{"title":"被屏蔽的邮件地址","description":"当有人试图用以下邮件地址注册时，将受到阻止或其它系统操作。","email":"邮件地址"},"screened_urls":{"title":"被屏蔽的URL","description":"以下是垃圾信息发布者使用过的URL。","url":"URL","domain":"域名"},"screened_ips":{"title":"被屏蔽的IP","description":"受监视的IP地址，使用“放行”可将IP地址加入白名单。","delete_confirm":"确定要撤销对IP地址为 %{ip_address} 的规则？","actions":{"block":"阻挡","do_nothing":"放行"},"form":{"label":"新：","ip_address":"IP地址","add":"添加"}}},"impersonate":{"title":"假冒用户","username_or_email":"用户名或用户电子邮件","help":"使用此工具来假冒一个用户帐号以方便调试。","not_found":"无法找到该用户。","invalid":"抱歉，你不能假冒该用户。"},"users":{"title":"用户","create":"添加管理员用户","last_emailed":"最后一次邮寄","not_found":"抱歉，在我们的系统中此用户名不存在。","active":"活跃","nav":{"new":"新建","active":"活跃","pending":"待定","admins":"管理员","moderators":"版主","suspended":"禁止登录","blocked":"禁止参与讨论"},"approved":"已批准？","approved_selected":{"one":"批准用户","other":"批准用户（{{count}}）"},"reject_selected":{"one":"拒绝用户","other":"拒绝用户 ({{count}})"},"titles":{"active":"活动用户","new":"新用户","pending":"等待审核用户","newuser":"信用等级为0的用户（新用户）","basic":"信用等级为1的用户（基本用户）","regular":"信用等级为2的用户（常访问用户）","leader":"信用等级为3的用户（高级用户）","elder":"信用等级为4的用户（骨灰用户）","admins":"管理员","moderators":"版主","blocked":"被封用户","suspended":"被禁用户"},"reject_successful":{"one":"1名用户已被拒绝。","other":"%{count}名用户已被拒绝。"},"reject_failures":{"one":"1名用户拒绝失败。","other":"%{count}名用户决绝失败。"}},"user":{"suspend_failed":"禁止此用户时发生了错误 {{error}}","unsuspend_failed":"解禁此用户时发生了错误 {{error}}","suspend_duration":"你计划禁止该用户多久？","ban_duration_units":"（天）","ban_reason_label":"为什么禁止该用户？当其尝试登入时，会看到这条理由。","ban_reason":"禁止的理由","banned_by":"禁止操作者：","delete_all_posts":"删除所有帖子","delete_all_posts_confirm":"你将删除 %{posts} 个帖子和 %{topics} 个主题，确认吗？","suspend":"禁止","unsuspend":"解禁","suspended":"已禁止？","moderator":"版主？","admin":"管理员？","blocked":"已封?","show_admin_profile":"管理员","edit_title":"编辑头衔","save_title":"保存头衔","refresh_browsers":"强制浏览器刷新","show_public_profile":"显示公开介绍","impersonate":"假冒用户","revoke_admin":"吊销管理员资格","grant_admin":"赋予管理员资格","revoke_moderation":"吊销论坛版主资格","grant_moderation":"赋予论坛版主资格","unblock":"解封","block":"封号","reputation":"声誉","permissions":"权限","activity":"活动","like_count":"收到的赞","private_topics_count":"私有主题数量","posts_read_count":"已阅帖子数量","post_count":"创建的帖子数量","topics_entered":"进入的主题数量","flags_given_count":"所做报告数量","flags_received_count":"收到报告数量","approve":"批准","approved_by":"批准人","approve_success":"用户已被批准， 激活邮件已发送。","approve_bulk_success":"成功！所有选定的用户已批准并通知。","time_read":"阅读次数","delete":"删除用户","delete_forbidden":{"one":"用户已注册 %{count} 天或已有发帖后，则无法被删除。请先删除该用户的所有发帖后再试。","other":"用户已注册 %{count} 天或已有发帖后，则无法被删除。请先删除该用户的所有发帖后再试。"},"delete_confirm":"你确定要永久地从本站删除此用户？该操作无法撤销！","delete_and_block":"\u003Cb\u003E确定\u003C/b\u003E，并\u003Cb\u003E阻止\u003C/b\u003E该邮件地址和IP地址再次注册。","delete_dont_block":"\u003Cb\u003E确定\u003C/b\u003E，但\u003Cb\u003E允许\u003C/b\u003E该邮件地址和IP地址再次注册。","deleted":"该用户已被删除。","delete_failed":"在删除用户时发生了错误。请确保删除该用户前删除了该用户的所有帖子。","send_activation_email":"发送激活邮件","activation_email_sent":"激活邮件已发送。","send_activation_email_failed":"在发送激活邮件时发生了错误。","activate":"激活帐号","activate_failed":"在激活用户帐号时发生了错误。","deactivate_account":"停用帐号","deactivate_failed":"在停用用户帐号时发生了错误。","unblock_failed":"在解除用户帐号封禁时发生了错误。","block_failed":"在封禁用户帐号时发生了错误。","deactivate_explanation":"已停用的用户必须重新验证他们的电子邮件。","banned_explanation":"被禁止的用户无法登录。","block_explanation":"被封禁的用户不能发表主题或者评论。","trust_level_change_failed":"改变用户等级时出现了一个问题。","ban_modal_title":"禁止用户"},"site_content":{"none":"选择内容类型以开始编辑。","title":"内容","edit":"编辑站点内容"},"site_settings":{"show_overriden":"只显示被覆盖了缺省值的","title":"设置","reset":"重置为缺省值","none":"无"}}}}};
I18n.locale = 'zh_CN';
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
// language : chinese
// author : suupic : https://github.com/suupic

moment.lang('zh-cn', {
    months : "一月_二月_三月_四月_五月_六月_七月_八月_九月_十月_十一月_十二月".split("_"),
    monthsShort : "1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月".split("_"),
    weekdays : "星期日_星期一_星期二_星期三_星期四_星期五_星期六".split("_"),
    weekdaysShort : "周日_周一_周二_周三_周四_周五_周六".split("_"),
    weekdaysMin : "日_一_二_三_四_五_六".split("_"),
    longDateFormat : {
        LT : "Ah点mm",
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
            return number + "周";
        default :
            return number;
        }
    },
    relativeTime : {
        future : "%s内",
        past : "%s前",
        s : "几秒",
        m : "1分钟",
        mm : "%d分钟",
        h : "1小时",
        hh : "%d小时",
        d : "1天",
        dd : "%d天",
        M : "1个月",
        MM : "%d个月",
        y : "1年",
        yy : "%d年"
    }
});

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
