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
MessageFormat.locale.ko = function ( n ) {
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
r += "is <a href='/unread'>1 안읽음</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "are <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 안읽음</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += " <a href='/new'>1 새로운</a> topic";
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
})() + " 새로운</a> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
}});I18n.translations = {"ko":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"tiny":{"half_a_minute":"\u003C1분","less_than_x_seconds":{"one":"\u003C 1초","other":"\u003C %{count}초"},"x_seconds":{"one":"1초","other":"%{count}초"},"less_than_x_minutes":{"one":"\u003C 1분","other":"\u003C %{count}분"},"x_minutes":{"one":"1분","other":"%{count}분"},"about_x_hours":{"one":"약 1시간","other":"약 %{count}시간"},"x_days":{"one":"1일","other":"%{count}일"},"about_x_years":{"one":"약 1년","other":"약 %{count}년"},"over_x_years":{"one":"\u003E 1년","other":"\u003E %{count}년"},"almost_x_years":{"one":"거의 1년","other":"거의 %{count}년"}},"medium":{"x_minutes":{"one":"1분","other":"%{count}분"},"x_hours":{"one":"1시간","other":"%{count}시간"},"x_days":{"one":"1일","other":"%{count}일"}},"medium_with_ago":{"x_minutes":{"one":"1분전","other":"%{count}분전"},"x_hours":{"one":"1시간전","other":"%{count}시간전"},"x_days":{"one":"1일전","other":"%{count}일전"}}},"share":{"topic":"토픽를 공유합니다.","post":"#%{postNumber} 게시물을 공유합니다.","close":"닫기","twitter":"twitter로 공유","facebook":"Facebook으로 공유","google+":"Google+로 공유","email":"이메일로 공유"},"edit":"제목과 카테고리를 편집하기","not_implemented":"추후 업데이트 예정","no_value":"아니오","yes_value":"예","of_value":"으로","generic_error":"오류 발생","generic_error_with_reason":"에러 발견: %{error} ","log_in":"로그인","age":"나이","last_post":"최근 게시물","joined":"가입함","admin_title":"운영자","flags_title":"관심","show_more":"더 보기","links":"링크","faq":"FAQ","privacy_policy":"개인보호 정책","mobile_view":"모바일로 보기","desktop_view":"PC로 보기","you":"당신","or":"또는","now":"지금","read_more":"더 읽기","more":"더 보기","less":"덜","never":"전혀","daily":"매일","weekly":"매주","every_two_weeks":"격주","character_count":{"other":"{{count}} 자"},"in_n_seconds":{"one":"1 초 안에","other":"{{count}} 초 안에"},"in_n_minutes":{"one":"1 분 안에","other":"{{count}} 분 안에"},"in_n_hours":{"one":"1 시간 안에","other":"{{count}} 시간 안에"},"in_n_days":{"one":"1 일 안에","other":"{{count}} 일 안에"},"suggested_topics":{"title":"추천 토픽"},"bookmarks":{"not_logged_in":"죄송합니다. 북마크 된 게시물을 보려면 로그인을 해야합니다.","created":"이 게시물을 북마크 했습니다.","not_bookmarked":"이 게시물을 읽었습니다. 북마크를 클릭하세요.","last_read":"이것이 당신이 읽은 마지막 게시물 입니다. 북마크를 클릭하세요."},"new_topics_inserted":"{{count}} 개 토픽.","show_new_topics":"표시하려면 클릭하세요.","preview":"미리보기","cancel":"취소","save":"변경사항을 저장","saving":"저장중...","saved":"저장완료!","upload":"업로드","uploading":"업로드중...","uploaded":"업로드 완료!","choose_topic":{"none_found":"토픽가 없음.","title":{"search":"이름, url, ID로 토픽 검색","placeholder":"여기에 토픽 제목을 입력"}},"user_action":{"user_posted_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E 게시 \u003Ca href='{{topicUrl}}'\u003Ethe topic\u003C/a\u003E","you_posted_topic":"\u003Ca href='{{userUrl}}'\u003EYou\u003C/a\u003E 게시 \u003Ca href='{{topicUrl}}'\u003Ethe topic\u003C/a\u003E","user_replied_to_post":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E 답글 to \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","you_replied_to_post":"\u003Ca href='{{userUrl}}'\u003EYou\u003C/a\u003E 답글 \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","user_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E 답글 \u003Ca href='{{topicUrl}}'\u003Ethe topic\u003C/a\u003E","you_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003EYou\u003C/a\u003E 답글 \u003Ca href='{{topicUrl}}'\u003Ethe topic\u003C/a\u003E","user_mentioned_user":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E 언급 \u003Ca href='{{user2Url}}'\u003E{{another_user}}\u003C/a\u003E","user_mentioned_you":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E 언급 \u003Ca href='{{user2Url}}'\u003Eyou\u003C/a\u003E","you_mentioned_user":"\u003Ca href='{{user1Url}}'\u003EYou\u003C/a\u003E 언급 \u003Ca href='{{user2Url}}'\u003E{{user}}\u003C/a\u003E","posted_by_user":"에 의해 게시 \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","posted_by_you":"에 의해 게시 \u003Ca href='{{userUrl}}'\u003Eyou\u003C/a\u003E","sent_by_user":"에 의해 전송 \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","sent_by_you":"에 의해 전송 \u003Ca href='{{userUrl}}'\u003Eyou\u003C/a\u003E"},"user_action_groups":{"1":"좋아요 받음","2":"좋아요 보냄","3":"북마크","4":"토픽들","5":"게시글들","6":"답글","7":"언급","9":"인용","10":"즐겨찾기","11":"편집","12":"보낸 편지함","13":"받은 편지함"},"categories":{"all":"전체 카테고리","only_category":"오직 {{categoryName}} 카테고리","category":"카테고리","posts":"게시글","topics":"토픽들","latest":"최신","latest_by":"가장 최근","toggle_ordering":"정렬 컨트롤 토글","subcategories":"서브카테고리들:"},"user":{"said":"{{username}} 말:","profile":"프로필","show_profile":"프로필 방문","mute":"음소거","edit":"편집","download_archive":"내 게시물을 아카이브로 다운로드","private_message":"개인 메시지","private_messages":"메시지","activity_stream":"활동","preferences":"환경 설정","bio":"프로필","invited_by":"에 의해 초대되었습니다.","trust_level":"레벨","notifications":"알림","dynamic_favicon":"Favicon으로 들어온 메시지 알림을 받습니다.","external_links_in_new_tab":"새 탭에서 모든 외부 링크 열기","enable_quoting":"강조 표시된 텍스트에 대한 알림을 사용합니다","change":"변경","moderator":"{{user}}는 중간 관리자입니다.","admin":"{{user}} 는 운영자입니다.","deleted":"(삭제됨)","messages":{"all":"전체","mine":"내글","unread":"읽지 않음"},"change_password":{"success":"(이메일 전송)","in_progress":"(이메일 전송중)","error":"(에러)","action":"패스워드 변경 이메일 전송"},"change_about":{"title":"내정보 변경"},"change_username":{"title":"사용자 이름 변경","confirm":"사용자 이름을 변경합니다. 모든 @사용자 언급이 끊어집니다. 사용자 이름을 변경하는게 확실한가요?","taken":"죄송합니다. 중복된 사용자 이름입니다.","error":"사용자 이름을 변경하는 중에 오류가 발생했습니다.","invalid":"사용자 이름이 잘못되었습니다. 숫자와 문자를 포함해야합니다."},"change_email":{"title":"이메일 수정","taken":"죄송합니다. 해당 이메일은 사용할 수 없습니다.","error":"이메일 변경 중 오류가 발생했습니다. 이미 사용중인 이메일인지 확인해주세요.","success":"이메일 발송이 완료되었습니다. 확인하신 후 절차에 따라주세요."},"change_avatar":{"title":"아바타 변경","gravatar":"\u003Ca href='//gravatar.com/emails' target='_blank'\u003EGravatar\u003C/a\u003E 기반","gravatar_title":"Gravatar 사이트의 아바타 변경하기","uploaded_avatar":"커스텀 사진","uploaded_avatar_empty":"커스텀 사진 추가","upload_title":"프로필 사진 업로드","image_is_not_a_square":"경고: 사진을 정사각형으로 수정하였습니다."},"email":{"title":"이메일","instructions":"당신의 이메일은 노출 되지않습니다.","ok":"완료. 확인 이메일을 보냈습니다.","invalid":"사용하고 계시는 이메일주소를 입력해주세요.","authenticated":"당신의 이메일은 {{provider}}에 의해 인증되었습니다.","frequency":"당신의 활동이 뜸해지거나 메일을 읽지않는다면 확인메일을 보내드립니다."},"name":{"title":"별명","instructions":"별명을 정해주세요.","too_short":"너무 짧습니다.","ok":"사용가능합니다."},"username":{"title":"사용자 이름","instructions":"중복이 안되며, 공백이 없어야합니다.","short_instructions":"@{{username}}으로 언급이 가능합니다.","available":"사용자 이름으로 사용가능합니다.","global_match":"이메일이 등록된 이름과 일치합니다.","global_mismatch":"이미 등록된 계정입니다. 다시 시도해보세요. {{suggestion}}","not_available":"사용할 수 없는 계정입니다. 다시 시도해보세요. {{suggestion}}","too_short":"사용자 이름이 너무 짧습니다.","too_long":"사용자 이름이 너무 깁니다.","checking":"사용가능한지 확인 중...","enter_email":"사용자 이름을 찾았습니다. 일치하는 Email을 입력해주세요."},"password_confirmation":{"title":"비밀번호를 재입력해주세요."},"last_posted":"마지막글","last_emailed":"마지막 이메일","last_seen":"마지막 접속","created":"생성일","log_out":"로그 아웃","website":"웹사이트","email_settings":"이메일","email_digests":{"title":"새로운 정보를 요약하여 이메일로 보내드립니다.","daily":"매일","weekly":"매주","bi_weekly":"격주"},"email_direct":"누군가가 게시물에 @이름 또는 답글을 달 경우에 이메일을 받습니다.","email_private_messages":"누군가 당신에게 메세지를 보낼 때 이메일을 받습니다.","email_always":"해당 포럼을 이용중이면 이메일 알림과 이메일 요약을 받습니다.","other_settings":"추가 사항","new_topic_duration":{"label":"새글을 정의해주세요.","not_viewed":"아직 안본 글","last_here":"내가 마지막으로 작성한 후 게시된 글","after_n_days":{"one":"어제 작성된 글","other":"{{count}}일 전에 작성된 글입니다"},"after_n_weeks":{"one":"지난주 작성된 글","other":"최근 {{count}} 주 동안 게시되었습니다."}},"auto_track_topics":"내가 작성한 글을 추적할 수 있습니다.","auto_track_options":{"never":"하지않음","always":"항상","after_n_seconds":{"one":"1초 후에","other":"{{count}}초 후에"},"after_n_minutes":{"one":"1분 후에","other":"{{count}}분 후에"}},"invited":{"title":"초대","user":"사용자 초대","none":"{{username}}은 초대를 받은적이 없습니다.","redeemed":"초대를 받았습니다.","redeemed_at":"에 초대되었습니다.","pending":"초대를 보류합니다.","topics_entered":"토픽이 입력되었습니다.","posts_read_count":"게시물 읽기","rescind":"초대 제거","rescinded":"초대가 제거되었습니다.","time_read":"읽은 시간","days_visited":"일일 방문","account_age_days":"일일 계정 나이"},"password":{"title":"비밀번호","too_short":"암호가 너무 짧습니다.","ok":"적절한 암호입니다."},"ip_address":{"title":"마지막 IP 주소"},"avatar":{"title":"아바타"},"title":{"title":"제목"},"filters":{"all":"All"},"stream":{"posted_by":"에 의해 게시","sent_by":"에 의해 전송 ","private_message":"비공개 메시지","the_topic":"토픽"}},"loading":"로딩중...","close":"닫기","learn_more":"더 배우기...","year":"년","year_desc":"지난 1년 동안 게시 된 글","month":"월","month_desc":"지난 1달 동안 게시 된 글","week":"주","week_desc":"지난 1주 동안 게시 된 글","first_post":"첫 번째 게시물","mute":"음소거","unmute":"음소거 해제","best_of":{"title":"인기 토픽","enabled_description":"당신은 해당 토픽의 인기 게시물 을 보고 있습니다. 모든 게시물을 보려면 아래를 클릭하세요.","description":"해당 토픽에는 \u003Cb\u003E{{count}}\u003C/b\u003E개의 게시글이 있습니다. . 아주 많군요!! 인기 게시물만 봄으로 시간을 절약하겠습니까?","enable":"인기 토픽 보기로 전환하여 봅니다","disable":"인기 토픽 보기가 취소되었습니다"},"private_message_info":{"title":"개인 메시지","invite":"다른 사람 초대...","remove_allowed_user":"{{name}} 에게서 온 개인 메시지를 삭제할까요? "},"email":"이메일","username":"사용자","last_seen":"마지막 접근","created":"생성","trust_level":"신뢰하는 레벨","create_account":{"title":"계정만들기","action":"지금 계정 만들기!","invite":"아직 계정이 없으신가요?","failed":"뭔가 잘못되었습니다. 이 메일은 등록이 되어있습니다. 비밀번호를 잊으셨다면 비밀번호 찾기를 눌러주세요."},"forgot_password":{"title":"비밀번호를 찾기","action":"비밀번호를 잊어버렸습니다.","invite":"사용자 이름 또는 이메일 주소를 입력하시면, 비밀번호 재설정 이메일을 보내드립니다.","reset":"암호 재설정","complete":"이메일이 맞다면, 곧 암호를 재설정하는 지침 이메일을 수신합니다."},"login":{"title":"로그인","username":"로그인","password":"비밀번호","email_placeholder":"이메일 주소 또는 사용자 이름","error":"알 수없는 오류","reset_password":"암호 재설정","logging_in":"로그인 중...","or":"또는","authenticating":"인증 중...","awaiting_confirmation":"계정 활성화를 기다있습니다. 다른 인증 이메일을 받고 싶으면 비밀번호 찾기를 누르세요.","awaiting_approval":"당신의 계정은 아직 스태프에 의해 승인되지 않았습니다. 승인되면 이메일을 받게됩니다.","requires_invite":"죄송합니다. 초대를 받은 사람만 이용하실 수 있습니다.","not_activated":"당신은 아직 로그인 할 수 없습니다. 이전에 \u003Cb\u003E {{sentTo}} \u003C/b\u003E 주소로 인증 이메일을 보냈습니다. 계정을 활성화하려면 해당 이메일의 지침을 따르십시오.","resend_activation_email":"다시 인증 이메일을 보내려면 여기를 클릭하세요.","sent_activation_email_again":"\u003Cb\u003E {{currentEmail}} \u003C/b\u003E 주소로 인증 이메일을 보냈습니다. 이메일이 도착하기 까지 몇 분 정도 걸릴 수 있습니다. 또한 스팸 메일을 확인하십시오.","google":{"title":"Google","message":"Google 인증 중(팝업 차단을 해제 하세요.)"},"twitter":{"title":"Twitter","message":"Twitter 인증 중(팝업 차단을 해제 하세요.)"},"facebook":{"title":"Facebook","message":"Facebook 인증 중(팝업 차단을 해제 하세요.)"},"cas":{"title":"CAS로 로그인하기","message":"CAS로 인증하기(팝업 차단을 해제 하세요.)"},"yahoo":{"title":"Yahoo","message":"Yahoo 인증 중(팝업 차단을 해제 하세요.)"},"github":{"title":"GitHub","message":"GitHub 인증 중(팝업 차단을 해제 하세요.)"},"persona":{"title":"Persona","message":"Mozilla Persona 인증 중(팝업 차단을 해제 하세요.)"}},"composer":{"posting_not_on_topic":"어떤 토픽에 답글을 작성하시겠습니까?","saving_draft_tip":"저장중...","saved_draft_tip":"저장완료","saved_local_draft_tip":"로컬로 저장됩니다.","similar_topics":"당신의 토픽은 유사합니다...","drafts_offline":"초안","min_length":{"need_more_for_title":"{{n}} 자 필요","need_more_for_reply":"{{n}} 자 필요"},"error":{"title_missing":"제목 필요","title_too_short":"제목은 적어도 {{min}}자 보다 길어야 합니다.","title_too_long":"제목은 최대 {{max}}자 보다 짧아야 합니다.","post_missing":"본문이 비어있습니다.","post_length":"본문은 적어도 {{min}}자 보다 길어야 합니다.","category_missing":"카테고리를 선택해야 합니다."},"save_edit":"편집 저장","reply_original":"기존 토픽에 대해 답글을 씁니다.","reply_here":"여기에 답글을 달아주세요.","reply":"답글","cancel":"취소","create_topic":"토픽 만들기","create_pm":"개인 메시지를 만듭니다.","users_placeholder":"사용자 추가","title_placeholder":"여기에 제목을 입력하세요. 토픽은 무엇입니까?","reply_placeholder":"여기에 입력하세요. 마크 다운이나 BBCode 형식을 사용하세요. 드래그\u0026드랍으로 이미지를 넣습니다.","view_new_post":"새로운 게시물을 볼 수 있습니다..","saving":"저장중...","saved":"저장완료!","saved_draft":"당신은 진행중인 게시물 초안이 있습니다. 편집을 다시 시작하려면이 상자에 아무 곳이나 클릭합니다.","uploading":"업로딩중...","show_preview":"미리보기를 보여줍니다 \u0026laquo;","hide_preview":"\u0026laquo; 미리보기를 숨깁니다","quote_post_title":"전체 게시물을 인용","bold_title":"굵게","bold_text":"굵게하기","italic_title":"강조","italic_text":"강조하기","link_title":"하이퍼링크","link_description":"링크 설명을 입력","link_dialog_title":"하이퍼링크 삽입","link_optional_text":"옵션 제목","quote_title":"인용구","quote_text":"인용구","code_title":"코드 샘플","code_text":"여기에 코드를 입력","upload_title":"업로드","upload_description":"업로드 설명을 입력","olist_title":"번호 매기기 목록","ulist_title":"글 머리 기호 목록","list_item":"토픽","heading_title":"표제","heading_text":"표제","hr_title":"수평선","undo_title":"취소","redo_title":"다시","help":"마크다운 편집 도움말","toggler":"작성 패널을 숨기거나 표시","admin_options_title":"이 토픽에 대한 옵션 설정","auto_close_label":"자동 토픽 닫기 : ","auto_close_units":"일"},"notifications":{"title":"@이름 언급, 게시글과 토픽에 대한 언긋, 개인 메시지 등에 대한 알림","none":"현재 알림이 없습니다.","more":"이전 알림을 볼 수 있습니다.","mentioned":"\u003Cspan title='mentioned' class='icon'\u003E@\u003C/span\u003E {{username}} {{link}}","quoted":"\u003Ci title='quoted' class='icon icon-quote-right'\u003E\u003C/i\u003E {{username}} {{link}}","replied":"\u003Ci title='replied' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","posted":"\u003Ci title='replied' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","edited":"\u003Ci title='edited' class='icon icon-pencil'\u003E\u003C/i\u003E {{username}} {{link}}","liked":"\u003Ci title='liked' class='icon icon-heart'\u003E\u003C/i\u003E {{username}} {{link}}","private_message":"\u003Ci class='icon icon-envelope-alt' title='private message'\u003E\u003C/i\u003E {{username}} {{link}}","invited_to_private_message":"\u003Ci class='icon icon-envelope-alt' title='private message'\u003E\u003C/i\u003E {{username}} {{link}}","invitee_accepted":"\u003Ci title='accepted your invitation' class='icon icon-signin'\u003E\u003C/i\u003E {{username}} 의 초대를 수락했습니다.","moved_post":"\u003Ci title='moved post' class='icon icon-arrow-right'\u003E\u003C/i\u003E {{username}} 이동 {{link}}","total_flagged":"관심 표시된 총 게시글"},"upload_selector":{"title":"이미지 추가하기","title_with_attachments":"이미지 또는 파일 추가하기","from_my_computer":"컴퓨터에서 가져오기","from_the_web":"인터넷에서 가져오기","remote_tip":"http://example.com/image.jpg 형식으로 이미지 주소를 입력","remote_tip_with_attachments":"http://example.com/file.ext 형식으로 이미지나 파일의 주소를 입력 (사용 가능한 확장자: {{authorized_extensions}})","local_tip":"내 컴퓨터에서 이미지를 가져오기","local_tip_with_attachments":"내 컴퓨터에서 이미지나 파일 가져오기 (사용 가능한 확장자: {{authorized_extensions}})","hint":"(드래그\u0026드랍으로 업로드 가능)","hint_for_chrome":"(드래그\u0026드랍으로 이미지 업로드 가능)","uploading":"업로드 중입니다"},"search":{"title":"토픽, 게시물, 사용자, 카테고리를 검색","placeholder":"여기에 검색어를 입력","no_results":"검색 결과가 없음","searching":"검색중 ...","prefer":{"user":"@{{username}}님이 쓰신 게시글을 위주로 검색","category":"{{category}} 안에 게시글을 위주로 검색"}},"site_map":"다른 토픽나 카테고리로 이동","go_back":"돌아가기","current_user":"사용자 페이지로 이동","favorite":{"title":"즐겨찾기","help":{"star":"즐겨찾기로 이 토픽를 추가","unstar":"즐겨찾기에서 이 토픽를 제거"}},"topics":{"none":{"favorited":"아직 즐겨찾기가 없습니다, 토픽을 즐거찾기 하려면 제목 옆에 별표를 눌러주세요.","unread":"읽지 않은 토픽이 없습니다.","new":"읽을 새로운 토픽가 없습니다.","read":"아직 어떠한 토픽도 읽지 않았습니다.","posted":"아직 어떠한 토픽도 게시되지 않았습니다.","latest":"최신 토픽이 없습니다.","hot":"인기있는 토픽이 없습니다.","category":"{{category}} 에 토픽이 없습니다."},"bottom":{"latest":"더 이상 읽을 최신 토픽이 없습니다","hot":"더 이상 읽을 인기있는 토픽이 없습니다","posted":"당신은 아직 어떤 토픽에도 게시하지 않았습니다","read":"더 이상 읽을 토픽이 없습니다","new":"더 이상 읽을 새로운 토픽이 없습니다.","unread":"더 이상 읽지 않은 토픽이 없습니다","favorited":"더 이상 읽을 즐겨 찾기 토픽이 없습니다","category":"더 이상 {{category}} 토픽이 없습니다"}},"rank_details":{"toggle":"토픽 랭킹 세부 사항을 토글합니다.","show":"토픽 랭킹 세부 사항을 보여줍니다.","title":"토픽 랭킹 세부 사항"},"topic":{"filter_to":"이 토픽에서 오직 {{username}} 사용자의 {{post_count}} 건의 게시물만 보기","create":"토픽 만들기","create_long":"새로운 토픽를 개설","private_message":"개인 메시지를 시작","list":"토픽 목록","new":"새로운 토픽","new_topics":{"one":"1개의 새로운 토픽","other":"{{count}} 개의 새로운 토픽들"},"unread_topics":{"one":"1개의 읽지 않은 토픽","other":"{{count}} 개의 읽지 않은 토픽들"},"title":"토픽","loading_more":"더 많은 토픽 로딩 중...","loading":"토픽 로딩 중...","invalid_access":{"title":"이 토픽은 비공개","description":"죄송합니다. 그 토픽에 접근 할 수 없습니다!"},"server_error":{"title":"토픽를 로드하지 못했습니다","description":"죄송합니다. 연결 문제로 인해 해당 토픽을 로드 할 수 없습니다. 다시 시도하십시오. 문제가 지속되면 문의해 주시기 바랍니다"},"not_found":{"title":"토픽을 찾을 수 없습니다","description":"죄송합니다. 토픽을 찾을 수 없습니다. 아마도 중간 관리자에 의해 삭제 된 것같습니다."},"unread_posts":{"one":"이 토픽에 1 개의 오래된 게시글이 있습니다.","other":"이 토픽에 {{count}} 개의 오래된 게시글이 있습니다."},"new_posts":{"one":"1 개의 읽지 않은 게시글이 있습니다.","other":"{{count}} 개의 읽지 않은 게시글이 있습니다."},"likes":{"other":"이 토픽에 {{count}} 개의 '좋아요'가 있습니다."},"back_to_list":"토픽 리스트로 돌아갑니다.","options":"토픽 옵션","show_links":"이 토픽에서 링크를 표시합니다.","toggle_information":"토픽 세부 정보를 토글합니다.","read_more_in_category":"자세한 내용을 원하십니까? {{catLink}} 또는 {{latestLink}} 에서 다른 토픽을 검색해보세요","read_more":"{{catLink}} 또는 {{latestLink}}에서 자세한 내용을 원하십니까?","browse_all_categories":"모든 카테고리 보기","view_latest_topics":"최신 토픽 보기","suggest_create_topic":"왜 토픽을 만들 수 없나요?","read_position_reset":"당신의 읽기 위치가 재설정되었습니다.","jump_reply_up":"이전 답글로 이동","jump_reply_down":"이후 답글로 이동","deleted":"토픽이 삭제되었습니다","auto_close_notice":"이 토픽은 곧 자동으로 닫힙니다. %{timeLeft}.","auto_close_title":"자동 닫기 설정","auto_close_save":"저장","auto_close_remove":"이 토픽 자동 닫지 않기","progress":{"title":"진행중인 토픽","jump_top":"첫 게시글로 이동","jump_bottom":"마지막 게시글로 이동","total":"총 게시글","current":"현재 게시글"},"notifications":{"title":"알림","reasons":{"3_2":"이 토픽을 보고있어서 알림을 받게됩니다.","3_1":"이 토픽을 생성하여서 알림을 받게됩니다.","3":"이 토픽을 보고있어서 알림을 받게됩니다.","2_4":"이 토픽에 답글을 작성하여서 알림을 받게됩니다.","2_2":"이 토픽을 추척하고 있어서 알림을 받게됩니다.","2":"이 토픽을 읽어서 알림을 받게됩니다. \u003Ca href=\"/users/{{username}}/preferences\"\u003E(설정)\u003C/a\u003E","1":"누군가가 게시물에 @이름 또는 답글을 달 경우에 알림을 받게됩니다.","1_2":"누군가가 게시물에 @이름 또는 답글을 달 경우에 알림을 받게됩니다.","0":"당신은 이 토픽에 관한 모든 알림을 무시합니다.","0_2":"당신은 이 토픽에 관한 모든 알림을 무시합니다."},"watching":{"title":"보기","description":"모든 새 게시물 알림을 받게됩니다."},"tracking":{"title":"추적","description":"누군가가 게시물에 @이름 또는 답글을 달 경우에 알림을 받게됩니다. '읽지 않은 글' 탭에서 개시물의 수를 볼 수 있습니다."},"regular":{"title":"보통","description":"누군가가 게시물에 @이름 또는 답글을 달 경우에 알림을 받게됩니다."},"muted":{"title":"알림 없음","description":"아무 알림도 없습니다. '읽지 않은 글' 탭에 나타나지 않습니다."}},"actions":{"recover":"토픽 다시 복구","delete":"토픽 삭제","open":"토픽 열기","close":"토픽 닫기","auto_close":"자동으로 닫기","unpin":"취소한 토픽","pin":"토픽 고정","unarchive":"보관안된 토픽","archive":"보관된 토픽","invisible":"보이지 않게 하기","visible":"보이게 합기","reset_read":"데이터 읽기 재설정","multi_select":"이동하기 위한 게시글 다중 선택","convert_to_topic":"정식 토픽으로 변환"},"reply":{"title":"답글","help":"이 토픽에 대한 답글 구성 시작"},"clear_pin":{"title":"고정 취소","help":"더 이상 목록의 맨 위에 표시하지 않도록 이 토픽의 고정 상태를 해제합니다."},"share":{"title":"공유","help":"이 토픽의 링크를 공유"},"inviting":"초대 중...","invite_private":{"title":"개인 메시지에 초대","email_or_username":"초대하려는 이메일 또는 사용자","email_or_username_placeholder":"이메일 또는 사용자","action":"초대","success":"감사합니다! 사용자가 개인 메세지에 참여할 수 있도록 초대했습니다.","error":"죄송합니다, 해당 사용자를 초대하는 도중 오류가 발생했습니다."},"invite_reply":{"title":"초대 이메일 보내기","action":"이메일 초대","help":"한 번의 클릭으로 이 토픽에 답글을 추가할 수 있도록 친구에게 초대장을 보낼 수 있습니다.","email":"이 토픽에 답글을 추가할 수 있도록 초대 이메일 보내기","email_placeholder":"이메일 주소","success":"감사합니다! \u003Cb\u003E{{email}}\u003C/b\u003E로 초대장을 발송했습니다. 초대를 수락하면 알려 드리겠습니다. 초대 한 사람을 추적하기 위해선 사용자 페이지에서 '초대장' 탭을 선택하세요.","error":"죄송합니다, 그 사람을 초대 할 수 없습니다. 이미 포럼 사용자입니까?"},"login_reply":"답글을 작성하려면 로그인해야 합니다.","filters":{"user":"당신은 {{n_posts}} {{by_n_users}}를 보고 있습니다.","n_posts":{"one":"1 개의 게시글","other":"{{count}} 개의 게시글"},"by_n_users":{"one":"1 명의 유저에 의해 만들어짐","other":"{{count}} 명의 유저에 의해 만들어짐"},"best_of":"당신은 {{n_best_posts}} {{of_n_posts}}를 보고 있습니다.","n_best_posts":{"one":"1 개의 인기 게시글","other":"{{count}} 개의 인기 게시글"},"of_n_posts":{"one":"이 토픽에 1 개","other":"이 토픽에 {{count}} 개"},"cancel":"다시 이 토픽의 모든 게시물을 표시합니다."},"split_topic":{"title":"새로운 토픽으로 이동","action":"새로운 토픽으로 이동","topic_name":"새로운 토픽 이름","error":"새로운 토픽으로 이동시키는데 문제가 발생하였습니다.","instructions":{"one":"새로운 토픽을 만들기 위해 당신이 선택한 1개의 글을 불렀왔습니다.","other":"새로운 토픽을 만들기 위해 당신이 선택한 \u003Cb\u003E{{count}}\u003C/b\u003E개의 글을 불러왔습니다."}},"merge_topic":{"title":"이미 있는 토픽로 옴기기","action":"이미 있는 토픽로 옴기기","error":"이 토픽을 이동시키는데 문제가 발생하였습니다.","instructions":{"one":"이 게시물을 이동시킬 토픽을 선택하세요.","other":"이 \u003Cb\u003E{{count}}\u003C/b\u003E개의 게시물들을 이동시킬 토픽를 선택하세요."}},"multi_select":{"select":"선택","selected":"({{count}})개가 선택됨","select_replies":"선택 + 답글","delete":"선택 삭제","cancel":"선택을 취소","description":{"one":"\u003Cb\u003E1\u003C/b\u003E개의 게시물을 선택하였습니다.","other":"\u003Cb\u003E{{count}}\u003C/b\u003E개의 게시물을 선택하였습니다."}}},"post":{"reply":"{{replyAvatar}} {{username}}에 의해 {{link}} 답글","reply_topic":"{{link}} 답글","quote_reply":"답글을 인용","edit":"{{replyAvatar}} {{username}}에 의해 {{link}} 편집","post_number":"{{number}}개 게시","in_reply_to":"답글","last_edited_on":"마지막 편집을 게시","reply_as_new_topic":"새로운 토픽으로 답글","continue_discussion":"{{postLink}}에서 논의를 계속:","follow_quote":"인용 글로 이동","deleted_by_author":{"one":"(글 작성자의 요구로 %{count} 시간안에 자동 삭제됩니다.)","other":"(글 작성자의 요구로 %{count} 시간안에 자동 삭제됩니다.)"},"deleted_by":"삭제됨","expand_collapse":"확장/축소","has_replies":{"one":"답글","other":"답글들"},"errors":{"create":"죄송합니다, 게시물을 만드는 동안 오류가 발생했습니다. 다시 시도하십시오.","edit":"죄송합니다, 게시물을 수정하는 중에 오류가 발생했습니다. 다시 시도하십시오.","upload":"죄송합니다, 파일을 업로드하는 동안 오류가 발생했습니다. 다시 시도하십시오.","attachment_too_large":"업로드하려는 파일의 크기가 너무 큽니다. (최대 크기는 {{max_size_kb}}kb 입니다).","image_too_large":"업로드하려는 이미지의 크기가 너무 큽니다. (최대 크기는 {{max_size_kb}}kb 입니다) 사이즈를 조정하고 다시 시도해보세요.","too_many_uploads":"한번에 한 파일만 업로드 하실 수 있습니다.","upload_not_authorized":"업로드 하시려는 파일 확장자는 사용이 불가능합니다 (사용가능 확장자: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"죄송합니다. 새로운 유저는 이미지를 업로드 하실 수 없습니다.","attachment_upload_not_allowed_for_new_user":"죄송합니다. 새로운 유저는 파일 첨부를 업로드 하실 수 없습니다."},"abandon":"당신의 게시물을 포기 하시겠습니까?","archetypes":{"save":"옵션 저장"},"controls":{"reply":"이 게시물에 대한 딥글을 작성합니다.","like":"이 게시물을 좋아합니다.","edit":"이 게시물을 편집합니다.","flag":"이 게시물을 신고하거나 알림을 보냅니다.","delete":"이 게시물을 삭제합니다.","undelete":"이 게시물 삭제를 취소합니다.","share":"이 게시물에 대한 링크를 공유합니다.","more":"더","delete_replies":{"confirm":{"one":"이 게시글에 대한 1 개의 답글을 삭제하시겠습니까?","other":"이 게시글에 대한 {{count}} 개의 답글을 삭제하시겠습니까?"},"yes_value":"예, 답글도 삭제합니다.","no_value":"아니오, 게시글만 삭제합니다."}},"actions":{"flag":"신고","clear_flags":{"one":"신고 제거","other":"신고 제거"},"it_too":{"off_topic":"토픽에서 벗어남","spam":"스팸","inappropriate":"부적절함","custom_flag":"신고","bookmark":"북마크","like":"좋아요","vote":"투표"},"undo":{"off_topic":"토픽에서 벗어남 취소","spam":"스팸 취소","inappropriate":"부적절함 취소","bookmark":"북마크 취소","like":"좋아요 취소","vote":"투표 취소"},"people":{"off_topic":"{{icons}} 주제에서 토픽에서 벗어남으로 신고","spam":"{{icons}} 스팸으로 신고","inappropriate":"{{icons}} 부적절하다고 신고","notify_moderators":"{{icons}} 중간 관리자에게 보고","notify_moderators_with_url":"{{icons}} \u003Ca href='{{postUrl}}'\u003E중간 관리자에게 보고\u003C/a\u003E","notify_user":"{{icons}} 개인 메시지를 보냄","notify_user_with_url":"{{icons}}은 \u003Ca href='{{postUrl}}'\u003E개인 메시지\u003C/a\u003E를 보냄","bookmark":"{{icons}} 북마크","like":"{{icons}} 좋아요","vote":"{{icons}} 투표"},"by_you":{"off_topic":"당신이 토픽에서 벗어남으로 신고","spam":"당신이 스팸으로 신고","inappropriate":"당신이 부적절하다고 신고","notify_moderators":"당신이 중간 관리자에게 보고","notify_user":"당신이 이 사용자에게 개인 메시지를 보냄","bookmark":"당신이 이 게시물을 북마크함","like":"당신은 이 게시물을 좋아요함","vote":"당신은 이 게시물에 투표함"},"by_you_and_others":{"off_topic":{"one":"당신과 1명의 사용자가 토픽에서 벗어난다고 신고했습니다.","other":"당신과 {{count}}명의 사용자가 토픽에서 벗어난다고 신고했습니다."},"spam":{"one":"당신과 1명의 사용자가 스팸으로 신고했습니다.","other":"당신과 {{count}}명의 사용자가 스팸으로 신고했습니다."},"inappropriate":{"one":"당신과 1명이 사용자가 부적절하다고 신고했습니다.","other":"당신과 {{count}}명이 사용자가 부적절하다고 신고했습니다."},"notify_moderators":{"one":"당신과 1명의 사용자가 이 게시글을 중간 관리자에게 보고하였습니다.","other":"당신과 {{count}}명의 사용자가 이 게시글을 중간 관리자에게 보고하였습니다."},"notify_user":{"other":"당신과 {{count}}명의 사용자가 이 사용자에게 개인 메시지를 보냈습니다."},"bookmark":{"one":"당신과 1명의 사용자가 북마크했습니다.","other":"당신과 {{count}}명의 사용자가 북마크했습니다."},"like":{"one":"당신과 1명의 사용자가 좋아합니다.","other":"당신과 {{count}}명의 사용자가 좋아합니다."},"vote":{"one":"당신과 1명의 사용자가 투표했습니다.","other":"당신과 {{count}}명의 사용자가 투표했습니다."}},"by_others":{"off_topic":{"one":"1명의 사용자가 토픽에 벗어난다고 신고했습니다.","other":"{{count}}명의 사용자가 토픽에 벗어난다고 신고했습니다."},"spam":{"one":"1명의 사용자가 스팸으로 신고했습니다.","other":"{{count}}명의 사용자가 스팸으로 신고했습니다."},"inappropriate":{"one":"1명의 사용자가 이것을 부적절하다고 신고했습니다.","other":"{{count}}명의 사용자가 이것을 부적절하다고 신고했습니다."},"notify_moderators":{"one":"1명의 사용자가 이 게시글을 중간 관리자에게 보고하였습니다.","other":"{{count}}명의 사용자가 이 게시글을 중간 관리자에게 보고하였습니다."},"notify_user":{"one":"1명의 사용자가 이 사용자에게 개인 메시지를 보냈습니다.","other":"{{count}}명의 사용자가 이 사용자에게 개인 메시지를 보냈습니다."},"bookmark":{"one":"1명의 사용자가 북마크했습니다.","other":"{{count}}명의 사용자가 북마크했습니다."},"like":{"one":"1명의 사용자가 좋아합니다.","other":"{{count}}명의 사용자가 좋아합니다."},"vote":{"one":"1명의 사용자가  이 게시글에 투표했습니다.","other":"{{count}}명의 사용자가  이 게시글에 투표했습니다."}}},"edits":{"one":"하나 편집","other":"{{count}}개 편집 ","zero":"편집 안함"},"delete":{"confirm":{"other":"모든 게시물들을 삭제하시겠습니까?"}}},"category":{"can":"할 수 있다\u0026hellip;","none":"(카테고리 없음)","choose":"카테고리를 선택하세요\u0026hellip;","edit":"편집","edit_long":"카테고리 편집","view":"카테고리안의 토픽보기","general":"일반","settings":"설정","delete":"카테고리 삭제","create":"카테고리 생성","save":"카테고리 저장","creation_error":"카테고리 생성 중 오류가 발생했습니다.","save_error":"카테고리 저장 중 오류가 발생했습니다..","more_posts":"모든 {{posts}} 보기...","name":"카테고리 이름","description":"설명","topic":"카테고리 토픽","badge_colors":"뱃지 색상","background_color":"배경 색상","foreground_color":"글씨 색상","name_placeholder":"짧고 간결해야합니다.","color_placeholder":"웹 색상","delete_confirm":"이 카테고리를 삭제 하시겠습니까?","delete_error":"카테고리를 삭제하는 동안 오류가 발생했습니다.","list":"카테고리 목록","no_description":"이 카테고리에 대한 설명이 없습니다.","change_in_category_topic":"설명 편집","hotness":"활발한","already_used":"이 색은 다른 카테고리에서 사용되고 있습니다.","security":"보안","auto_close_label":"토픽 자동 닫기 :","edit_permissions":"권한 수정","add_permission":"권한 추가","this_year":"올해","position":"위치","parent":"부모 카테고리"},"flagging":{"title":"왜 이 게시물을 신고합니까?","action":"게시물 신고","take_action":"조치를 취하기","notify_action":"알림","delete_spammer":"스팸 사용자 삭제","delete_confirm":"당신은 이 사용자의 %{posts} 개의 게시글과 %{topics} 개의 토픽를 삭제하고 IP주소 %{ip_address} 와 이메일 %{email} 을 영구블락 합니다. 이 사용자가 진짜 악성 사용자 입니까? ","yes_delete_spammer":"예, 스팸 사용자 삭제.","cant":"죄송합니다, 당신은 지금 이 게시물을 신고 할 수 없습니다.","custom_placeholder_notify_user":"해당 유저에게 직접적이고 개인적으로 말해야 할 필요가 있습니까? 구체적이고, 건설이고, 항상 친절하십시요.","custom_placeholder_notify_moderators":"이 게시물을 보고할 필요가 있습니까? 구체적으로 당신이 걱정하는 것과 제공 가능한 모든 관련된 링크를 제공해주세요.","custom_message":{"at_least":"최소한 {{n}}자를 입력하세요  ","more":"{{n}} 이동합니다...","left":"{{n}} 나머지"}},"topic_summary":{"title":"토픽 요약","links_shown":"모든 {{totalLinks}} 링크 보기...","clicks":"클릭","topic_link":"토픽 링크"},"topic_statuses":{"locked":{"help":"이 토픽은 폐쇄되었습니다. 더이상 새 답글을 받을 수 없습니다."},"pinned":{"help":"이 토픽은 고정되었습니다. 카테고리의 상단에 표시됩니다."},"archived":{"help":"이 토픽은 보관중입니다. 고정되어 변경이 불가능합니다."},"invisible":{"help":"이 토픽은 보이지 않습니다. 토픽 목록에 표시되지 않습니다. ​​단지 직접적인 링크를 통해서만 접근 할 수 있습니다"}},"posts":"게시물","posts_long":"이 토픽의 게시물 수는 {{number}}개 입니다.","original_post":"원본 게시물","views":"조회수","replies":"답변","views_long":"이 토픽은 {{number}}번 조회 되었습니다.","activity":"활동","likes":"좋아요","likes_long":"이 주제에 {{number}}개의 '좋아요'가 있습니다.","top_contributors":"참여자","category_title":"카테고리","history":"기록","changed_by":"{{author}}에 의해","categories_list":"카테고리 목록","filters":{"latest":{"title":"최신글","help":"가장 최근 토픽"},"hot":{"title":"인기 있는 글","help":"가장 인기있는 토픽 중 하나를 선택"},"favorited":{"title":"즐겨찾기","help":"즐겨찾기로 표시한 게시글"},"read":{"title":"읽기","help":"마지막으로 순서대로 읽은 토픽"},"categories":{"title":"카테고리","title_in":"카테고리 - {{categoryName}}","help":"카테고리별로 그룹화 된 모든 토픽"},"unread":{"title":{"zero":"읽지 않은 글","one":"읽지 않은 글(1)","other":"읽지 않은 글({{count}})"},"help":"추적되었지만 읽지 않은 게시글"},"new":{"title":{"zero":"새로운 글","one":"새로운 글(1)","other":"새로운 글({{count}})"},"help":"마지막 방문 이후 새로운 글"},"posted":{"title":"내 게시물","help":"당신이 게시한 글"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"{{categoryName}}카테고리의 최신 토픽"}},"browser_update":"불행하게도, \u003Ca href=\"http://www.discourse.org/faq/#browser\"\u003E당신의 브라우저는 이 사이트를 이용하기에 어렵습니다.\u003C/a\u003E. 브라우저를 업그레이드 하시기 바랍니다.\u003Ca href=\"http://browsehappy.com\"\u003E.","permission_types":{"full":"생성 / 답글/ 보기","create_post":"답글 / 보기","readonly":"보기"},"type_to_filter":"필터를 입력하세요...","admin":{"title":"Discourse 운영","moderator":"중간 관리자","dashboard":{"title":"대시보드","last_updated":"대시보드 최근 업데이트 :","version":"버전","up_to_date":"최신상태입니다!","critical_available":"중요 업데이트를 사용할 수 있습니다.","updates_available":"업데이트를 사용할 수 있습니다.","please_upgrade":"업그레이드하세요.","no_check_performed":"A check for updates has not been performed. Ensure sidekiq is running.","stale_data":"A check for updates has not been performed lately. Ensure sidekiq is running.","version_check_pending":"최근에 업데이트 되었군요! 환상적입니다!!","installed_version":"설치됨","latest_version":"최근","problems_found":"몇몇의 문제들은 Disocouse 설치 과정에서 나타납니다.","last_checked":"마지막으로 확인","refresh_problems":"새로고침","no_problems":"아무런 문제가 발견되지 않았다.","moderators":"중간 관리자:","admins":"운영자:","blocked":"블락됨:","suspended":"접근금지:","private_messages_short":"PMs","private_messages_title":"개인 메시지","reports":{"today":"오늘","yesterday":"어제","last_7_days":"7일 후","last_30_days":"30일 후","all_time":"모든 시간","7_days_ago":"7일 전","30_days_ago":"30일 전","all":"모두","view_table":"테이블로 보기","view_chart":"차트로 보기"}},"commits":{"latest_changes":"최근 변경 사항 : 자주 업데이트하십시오!","by":"에 의해"},"flags":{"title":"신고","old":"지난 신고","active":"신고","agree_hide":"동의 (게시글 숨기기 + 개인 메시지 보내기)","agree_hide_title":"이 게시물을 숨기고 사용자에게 편집하라는 개인 메시지를 보냅니다.","defer":"연기","defer_title":"지금은 조치가 필요하지 않습니다, 이 신고에 대한 조치을 다음으로 연기하세요.","delete_post":"게시물 삭제","delete_post_title":"게시글 삭제; 만약 첫 게시글이라면 토픽를 삭제","disagree_unhide":"동의하지 않음 (게시글 보이기)","disagree_unhide_title":"게시글의 신고를 삭제하고 보이는 상태로 변경","disagree":"동의하지 않음","disagree_title":"신고에 동의하지 않고, 이 게시글에 달린 신고는 삭제","delete_spammer_title":"사용자와 모든 토픽, 게시글 삭제.","flagged_by":"신고자","error":"뭔가 잘못 됐어요","view_message":"답글","no_results":"신고가 없습니다.","summary":{"action_type_3":{"one":"주제 벗어남","other":"주제 벗어남 x{{count}}"},"action_type_4":{"one":"부적절함","other":"부적절함 x{{count}}"},"action_type_6":{"one":"신고","other":"신고 x{{count}}"},"action_type_7":{"one":"신고","other":"신고 x{{count}}"},"action_type_8":{"one":"스팸","other":"스팸 x{{count}}"}}},"groups":{"title":"그룹","edit":"그룹 수정","selector_placeholder":"사용자 추가","name_placeholder":"그룹 이름, 사용자 이름처럼 스페이스 없이 작성","about":"회원과 이름을 변경","can_not_edit_automatic":"자동으로 회원이 결정됩니다. 관리 사용자는 회원의 역할과 신뢰 레벨을 결정할 수 있습니다.","delete":"삭제","delete_confirm":"이 그룹을 삭제 하시겠습니까?","delete_failed":"이것은 자동으로 생성된 그룹입니다. 삭제할 수 없습니다."},"api":{"generate_master":"마스터 API 키 생성","none":"지금 활성화된 API 키가 없습니다.","user":"사용자","title":"API","key":"API 키","generate":"API 키 생성","regenerate":"API 키 재생성","revoke":"폐지","confirm_regen":"API 키를 새로 발급 받으시겠습니까?","confirm_revoke":"API 키를 폐지하겠습니까?","info_html":"당신의 API 키는 JSON콜을 이용하여 토픽을 생성하거나 수정할 수 있습니다.","all_users":"전체 유저","note_html":"이 \u003Cstrong\u003EAPI 키 번호\u003C/strong\u003E를 노출하지 마세요. 다른 사용자가 대신 글을 작성하거나 수정 할 수 있습니다."},"customize":{"title":"사용자 지정","long_title":"사이트 사용자 지정","header":"헤더","css":"스타일","mobile_header":"Mobile Header","mobile_css":"Mobile Stylesheet","override_default":"표준 스타일 시트를 포함하지 마십시오","enabled":"사용가능?","preview":"미리 보기","undo_preview":"미리 보기 취소","save":"저장","new":"새롭게","new_style":"새로운 스타일","delete":"삭제","delete_confirm":"이 정의를 삭제 하시겠습니까?","about":"사이트 정의는 사이트 스타일 시트와 헤더를 수정할 수 있습니다. 선택하거나 편집을 시작하려면 하나를 추가 할 수 있습니다."},"email":{"title":"이메일","settings":"설정","logs":"로그","sent_at":"보냄","user":"사용자","email_type":"이메일 타입","to_address":"받는 주소","test_email_address":"테스트용 이메일 주소","send_test":"테스트 메일 전송","sent_test":"전송됨!","delivery_method":"전달 방법","preview_digest":"요약 미리보기","preview_digest_desc":"포럼에서 전송되는 요약 메일 미리보기 도구","refresh":"새로고침","format":"형식","html":"html","text":"문장","last_seen_user":"마지막으로 본 사용자","reply_key":"답글 단축키"},"logs":{"title":"기록","action":"허용여부","created_at":"생성된","last_match_at":"마지막 방문","match_count":"방문","ip_address":"IP","delete":"삭제","edit":"편집","save":"저장","screened_actions":{"block":"블락","do_nothing":"아무것도 하지 않음"},"staff_actions":{"title":"중간 관리자 기록","instructions":"사용자 이름을 클릭하고 리스트를 필터링하세요. 아바타를 클릭하여 사용자 페이지로 이동합니다.","clear_filters":"전체 보기","staff_user":"중간 관리 사용자","target_user":"타겟 사용자","subject":"제목","when":"언제","context":"상황","details":"상세","previous_value":"이전값","new_value":"새값","diff":"차이점","show":"보기","modal_title":"상세","no_previous":"이전 값이 없습니다.","deleted":"새로운 값이 없습니다. 기록이 삭제되었습니다.","actions":{"delete_user":"사용사 삭제","change_trust_level":"신뢰 레밸 변경","change_site_setting":"사이트 설정 변경","change_site_customization":"사이트 커스텀화 변경","delete_site_customization":"사이트 커스텀화 삭제","ban_user":"사용자 금지","unban_user":"사용자 금지 해제"}},"screened_emails":{"title":"블락된 이메일들","description":"누군가가 새로운 계정을 만들면 아래 이메일 주소는 체크되고 등록은 블락됩니다, 또는 다른 조치가 취해집니다.","email":"이메일 주소"},"screened_urls":{"title":"블락된 URL들","description":"이 목록은 사용자에 의해 스팸으로 알려진 URL 목록입니다.","url":"URL","domain":"도메인"},"screened_ips":{"title":"블락된 IP들","description":"IP 주소는 감시됩니다. \"허용\"으로 Whitelist에 등록해주세요.","delete_confirm":"%{ip_address} 를 규칙에 의해 삭제할까요?","actions":{"block":"블락","do_nothing":"허용"},"form":{"label":"새 IP :","ip_address":"IP 주소","add":"추가"}}},"impersonate":{"title":"이 사용자로 로그인","username_or_email":"사용자의 아이디 또는 이메일","help":"디버깅 목적으로 사용자 계정으로 로그인하기 위해 이 도구를 사용합니다.","not_found":"해당 사용자를 찾을 수 없습니다.","invalid":"죄송합니다, 해당 사용자로 로그인 할 수 있습니다."},"users":{"title":"사용자","create":"중간 관리자 추가","last_emailed":"마지막 이메일","not_found":"죄송합니다, 그 이름은 우리의 시스템에 존재하지 않습니다.","active":"활동","nav":{"new":"New","active":"활성화","pending":"보류","admins":"운영자들","moderators":"중간 관리자들","suspended":"접근 금지","blocked":"블락됨"},"approved":"승인?","approved_selected":{"one":"사용자 찬성","other":"{{count}} 사용자들 찬성"},"reject_selected":{"one":"사용자 거절","other":"{{count}} 사용자들 거절"},"titles":{"active":"활성 사용자","new":"새로운 사용자","pending":"검토필요한 사용자","newuser":"사용자 신뢰 레벨 0 (새로운 사용자)","basic":"사용자 신뢰 레벨 1 (초보 사용자)","regular":"사용자 신뢰 레벨 2 (보통 사용자)","leader":"사용자 신뢰 레벨 3 (숙련 사용자)","elder":"사용자 신뢰 레벨 4 (고급 사용자)","admins":"운영자 사용자","moderators":"중간 관리자","blocked":"블락된 사용자들","suspended":"접근 금지된 사용자들"},"reject_successful":{"other":"성공적으로 ${count}명의 사용자를 거절하였습니다."},"reject_failures":{"one":"1명의 사용자를 거절하는데 실패했습니다.","other":"%{count}명의 사용자를 거절하는데 실패했습니다."}},"user":{"suspend_failed":"이 사용자를 접근 금지하는데 오류 발생 {{error}}","unsuspend_failed":"이 사용자를 접근 허용 하는데 오류 발생 {{error}}","suspend_duration":"사용자를 몇일 접근 금지 하시겠습니까?","ban_duration_units":"(일)","ban_reason_label":"왜 접근 금지 합니까? 사용자가 로그인을 시도하면 그들은 이 메시지를 보게 됩니다.","ban_reason":"접근 금지 이유","banned_by":"접근 금지자","delete_all_posts":"모든 글을 삭제합니다","delete_all_posts_confirm":"당신은 %{posts} 개의 게시글과 %{topics} 개의 토픽를 삭제합니다. 확실합니까?","suspend":"접근 금지","unsuspend":"접근 허용","suspended":"접근 금지?","moderator":"중간 관리자?","admin":"운영자?","blocked":"블락","show_admin_profile":"운영자","edit_title":"제목 수정","save_title":"제목 저장","refresh_browsers":"브라우저 새로 고침","show_public_profile":"공개 프로필 보기","impersonate":"사용자로 로그인하기","revoke_admin":"운영자권한 취소","grant_admin":"운영자권한 주기","revoke_moderation":"중간 관리자 사용 안함","grant_moderation":"중간 관리자 사용","unblock":"언블락","block":"블락","reputation":"평판","permissions":"권한","activity":"활동","like_count":"좋아요","private_topics_count":"개인적인 토픽 수","posts_read_count":"게시글 읽은 수","post_count":"게시글 수","topics_entered":"토픽 수","flags_given_count":"관심 수","flags_received_count":"관심 받은 수","approve":"승인","approved_by":"승인자","approve_success":"인증 이메일이 발송되었습니다.","approve_bulk_success":"성공! 모든 선택된 사용자는 인증되고 통보졌습니다.","time_read":"읽은 시간","delete":"사용사 삭제","delete_forbidden":{"one":"가입한지 %{count} 일 보다 오래되거나, 소유한 게시글이 있으면 사용자를 삭제할 수 없습니다. 사용자를 삭제하기 전에 모든 게시글을 삭제하세요.","other":"가입한지 %{count} 일 보다 오래되거나, 소유한 게시글이 있으면 사용자를 삭제할 수 없습니다. 사용자를 삭제하기 전에 모든 게시글을 삭제하세요."},"delete_confirm":"당신은 영구적으로 사이트에서 이 사용자를 삭제 하시겠습니까? 이 조치는 영구적입니다!","delete_and_block":"예, 그리고 이메일과 IP주소를 블락합니다.","delete_dont_block":"예, 그리고 이메일과 IP주소를 허용합니다.","deleted":"사용자가 삭제되었습니다.","delete_failed":"해당 사용자를 삭제하는 동안 오류가 발생했습니다. 모든 글은 사용자를 삭제하기 전에 삭제해야합니다.","send_activation_email":"인증 메일 보내기","activation_email_sent":"인증 메일을 보냈습니다.","send_activation_email_failed":"인증 메일 전송중 오류 %{error}","activate":"계정 활성화","activate_failed":"사용자 활성화에 문제가 있습니다.","deactivate_account":"계정 비활성화","deactivate_failed":"사용자 비활성에 문제가 있습니다.","unblock_failed":"사용자 언블락에 문제가 있습니다.","block_failed":"사용자 블락에 문제가 있습니다.","deactivate_explanation":"비활성화 사용자는 이메일 인증을 다시 받아야합니다.","banned_explanation":"접근 금지된 유저는 로그인 할 수 없습니다.","block_explanation":"블락 사용자는 게시글을 작성하거나 토픽를 작성할 수 없습니다.","trust_level_change_failed":"신뢰 레벨 변경에 문제가 있습니다.","ban_modal_title":"사용자 금지"},"site_content":{"none":"편집을 시작하려는 컨텐츠의 타입을 선택하세요.","title":"사이트 컨텐츠","edit":"사이트 컨텐츠를 편집"},"site_settings":{"show_overriden":"오직 수정된 것만 표시","title":"사이트 설정","reset":"기본값으로 재설정","none":"none","site_description":"사이트 설명"}}}}};
I18n.locale = 'ko';
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
// language : korean (ko)
// author : Kyungwook, Park : https://github.com/kyungw00k

moment.lang('ko', {
    months : "1월_2월_3월_4월_5월_6월_7월_8월_9월_10월_11월_12월".split("_"),
    monthsShort : "1월_2월_3월_4월_5월_6월_7월_8월_9월_10월_11월_12월".split("_"),
    weekdays : "일요일_월요일_화요일_수요일_목요일_금요일_토요일".split("_"),
    weekdaysShort : "일_월_화_수_목_금_토".split("_"),
    weekdaysMin : "일_월_화_수_목_금_토".split("_"),
    longDateFormat : {
        LT : "A h시 mm분",
        L : "YYYY.MM.DD",
        LL : "YYYY년 MMMM D일",
        LLL : "YYYY년 MMMM D일 LT",
        LLLL : "YYYY년 MMMM D일 dddd LT"
    },
    meridiem : function (hour, minute, isUpper) {
        return hour < 12 ? '오전' : '오후';
    },
    calendar : {
        sameDay : '오늘 LT',
        nextDay : '내일 LT',
        nextWeek : 'dddd LT',
        lastDay : '어제 LT',
        lastWeek : '지난주 dddd LT',
        sameElse : 'L'
    },
    relativeTime : {
        future : "%s 후",
        past : "%s 전",
        s : "몇초",
        ss : "%d초",
        m : "일분",
        mm : "%d분",
        h : "한시간",
        hh : "%d시간",
        d : "하루",
        dd : "%d일",
        M : "한달",
        MM : "%d달",
        y : "일년",
        yy : "%d년"
    },
    ordinal : '%d일'
});

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
