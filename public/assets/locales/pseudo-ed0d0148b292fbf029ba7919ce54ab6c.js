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
MessageFormat.locale.pseudo = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
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
r += "[[ Ťĥéřé ";
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
r += (pf_0[ MessageFormat.locale["pseudo"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["pseudo"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " řéɱáíɳíɳǧ, óř ";
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
r += "  ]]";
return r;
}});I18n.translations = {"pseudo":{"js":{"dates":{"tiny":{"half_a_minute":"[[ \u003C 1ɱ ]]","less_than_x_seconds":{"one":"[[ \u003C 1š ]]","other":"[[ \u003C %{count}š ]]"},"x_seconds":{"one":"[[ 1š ]]","other":"[[ %{count}š ]]"},"less_than_x_minutes":{"one":"[[ \u003C 1ɱ ]]","other":"[[ \u003C %{count}ɱ ]]"},"x_minutes":{"one":"[[ 1ɱ ]]","other":"[[ %{count}ɱ ]]"},"about_x_hours":{"one":"[[ 1ĥ ]]","other":"[[ %{count}ĥ ]]"},"x_days":{"one":"[[ 1ď ]]","other":"[[ %{count}ď ]]"},"about_x_years":{"one":"[[ 1ý ]]","other":"[[ %{count}ý ]]"},"over_x_years":{"one":"[[ \u003E 1ý ]]","other":"[[ \u003E %{count}ý ]]"},"almost_x_years":{"one":"[[ 1ý ]]","other":"[[ %{count}ý ]]"}},"medium":{"x_minutes":{"one":"[[ 1 ɱíɳ ]]","other":"[[ %{count} ɱíɳš ]]"},"x_hours":{"one":"[[ 1 ĥóůř ]]","other":"[[ %{count} ĥóůřš ]]"},"x_days":{"one":"[[ 1 ďáý ]]","other":"[[ %{count} ďáýš ]]"}},"medium_with_ago":{"x_minutes":{"one":"[[ 1 ɱíɳ áǧó ]]","other":"[[ %{count} ɱíɳš áǧó ]]"},"x_hours":{"one":"[[ 1 ĥóůř áǧó ]]","other":"[[ %{count} ĥóůřš áǧó ]]"},"x_days":{"one":"[[ 1 ďáý áǧó ]]","other":"[[ %{count} ďáýš áǧó ]]"}}},"share":{"topic":"[[ šĥářé á łíɳǩ ťó ťĥíš ťóƿíč ]]","post":"[[ šĥářé á łíɳǩ ťó ťĥíš ƿóšť ]]","close":"[[ čłóšé ]]","twitter":"[[ šĥářé ťĥíš łíɳǩ óɳ Ťŵíťťéř ]]","facebook":"[[ šĥářé ťĥíš łíɳǩ óɳ Ƒáčéƀóóǩ ]]","google+":"[[ šĥářé ťĥíš łíɳǩ óɳ Ǧóóǧłé+ ]]","email":"[[ šéɳď ťĥíš łíɳǩ íɳ áɳ éɱáíł ]]"},"edit":"[[ éďíť ťĥé ťíťłé áɳď čáťéǧóřý óƒ ťĥíš ťóƿíč ]]","not_implemented":"[[ Ťĥáť ƒéáťůřé ĥášɳ'ť ƀééɳ íɱƿłéɱéɳťéď ýéť, šóřřý! ]]","no_value":"[[ Ѝó ]]","yes_value":"[[ Ýéš ]]","of_value":"[[ óƒ ]]","generic_error":"[[ Šóřřý, áɳ éřřóř ĥáš óččůřřéď. ]]","generic_error_with_reason":"[[ Áɳ éřřóř óččůřéď: %{error} ]]","log_in":"[[ Łóǧ Íɳ ]]","age":"[[ Áǧé ]]","last_post":"[[ Łášť ƿóšť ]]","admin_title":"[[ Áďɱíɳ ]]","flags_title":"[[ Ƒłáǧš ]]","show_more":"[[ šĥóŵ ɱóřé ]]","links":"[[ Łíɳǩš ]]","faq":"[[ ƑÁƢ ]]","privacy_policy":"[[ Рříνáčý Рółíčý ]]","you":"[[ Ýóů ]]","or":"[[ óř ]]","now":"[[ ʲůšť ɳóŵ ]]","read_more":"[[ řéáď ɱóřé ]]","in_n_seconds":{"one":"[[ íɳ 1 šéčóɳď ]]","other":"[[ íɳ {{count}} šéčóɳďš ]]"},"in_n_minutes":{"one":"[[ íɳ 1 ɱíɳůťé ]]","other":"[[ íɳ {{count}} ɱíɳůťéš ]]"},"in_n_hours":{"one":"[[ íɳ 1 ĥóůř ]]","other":"[[ íɳ {{count}} ĥóůřš ]]"},"in_n_days":{"one":"[[ íɳ 1 ďáý ]]","other":"[[ íɳ {{count}} ďáýš ]]"},"suggested_topics":{"title":"[[ Šůǧǧéšťéď Ťóƿíčš ]]"},"bookmarks":{"not_logged_in":"[[ Šóřřý, ýóů ɱůšť ƀé łóǧǧéď íɳ ťó ƀóóǩɱářǩ ƿóšťš. ]]","created":"[[ Ýóů'νé ƀóóǩɱářǩéď ťĥíš ƿóšť. ]]","not_bookmarked":"[[ Ýóů'νé řéáď ťĥíš ƿóšť; čłíčǩ ťó ƀóóǩɱářǩ íť. ]]","last_read":"[[ Ťĥíš íš ťĥé łášť ƿóšť ýóů'νé řéáď; čłíčǩ ťó ƀóóǩɱářǩ íť. ]]"},"new_topics_inserted":"[[ {{count}} ɳéŵ ťóƿíčš. ]]","show_new_topics":"[[ Čłíčǩ ťó šĥóŵ. ]]","preview":"[[ ƿřéνíéŵ ]]","cancel":"[[ čáɳčéł ]]","save":"[[ Šáνé Čĥáɳǧéš ]]","saving":"[[ Šáνíɳǧ... ]]","saved":"[[ Šáνéď! ]]","choose_topic":{"none_found":"[[ Ѝó ťóƿíčš ƒóůɳď. ]]","title":{"search":"[[ Šéářčĥ ƒóř á Ťóƿíč ƀý ɳáɱé, ůřł óř íď: ]]","placeholder":"[[ ťýƿé ťĥé ťóƿíč ťíťłé ĥéřé ]]"}},"user_action":{"user_posted_topic":"[[ \u003Cá ĥřéƒ='{{userUrl}}'\u003E{{user}}\u003C/á\u003E ƿóšťéď \u003Cá ĥřéƒ='{{topicUrl}}'\u003Eťĥé ťóƿíč\u003C/á\u003E ]]","you_posted_topic":"[[ \u003Cá ĥřéƒ='{{userUrl}}'\u003EÝóů\u003C/á\u003E ƿóšťéď \u003Cá ĥřéƒ='{{topicUrl}}'\u003Eťĥé ťóƿíč\u003C/á\u003E ]]","user_replied_to_post":"[[ \u003Cá ĥřéƒ='{{userUrl}}'\u003E{{user}}\u003C/á\u003E řéƿłíéď ťó \u003Cá ĥřéƒ='{{postUrl}}'\u003E{{post_number}}\u003C/á\u003E ]]","you_replied_to_post":"[[ \u003Cá ĥřéƒ='{{userUrl}}'\u003EÝóů\u003C/á\u003E řéƿłíéď ťó \u003Cá ĥřéƒ='{{postUrl}}'\u003E{{post_number}}\u003C/á\u003E ]]","user_replied_to_topic":"[[ \u003Cá ĥřéƒ='{{userUrl}}'\u003E{{user}}\u003C/á\u003E řéƿłíéď ťó \u003Cá ĥřéƒ='{{topicUrl}}'\u003Eťĥé ťóƿíč\u003C/á\u003E ]]","you_replied_to_topic":"[[ \u003Cá ĥřéƒ='{{userUrl}}'\u003EÝóů\u003C/á\u003E řéƿłíéď ťó \u003Cá ĥřéƒ='{{topicUrl}}'\u003Eťĥé ťóƿíč\u003C/á\u003E ]]","user_mentioned_user":"[[ \u003Cá ĥřéƒ='{{user1Url}}'\u003E{{user}}\u003C/á\u003E ɱéɳťíóɳéď \u003Cá ĥřéƒ='{{user2Url}}'\u003E{{another_user}}\u003C/á\u003E ]]","user_mentioned_you":"[[ \u003Cá ĥřéƒ='{{user1Url}}'\u003E{{user}}\u003C/á\u003E ɱéɳťíóɳéď \u003Cá ĥřéƒ='{{user2Url}}'\u003Eýóů\u003C/á\u003E ]]","you_mentioned_user":"[[ \u003Cá ĥřéƒ='{{user1Url}}'\u003EÝóů\u003C/á\u003E ɱéɳťíóɳéď \u003Cá ĥřéƒ='{{user2Url}}'\u003E{{user}}\u003C/á\u003E ]]","posted_by_user":"[[ Рóšťéď ƀý \u003Cá ĥřéƒ='{{userUrl}}'\u003E{{user}}\u003C/á\u003E ]]","posted_by_you":"[[ Рóšťéď ƀý \u003Cá ĥřéƒ='{{userUrl}}'\u003Eýóů\u003C/á\u003E ]]","sent_by_user":"[[ Šéɳť ƀý \u003Cá ĥřéƒ='{{userUrl}}'\u003E{{user}}\u003C/á\u003E ]]","sent_by_you":"[[ Šéɳť ƀý \u003Cá ĥřéƒ='{{userUrl}}'\u003Eýóů\u003C/á\u003E ]]"},"user_action_groups":{"1":"[[ Łíǩéš Ǧíνéɳ ]]","2":"[[ Łíǩéš Řéčéíνéď ]]","3":"[[ Ɓóóǩɱářǩš ]]","4":"[[ Ťóƿíčš ]]","5":"[[ Рóšťš ]]","6":"[[ Řéšƿóɳšéš ]]","7":"[[ Ϻéɳťíóɳš ]]","9":"[[ Ƣůóťéš ]]","10":"[[ Ƒáνóříťéš ]]","11":"[[ Éďíťš ]]","12":"[[ Šéɳť Íťéɱš ]]","13":"[[ Íɳƀóх ]]"},"user":{"profile":"[[ Рřóƒíłé ]]","mute":"[[ Ϻůťé ]]","edit":"[[ Éďíť Рřéƒéřéɳčéš ]]","download_archive":"[[ ďóŵɳłóáď ářčĥíνé óƒ ɱý ƿóšťš ]]","private_message":"[[ Рříνáťé Ϻéššáǧé ]]","private_messages":"[[ Ϻéššáǧéš ]]","activity_stream":"[[ Áčťíνíťý ]]","preferences":"[[ Рřéƒéřéɳčéš ]]","bio":"[[ Áƀóůť ɱé ]]","invited_by":"[[ Íɳνíťéď Ɓý ]]","trust_level":"[[ Ťřůšť Łéνéł ]]","notifications":"[[ Ѝóťíƒíčáťíóɳš ]]","dynamic_favicon":"[[ Šĥóŵ íɳčóɱíɳǧ ɱéššáǧé ɳóťíƒíčáťíóɳš óɳ ƒáνíčóɳ ]]","external_links_in_new_tab":"[[ Óƿéɳ áłł éхťéřɳáł łíɳǩš íɳ á ɳéŵ ťáƀ ]]","enable_quoting":"[[ Éɳáƀłé ƣůóťé řéƿłý ƒóř ĥíǧĥłíǧĥťéď ťéхť ]]","moderator":"[[ {{user}} íš á ɱóďéřáťóř ]]","admin":"[[ {{user}} íš áɳ áďɱíɳ ]]","change_password":{"action":"[[ čĥáɳǧé ]]","success":"[[ (éɱáíł šéɳť) ]]","in_progress":"[[ (šéɳďíɳǧ éɱáíł) ]]","error":"[[ (éřřóř) ]]"},"change_username":{"action":"[[ čĥáɳǧé ]]","title":"[[ Čĥáɳǧé Ůšéřɳáɱé ]]","confirm":"[[ Ťĥéřé čóůłď ƀé čóɳšéƣůéɳčéš ťó čĥáɳǧíɳǧ ýóůř ůšéřɳáɱé. Ářé ýóů áƀšółůťéłý šůřé ýóů ŵáɳť ťó? ]]","taken":"[[ Šóřřý, ťĥáť ůšéřɳáɱé íš ťáǩéɳ. ]]","error":"[[ Ťĥéřé ŵáš áɳ éřřóř čĥáɳǧíɳǧ ýóůř ůšéřɳáɱé. ]]","invalid":"[[ Ťĥáť ůšéřɳáɱé íš íɳνáłíď. Íť ɱůšť óɳłý íɳčłůďé ɳůɱƀéřš áɳď łéťťéřš ]]"},"change_email":{"action":"[[ čĥáɳǧé ]]","title":"[[ Čĥáɳǧé Éɱáíł ]]","taken":"[[ Šóřřý, ťĥáť éɱáíł íš ɳóť áνáíłáƀłé. ]]","error":"[[ Ťĥéřé ŵáš áɳ éřřóř čĥáɳǧíɳǧ ýóůř éɱáíł. Рéřĥáƿš ťĥáť áďďřéšš íš áłřéáďý íɳ ůšé? ]]","success":"[[ Ŵé'νé šéɳť áɳ éɱáíł ťó ťĥáť áďďřéšš. Рłéášé ƒółłóŵ ťĥé čóɳƒířɱáťíóɳ íɳšťřůčťíóɳš. ]]"},"email":{"title":"[[ Éɱáíł ]]","instructions":"[[ Ýóůř éɱáíł ŵíłł ɳéνéř ƀé šĥóŵɳ ťó ťĥé ƿůƀłíč. ]]","ok":"[[ Łóóǩš ǧóóď. Ŵé ŵíłł éɱáíł ýóů ťó čóɳƒířɱ. ]]","invalid":"[[ Рłéášé éɳťéř á νáłíď éɱáíł áďďřéšš. ]]","authenticated":"[[ Ýóůř éɱáíł ĥáš ƀééɳ áůťĥéɳťíčáťéď ƀý {{provider}}. ]]","frequency":"[[ Ŵé'łł óɳłý éɱáíł ýóů íƒ ŵé ĥáνéɳ'ť šééɳ ýóů řéčéɳťłý áɳď ýóů ĥáνéɳ'ť áłřéáďý šééɳ ťĥé ťĥíɳǧ ŵé'řé éɱáíłíɳǧ ýóů áƀóůť. ]]"},"name":{"title":"[[ Ѝáɱé ]]","instructions":"[[ Ťĥé łóɳǧéř νéřšíóɳ óƒ ýóůř ɳáɱé; ďóéš ɳóť ɳééď ťó ƀé ůɳíƣůé. Ůšéď ƒóř áłťéřɳáťé @ɳáɱé ɱáťčĥíɳǧ áɳď šĥóŵɳ óɳłý óɳ ýóůř ůšéř ƿáǧé. ]]","too_short":"[[ Ýóůř ɳáɱé íš ťóó šĥóřť. ]]","ok":"[[ Ýóůř ɳáɱé łóóǩš ǧóóď. ]]"},"username":{"title":"[[ Ůšéřɳáɱé ]]","instructions":"[[ Ϻůšť ƀé ůɳíƣůé, ɳó šƿáčéš. Рéóƿłé čáɳ ɱéɳťíóɳ ýóů áš @ůšéřɳáɱé. ]]","short_instructions":"[[ Рéóƿłé čáɳ ɱéɳťíóɳ ýóů áš @{{username}}. ]]","available":"[[ Ýóůř ůšéřɳáɱé íš áνáíłáƀłé. ]]","global_match":"[[ Éɱáíł ɱáťčĥéš ťĥé řéǧíšťéřéď ůšéřɳáɱé. ]]","global_mismatch":"[[ Áłřéáďý řéǧíšťéřéď. Ťřý {{suggestion}}? ]]","not_available":"[[ Ѝóť áνáíłáƀłé. Ťřý {{suggestion}}? ]]","too_short":"[[ Ýóůř ůšéřɳáɱé íš ťóó šĥóřť. ]]","too_long":"[[ Ýóůř ůšéřɳáɱé íš ťóó łóɳǧ. ]]","checking":"[[ Čĥéčǩíɳǧ ůšéřɳáɱé áνáíłáƀíłíťý... ]]","enter_email":"[[ Ůšéřɳáɱé ƒóůɳď. Éɳťéř ɱáťčĥíɳǧ éɱáíł. ]]"},"password_confirmation":{"title":"[[ Рáššŵóřď Áǧáíɳ ]]"},"last_posted":"[[ Łášť Рóšť ]]","last_emailed":"[[ Łášť Éɱáíłéď ]]","last_seen":"[[ Łášť Šééɳ ]]","created":"[[ Čřéáťéď Áť ]]","log_out":"[[ Łóǧ Óůť ]]","website":"[[ Ŵéƀ Šíťé ]]","email_settings":"[[ Éɱáíł ]]","email_digests":{"title":"[[ Ŵĥéɳ Í ďóɳ'ť νíšíť ťĥé šíťé, šéɳď ɱé áɳ éɱáíł ďíǧéšť óƒ ŵĥáť'š ɳéŵ ]]","daily":"[[ ďáíłý ]]","weekly":"[[ ŵééǩłý ]]","bi_weekly":"[[ éνéřý ťŵó ŵééǩš ]]"},"email_direct":"[[ Řéčéíνé áɳ éɱáíł ŵĥéɳ šóɱéóɳé ƣůóťéš ýóů, řéƿłíéš ťó ýóůř ƿóšť, óř ɱéɳťíóɳš ýóůř @ůšéřɳáɱé ]]","email_private_messages":"[[ Řéčéíνé áɳ éɱáíł ŵĥéɳ šóɱéóɳé šéɳďš ýóů á ƿříνáťé ɱéššáǧé ]]","other_settings":"[[ Óťĥéř ]]","new_topic_duration":{"label":"[[ Čóɳšíďéř ťóƿíčš ɳéŵ ŵĥéɳ ]]","not_viewed":"[[ Í ĥáνéɳ'ť νíéŵéď ťĥéɱ ýéť ]]","last_here":"[[ ťĥéý ŵéřé ƿóšťéď šíɳčé Í ŵáš ĥéřé łášť ]]","after_n_days":{"one":"[[ ťĥéý ŵéřé ƿóšťéď íɳ ťĥé łášť ďáý ]]","other":"[[ ťĥéý ŵéřé ƿóšťéď íɳ ťĥé łášť {{count}} ďáýš ]]"},"after_n_weeks":{"one":"[[ ťĥéý ŵéřé ƿóšťéď íɳ ťĥé łášť ŵééǩ ]]","other":"[[ ťĥéý ŵéřé ƿóšťéď íɳ ťĥé łášť {{count}} ŵééǩ ]]"}},"auto_track_topics":"[[ Áůťóɱáťíčáłłý ťřáčǩ ťóƿíčš Í éɳťéř ]]","auto_track_options":{"never":"[[ ɳéνéř ]]","always":"[[ áłŵáýš ]]","after_n_seconds":{"one":"[[ áƒťéř 1 šéčóɳď ]]","other":"[[ áƒťéř {{count}} šéčóɳďš ]]"},"after_n_minutes":{"one":"[[ áƒťéř 1 ɱíɳůťé ]]","other":"[[ áƒťéř {{count}} ɱíɳůťéš ]]"}},"invited":{"title":"[[ Íɳνíťéš ]]","user":"[[ Íɳνíťéď Ůšéř ]]","none":"[[ {{username}} ĥášɳ'ť íɳνíťéď áɳý ůšéřš ťó ťĥé šíťé. ]]","redeemed":"[[ Řéďééɱéď Íɳνíťéš ]]","redeemed_at":"[[ Řéďééɱéď Áť ]]","pending":"[[ Рéɳďíɳǧ Íɳνíťéš ]]","topics_entered":"[[ Ťóƿíčš Éɳťéřéď ]]","posts_read_count":"[[ Рóšťš Řéáď ]]","rescind":"[[ Řéɱóνé Íɳνíťáťíóɳ ]]","rescinded":"[[ Íɳνíťé řéɱóνéď ]]","time_read":"[[ Řéáď Ťíɱé ]]","days_visited":"[[ Ďáýš Ѷíšíťéď ]]","account_age_days":"[[ Áččóůɳť áǧé íɳ ďáýš ]]"},"password":{"title":"[[ Рáššŵóřď ]]","too_short":"[[ Ýóůř ƿáššŵóřď íš ťóó šĥóřť. ]]","ok":"[[ Ýóůř ƿáššŵóřď łóóǩš ǧóóď. ]]"},"ip_address":{"title":"[[ Łášť ÍР Áďďřéšš ]]"},"avatar":{"title":"[[ Áνáťář ]]"},"title":{"title":"[[ Ťíťłé ]]"},"filters":{"all":"[[ Áłł ]]"},"stream":{"posted_by":"[[ Рóšťéď ƀý ]]","sent_by":"[[ Šéɳť ƀý ]]","private_message":"[[ ƿříνáťé ɱéššáǧé ]]","the_topic":"[[ ťĥé ťóƿíč ]]"}},"loading":"[[ Łóáďíɳǧ... ]]","close":"[[ Čłóšé ]]","learn_more":"[[ łéářɳ ɱóřé... ]]","year":"[[ ýéář ]]","year_desc":"[[ ťóƿíčš ƿóšťéď íɳ ťĥé łášť 365 ďáýš ]]","month":"[[ ɱóɳťĥ ]]","month_desc":"[[ ťóƿíčš ƿóšťéď íɳ ťĥé łášť 30 ďáýš ]]","week":"[[ ŵééǩ ]]","week_desc":"[[ ťóƿíčš ƿóšťéď íɳ ťĥé łášť 7 ďáýš ]]","first_post":"[[ Ƒířšť ƿóšť ]]","mute":"[[ Ϻůťé ]]","unmute":"[[ Ůɳɱůťé ]]","best_of":{"title":"[[ Ɓéšť Óƒ ]]","enabled_description":"[[ Ýóů ářé čůřřéɳťłý νíéŵíɳǧ ťĥé \"Ɓéšť Óƒ\" νíéŵ óƒ ťĥíš ťóƿíč. ]]","description":"[[ Ťĥéřé ářé \u003Cƀ\u003E{{count}}\u003C/ƀ\u003E ƿóšťš íɳ ťĥíš ťóƿíč. Ťĥáť'š á łóť! Ŵóůłď ýóů łíǩé ťó šáνé ťíɱé ƀý šĥóŵíɳǧ óɳłý ťĥé ƀéšť ƿóšťš? ]]","enable":"[[ Šŵíťčĥ ťó \"Ɓéšť Óƒ\" νíéŵ ]]","disable":"[[ Čáɳčéł \"Ɓéšť Óƒ\" ]]"},"private_message_info":{"title":"[[ Рříνáťé Ϻéššáǧé ]]","invite":"[[ Íɳνíťé Óťĥéřš... ]]"},"email":"[[ Éɱáíł ]]","username":"[[ Ůšéřɳáɱé ]]","last_seen":"[[ Łášť Šééɳ ]]","created":"[[ Čřéáťéď ]]","trust_level":"[[ Ťřůšť Łéνéł ]]","create_account":{"title":"[[ Čřéáťé Áččóůɳť ]]","action":"[[ Čřéáťé óɳé ɳóŵ! ]]","invite":"[[ Ďóɳ'ť ĥáνé áɳ áččóůɳť ýéť? ]]","failed":"[[ Šóɱéťĥíɳǧ ŵéɳť ŵřóɳǧ, ƿéřĥáƿš ťĥíš éɱáíł íš áłřéáďý řéǧíšťéřéď, ťřý ťĥé ƒóřǧóť ƿáššŵóřď łíɳǩ ]]"},"forgot_password":{"title":"[[ Ƒóřǧóť Рáššŵóřď ]]","action":"[[ Í ƒóřǧóť ɱý ƿáššŵóřď ]]","invite":"[[ Éɳťéř ýóůř ůšéřɳáɱé óř éɱáíł áďďřéšš, áɳď ŵé'łł šéɳď ýóů á ƿáššŵóřď řéšéť éɱáíł. ]]","reset":"[[ Řéšéť Рáššŵóřď ]]","complete":"[[ Íƒ áɳ áččóůɳť ɱáťčĥéš ťĥáť ůšéřɳáɱé óř éɱáíł áďďřéšš, ýóů šĥóůłď řéčéíνé áɳ éɱáíł ŵíťĥ íɳšťřůčťíóɳš óɳ ĥóŵ ťó řéšéť ýóůř ƿáššŵóřď šĥóřťłý. ]]"},"login":{"title":"[[ Łóǧ Íɳ ]]","username":"[[ Łóǧíɳ ]]","password":"[[ Рáššŵóřď ]]","email_placeholder":"[[ éɱáíł áďďřéšš óř ůšéřɳáɱé ]]","error":"[[ Ůɳǩɳóŵɳ éřřóř ]]","reset_password":"[[ Řéšéť Рáššŵóřď ]]","logging_in":"[[ Łóǧǧíɳǧ Íɳ... ]]","or":"[[ Óř ]]","authenticating":"[[ Áůťĥéɳťíčáťíɳǧ... ]]","awaiting_confirmation":"[[ Ýóůř áččóůɳť íš áŵáíťíɳǧ áčťíνáťíóɳ, ůšé ťĥé ƒóřǧóť ƿáššŵóřď łíɳǩ ťó íššůé áɳóťĥéř áčťíνáťíóɳ éɱáíł. ]]","awaiting_approval":"[[ Ýóůř áččóůɳť ĥáš ɳóť ƀééɳ áƿƿřóνéď ƀý á šťáƒƒ ɱéɱƀéř ýéť. Ýóů ŵíłł ƀé šéɳť áɳ éɱáíł ŵĥéɳ íť íš áƿƿřóνéď. ]]","not_activated":"[[ Ýóů čáɳ'ť łóǧ íɳ ýéť. Ŵé ƿřéνíóůšłý šéɳť áɳ áčťíνáťíóɳ éɱáíł ťó ýóů áť \u003Cƀ\u003E{{sentTo}}\u003C/ƀ\u003E. Рłéášé ƒółłóŵ ťĥé íɳšťřůčťíóɳš íɳ ťĥáť éɱáíł ťó áčťíνáťé ýóůř áččóůɳť. ]]","resend_activation_email":"[[ Čłíčǩ ĥéřé ťó šéɳď ťĥé áčťíνáťíóɳ éɱáíł áǧáíɳ. ]]","sent_activation_email_again":"[[ Ŵé šéɳť áɳóťĥéř áčťíνáťíóɳ éɱáíł ťó ýóů áť \u003Cƀ\u003E{{currentEmail}}\u003C/ƀ\u003E. Íť ɱíǧĥť ťáǩé á ƒéŵ ɱíɳůťéš ƒóř íť ťó ářříνé; ƀé šůřé ťó čĥéčǩ ýóůř šƿáɱ ƒółďéř. ]]","google":{"title":"[[ ŵíťĥ Ǧóóǧłé ]]","message":"[[ Áůťĥéɳťíčáťíɳǧ ŵíťĥ Ǧóóǧłé (ɱáǩé šůřé ƿóƿ ůƿ ƀłóčǩéřš ářé ɳóť éɳáƀłéď) ]]"},"twitter":{"title":"[[ ŵíťĥ Ťŵíťťéř ]]","message":"[[ Áůťĥéɳťíčáťíɳǧ ŵíťĥ Ťŵíťťéř (ɱáǩé šůřé ƿóƿ ůƿ ƀłóčǩéřš ářé ɳóť éɳáƀłéď) ]]"},"facebook":{"title":"[[ ŵíťĥ Ƒáčéƀóóǩ ]]","message":"[[ Áůťĥéɳťíčáťíɳǧ ŵíťĥ Ƒáčéƀóóǩ (ɱáǩé šůřé ƿóƿ ůƿ ƀłóčǩéřš ářé ɳóť éɳáƀłéď) ]]"},"cas":{"title":"[[ Łóǧ Íɳ ŵíťĥ ČÁŠ ]]","message":"[[ Áůťĥéɳťíčáťíɳǧ ŵíťĥ ČÁŠ (ɱáǩé šůřé ƿóƿ ůƿ ƀłóčǩéřš ářé ɳóť éɳáƀłéď) ]]"},"yahoo":{"title":"[[ ŵíťĥ Ýáĥóó ]]","message":"[[ Áůťĥéɳťíčáťíɳǧ ŵíťĥ Ýáĥóó (ɱáǩé šůřé ƿóƿ ůƿ ƀłóčǩéřš ářé ɳóť éɳáƀłéď) ]]"},"github":{"title":"[[ ŵíťĥ ǦíťĤůƀ ]]","message":"[[ Áůťĥéɳťíčáťíɳǧ ŵíťĥ ǦíťĤůƀ (ɱáǩé šůřé ƿóƿ ůƿ ƀłóčǩéřš ářé ɳóť éɳáƀłéď) ]]"},"persona":{"title":"[[ ŵíťĥ Рéřšóɳá ]]","message":"[[ Áůťĥéɳťíčáťíɳǧ ŵíťĥ Ϻóžíłłá Рéřšóɳá (ɱáǩé šůřé ƿóƿ ůƿ ƀłóčǩéřš ářé ɳóť éɳáƀłéď) ]]"}},"composer":{"posting_not_on_topic":"[[ Ŵĥíčĥ ťóƿíč ďó ýóů ŵáɳť ťó řéƿłý ťó? ]]","saving_draft_tip":"[[ šáνíɳǧ ]]","saved_draft_tip":"[[ šáνéď ]]","saved_local_draft_tip":"[[ šáνéď łóčáłłý ]]","similar_topics":"[[ Ýóůř ťóƿíč íš šíɱíłář ťó... ]]","drafts_offline":"[[ ďřáƒťš óƒƒłíɳé ]]","min_length":{"need_more_for_title":"[[ {{n}} ťó ǧó ƒóř ťĥé ťíťłé ]]","need_more_for_reply":"[[ {{n}} ťó ǧó ƒóř ťĥé ƿóšť ]]"},"error":{"title_missing":"[[ Ťíťłé íš řéƣůířéď. ]]","title_too_short":"[[ Ťíťłé ɱůšť ƀé áť łéášť {{min}} čĥářáčťéřš łóɳǧ. ]]","title_too_long":"[[ Ťíťłé ɱůšť ƀé łéšš ťĥáɳ {{max}} čĥářáčťéřš łóɳǧ. ]]","post_missing":"[[ Рóšť čáɳ'ť ƀé éɱƿťý. ]]","post_length":"[[ Рóšť ɱůšť ƀé áť łéášť {{min}} čĥářáčťéřš łóɳǧ. ]]","category_missing":"[[ Ýóů ɱůšť čĥóóšé á čáťéǧóřý. ]]"},"save_edit":"[[ Šáνé Éďíť ]]","reply_original":"[[ Řéƿłý óɳ Óříǧíɳáł Ťóƿíč ]]","reply_here":"[[ Řéƿłý Ĥéřé ]]","reply":"[[ Řéƿłý ]]","cancel":"[[ Čáɳčéł ]]","create_topic":"[[ Čřéáťé Ťóƿíč ]]","create_pm":"[[ Čřéáťé Рříνáťé Ϻéššáǧé ]]","users_placeholder":"[[ Áďď á ůšéř ]]","title_placeholder":"[[ Ťýƿé ýóůř ťíťłé ĥéřé. Ŵĥáť íš ťĥíš ďíščůššíóɳ áƀóůť íɳ óɳé ƀříéƒ šéɳťéɳčé? ]]","reply_placeholder":"[[ Ťýƿé ĥéřé. Ůšé Ϻářǩďóŵɳ óř ƁƁČóďé ťó ƒóřɱáť. Ďřáǧ óř ƿášťé áɳ íɱáǧé ťó ůƿłóáď íť. ]]","view_new_post":"[[ Ѷíéŵ ýóůř ɳéŵ ƿóšť. ]]","saving":"[[ Šáνíɳǧ... ]]","saved":"[[ Šáνéď! ]]","saved_draft":"[[ Ýóů ĥáνé á ƿóšť ďřáƒť íɳ ƿřóǧřéšš. Čłíčǩ áɳýŵĥéřé íɳ ťĥíš ƀóх ťó řéšůɱé éďíťíɳǧ. ]]","uploading":"[[ Ůƿłóáďíɳǧ... ]]","show_preview":"[[ šĥóŵ ƿřéνíéŵ \u0026řáƣůó; ]]","hide_preview":"[[ \u0026łáƣůó; ĥíďé ƿřéνíéŵ ]]","quote_post_title":"[[ Ƣůóťé ŵĥółé ƿóšť ]]","bold_title":"[[ Šťřóɳǧ ]]","bold_text":"[[ šťřóɳǧ ťéхť ]]","italic_title":"[[ Éɱƿĥášíš ]]","italic_text":"[[ éɱƿĥášížéď ťéхť ]]","link_title":"[[ Ĥýƿéřłíɳǩ ]]","link_description":"[[ éɳťéř łíɳǩ ďéščříƿťíóɳ ĥéřé ]]","link_dialog_title":"[[ Íɳšéřť Ĥýƿéřłíɳǩ ]]","link_optional_text":"[[ óƿťíóɳáł ťíťłé ]]","quote_title":"[[ Ɓłóčǩƣůóťé ]]","quote_text":"[[ Ɓłóčǩƣůóťé ]]","code_title":"[[ Čóďé Šáɱƿłé ]]","code_text":"[[ éɳťéř čóďé ĥéřé ]]","upload_title":"[[ Íɱáǧé ]]","upload_description":"[[ éɳťéř íɱáǧé ďéščříƿťíóɳ ĥéřé ]]","olist_title":"[[ Ѝůɱƀéřéď Łíšť ]]","ulist_title":"[[ Ɓůłłéťéď Łíšť ]]","list_item":"[[ Łíšť íťéɱ ]]","heading_title":"[[ Ĥéáďíɳǧ ]]","heading_text":"[[ Ĥéáďíɳǧ ]]","hr_title":"[[ Ĥóřížóɳťáł Řůłé ]]","undo_title":"[[ Ůɳďó ]]","redo_title":"[[ Řéďó ]]","help":"[[ Ϻářǩďóŵɳ Éďíťíɳǧ Ĥéłƿ ]]","toggler":"[[ ĥíďé óř šĥóŵ ťĥé čóɱƿóšéř ƿáɳéł ]]","admin_options_title":"[[ Óƿťíóɳáł šťáƒƒ šéťťíɳǧš ƒóř ťĥíš ťóƿíč ]]","auto_close_label":"[[ Áůťó-čłóšé ťóƿíč áƒťéř: ]]","auto_close_units":"[[ ďáýš ]]"},"notifications":{"title":"[[ ɳóťíƒíčáťíóɳš óƒ @ɳáɱé ɱéɳťíóɳš, řéƿłíéš ťó ýóůř ƿóšťš áɳď ťóƿíčš, ƿříνáťé ɱéššáǧéš, éťč ]]","none":"[[ Ýóů ĥáνé ɳó ɳóťíƒíčáťíóɳš říǧĥť ɳóŵ. ]]","more":"[[ νíéŵ ółďéř ɳóťíƒíčáťíóɳš ]]","mentioned":"[[ \u003Cšƿáɳ ťíťłé='ɱéɳťíóɳéď' čłášš='íčóɳ'\u003E@\u003C/šƿáɳ\u003E {{username}} {{link}} ]]","quoted":"[[ \u003Cí ťíťłé='ƣůóťéď' čłášš='íčóɳ íčóɳ-ƣůóťé-říǧĥť'\u003E\u003C/í\u003E {{username}} {{link}} ]]","replied":"[[ \u003Cí ťíťłé='řéƿłíéď' čłášš='íčóɳ íčóɳ-řéƿłý'\u003E\u003C/í\u003E {{username}} {{link}} ]]","posted":"[[ \u003Cí ťíťłé='řéƿłíéď' čłášš='íčóɳ íčóɳ-řéƿłý'\u003E\u003C/í\u003E {{username}} {{link}} ]]","edited":"[[ \u003Cí ťíťłé='éďíťéď' čłášš='íčóɳ íčóɳ-ƿéɳčíł'\u003E\u003C/í\u003E {{username}} {{link}} ]]","liked":"[[ \u003Cí ťíťłé='łíǩéď' čłášš='íčóɳ íčóɳ-ĥéářť'\u003E\u003C/í\u003E {{username}} {{link}} ]]","private_message":"[[ \u003Cí čłášš='íčóɳ íčóɳ-éɳνéłóƿé-áłť' ťíťłé='ƿříνáťé ɱéššáǧé'\u003E\u003C/í\u003E {{username}} {{link}} ]]","invited_to_private_message":"[[ \u003Cí čłášš='íčóɳ íčóɳ-éɳνéłóƿé-áłť' ťíťłé='ƿříνáťé ɱéššáǧé'\u003E\u003C/í\u003E {{username}} {{link}} ]]","invitee_accepted":"[[ \u003Cí ťíťłé='áččéƿťéď ýóůř íɳνíťáťíóɳ' čłášš='íčóɳ íčóɳ-šíǧɳíɳ'\u003E\u003C/í\u003E {{username}} áččéƿťéď ýóůř íɳνíťáťíóɳ ]]","moved_post":"[[ \u003Cí ťíťłé='ɱóνéď ƿóšť' čłášš='íčóɳ íčóɳ-ářřóŵ-říǧĥť'\u003E\u003C/í\u003E {{username}} ɱóνéď ťó {{link}} ]]","total_flagged":"[[ ťóťáł ƒłáǧǧéď ƿóšťš ]]"},"upload_selector":{"title":"[[ Íɳšéřť Íɱáǧé ]]","from_my_computer":"[[ Ƒřóɱ Ϻý Ďéνíčé ]]","from_the_web":"[[ Ƒřóɱ Ťĥé Ŵéƀ ]]","remote_tip":"[[ éɳťéř áďďřéšš óƒ áɳ íɱáǧé íɳ ťĥé ƒóřɱ ĥťťƿ://éхáɱƿłé.čóɱ/íɱáǧé.ʲƿǧ ]]","local_tip":"[[ čłíčǩ ťó šéłéčť áɳ íɱáǧé ƒřóɱ ýóůř ďéνíčé. ]]","uploading":"[[ Ůƿłóáďíɳǧ íɱáǧé ]]"},"search":{"title":"[[ šéářčĥ ƒóř ťóƿíčš, ƿóšťš, ůšéřš, óř čáťéǧóříéš ]]","placeholder":"[[ ťýƿé ýóůř šéářčĥ ťéřɱš ĥéřé ]]","no_results":"[[ Ѝó řéšůłťš ƒóůɳď. ]]","searching":"[[ Šéářčĥíɳǧ ... ]]","prefer":{"user":"[[ šéářčĥ ŵíłł ƿřéƒéř řéšůłťš ƀý @{{username}} ]]","category":"[[ šéářčĥ ŵíłł ƿřéƒéř řéšůłťš íɳ {{category}} ]]"}},"site_map":"[[ ǧó ťó áɳóťĥéř ťóƿíč łíšť óř čáťéǧóřý ]]","go_back":"[[ ǧó ƀáčǩ ]]","current_user":"[[ ǧó ťó ýóůř ůšéř ƿáǧé ]]","favorite":{"title":"[[ Ƒáνóříťé ]]","help":{"star":"[[ áďď ťĥíš ťóƿíč ťó ýóůř ƒáνóříťéš łíšť ]]","unstar":"[[ řéɱóνé ťĥíš ťóƿíč ƒřóɱ ýóůř ƒáνóříťéš łíšť ]]"}},"topics":{"none":{"favorited":"[[ Ýóů ĥáνéɳ'ť ƒáνóříťéď áɳý ťóƿíčš ýéť. Ťó ƒáνóříťé á ťóƿíč, čłíčǩ óř ťáƿ ťĥé šťář ɳéхť ťó ťĥé ťíťłé. ]]","unread":"[[ Ýóů ĥáνé ɳó ůɳřéáď ťóƿíčš. ]]","new":"[[ Ýóů ĥáνé ɳó ɳéŵ ťóƿíčš. ]]","read":"[[ Ýóů ĥáνéɳ'ť řéáď áɳý ťóƿíčš ýéť. ]]","posted":"[[ Ýóů ĥáνéɳ'ť ƿóšťéď íɳ áɳý ťóƿíčš ýéť. ]]","latest":"[[ Ťĥéřé ářé ɳó łáťéšť ťóƿíčš. Ťĥáť'š šáď. ]]","hot":"[[ Ťĥéřé ářé ɳó ĥóť ťóƿíčš. ]]","category":"[[ Ťĥéřé ářé ɳó {{category}} ťóƿíčš. ]]"},"bottom":{"latest":"[[ Ťĥéřé ářé ɳó ɱóřé łáťéšť ťóƿíčš. ]]","hot":"[[ Ťĥéřé ářé ɳó ɱóřé ĥóť ťóƿíčš. ]]","posted":"[[ Ťĥéřé ářé ɳó ɱóřé ƿóšťéď ťóƿíčš. ]]","read":"[[ Ťĥéřé ářé ɳó ɱóřé řéáď ťóƿíčš. ]]","new":"[[ Ťĥéřé ářé ɳó ɱóřé ɳéŵ ťóƿíčš. ]]","unread":"[[ Ťĥéřé ářé ɳó ɱóřé ůɳřéáď ťóƿíčš. ]]","favorited":"[[ Ťĥéřé ářé ɳó ɱóřé ƒáνóříťéď ťóƿíčš. ]]","category":"[[ Ťĥéřé ářé ɳó ɱóřé {{category}} ťóƿíčš. ]]"}},"rank_details":{"toggle":"[[ ťóǧǧłé ťóƿíč řáɳǩ ďéťáíłš ]]","show":"[[ šĥóŵ ťóƿíč řáɳǩ ďéťáíłš ]]","title":"[[ Ťóƿíč Řáɳǩ Ďéťáíłš ]]"},"topic":{"create":"[[ Čřéáťé Ťóƿíč ]]","create_long":"[[ Čřéáťé á ɳéŵ Ťóƿíč ]]","private_message":"[[ Šťářť á ƿříνáťé ɱéššáǧé ]]","list":"[[ Ťóƿíčš ]]","new":"[[ ɳéŵ ťóƿíč ]]","title":"[[ Ťóƿíč ]]","loading_more":"[[ Łóáďíɳǧ ɱóřé Ťóƿíčš... ]]","loading":"[[ Łóáďíɳǧ ťóƿíč... ]]","invalid_access":{"title":"[[ Ťóƿíč íš ƿříνáťé ]]","description":"[[ Šóřřý, ýóů ďóɳ'ť ĥáνé áččéšš ťó ťĥáť ťóƿíč! ]]"},"server_error":{"title":"[[ Ťóƿíč ƒáíłéď ťó łóáď ]]","description":"[[ Šóřřý, ŵé čóůłďɳ'ť łóáď ťĥáť ťóƿíč, ƿóššíƀłý ďůé ťó á čóɳɳéčťíóɳ ƿřóƀłéɱ. Рłéášé ťřý áǧáíɳ. Íƒ ťĥé ƿřóƀłéɱ ƿéřšíšťš, łéť ůš ǩɳóŵ. ]]"},"not_found":{"title":"[[ Ťóƿíč ɳóť ƒóůɳď ]]","description":"[[ Šóřřý, ŵé čóůłďɳ'ť ƒíɳď ťĥáť ťóƿíč. Рéřĥáƿš íť ŵáš řéɱóνéď ƀý á ɱóďéřáťóř? ]]"},"unread_posts":{"one":"[[ ýóů ĥáνé 1 ůɳřéáď ółď ƿóšť íɳ ťĥíš ťóƿíč ]]","other":"[[ ýóů ĥáνé {{count}} ůɳřéáď ółď ƿóšťš íɳ ťĥíš ťóƿíč ]]"},"new_posts":{"one":"[[ ťĥéřé íš 1 ɳéŵ ƿóšť íɳ ťĥíš ťóƿíč šíɳčé ýóů łášť řéáď íť ]]","other":"[[ ťĥéřé ářé {{count}} ɳéŵ ƿóšťš íɳ ťĥíš ťóƿíč šíɳčé ýóů łášť řéáď íť ]]"},"likes":{"one":"[[ ťĥéřé íš 1 łíǩé íɳ ťĥíš ťóƿíč ]]","other":"[[ ťĥéřé ářé {{count}} łíǩéš íɳ ťĥíš ťóƿíč ]]"},"back_to_list":"[[ Ɓáčǩ ťó Ťóƿíč Łíšť ]]","options":"[[ Ťóƿíč Óƿťíóɳš ]]","show_links":"[[ šĥóŵ łíɳǩš ŵíťĥíɳ ťĥíš ťóƿíč ]]","toggle_information":"[[ ťóǧǧłé ťóƿíč ďéťáíłš ]]","read_more_in_category":"[[ Ŵáɳť ťó řéáď ɱóřé? Ɓřóŵšé óťĥéř ťóƿíčš íɳ {{catLink}} óř {{latestLink}}. ]]","read_more":"[[ Ŵáɳť ťó řéáď ɱóřé? {{catLink}} óř {{latestLink}}. ]]","browse_all_categories":"[[ Ɓřóŵšé áłł čáťéǧóříéš ]]","view_latest_topics":"[[ νíéŵ łáťéšť ťóƿíčš ]]","suggest_create_topic":"[[ Ŵĥý ɳóť čřéáťé á ťóƿíč? ]]","read_position_reset":"[[ Ýóůř řéáď ƿóšíťíóɳ ĥáš ƀééɳ řéšéť. ]]","jump_reply_up":"[[ ʲůɱƿ ťó éářłíéř řéƿłý ]]","jump_reply_down":"[[ ʲůɱƿ ťó łáťéř řéƿłý ]]","deleted":"[[ Ťĥé ťóƿíč ĥáš ƀééɳ ďéłéťéď ]]","auto_close_notice":"[[ Ťĥíš ťóƿíč ŵíłł áůťóɱáťíčáłłý čłóšé %{timeLeft}. ]]","auto_close_title":"[[ Áůťó-Čłóšé Šéťťíɳǧš ]]","auto_close_save":"[[ Šáνé ]]","auto_close_cancel":"[[ Čáɳčéł ]]","auto_close_remove":"[[ Ďóɳ'ť Áůťó-Čłóšé Ťĥíš Ťóƿíč ]]","progress":{"title":"[[ ťóƿíč ƿřóǧřéšš ]]","jump_top":"[[ ʲůɱƿ ťó ƒířšť ƿóšť ]]","jump_bottom":"[[ ʲůɱƿ ťó łášť ƿóšť ]]","total":"[[ ťóťáł ƿóšťš ]]","current":"[[ čůřřéɳť ƿóšť ]]"},"notifications":{"title":"[[  ]]","reasons":{"3_2":"[[ Ýóů ŵíłł řéčéíνé ɳóťíƒíčáťíóɳš ƀéčáůšé ýóů ářé ŵáťčĥíɳǧ ťĥíš ťóƿíč. ]]","3_1":"[[ Ýóů ŵíłł řéčéíνé ɳóťíƒíčáťíóɳš ƀéčáůšé ýóů čřéáťéď ťĥíš ťóƿíč. ]]","3":"[[ Ýóů ŵíłł řéčéíνé ɳóťíƒíčáťíóɳš ƀéčáůšé ýóů ářé ŵáťčĥíɳǧ ťĥíš ťóƿíč. ]]","2_4":"[[ Ýóů ŵíłł řéčéíνé ɳóťíƒíčáťíóɳš ƀéčáůšé ýóů ƿóšťéď á řéƿłý ťó ťĥíš ťóƿíč. ]]","2_2":"[[ Ýóů ŵíłł řéčéíνé ɳóťíƒíčáťíóɳš ƀéčáůšé ýóů ářé ťřáčǩíɳǧ ťĥíš ťóƿíč. ]]","2":"[[ Ýóů ŵíłł řéčéíνé ɳóťíƒíčáťíóɳš ƀéčáůšé ýóů \u003Cá ĥřéƒ=\"/ůšéřš/{{username}}/ƿřéƒéřéɳčéš\"\u003Eřéáď ťĥíš ťóƿíč\u003C/á\u003E. ]]","1":"[[ Ýóů ŵíłł ƀé ɳóťíƒíéď óɳłý íƒ šóɱéóɳé ɱéɳťíóɳš ýóůř @ɳáɱé óř řéƿłíéš ťó ýóůř ƿóšť. ]]","1_2":"[[ Ýóů ŵíłł ƀé ɳóťíƒíéď óɳłý íƒ šóɱéóɳé ɱéɳťíóɳš ýóůř @ɳáɱé óř řéƿłíéš ťó ýóůř ƿóšť. ]]","0":"[[ Ýóů ářé íǧɳóříɳǧ áłł ɳóťíƒíčáťíóɳš óɳ ťĥíš ťóƿíč. ]]","0_2":"[[ Ýóů ářé íǧɳóříɳǧ áłł ɳóťíƒíčáťíóɳš óɳ ťĥíš ťóƿíč. ]]"},"watching":{"title":"[[ Ŵáťčĥíɳǧ ]]","description":"[[ šáɱé áš Ťřáčǩíɳǧ, ƿłůš ýóů ŵíłł ƀé ɳóťíƒíéď óƒ áłł ɳéŵ ƿóšťš. ]]"},"tracking":{"title":"[[ Ťřáčǩíɳǧ ]]","description":"[[ ýóů ŵíłł ƀé ɳóťíƒíéď óƒ @ɳáɱé ɱéɳťíóɳš áɳď řéƿłíéš ťó ýóůř ƿóšťš, ƿłůš ýóů ŵíłł šéé á čóůɳť óƒ ůɳřéáď áɳď ɳéŵ ƿóšťš. ]]"},"regular":{"title":"[[ Řéǧůłář ]]","description":"[[ ýóů ŵíłł ƀé ɳóťíƒíéď óɳłý íƒ šóɱéóɳé ɱéɳťíóɳš ýóůř @ɳáɱé óř řéƿłíéš ťó ýóůř ƿóšť. ]]"},"muted":{"title":"[[ Ϻůťéď ]]","description":"[[ ýóů ŵíłł ɳóť ƀé ɳóťíƒíéď óƒ áɳýťĥíɳǧ áƀóůť ťĥíš ťóƿíč, áɳď íť ŵíłł ɳóť áƿƿéář óɳ ýóůř ůɳřéáď ťáƀ. ]]"}},"actions":{"delete":"[[ Ďéłéťé Ťóƿíč ]]","open":"[[ Óƿéɳ Ťóƿíč ]]","close":"[[ Čłóšé Ťóƿíč ]]","auto_close":"[[ Áůťó Čłóšé ]]","unpin":"[[ Ůɳ-Рíɳ Ťóƿíč ]]","pin":"[[ Рíɳ Ťóƿíč ]]","unarchive":"[[ Ůɳářčĥíνé Ťóƿíč ]]","archive":"[[ Ářčĥíνé Ťóƿíč ]]","invisible":"[[ Ϻáǩé Íɳνíšíƀłé ]]","visible":"[[ Ϻáǩé Ѷíšíƀłé ]]","reset_read":"[[ Řéšéť Řéáď Ďáťá ]]","multi_select":"[[ Šéłéčť ƒóř Ϻéřǧé/Šƿłíť ]]","convert_to_topic":"[[ Čóɳνéřť ťó Řéǧůłář Ťóƿíč ]]"},"reply":{"title":"[[ Řéƿłý ]]","help":"[[ ƀéǧíɳ čóɱƿóšíɳǧ á řéƿłý ťó ťĥíš ťóƿíč ]]"},"clear_pin":{"title":"[[ Čłéář ƿíɳ ]]","help":"[[ Čłéář ťĥé ƿíɳɳéď šťáťůš óƒ ťĥíš ťóƿíč šó íť ɳó łóɳǧéř áƿƿéářš áť ťĥé ťóƿ óƒ ýóůř ťóƿíč łíšť ]]"},"share":{"title":"[[ Šĥářé ]]","help":"[[ šĥářé á łíɳǩ ťó ťĥíš ťóƿíč ]]"},"inviting":"[[ Íɳνíťíɳǧ... ]]","invite_private":{"title":"[[ Íɳνíťé ťó Рříνáťé Ϻéššáǧé ]]","email_or_username":"[[ Íɳνíťéé'š Éɱáíł óř Ůšéřɳáɱé ]]","email_or_username_placeholder":"[[ éɱáíł áďďřéšš óř ůšéřɳáɱé ]]","action":"[[ Íɳνíťé ]]","success":"[[ Ťĥáɳǩš! Ŵé'νé íɳνíťéď ťĥáť ůšéř ťó ƿářťíčíƿáťé íɳ ťĥíš ƿříνáťé ɱéššáǧé. ]]","error":"[[ Šóřřý, ťĥéřé ŵáš áɳ éřřóř íɳνíťíɳǧ ťĥáť ůšéř. ]]"},"invite_reply":{"title":"[[ Íɳνíťé Ƒříéɳďš ťó Řéƿłý ]]","action":"[[ Éɱáíł Íɳνíťé ]]","help":"[[ šéɳď íɳνíťáťíóɳš ťó ƒříéɳďš šó ťĥéý čáɳ řéƿłý ťó ťĥíš ťóƿíč ŵíťĥ á šíɳǧłé čłíčǩ ]]","email":"[[ Ŵé'łł šéɳď ýóůř ƒříéɳď á ƀříéƒ éɱáíł áłłóŵíɳǧ ťĥéɱ ťó řéƿłý ťó ťĥíš ťóƿíč ƀý čłíčǩíɳǧ á łíɳǩ. ]]","email_placeholder":"[[ éɱáíł áďďřéšš ]]","success":"[[ Ťĥáɳǩš! Ŵé ɱáíłéď óůť áɳ íɳνíťáťíóɳ ťó \u003Cƀ\u003E{{email}}\u003C/ƀ\u003E. Ŵé'łł łéť ýóů ǩɳóŵ ŵĥéɳ ťĥéý řéďééɱ ýóůř íɳνíťáťíóɳ. Čĥéčǩ ťĥé íɳνíťáťíóɳš ťáƀ óɳ ýóůř ůšéř ƿáǧé ťó ǩééƿ ťřáčǩ óƒ ŵĥó ýóů'νé íɳνíťéď. ]]","error":"[[ Šóřřý, ŵé čóůłďɳ'ť íɳνíťé ťĥáť ƿéřšóɳ. Рéřĥáƿš ťĥéý ářé áłřéáďý á ůšéř? ]]"},"login_reply":"[[ Łóǧ Íɳ ťó Řéƿłý ]]","filters":{"user":"[[ Ýóů'řé νíéŵíɳǧ óɳłý {{n_posts}} {{by_n_users}}. ]]","n_posts":{"one":"[[ 1 ƿóšť ]]","other":"[[ {{count}} ƿóšťš ]]"},"by_n_users":{"one":"[[ ɱáďé ƀý 1 šƿéčíƒíč ůšéř ]]","other":"[[ ɱáďé ƀý {{count}} šƿéčíƒíč ůšéřš ]]"},"best_of":"[[ Ýóů'řé νíéŵíɳǧ ťĥé {{n_best_posts}} {{of_n_posts}}. ]]","n_best_posts":{"one":"[[ 1 ƀéšť ƿóšť ]]","other":"[[ {{count}} ƀéšť ƿóšťš ]]"},"of_n_posts":{"one":"[[ óƒ 1 íɳ ťĥé ťóƿíč ]]","other":"[[ óƒ {{count}} íɳ ťĥé ťóƿíč ]]"},"cancel":"[[ Šĥóŵ áłł ƿóšťš íɳ ťĥíš ťóƿíč áǧáíɳ. ]]"},"split_topic":{"title":"[[ Šƿłíť Ťóƿíč ]]","action":"[[ šƿłíť ťóƿíč ]]","topic_name":"[[ Ѝéŵ Ťóƿíč Ѝáɱé: ]]","error":"[[ Ťĥéřé ŵáš áɳ éřřóř šƿłíťťíɳǧ ťĥáť ťóƿíč. ]]","instructions":{"one":"[[ Ýóů ářé áƀóůť ťó čřéáťé á ɳéŵ ťóƿíč áɳď ƿóƿůłáťé íť ŵíťĥ ťĥé ƿóšť ýóů'νé šéłéčťéď. ]]","other":"[[ Ýóů ářé áƀóůť ťó čřéáťé á ɳéŵ ťóƿíč áɳď ƿóƿůłáťé íť ŵíťĥ ťĥé \u003Cƀ\u003E{{count}}\u003C/ƀ\u003E ƿóšťš ýóů'νé šéłéčťéď. ]]"}},"merge_topic":{"title":"[[ Ϻéřǧé Ťóƿíč ]]","action":"[[ ɱéřǧé ťóƿíč ]]","error":"[[ Ťĥéřé ŵáš áɳ éřřóř ɱéřǧíɳǧ ťĥáť ťóƿíč. ]]","instructions":{"one":"[[ Рłéášé čĥóóšé ťĥé ťóƿíč ýóů'ď łíǩé ťó ɱóνé ťĥáť ƿóšť ťó. ]]","other":"[[ Рłéášé čĥóóšé ťĥé ťóƿíč ýóů'ď łíǩé ťó ɱóνé ťĥóšé \u003Cƀ\u003E{{count}}\u003C/ƀ\u003E ƿóšťš ťó. ]]"}},"multi_select":{"select":"[[ šéłéčť ]]","selected":"[[ šéłéčťéď ({{count}}) ]]","delete":"[[ ďéłéťé šéłéčťéď ]]","cancel":"[[ čáɳčéł šéłéčťíɳǧ ]]","description":{"one":"[[ Ýóů ĥáνé šéłéčťéď \u003Cƀ\u003E1\u003C/ƀ\u003E ƿóšť. ]]","other":"[[ Ýóů ĥáνé šéłéčťéď \u003Cƀ\u003E{{count}}\u003C/ƀ\u003E ƿóšťš. ]]"}}},"post":{"reply":"[[ Řéƿłýíɳǧ ťó {{link}} ƀý {{replyAvatar}} {{username}} ]]","reply_topic":"[[ Řéƿłý ťó {{link}} ]]","quote_reply":"[[ ƣůóťé řéƿłý ]]","edit":"[[ Éďíťíɳǧ {{link}} ƀý {{replyAvatar}} {{username}} ]]","post_number":"[[ ƿóšť {{number}} ]]","in_reply_to":"[[ íɳ řéƿłý ťó ]]","reply_as_new_topic":"[[ Řéƿłý áš ɳéŵ Ťóƿíč ]]","continue_discussion":"[[ Čóɳťíɳůíɳǧ ťĥé ďíščůššíóɳ ƒřóɱ {{postLink}}: ]]","follow_quote":"[[ ǧó ťó ťĥé ƣůóťéď ƿóšť ]]","deleted_by_author":"[[ (ƿóšť řéɱóνéď ƀý áůťĥóř) ]]","expand_collapse":"[[ éхƿáɳď/čółłáƿšé ]]","has_replies":{"one":"[[ Řéƿłý ]]","other":"[[ Řéƿłíéš ]]"},"errors":{"create":"[[ Šóřřý, ťĥéřé ŵáš áɳ éřřóř čřéáťíɳǧ ýóůř ƿóšť. Рłéášé ťřý áǧáíɳ. ]]","edit":"[[ Šóřřý, ťĥéřé ŵáš áɳ éřřóř éďíťíɳǧ ýóůř ƿóšť. Рłéášé ťřý áǧáíɳ. ]]","upload":"[[ Šóřřý, ťĥéřé ŵáš áɳ éřřóř ůƿłóáďíɳǧ ťĥáť ƒíłé. Рłéášé ťřý áǧáíɳ. ]]","image_too_large":"[[ Šóřřý, ťĥé ƒíłé ýóů ářé ťřýíɳǧ ťó ůƿłóáď íš ťóó ƀíǧ (ɱáхíɱůɱ šížé íš {{max_size_kb}}ǩƀ), ƿłéášé řéšížé íť áɳď ťřý áǧáíɳ. ]]","too_many_uploads":"[[ Šóřřý, ýóů čáɳ óɳłý ůƿłóáď óɳé ƒíłé áť á ťíɱé. ]]","upload_not_authorized":"[[ Šóřřý, ťĥé ƒíłé ýóů ářé ťřýíɳǧ ťó ůƿłóáď íš ɳóť áůťĥóřížéď (áůťĥóřížéď éхťéɳšíóɳ: {{authorized_extensions}}). ]]","upload_not_allowed_for_new_user":"[[ Šóřřý, ɳéŵ ůšéřš čáɳ ɳóť ůƿłóáď íɱáǧéš. ]]"},"abandon":"[[ Ářé ýóů šůřé ýóů ŵáɳť ťó áƀáɳďóɳ ýóůř ƿóšť? ]]","archetypes":{"save":"[[ Šáνé Óƿťíóɳš ]]"},"controls":{"reply":"[[ ƀéǧíɳ čóɱƿóšíɳǧ á řéƿłý ťó ťĥíš ƿóšť ]]","like":"[[ łíǩé ťĥíš ƿóšť ]]","edit":"[[ éďíť ťĥíš ƿóšť ]]","flag":"[[ ƒłáǧ ťĥíš ƿóšť ƒóř áťťéɳťíóɳ óř šéɳď á ɳóťíƒíčáťíóɳ áƀóůť íť ]]","delete":"[[ ďéłéťé ťĥíš ƿóšť ]]","undelete":"[[ ůɳďéłéťé ťĥíš ƿóšť ]]","share":"[[ šĥářé á łíɳǩ ťó ťĥíš ƿóšť ]]","more":"[[ Ϻóřé ]]"},"actions":{"flag":"[[ Ƒłáǧ ]]","clear_flags":{"one":"[[ Čłéář ƒłáǧ ]]","other":"[[ Čłéář ƒłáǧš ]]"},"it_too":{"off_topic":"[[ Ƒłáǧ íť ťóó ]]","spam":"[[ Ƒłáǧ íť ťóó ]]","inappropriate":"[[ Ƒłáǧ íť ťóó ]]","custom_flag":"[[ Ƒłáǧ íť ťóó ]]","bookmark":"[[ Ɓóóǩɱářǩ íť ťóó ]]","like":"[[ Łíǩé íť ťóó ]]","vote":"[[ Ѷóťé ƒóř íť ťóó ]]"},"undo":{"off_topic":"[[ Ůɳďó ƒłáǧ ]]","spam":"[[ Ůɳďó ƒłáǧ ]]","inappropriate":"[[ Ůɳďó ƒłáǧ ]]","bookmark":"[[ Ůɳďó ƀóóǩɱářǩ ]]","like":"[[ Ůɳďó łíǩé ]]","vote":"[[ Ůɳďó νóťé ]]"},"people":{"off_topic":"[[ {{icons}} ɱářǩéď ťĥíš áš óƒƒ-ťóƿíč ]]","spam":"[[ {{icons}} ɱářǩéď ťĥíš áš šƿáɱ ]]","inappropriate":"[[ {{icons}} ɱářǩéď ťĥíš áš íɳáƿƿřóƿříáťé ]]","notify_moderators":"[[ {{icons}} ɳóťíƒíéď ɱóďéřáťóřš ]]","notify_moderators_with_url":"[[ {{icons}} \u003Cá ĥřéƒ='{{postUrl}}'\u003Eɳóťíƒíéď ɱóďéřáťóřš\u003C/á\u003E ]]","notify_user":"[[ {{icons}} šéɳť á ƿříνáťé ɱéššáǧé ]]","notify_user_with_url":"[[ {{icons}} šéɳť á \u003Cá ĥřéƒ='{{postUrl}}'\u003Eƿříνáťé ɱéššáǧé\u003C/á\u003E ]]","bookmark":"[[ {{icons}} ƀóóǩɱářǩéď ťĥíš ]]","like":"[[ {{icons}} łíǩéď ťĥíš ]]","vote":"[[ {{icons}} νóťéď ƒóř ťĥíš ]]"},"by_you":{"off_topic":"[[ Ýóů ƒłáǧǧéď ťĥíš áš óƒƒ-ťóƿíč ]]","spam":"[[ Ýóů ƒłáǧǧéď ťĥíš áš šƿáɱ ]]","inappropriate":"[[ Ýóů ƒłáǧǧéď ťĥíš áš íɳáƿƿřóƿříáťé ]]","notify_moderators":"[[ Ýóů ƒłáǧǧéď ťĥíš ƒóř ɱóďéřáťíóɳ ]]","notify_user":"[[ Ýóů šéɳť á ƿříνáťé ɱéššáǧé ťó ťĥíš ůšéř ]]","bookmark":"[[ Ýóů ƀóóǩɱářǩéď ťĥíš ƿóšť ]]","like":"[[ Ýóů łíǩéď ťĥíš ]]","vote":"[[ Ýóů νóťéď ƒóř ťĥíš ƿóšť ]]"},"by_you_and_others":{"off_topic":{"one":"[[ Ýóů áɳď 1 óťĥéř ƒłáǧǧéď ťĥíš áš óƒƒ-ťóƿíč ]]","other":"[[ Ýóů áɳď {{count}} óťĥéř ƿéóƿłé ƒłáǧǧéď ťĥíš áš óƒƒ-ťóƿíč ]]"},"spam":{"one":"[[ Ýóů áɳď 1 óťĥéř ƒłáǧǧéď ťĥíš áš šƿáɱ ]]","other":"[[ Ýóů áɳď {{count}} óťĥéř ƿéóƿłé ƒłáǧǧéď ťĥíš áš šƿáɱ ]]"},"inappropriate":{"one":"[[ Ýóů áɳď 1 óťĥéř ƒłáǧǧéď ťĥíš áš íɳáƿƿřóƿříáťé ]]","other":"[[ Ýóů áɳď {{count}} óťĥéř ƿéóƿłé ƒłáǧǧéď ťĥíš áš íɳáƿƿřóƿříáťé ]]"},"notify_moderators":{"one":"[[ Ýóů áɳď 1 óťĥéř ƒłáǧǧéď ťĥíš ƒóř ɱóďéřáťíóɳ ]]","other":"[[ Ýóů áɳď {{count}} óťĥéř ƿéóƿłé ƒłáǧǧéď ťĥíš ƒóř ɱóďéřáťíóɳ ]]"},"notify_user":{"one":"[[ Ýóů áɳď 1 óťĥéř šéɳť á ƿříνáťé ɱéššáǧé ťó ťĥíš ůšéř ]]","other":"[[ Ýóů áɳď {{count}} óťĥéř ƿéóƿłé šéɳť á ƿříνáťé ɱéššáǧé ťó ťĥíš ůšéř ]]"},"bookmark":{"one":"[[ Ýóů áɳď 1 óťĥéř ƀóóǩɱářǩéď ťĥíš ƿóšť ]]","other":"[[ Ýóů áɳď {{count}} óťĥéř ƿéóƿłé ƀóóǩɱářǩéď ťĥíš ƿóšť ]]"},"like":{"one":"[[ Ýóů áɳď 1 óťĥéř łíǩéď ťĥíš ]]","other":"[[ Ýóů áɳď {{count}} óťĥéř ƿéóƿłé łíǩéď ťĥíš ]]"},"vote":{"one":"[[ Ýóů áɳď 1 óťĥéř νóťéď ƒóř ťĥíš ƿóšť ]]","other":"[[ Ýóů áɳď {{count}} óťĥéř ƿéóƿłé νóťéď ƒóř ťĥíš ƿóšť ]]"}},"by_others":{"off_topic":{"one":"[[ 1 ƿéřšóɳ ƒłáǧǧéď ťĥíš áš óƒƒ-ťóƿíč ]]","other":"[[ {{count}} ƿéóƿłé ƒłáǧǧéď ťĥíš áš óƒƒ-ťóƿíč ]]"},"spam":{"one":"[[ 1 ƿéřšóɳ ƒłáǧǧéď ťĥíš áš šƿáɱ ]]","other":"[[ {{count}} ƿéóƿłé ƒłáǧǧéď ťĥíš áš šƿáɱ ]]"},"inappropriate":{"one":"[[ 1 ƿéřšóɳ ƒłáǧǧéď ťĥíš áš íɳáƿƿřóƿříáťé ]]","other":"[[ {{count}} ƿéóƿłé ƒłáǧǧéď ťĥíš áš íɳáƿƿřóƿříáťé ]]"},"notify_moderators":{"one":"[[ 1 ƿéřšóɳ ƒłáǧǧéď ťĥíš ƒóř ɱóďéřáťíóɳ ]]","other":"[[ {{count}} ƿéóƿłé ƒłáǧǧéď ťĥíš ƒóř ɱóďéřáťíóɳ ]]"},"notify_user":{"one":"[[ 1 ƿéřšóɳ šéɳť á ƿříνáťé ɱéššáǧé ťó ťĥíš ůšéř ]]","other":"[[ {{count}} šéɳť á ƿříνáťé ɱéššáǧé ťó ťĥíš ůšéř ]]"},"bookmark":{"one":"[[ 1 ƿéřšóɳ ƀóóǩɱářǩéď ťĥíš ƿóšť ]]","other":"[[ {{count}} ƿéóƿłé ƀóóǩɱářǩéď ťĥíš ƿóšť ]]"},"like":{"one":"[[ 1 ƿéřšóɳ łíǩéď ťĥíš ]]","other":"[[ {{count}} ƿéóƿłé łíǩéď ťĥíš ]]"},"vote":{"one":"[[ 1 ƿéřšóɳ νóťéď ƒóř ťĥíš ƿóšť ]]","other":"[[ {{count}} ƿéóƿłé νóťéď ƒóř ťĥíš ƿóšť ]]"}}},"edits":{"one":"[[ 1 éďíť ]]","other":"[[ {{count}} éďíťš ]]","zero":"[[ ɳó éďíťš ]]"},"delete":{"confirm":{"one":"[[ Ářé ýóů šůřé ýóů ŵáɳť ťó ďéłéťé ťĥáť ƿóšť? ]]","other":"[[ Ářé ýóů šůřé ýóů ŵáɳť ťó ďéłéťé áłł ťĥóšé ƿóšťš? ]]"}}},"category":{"none":"[[ (ɳó čáťéǧóřý) ]]","edit":"[[ éďíť ]]","edit_long":"[[ Éďíť Čáťéǧóřý ]]","view":"[[ Ѷíéŵ Ťóƿíčš íɳ Čáťéǧóřý ]]","general":"[[ Ǧéɳéřáł ]]","settings":"[[ Šéťťíɳǧš ]]","delete":"[[ Ďéłéťé Čáťéǧóřý ]]","create":"[[ Čřéáťé Čáťéǧóřý ]]","save":"[[ Šáνé Čáťéǧóřý ]]","creation_error":"[[ Ťĥéřé ĥáš ƀééɳ áɳ éřřóř ďůříɳǧ ťĥé čřéáťíóɳ óƒ ťĥé čáťéǧóřý. ]]","save_error":"[[ Ťĥéřé ŵáš áɳ éřřóř šáνíɳǧ ťĥé čáťéǧóřý. ]]","more_posts":"[[ νíéŵ áłł {{posts}}... ]]","name":"[[ Čáťéǧóřý Ѝáɱé ]]","description":"[[ Ďéščříƿťíóɳ ]]","topic":"[[ čáťéǧóřý ťóƿíč ]]","badge_colors":"[[ Ɓáďǧé čółóřš ]]","background_color":"[[ Ɓáčǩǧřóůɳď čółóř ]]","foreground_color":"[[ Ƒóřéǧřóůɳď čółóř ]]","name_placeholder":"[[ Šĥóůłď ƀé šĥóřť áɳď šůččíɳčť. ]]","color_placeholder":"[[ Áɳý ŵéƀ čółóř ]]","delete_confirm":"[[ Ářé ýóů šůřé ýóů ŵáɳť ťó ďéłéťé ťĥíš čáťéǧóřý? ]]","delete_error":"[[ Ťĥéřé ŵáš áɳ éřřóř ďéłéťíɳǧ ťĥé čáťéǧóřý. ]]","list":"[[ Łíšť Čáťéǧóříéš ]]","no_description":"[[ Ťĥéřé íš ɳó ďéščříƿťíóɳ ƒóř ťĥíš čáťéǧóřý, éďíť ťĥé ťóƿíč ďéƒíɳíťíóɳ. ]]","change_in_category_topic":"[[ Éďíť Ďéščříƿťíóɳ ]]","hotness":"[[ Ĥóťɳéšš ]]","already_used":"[[ Ťĥíš čółóř ĥáš ƀééɳ ůšéď ƀý áɳóťĥéř čáťéǧóřý ]]","is_secure":"[[ Šéčůřé čáťéǧóřý? ]]","add_group":"[[ Áďď Ǧřóůƿ ]]","security":"[[ Šéčůříťý ]]","allowed_groups":"[[ Áłłóŵéď Ǧřóůƿš: ]]","auto_close_label":"[[ Áůťó-čłóšé ťóƿíčš áƒťéř: ]]"},"flagging":{"title":"[[ Ŵĥý ářé ýóů ƒłáǧǧíɳǧ ťĥíš ƿóšť? ]]","action":"[[ Ƒłáǧ Рóšť ]]","take_action":"[[ Ťáǩé Áčťíóɳ ]]","notify_action":"[[ Ѝóťíƒý ]]","cant":"[[ Šóřřý, ýóů čáɳ'ť ƒłáǧ ťĥíš ƿóšť áť ťĥíš ťíɱé. ]]","custom_placeholder_notify_user":"[[ Ŵĥý ďóéš ťĥíš ƿóšť řéƣůířé ýóů ťó šƿéáǩ ťó ťĥíš ůšéř ďířéčťłý áɳď ƿříνáťéłý? Ɓé šƿéčíƒíč, ƀé čóɳšťřůčťíνé, áɳď áłŵáýš ƀé ǩíɳď. ]]","custom_placeholder_notify_moderators":"[[ Ŵĥý ďóéš ťĥíš ƿóšť řéƣůířé ɱóďéřáťóř áťťéɳťíóɳ? Łéť ůš ǩɳóŵ šƿéčíƒíčáłłý ŵĥáť ýóů ářé čóɳčéřɳéď áƀóůť, áɳď ƿřóνíďé řéłéνáɳť łíɳǩš ŵĥéřé ƿóššíƀłé. ]]","custom_message":{"at_least":"[[ éɳťéř áť łéášť {{n}} čĥářáčťéřš ]]","more":"[[ {{n}} ťó ǧó... ]]","left":"[[ {{n}} řéɱáíɳíɳǧ ]]"}},"topic_summary":{"title":"[[ Ťóƿíč Šůɱɱářý ]]","links_shown":"[[ šĥóŵ áłł {{totalLinks}} łíɳǩš... ]]","clicks":"[[ čłíčǩš ]]","topic_link":"[[ ťóƿíč łíɳǩ ]]"},"topic_statuses":{"locked":{"help":"[[ ťĥíš ťóƿíč íš čłóšéď; íť ɳó łóɳǧéř áččéƿťš ɳéŵ řéƿłíéš ]]"},"pinned":{"help":"[[ ťĥíš ťóƿíč íš ƿíɳɳéď; íť ŵíłł ďíšƿłáý áť ťĥé ťóƿ óƒ íťš čáťéǧóřý ]]"},"archived":{"help":"[[ ťĥíš ťóƿíč íš ářčĥíνéď; íť íš ƒřóžéɳ áɳď čáɳɳóť ƀé čĥáɳǧéď ]]"},"invisible":{"help":"[[ ťĥíš ťóƿíč íš íɳνíšíƀłé; íť ŵíłł ɳóť ƀé ďíšƿłáýéď íɳ ťóƿíč łíšťš, áɳď čáɳ óɳłý ƀé áččéššéď νíá á ďířéčť łíɳǩ ]]"}},"posts":"[[ Рóšťš ]]","posts_long":"[[ ťĥéřé ářé {{number}} ƿóšťš íɳ ťĥíš ťóƿíč ]]","original_post":"[[ Óříǧíɳáł Рóšť ]]","views":"[[ Ѷíéŵš ]]","replies":"[[ Řéƿłíéš ]]","views_long":"[[ ťĥíš ťóƿíč ĥáš ƀééɳ νíéŵéď {{number}} ťíɱéš ]]","activity":"[[ Áčťíνíťý ]]","likes":"[[ Łíǩéš ]]","likes_long":"[[ ťĥéřé ářé {{number}} łíǩéš íɳ ťĥíš ťóƿíč ]]","top_contributors":"[[ Рářťíčíƿáɳťš ]]","category_title":"[[ Čáťéǧóřý ]]","history":"[[ Ĥíšťóřý ]]","changed_by":"[[ ƀý {{author}} ]]","categories_list":"[[ Čáťéǧóříéš Łíšť ]]","filters":{"latest":{"title":"[[ Łáťéšť ]]","help":"[[ ťĥé ɱóšť řéčéɳť ťóƿíčš ]]"},"hot":{"title":"[[ Ĥóť ]]","help":"[[ á šéłéčťíóɳ óƒ ťĥé ĥóťťéšť ťóƿíčš ]]"},"favorited":{"title":"[[ Ƒáνóříťéď ]]","help":"[[ ťóƿíčš ýóů ɱářǩéď áš ƒáνóříťéš ]]"},"read":{"title":"[[ Řéáď ]]","help":"[[ ťóƿíčš ýóů'νé řéáď, íɳ ťĥé óřďéř ťĥáť ýóů łášť řéáď ťĥéɱ ]]"},"categories":{"title":"[[ Čáťéǧóříéš ]]","title_in":"[[ Čáťéǧóřý - {{categoryName}} ]]","help":"[[ áłł ťóƿíčš ǧřóůƿéď ƀý čáťéǧóřý ]]"},"unread":{"title":{"zero":"[[ Ůɳřéáď ]]","one":"[[ Ůɳřéáď (1) ]]","other":"[[ Ůɳřéáď ({{count}}) ]]"},"help":"[[ ťřáčǩéď ťóƿíčš ŵíťĥ ůɳřéáď ƿóšťš ]]"},"new":{"title":{"zero":"[[ Ѝéŵ ]]","one":"[[ Ѝéŵ (1) ]]","other":"[[ Ѝéŵ ({{count}}) ]]"},"help":"[[ ɳéŵ ťóƿíčš šíɳčé ýóůř łášť νíšíť ]]"},"posted":{"title":"[[ Ϻý Рóšťš ]]","help":"[[ ťóƿíčš ýóů ĥáνé ƿóšťéď íɳ ]]"},"category":{"title":{"zero":"[[ {{categoryName}} ]]","one":"[[ {{categoryName}} (1) ]]","other":"[[ {{categoryName}} ({{count}}) ]]"},"help":"[[ łáťéšť ťóƿíčš íɳ ťĥé {{categoryName}} čáťéǧóřý ]]"}},"browser_update":"[[ Ůɳƒóřťůɳáťéłý, \u003Cá ĥřéƒ=\"ĥťťƿ://ŵŵŵ.ďíščóůřšé.óřǧ/ƒáƣ/#ƀřóŵšéř\"\u003Eýóůř ƀřóŵšéř íš ťóó ółď ťó ŵóřǩ óɳ ťĥíš Ďíščóůřšé ƒóřůɱ\u003C/á\u003E. Рłéášé \u003Cá ĥřéƒ=\"ĥťťƿ://ƀřóŵšéĥáƿƿý.čóɱ\"\u003Eůƿǧřáďé ýóůř ƀřóŵšéř\u003C/á\u003E. ]]","type_to_filter":"[[ ťýƿé ťó ƒíłťéř... ]]","admin":{"title":"[[ Ďíščóůřšé Áďɱíɳ ]]","moderator":"[[ Ϻóďéřáťóř ]]","dashboard":{"title":"[[ Ďášĥƀóářď ]]","version":"[[ Ѷéřšíóɳ ]]","up_to_date":"[[ Ýóů'řé ůƿ ťó ďáťé! ]]","critical_available":"[[ Á čříťíčáł ůƿďáťé íš áνáíłáƀłé. ]]","updates_available":"[[ Ůƿďáťéš ářé áνáíłáƀłé. ]]","please_upgrade":"[[ Рłéášé ůƿǧřáďé! ]]","installed_version":"[[ Íɳšťáłłéď ]]","latest_version":"[[ Łáťéšť ]]","problems_found":"[[ Šóɱé ƿřóƀłéɱš ĥáνé ƀééɳ ƒóůɳď ŵíťĥ ýóůř íɳšťáłłáťíóɳ óƒ Ďíščóůřšé: ]]","last_checked":"[[ Łášť čĥéčǩéď ]]","refresh_problems":"[[ Řéƒřéšĥ ]]","no_problems":"[[ Ѝó ƿřóƀłéɱš ŵéřé ƒóůɳď. ]]","moderators":"[[ Ϻóďéřáťóřš: ]]","admins":"[[ Áďɱíɳš: ]]","blocked":"[[ Ɓłóčǩéď: ]]","suspended":"[[ Ɓáɳɳéď: ]]","private_messages_short":"[[ РϺš ]]","private_messages_title":"[[ Рříνáťé Ϻéššáǧéš ]]","reports":{"today":"[[ Ťóďáý ]]","yesterday":"[[ Ýéšťéřďáý ]]","last_7_days":"[[ Łášť 7 Ďáýš ]]","last_30_days":"[[ Łášť 30 Ďáýš ]]","all_time":"[[ Áłł Ťíɱé ]]","7_days_ago":"[[ 7 Ďáýš Áǧó ]]","30_days_ago":"[[ 30 Ďáýš Áǧó ]]","all":"[[ Áłł ]]","view_table":"[[ Ѷíéŵ áš Ťáƀłé ]]","view_chart":"[[ Ѷíéŵ áš Ɓář Čĥářť ]]"}},"commits":{"latest_changes":"[[ Łáťéšť čĥáɳǧéš: ƿłéášé ůƿďáťé óƒťéɳ! ]]","by":"[[ ƀý ]]"},"flags":{"title":"[[ Ƒłáǧš ]]","old":"[[ Ółď ]]","active":"[[ Áčťíνé ]]","agree_hide":"[[ Áǧřéé (ĥíďé ƿóšť + šéɳď РϺ) ]]","agree_hide_title":"[[ Ĥíďé ťĥíš ƿóšť áɳď áůťóɱáťíčáłłý šéɳď ťĥé ůšéř á ƿříνáťé ɱéššáǧé ůřǧíɳǧ ťĥéɱ ťó éďíť íť ]]","defer":"[[ Ďéƒéř ]]","defer_title":"[[ Ѝó áčťíóɳ íš ɳéčéššářý áť ťĥíš ťíɱé, ďéƒéř áɳý áčťíóɳ óɳ ťĥíš ƒłáǧ ůɳťíł á łáťéř ďáťé, óř ɳéνéř ]]","delete_post":"[[ Ďéłéťé Рóšť ]]","delete_post_title":"[[ Ďéłéťé ƿóšť; íƒ ťĥé ƒířšť ƿóšť, ďéłéťé ťĥé ťóƿíč ]]","disagree_unhide":"[[ Ďíšáǧřéé (ůɳĥíďé ƿóšť) ]]","disagree_unhide_title":"[[ Řéɱóνé áɳý ƒłáǧš ƒřóɱ ťĥíš ƿóšť áɳď ɱáǩé ťĥé ƿóšť νíšíƀłé áǧáíɳ ]]","disagree":"[[ Ďíšáǧřéé ]]","disagree_title":"[[ Ďíšáǧřéé ŵíťĥ ƒłáǧ, řéɱóνé áɳý ƒłáǧš ƒřóɱ ťĥíš ƿóšť ]]","flagged_by":"[[ Ƒłáǧǧéď ƀý ]]","error":"[[ Šóɱéťĥíɳǧ ŵéɳť ŵřóɳǧ ]]","view_message":"[[ Řéƿłý ]]","no_results":"[[ Ťĥéřé ářé ɳó ƒłáǧš. ]]","summary":{"action_type_3":{"one":"[[ óƒƒ-ťóƿíč ]]","other":"[[ óƒƒ-ťóƿíč х{{count}} ]]"},"action_type_4":{"one":"[[ íɳáƿƿřóƿříáťé ]]","other":"[[ íɳáƿƿřóƿříáťé х{{count}} ]]"},"action_type_6":{"one":"[[ čůšťóɱ ]]","other":"[[ čůšťóɱ х{{count}} ]]"},"action_type_7":{"one":"[[ čůšťóɱ ]]","other":"[[ čůšťóɱ х{{count}} ]]"},"action_type_8":{"one":"[[ šƿáɱ ]]","other":"[[ šƿáɱ х{{count}} ]]"}}},"groups":{"title":"[[ Ǧřóůƿš ]]","edit":"[[ Éďíť Ǧřóůƿš ]]","selector_placeholder":"[[ áďď ůšéřš ]]","name_placeholder":"[[ Ǧřóůƿ ɳáɱé, ɳó šƿáčéš, šáɱé áš ůšéřɳáɱé řůłé ]]","about":"[[ Éďíť ýóůř ǧřóůƿ ɱéɱƀéřšĥíƿ áɳď ɳáɱéš ĥéřé ]]","can_not_edit_automatic":"[[ Áůťóɱáťíč ǧřóůƿ ɱéɱƀéřšĥíƿ íš ďéťéřɱíɳéď áůťóɱáťíčáłłý, áďɱíɳíšťéř ůšéřš ťó áššíǧɳ řółéš áɳď ťřůšť łéνéłš ]]","delete":"[[ Ďéłéťé ]]","delete_confirm":"[[ Ďéłéťé ťĥíš ǧřóůƿ? ]]","delete_failed":"[[ Unable to delete group. If this is an automatic group, it cannot be destroyed. ]]"},"api":{"title":"[[ ÁРÍ ]]","long_title":"[[ ÁРÍ Íɳƒóřɱáťíóɳ ]]","key":"[[ Ǩéý ]]","generate":"[[ Ǧéɳéřáťé ÁРÍ Ǩéý ]]","regenerate":"[[ Řéǧéɳéřáťé ÁРÍ Ǩéý ]]","info_html":"[[ Ýóůř ÁРÍ ǩéý ŵíłł áłłóŵ ýóů ťó čřéáťé áɳď ůƿďáťé ťóƿíčš ůšíɳǧ ǰŠÓЍ čáłłš. ]]","note_html":"[[ Ǩééƿ ťĥíš ǩéý \u003Cšťřóɳǧ\u003Ešéčřéť\u003C/šťřóɳǧ\u003E, áłł ůšéřš ťĥáť ĥáνé íť ɱáý čřéáťé ářƀíťřářý ƿóšťš óɳ ťĥé ƒóřůɱ áš áɳý ůšéř. ]]"},"customize":{"title":"[[ Čůšťóɱížé ]]","long_title":"[[ Šíťé Čůšťóɱížáťíóɳš ]]","header":"[[ Ĥéáďéř ]]","css":"[[ Šťýłéšĥééť ]]","override_default":"[[ Ďó ɳóť íɳčłůďé šťáɳďářď šťýłé šĥééť ]]","enabled":"[[ Éɳáƀłéď? ]]","preview":"[[ ƿřéνíéŵ ]]","undo_preview":"[[ ůɳďó ƿřéνíéŵ ]]","save":"[[ Šáνé ]]","new":"[[ Ѝéŵ ]]","new_style":"[[ Ѝéŵ Šťýłé ]]","delete":"[[ Ďéłéťé ]]","delete_confirm":"[[ Ďéłéťé ťĥíš čůšťóɱížáťíóɳ? ]]","about":"[[ Šíťé Čůšťóɱížáťíóɳ áłłóŵ ýóů ťó ɱóďíƒý šťýłéšĥééťš áɳď ĥéáďéřš óɳ ťĥé šíťé. Čĥóóšé óř áďď óɳé ťó šťářť éďíťíɳǧ. ]]"},"email":{"title":"[[ Éɱáíł ]]","settings":"[[ Šéťťíɳǧš ]]","logs":"[[ Łóǧš ]]","sent_at":"[[ Šéɳť Áť ]]","user":"[[ Ůšéř ]]","email_type":"[[ Éɱáíł Ťýƿé ]]","to_address":"[[ Ťó Áďďřéšš ]]","test_email_address":"[[ éɱáíł áďďřéšš ťó ťéšť ]]","send_test":"[[ šéɳď ťéšť éɱáíł ]]","sent_test":"[[ šéɳť! ]]","delivery_method":"[[ Ďéłíνéřý Ϻéťĥóď ]]","preview_digest":"[[ Рřéνíéŵ Ďíǧéšť ]]","preview_digest_desc":"[[ Ťĥíš íš á ťóół ƒóř ƿřéνíéŵíɳǧ ťĥé čóɳťéɳť óƒ ťĥé ďíǧéšť éɱáíłš šéɳť ƒřóɱ ýóůř ƒóřůɱ. ]]","refresh":"[[ Řéƒřéšĥ ]]","format":"[[ Ƒóřɱáť ]]","html":"[[ ĥťɱł ]]","text":"[[ ťéхť ]]","last_seen_user":"[[ Łášť Šééɳ Ůšéř: ]]","reply_key":"[[ Řéƿłý Ǩéý ]]"},"impersonate":{"title":"[[ Íɱƿéřšóɳáťé Ůšéř ]]","username_or_email":"[[ Ůšéřɳáɱé óř Éɱáíł óƒ Ůšéř ]]","help":"[[ Ůšé ťĥíš ťóół ťó íɱƿéřšóɳáťé á ůšéř áččóůɳť ƒóř ďéƀůǧǧíɳǧ ƿůřƿóšéš. ]]","not_found":"[[ Ťĥáť ůšéř čáɳ'ť ƀé ƒóůɳď. ]]","invalid":"[[ Šóřřý, ýóů ɱáý ɳóť íɱƿéřšóɳáťé ťĥáť ůšéř. ]]"},"users":{"title":"[[ Ůšéřš ]]","create":"[[ Áďď Áďɱíɳ Ůšéř ]]","last_emailed":"[[ Łášť Éɱáíłéď ]]","not_found":"[[ Šóřřý, ťĥáť ůšéřɳáɱé ďóéšɳ'ť éхíšť íɳ óůř šýšťéɱ. ]]","active":"[[ Áčťíνé ]]","nav":{"active":"[[ Áčťíνé ]]","new":"[[ Ѝéŵ ]]","pending":"[[ Рéɳďíɳǧ ]]","admins":"[[ Áďɱíɳš ]]","moderators":"[[ Ϻóďš ]]","suspended":"[[ Ɓáɳɳéď ]]","blocked":"[[ Ɓłóčǩéď ]]"},"approved":"[[ Áƿƿřóνéď? ]]","approved_selected":{"one":"[[ áƿƿřóνé ůšéř ]]","other":"[[ áƿƿřóνé ůšéřš ({{count}}) ]]"},"titles":{"active":"[[ Áčťíνé Ůšéřš ]]","new":"[[ Ѝéŵ Ůšéřš ]]","pending":"[[ Ůšéřš Рéɳďíɳǧ Řéνíéŵ ]]","newuser":"[[ Ůšéřš áť Ťřůšť Łéνéł 0 (Ѝéŵ Ůšéř) ]]","basic":"[[ Ůšéřš áť Ťřůšť Łéνéł 1 (Ɓášíč Ůšéř) ]]","regular":"[[ Ůšéřš áť Ťřůšť Łéνéł 2 (Řéǧůłář Ůšéř) ]]","leader":"[[ Ůšéřš áť Ťřůšť Łéνéł 3 (Łéáďéř) ]]","elder":"[[ Ůšéřš áť Ťřůšť Łéνéł 4 (Éłďéř) ]]","admins":"[[ Áďɱíɳ Ůšéřš ]]","moderators":"[[ Ϻóďéřáťóřš ]]","blocked":"[[ Ɓłóčǩéď Ůšéřš ]]","suspended":"[[ Ɓáɳɳéď Ůšéřš ]]"}},"user":{"suspend_failed":"[[ Šóɱéťĥíɳǧ ŵéɳť ŵřóɳǧ ƀáɳɳíɳǧ ťĥíš ůšéř {{error}} ]]","unsuspend_failed":"[[ Šóɱéťĥíɳǧ ŵéɳť ŵřóɳǧ ůɳƀáɳɳíɳǧ ťĥíš ůšéř {{error}} ]]","suspend_duration":"[[ Ĥóŵ łóɳǧ ŵóůłď ýóů łíǩé ťó ƀáɳ ťĥé ůšéř ƒóř? (ďáýš) ]]","delete_all_posts":"[[ Ďéłéťé áłł ƿóšťš ]]","suspend":"[[ Ɓáɳ ]]","unsuspend":"[[ Ůɳƀáɳ ]]","suspended":"[[ Ɓáɳɳéď? ]]","moderator":"[[ Ϻóďéřáťóř? ]]","admin":"[[ Áďɱíɳ? ]]","blocked":"[[ Ɓłóčǩéď? ]]","show_admin_profile":"[[ Áďɱíɳ ]]","edit_title":"[[ Éďíť Ťíťłé ]]","save_title":"[[ Šáνé Ťíťłé ]]","refresh_browsers":"[[ Ƒóřčé ƀřóŵšéř řéƒřéšĥ ]]","show_public_profile":"[[ Šĥóŵ Рůƀłíč Рřóƒíłé ]]","impersonate":"[[ Íɱƿéřšóɳáťé ]]","revoke_admin":"[[ Řéνóǩé Áďɱíɳ ]]","grant_admin":"[[ Ǧřáɳť Áďɱíɳ ]]","revoke_moderation":"[[ Řéνóǩé Ϻóďéřáťíóɳ ]]","grant_moderation":"[[ Ǧřáɳť Ϻóďéřáťíóɳ ]]","unblock":"[[ Ůɳƀłóčǩ ]]","block":"[[ Ɓłóčǩ ]]","reputation":"[[ Řéƿůťáťíóɳ ]]","permissions":"[[ Рéřɱíššíóɳš ]]","activity":"[[ Áčťíνíťý ]]","like_count":"[[ Łíǩéš Řéčéíνéď ]]","private_topics_count":"[[ Рříνáťé Ťóƿíčš ]]","posts_read_count":"[[ Рóšťš Řéáď ]]","post_count":"[[ Рóšťš Čřéáťéď ]]","topics_entered":"[[ Ťóƿíčš Éɳťéřéď ]]","flags_given_count":"[[ Ƒłáǧš Ǧíνéɳ ]]","flags_received_count":"[[ Ƒłáǧš Řéčéíνéď ]]","approve":"[[ Áƿƿřóνé ]]","approved_by":"[[ áƿƿřóνéď ƀý ]]","approve_success":"[[ Ůšéř áƿƿřóνéď áɳď éɱáíł šéɳť ŵíťĥ áčťíνáťíóɳ íɳšťřůčťíóɳš. ]]","approve_bulk_success":"[[ Šůččéšš! Áłł šéłéčťéď ůšéřš ĥáνé ƀééɳ áƿƿřóνéď áɳď ɳóťíƒíéď. ]]","time_read":"[[ Řéáď Ťíɱé ]]","delete":"[[ Ďéłéťé Ůšéř ]]","delete_forbidden":"[[ Ťĥíš ůšéř čáɳ'ť ƀé ďéłéťéď ƀéčáůšé ťĥéřé ářé ƿóšťš. Ďéłéťé áłł ťĥíš ůšéř'š ƿóšťš ƒířšť. ]]","delete_confirm":"[[ Ářé ýóů ŠŮŘÉ ýóů ŵáɳť ťó ƿéřɱáɳéɳťłý ďéłéťé ťĥíš ůšéř ƒřóɱ ťĥé šíťé? Ťĥíš áčťíóɳ íš ƿéřɱáɳéɳť! ]]","deleted":"[[ Ťĥé ůšéř ŵáš ďéłéťéď. ]]","delete_failed":"[[ Ťĥéřé ŵáš áɳ éřřóř ďéłéťíɳǧ ťĥáť ůšéř. Ϻáǩé šůřé áłł ƿóšťš ářé ďéłéťéď ƀéƒóřé ťřýíɳǧ ťó ďéłéťé ťĥé ůšéř. ]]","send_activation_email":"[[ Šéɳď Áčťíνáťíóɳ Éɱáíł ]]","activation_email_sent":"[[ Áɳ áčťíνáťíóɳ éɱáíł ĥáš ƀééɳ šéɳť. ]]","send_activation_email_failed":"[[ Ťĥéřé ŵáš á ƿřóƀłéɱ šéɳďíɳǧ áɳóťĥéř áčťíνáťíóɳ éɱáíł. %{error} ]]","activate":"[[ Áčťíνáťé Áččóůɳť ]]","activate_failed":"[[ Ťĥéřé ŵáš á ƿřóƀłéɱ áčťíνáťíɳǧ ťĥé ůšéř. ]]","deactivate_account":"[[ Ďéáčťíνáťé Áččóůɳť ]]","deactivate_failed":"[[ Ťĥéřé ŵáš á ƿřóƀłéɱ ďéáčťíνáťíɳǧ ťĥé ůšéř. ]]","unblock_failed":"[[ Ťĥéřé ŵáš á ƿřóƀłéɱ ůɳƀłóčǩíɳǧ ťĥé ůšéř. ]]","block_failed":"[[ Ťĥéřé ŵáš á ƿřóƀłéɱ ƀłóčǩíɳǧ ťĥé ůšéř. ]]","deactivate_explanation":"[[ Á ďéáčťíνáťéď ůšéř ɱůšť řé-νáłíďáťé ťĥéíř éɱáíł. ]]","banned_explanation":"[[ Á ƀáɳɳéď ůšéř čáɳ'ť łóǧ íɳ. ]]","block_explanation":"[[ Á ƀłóčǩéď ůšéř čáɳ'ť ƿóšť óř šťářť ťóƿíčš. ]]","trust_level_change_failed":"[[ Ťĥéřé ŵáš á ƿřóƀłéɱ čĥáɳǧíɳǧ ťĥé ůšéř'š ťřůšť łéνéł. ]]"},"site_content":{"none":"[[ Čĥóóšé á ťýƿé óƒ čóɳťéɳť ťó ƀéǧíɳ éďíťíɳǧ. ]]","title":"[[ Čóɳťéɳť ]]","edit":"[[ Éďíť Šíťé Čóɳťéɳť ]]"},"site_settings":{"show_overriden":"[[ Óɳłý šĥóŵ óνéřříďďéɳ ]]","title":"[[ Šéťťíɳǧš ]]","reset":"[[ řéšéť ťó ďéƒáůłť ]]","none":"[[ ɳóɳé ]]"}}}}};
I18n.locale = 'pseudo';
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
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
