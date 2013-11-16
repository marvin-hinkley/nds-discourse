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
MessageFormat.locale.cs = function (n) {
  if (n == 1) {
    return 'one';
  }
  if (n == 2 || n == 3 || n == 4) {
    return 'few';
  }
  return 'other';
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
r += "Je tu <a href='/unread'>1 nepřečtené</a> ";
return r;
},
"few" : function(d){
var r = "";
r += "Jsou tu <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " nepřečtená</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "Je tu <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " nepřečtených</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "a ";
return r;
},
"false" : function(d){
var r = "";
r += "Je tu ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>1 nové</a> téma";
return r;
},
"few" : function(d){
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
r += "a ";
return r;
},
"false" : function(d){
var r = "";
r += "Jsou tu ";
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
})() + " nová</a> témata";
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
r += "a ";
return r;
},
"false" : function(d){
var r = "";
r += "Je tu ";
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
})() + " nových</a> témat";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ", nebo ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "si projděte ostatní témata v kategorii ";
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
}});I18n.translations = {"cs":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"bajt","few":"bajty","other":"bajtů"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"tiny":{"half_a_minute":"\u003C 1m","less_than_x_seconds":{"one":"\u003C 1s","few":"\u003C %{count}s","other":"\u003C %{count}s"},"x_seconds":{"one":"1s","few":"%{count}s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003C 1m","few":"\u003C %{count}m","other":"\u003C %{count}m"},"x_minutes":{"one":"1m","few":"%{count}m","other":"%{count}m"},"about_x_hours":{"one":"1h","few":"%{count}h","other":"%{count}h"},"x_days":{"one":"1d","few":"%{count}d","other":"%{count}d"},"about_x_years":{"one":"1r","few":"%{count}r","other":"%{count}let"},"over_x_years":{"one":"\u003E 1r","few":"\u003E %{count}r","other":"\u003E %{count}let"},"almost_x_years":{"one":"1r","few":"%{count}r","other":"%{count}let"}},"medium":{"x_minutes":{"one":"1 minuta","few":"%{count} minuty","other":"%{count} minut"},"x_hours":{"one":"1 hodina","few":"%{count} hodiny","other":"%{count} hodin"},"x_days":{"one":"1 den","few":"%{count} dny","other":"%{count} dní"}},"medium_with_ago":{"x_minutes":{"one":"před 1 minutou","few":"před %{count} minutami","other":"před %{count} minutami"},"x_hours":{"one":"před 1 hodinou","few":"před %{count} hodinami","other":"před %{count} hodinami"},"x_days":{"one":"před 1 dnem","few":"před %{count} dny","other":"před %{count} dny"}}},"share":{"topic":"sdílet odkaz na toto téma","post":"sdílet odkaz na tento příspěvek","close":"zavřít","twitter":"sdílet odkaz na Twitteru","facebook":"sdílet odkaz na Facebooku","google+":"sdílet odkaz na Google+","email":"odeslat odkaz emailem"},"edit":"upravit název a kategorii příspěvku","not_implemented":"Tato fičura ještě není implementovaná","no_value":"Ne","yes_value":"Ano","of_value":"z","generic_error":"Bohužel nastala chyba.","generic_error_with_reason":"Nastala chyba: %{error}","log_in":"Přihlásit se","age":"Věk","last_post":"Poslední příspěvek","admin_title":"Administrátor","flags_title":"Nahlášení","show_more":"zobrazit více","links":"Odkazy","faq":"FAQ","privacy_policy":"Ochrana soukromí","you":"Vy","or":"nebo","now":"právě teď","read_more":"číst dále","in_n_seconds":{"one":"za 1 sekundu","few":"za {{count}} sekundy","other":"za {{count}} sekund"},"in_n_minutes":{"one":"za 1 minutu","few":"za {{count}} minuty","other":"za {{count}} minut"},"in_n_hours":{"one":"za 1 hodinu","few":"za {{count}} hodiny","other":"za {{count}} hodin"},"in_n_days":{"one":"za 1 den","few":"za {{count}} dny","other":"za {{count}} dní"},"suggested_topics":{"title":"Doporučená témata"},"bookmarks":{"not_logged_in":"Pro přidání záložky se musíte přihlásit.","created":"Záložka byla přidána.","not_bookmarked":"Tento příspěvek jste již četli. Klikněte pro přidání záložky.","last_read":"Tohle je poslední již přečtený příspěvek."},"new_topics_inserted":"{{count}} nových témat.","show_new_topics":"Klikněte pro zobrazení.","preview":"náhled","cancel":"zrušit","save":"Uložit změny","saving":"Ukládám...","saved":"Uloženo!","choose_topic":{"none_found":"Žádná témata nenalezena.","title":{"search":"Hledat téma podle názvu, URL nebo ID:","placeholder":"sem napište název tématu"}},"user_action":{"user_posted_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E zaslal \u003Ca href='{{topicUrl}}'\u003Etéma\u003C/a\u003E","you_posted_topic":"\u003Ca href='{{userUrl}}'\u003EVy\u003C/a\u003E jste zaslal \u003Ca href='{{topicUrl}}'\u003Etéma\u003C/a\u003E","user_replied_to_post":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E odpověděl na příspěvek \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","you_replied_to_post":"\u003Ca href='{{userUrl}}'\u003EVy\u003C/a\u003E jste odpověděl na příspěvek \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","user_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E přispěl do \u003Ca href='{{topicUrl}}'\u003Etématu\u003C/a\u003E","you_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003EVy\u003C/a\u003E jste přispěl do \u003Ca href='{{topicUrl}}'\u003Etématu\u003C/a\u003E","user_mentioned_user":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E zmínil uživatele \u003Ca href='{{user2Url}}'\u003E{{another_user}}\u003C/a\u003E","user_mentioned_you":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E zmínil \u003Ca href='{{user2Url}}'\u003Evás\u003C/a\u003E","you_mentioned_user":"\u003Ca href='{{user1Url}}'\u003EVy\u003C/a\u003E jste znínil uživatele \u003Ca href='{{user2Url}}'\u003E{{user}}\u003C/a\u003E","posted_by_user":"Odesláno uživatel \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","posted_by_you":"Odesláno \u003Ca href='{{userUrl}}'\u003Evámi\u003C/a\u003E","sent_by_user":"Posláno uživatelem \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","sent_by_you":"Posláno \u003Ca href='{{userUrl}}'\u003Evámi\u003C/a\u003E"},"user_action_groups":{"1":"Rozdaných 'líbí se'","2":"Obdržených 'líbí se'","3":"Záložky","4":"Témata","5":"Odpovědi","6":"Odezvy ostatních","7":"Zmíňky","9":"Citace","10":"Oblíbené","11":"Editace","12":"Odeslané zprávy","13":"Přijaté zprávy"},"user":{"said":"uživatel {{username}} řekl:","profile":"Profil","title":{"title":"Nadpis"},"mute":"Ignorovat","edit":"Upravit nastavení","download_archive":"stáhnout archiv mých příspěvků","private_message":"Soukromá zpráva","private_messages":"Zprávy","activity_stream":"Aktivita","preferences":"Nastavení","bio":"O mně","invited_by":"Poznánka od","trust_level":"Věrohodnost","notifications":"Oznámení","dynamic_favicon":"Zobrazovat notifikace na favikoně","external_links_in_new_tab":"Otevírat všechny externí odkazy do nové záložky","enable_quoting":"Povolit odpověď s citací z označeného textu","change":"změnit","moderator":"{{user}} je moderátor","admin":"{{user}} je administrátor","change_password":{"success":"(email odeslán)","in_progress":"(odesílám)","error":"(chyba)"},"change_about":{"title":"Změna o mně"},"change_username":{"title":"Změnit uživatelské jméno","confirm":"Změna uživatelského jména může mít vážné následky. Opravdu to chcete udělat?","taken":"Toto uživatelské jméno je již zabrané.","error":"Nastala chyba při změně uživatelského jména.","invalid":"Uživatelské jméno je neplatné. Musí obsahovat pouze písmena a číslice."},"change_email":{"title":"Změnit emailovou adresu","taken":"Tato emailová adresa není k dispozici.","error":"Nastala chyba při změně emailové adresy. Není tato adresa již používaná?","success":"Na zadanou adresu jsme zaslali email. Následujte, prosím, instrukce v tomto emailu."},"email":{"title":"Emailová adresa","instructions":"Vaše emailová adresa nikdy nebude veřejně zobrazena.","ok":"To vypadá dobře. Zašleme vám email s potvrzením.","invalid":"Prosím zadejte platnou emailovou adresu.","authenticated":"Vaše emailová adresa byla autorizována přes službu {{provider}}.","frequency":"Budeme vás informovat emailem pouze pokud jste se na našem webu dlouho neukázali a pokud jste obsah, o kterém vás chceme informovat, doposud neviděli."},"name":{"title":"Jméno","instructions":"Delší verze vašeho jména. Nemusí být unikátní.","too_short":"Vaše jméno je příliš krátké.","ok":"Vaše jméno vypadá dobře"},"username":{"title":"Uživatelské jméno","instructions":"Musí být unikátní a bez mezer. Ostatní vás mohou zmínit jako @username.","short_instructions":"Ostatní vás mohou zmínit jako @{{username}}.","available":"Toto uživatelské jméno je volné.","global_match":"Emailová adresa odpovídá registrovaného uživatelskému jménu.","global_mismatch":"již zaregistrováno. Co třeba {{suggestion}}?","not_available":"Není k dispozici. Co třeba {{suggestion}}?","too_short":"Vaše uživatelské jméno je příliš krátké.","too_long":"Vaše uživatelské jméno je příliš dlouhé.","checking":"Zjišťuji, zda je uživatelské jméno volné...","enter_email":"Uživatelské jméno nalezeno. Zadejte odpovídající emailovou adresu."},"password_confirmation":{"title":"Heslo znovu"},"last_posted":"Poslední příspěvek","last_emailed":"Naposledy zaslán email","last_seen":"Naposledy viděn","created":"Účet vytvořen","log_out":"Odhlásit","website":"Web","email_settings":"Emailová adresa","email_digests":{"title":"Chci dostávat emailem souhrn novinek","daily":"denně","weekly":"týdně","bi_weekly":"jednou za 14 dní"},"email_direct":"Chci dostat email když někdo bude mluvit přímo se mnou","email_private_messages":"Chci dostat email když mi někdo zašle soukromou zprávu","other_settings":"Ostatní","new_topic_duration":{"label":"Považovat témata za nová, pokud","not_viewed":"dosud jsem je neviděl","last_here":"byly zaslány od mé poslední návštěvy","after_n_days":{"one":"byly zaslány v posledním dni","few":"byly zaslány v posledních {{count}} dnech","other":"byly zaslány v posledních {{count}} dnech"},"after_n_weeks":{"one":"byly zaslány v posledním týdnu","few":"byly zaslány v posledních {{count}} týdnech","other":"byly zaslány v posledních {{count}} týdnech"}},"auto_track_topics":"Automaticky sledovat témata, která navštívím","auto_track_options":{"never":"nikdy","always":"vždy","after_n_seconds":{"one":"po 1 vteřině","few":"po {{count}} vteřinách","other":"po {{count}} vteřinách"},"after_n_minutes":{"one":"po 1 minutě","few":"po {{count}} minutách","other":"po {{count}} minutách"}},"invited":{"title":"Pozvánky","user":"Pozvaný uživatel","none":"{{username}} nepozval na tento web žádné uživatele.","redeemed":"Uplatněné pozvánky","redeemed_at":"Uplatněno","pending":"Nevyřízené pozvánky","topics_entered":"Zobrazeno témat","posts_read_count":"Přečteno příspěvků","rescind":"Odstranit pozvánku","rescinded":"Pozvánka odstraněna","time_read":"Čas čtení","days_visited":"Přítomen dnů","account_age_days":"Stáří účtu ve dnech"},"password":{"title":"Heslo","too_short":"Vaše heslo je příliš krátké.","ok":"Vaše heslo je v pořádku."},"ip_address":{"title":"Poslední IP adresa"},"avatar":{"title":"Avatar"},"filters":{"all":"Vše"},"stream":{"posted_by":"Zaslal","sent_by":"Odeslal","private_message":"soukromá zpráva","the_topic":"téma"}},"loading":"Načítám...","close":"Zavřít","learn_more":"více informací...","year":"rok","year_desc":"témata za posledních 365 dní","month":"měsíc","month_desc":"témata za posledních 30 dní","week":"týden","week_desc":"témata za posledních 7 dní","first_post":"První příspěvek","mute":"Ignorovat","unmute":"Zrušit ignorování","best_of":{"title":"Nejlepší příspěvky","enabled_description":"Právě máte zobrazeny \"nejlepší příspěvky\" tohoto tématu.","description":"V tomto tématu je \u003Cb\u003E{{count}}\u003C/b\u003E příspěvků. A to už je hodně! Nechcete ušetřit čas při čtení tím, že zobrazíte pouze příspěvky, které mají nejvíce interakcí a odpovědí?","enable":"Přepnout na \"nejlepší příspěvky\"","disable":"Přepnout na normální zobrazení"},"private_message_info":{"title":"Soukromé konverzace","invite":"pozvat účastníka"},"email":"Emailová adresa","username":"Uživatelské jméno","last_seen":"Naposledy viděn","created":"Účet vytvořen","trust_level":"Věrohodnost","create_account":{"title":"Vytvořit účet","action":"Vytvořit!","invite":"Nemáte ještě účet?","failed":"Něco se nepovedlo, možná je tato e-mailová adresa již použita. Zkuste použít formulář pro obnovení hesla."},"forgot_password":{"title":"Zapomenuté heslo","action":"Zapomněl jsem své heslo","invite":"Vložte svoje uživatelské jméno nebo e-mailovou adresu a my vám zašleme postup pro obnovení hesla.","reset":"Obnovit heslo","complete":"Měli byste obdržet email s instrukcemi jak obnovit vaše heslo."},"login":{"title":"Přihlásit se","username":"Login","password":"Heslo","email_placeholder":"emailová adresa nebo uživatelské jméno","error":"Neznámá chyba","reset_password":"Resetovat heslo","logging_in":"Přihlašuji...","or":"Nebo","authenticating":"Autorizuji...","awaiting_confirmation":"Váš účet nyní čeká na aktivaci, použijte odkaz pro zapomené heslo, jestli chcete, abychom vám zaslali další aktivační email.","awaiting_approval":"Váš účet zatím nebyl schválen moderátorem. Až se tak stane, budeme vás informovat emailem.","not_activated":"Ještě se nemůžete přihlásit. Zaslali jsme vám aktivační email v \u003Cb\u003E{{sentTo}}\u003C/b\u003E. Prosím následujte instrukce v tomto emailu, abychom mohli váš účet aktivovat.","resend_activation_email":"Klikněte sem pro zaslání aktivačního emailu.","sent_activation_email_again":"Zaslali jsme vám další aktivační email na \u003Cb\u003E{{currentEmail}}\u003C/b\u003E. Může trvat několik minut, než vám dorazí. Zkontrolujte také vaši složku s nevyžádanou pošlou.","google":{"title":"přes Google","message":"Autorizuji přes Google (ujistěte se, že nemáte zablokovaná popup okna)"},"twitter":{"title":"přes Twitter","message":"Autorizuji přes Twitter (ujistěte se, že nemáte zablokovaná popup okna)"},"facebook":{"title":"přes Facebook","message":"Autorizuji přes Facebook (ujistěte se, že nemáte zablokovaná popup okna)"},"cas":{"title":"Přihlásit přes CAS","message":"Autorizuji přes CAS (ujistěte se, že nemáte zablokovaná popup okna)"},"yahoo":{"title":"přes Yahoo","message":"Autorizuji přes Yahoo (ujistěte se, že nemáte zablokovaná popup okna)"},"github":{"title":"přes GitHub","message":"Autorizuji přes GitHub (ujistěte se, že nemáte zablokovaná popup okna)"},"persona":{"title":"přes Persona","message":"Autorizuji přes Mozilla Persona (ujistěte se, že nemáte zablokovaná popup okna)"}},"composer":{"posting_not_on_topic":"Rozepsali jste odpověď na téma \"{{title}}\", ale nyní máte otevřené jiné téma.","saving_draft_tip":"ukládám","saved_draft_tip":"uloženo","saved_local_draft_tip":"uloženo lokálně","similar_topics":"Podobná témata","drafts_offline":"koncepty offline","min_length":{"need_more_for_title":"ještě {{n}} znaků nadpisu tématu","need_more_for_reply":"ještě {{n}} znaků textu odpovědi"},"error":{"title_missing":"Název musí být vyplněn.","title_too_short":"Název musí být alespoň {{min}} znaků dlouhý.","title_too_long":"Název musí být dlouhý maximálně {{min}} znaků.","post_missing":"Příspěvek nesmí být prázdný.","post_length":"Příspěvek musí být alespoň {{min}} znaků dlouhý.","category_missing":"Musíte vybrat kategorii."},"save_edit":"Uložit změnu","reply_original":"Odpovědět na původní téma","reply_here":"Odpovědět sem","reply":"Odpovědět","cancel":"Zrušit","create_topic":"Vytvořit téma","create_pm":"Vytvořit soukromou zprávu","users_placeholder":"Přidat uživatele","title_placeholder":"Sem napište název. O čem je tato diskuze v jedné krátké větě","reply_placeholder":"Sem napište svou odpověď. Pro formátování použijte Markdown nebo BBCode. Můžete sem přetáhnout nebo vložit obrázek a bude vložen do příspěvku.","view_new_post":"Zobrazit váš nový příspěvek.","saving":"Ukládám...","saved":"Uloženo!","saved_draft":"Máte rozepsaný příspěvek. Klikněte sem pro pokračování v úpravách.","uploading":"Nahrávám...","show_preview":"zobrazit náhled \u0026raquo;","hide_preview":"\u0026laquo; skrýt náhled","quote_post_title":"Citovat celý příspěvek","bold_title":"Tučně","bold_text":"tučný text","italic_title":"Kurzíva","italic_text":"text kurzívou","link_title":"Odkazy","link_description":"sem vložte popis odkazu","link_dialog_title":"Vložit odkaz","link_optional_text":"volitelný popis","quote_title":"Bloková citace","quote_text":"Bloková citace","code_title":"Ukázka kódu","code_text":"sem vložte kód","upload_title":"Obrázek","upload_description":"sem vložek popis obrázku","olist_title":"Číslovaný seznam","ulist_title":"Odrážkový seznam","list_item":"Položka seznam","heading_title":"Nadpis","heading_text":"Nadpis","hr_title":"Horizontální oddělovač","undo_title":"Zpět","redo_title":"Opakovat","help":"Nápověda pro Markdown","toggler":"zobrazit nebo skrýt editor příspěvku","admin_options_title":"Volitelné administrační nastavení tématu","auto_close_label":"Automaticky zavřít téma za:","auto_close_units":"dní"},"notifications":{"title":"oznámení o zmínkách pomocí @name, odpovědi na vaše příspěvky a témata, soukromé zprávy, atd.","none":"V tuto chvíli nemáte žádná oznámení.","more":"zobrazit starší oznámení","mentioned":"\u003Cspan title='mentioned' class='icon'\u003E@\u003C/span\u003E {{username}} {{link}}","quoted":"\u003Ci title='quoted' class='icon icon-quote-right'\u003E\u003C/i\u003E {{username}} {{link}}","replied":"\u003Ci title='replied' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","posted":"\u003Ci title='replied' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","edited":"\u003Ci title='edited' class='icon icon-pencil'\u003E\u003C/i\u003E {{username}} {{link}}","liked":"\u003Ci title='liked' class='icon icon-heart'\u003E\u003C/i\u003E {{username}} {{link}}","private_message":"\u003Ci class='icon icon-envelope-alt' title='soukromá zpráva'\u003E\u003C/i\u003E {{username}} vám zaslal soukromou zprávu: {{link}}","invited_to_private_message":"{{username}} vás pozval do soukromé konverzace: {{link}}","invitee_accepted":"\u003Ci title='přijetí pozvánky' class='icon icon-signin'\u003E\u003C/i\u003E {{username}} přijal vaši pozvánku","moved_post":"\u003Ci title='přesunutý příspěvek' class='icon icon-arrow-right'\u003E\u003C/i\u003E {{username}} přesunul příspěvek do {{link}}","total_flagged":"celkem nahlášeno příspěvků"},"upload_selector":{"title":"Vložit obrázek","title_with_attachments":"Nahrát obrázek nebo soubor","from_my_computer":"Z mého zařízení","from_the_web":"Z webu","remote_tip":"zadejte adresu obrázku ve formátu http://example.com/image.jpg","remote_tip_with_attachments":"zadejte adresu obrázku nebo souboru ve formátu http://example.com/file.ext","local_tip":"klikněte sem pro výběr obrázku z vašeho zařízení.","local_tip_with_attachments":"klikněte sem pro výběr obrázku nebo souboru z vašeho zařízení.","uploading":"Nahrávám"},"search":{"title":"hledání témat, příspěvků, uživatelů a kategorií","placeholder":"sem zadejte hledaný výraz","no_results":"Nenalezeny žádné výsledky.","searching":"Hledám ...","prefer":{"user":"při hledání budou preferovány výsledky od @{{username}}","category":"při hledání budou preferovány výsledky z kategorie {{category}}"}},"site_map":"jít na jiný seznam témat nebo kategorii","go_back":"jít zpět","current_user":"jít na vaši uživatelskou stránku","favorite":{"title":"Oblíbené","help":{"star":"přidat toto téma do oblíbených","unstar":"odebrat toto téma z oblíbených"}},"topics":{"none":{"favorited":"Zatím nemáte žádná oblíbená témata. Pro přidání tématu do oblíbených, klikněte na hvězdičku vedle názvu tématu.","unread":"Nemáte žádná nepřečtená témata.","new":"Nemáte žádná nová témata ke čtení.","read":"Zatím jste nečetli žádná témata.","posted":"Zatím jste nepřispěli do žádného tématu.","latest":"Nejsou tu žádná témata z poslední doby. To je docela smutné.","hot":"Nejsou tu žádná populární témata.","category":"V kategorii {{category}} nejsou žádná témata."},"bottom":{"latest":"Nejsou tu žádná další témata z poslední doby k přečtení.","hot":"Nejsou tu žádná další populární témata k přečtení.","posted":"Nejsou tu žádná další zaslaná témata k přečtení.","read":"Nejsou tu žádná další přečtená témata.","new":"Nejsou tu žádná další nová témata k přečtení.","unread":"Nejsou tu žádná další nepřečtená témata.","favorited":"Nejsou tu žádná další oblíbená témata k přečtení.","category":"V kategorii {{category}} nejsou žádná další témata."}},"rank_details":{"toggle":"zobrazit/skrýt detaily bodování","show":"zobrazit detaily bodování tématu","title":"Detaily bodování tématu"},"topic":{"create":"Nové téma","create_long":"Vytvořit nové téma","private_message":"Vytvořit soukromou konverzaci","list":"Témata","new":"nové téma","title":"Téma","loading_more":"Nahrávám více témat...","loading":"Nahrávám téma...","invalid_access":{"title":"Téma je soukromé","description":"Bohužel nemáte přístup k tomuto tématu."},"server_error":{"title":"Téma se nepodařilo načíst","description":"Bohužel není možné načíst toto téma, může to být způsobeno problémem s vaším připojením. Prosím, zkuste stránku načíst znovu. Pokud bude problém přetrvávat, dejte nám vědět."},"not_found":{"title":"Téma nenalezeno","description":"Bohužel se nám nepovedlo najít toto téma. Nebylo odstraněno moderátorem?"},"unread_posts":{"one":"máte 1 nepřečtený příspěvěk v tomto tématu","few":"máte {{count}} nepřečtené příspěvky v tomto tématu","other":"máte {{count}} nepřečtených příspěvků v tomto tématu"},"new_posts":{"one":"je zde 1 nový příspěvek od doby, kdy jste toto téma naposledy četli","few":"jsou zde {{count}} nové příspěvky od doby, kdy jste toto téma naposledy četli","other":"je zde {{count}} nových příspěvků od doby, kdy jste toto téma naposledy četli"},"likes":{"one":"je zde 1x 'líbí' v tomto tématu","few":"je zde {{count}}x 'líbí' v tomto tématu","other":"je zde {{count}}x 'líbí' v tomto tématu"},"back_to_list":"Zpátky na seznam témat","options":"Možnosti","show_links":"zobrazit odkazy v tomto tématu","toggle_information":"zobrazit/skrýt detaily tématu","read_more_in_category":"Chcete si přečíst další informace? Projděte si témata v {{catLink}} nebo {{latestLink}}.","read_more":"Chcete si přečíst další informace? {{catLink}} nebo {{latestLink}}.","browse_all_categories":"Procházet všechny kategorie","view_latest_topics":"zobrazit populární témata","suggest_create_topic":"Co takhle založit nové téma?","read_position_reset":"Vaše pozice čtení byla zresetována.","jump_reply_up":"přejít na předchozí odpověď","jump_reply_down":"přejít na následující odpověď","deleted":"Téma bylo smazáno","auto_close_notice":"Toto téma se automaticky zavře %{timeLeft}.","auto_close_title":"Nastavení automatického zavírání","auto_close_save":"Uložit","auto_close_cancel":"Zrušit","auto_close_remove":"Nezavírat téma automaticky","progress":{"title":"pozice v tématu","jump_top":"přejít na první příspěvek","jump_bottom":"přejít na poslední příspěvek","total":"celkem příspěvků","current":"aktuální příspěvek"},"notifications":{"title":"","reasons":{"3_2":"Budete dostávat oznámení, protože hlídáte toto téma.","3_1":"Budete dostávat oznámení, protože jste autorem totoho tématu.","3":"Budete dostávat oznámení, protože hlídáte toto téma.","2_4":"Budete dostávat oznámení, protože jste zaslal odpověď do tohoto tématu.","2_2":"Budete dostávat oznámení, protože sledujete toto téma.","2":"Budete dostávat oznámení, protože \u003Ca href=\"/users/{{username}}/preferences\"\u003Ejste četli toto téma\u003C/a\u003E.","1":"Dostanete oznámení, jestliže vás někdo zmíní pomocí @name nebo odpoví na váš příspěvek.","1_2":"Dostanete oznámení, jestliže vás někdo zmíní pomocí @name nebo odpoví na váš příspěvek.","0":"Ignorujete všechna oznámení z tohoto tématu.","0_2":"Ignorujete všechna oznámení z tohoto tématu."},"watching":{"title":"Hlídání","description":"stejné jako 'Sledování' a navíc dostanete upozornění o všech nových příspěvcích."},"tracking":{"title":"Sledování","description":"dostanete oznámení o nepřečtených příspěvcích, zmínkách přes @name a odpovědích na váš příspěvek."},"regular":{"title":"Normální","description":"dostanete oznámení, jestliže vás někdo zmíní pomocí @name nebo odpoví na váš příspěvek."},"muted":{"title":"Ztišení","description":"nebudete vůbec dostávat oznámení o tomto tématu a nebude se zobrazovat v seznamu nepřečtených témat."}},"actions":{"recover":"Vrátit téma","delete":"Odstranit téma","open":"Otevřít téma","close":"Zavřít téma","auto_close":"Automaticky zavřít","unpin":"Odstranit připevnění","pin":"Připevnit téma","unarchive":"Navrátit z archivu","archive":"Archivovat téma","invisible":"Zneviditelnit","visible":"Zviditelnit","reset_read":"Resetovat data o přečtení","multi_select":"Zapnout/vypnout multi-výběr","convert_to_topic":"Převést na běžné téma"},"reply":{"title":"Odpovědět","help":"začněte psát odpověď na toto téma"},"clear_pin":{"title":"Odstranit připevnění","help":"Odebere připevnění tohoto tématu, takže se již nebude zobrazovat na vrcholu seznamu témat"},"share":{"title":"Sdílet","help":"sdílet odkaz na toto téma"},"inviting":"Odesílám pozvánku...","invite_private":{"title":"Pozvat do soukromé konverzace","email_or_username":"Email nebo uživatelské jméno pozvaného","email_or_username_placeholder":"emailová adresa nebo uživatelské jméno","action":"Pozvat","success":"Děkujeme! Pozvali jste daného uživatele, aby se účastnil této soukromé konverzace.","error":"Bohužel nastala chyba při odesílání pozvánky."},"invite_reply":{"title":"Pozvat přátele k odpovědi","action":"Odeslat pozvánku","help":"odeslat pozvánku přátelům, aby mohli na toto téma odpovědět jedním kliknutím","email":"Odešleme vašemu příteli krátký email s odkazem na možnost přímo odpovědět na toto téma.","email_placeholder":"emailová adresa","success":"Díky! Odeslali jsme pozvánku na \u003Cb\u003E{{email}}\u003C/b\u003E. Dáme vám vědět, až bude pozvánka vyzvednuta. Na záložce pozvánek na vaší uživatelské stránce můžete sledovat koho jste pozvali.","error":"Bohužel se nepodařilo pozvat tuto osobu. Není již registrovaným uživatelem?"},"login_reply":"Přihlaste se, chcete-li odpovědět","filters":{"user":"{{n_posts}} {{by_n_users}}.","n_posts":{"one":"Je zobrazen pouze 1 příspěvek","few":"Jsou zobrazeny pouze {{count}} příspěvky","other":"Je zobrazeno pouze {{count}} příspěvků"},"by_n_users":{"one":"od 1 vybraného uživatele","few":"od {{count}} vybraného uživatele","other":"od {{count}} vybraných uživatelů"},"best_of":"{{n_best_posts}} {{of_n_posts}}.","n_best_posts":{"one":"Je zobrazen 1 nejlepší příspěvek","few":"Jsou zobrazeny {{count}} nejlepší příspěvky","other":"Je zobrazeno {{count}} nejlepších příspěvků"},"of_n_posts":{"one":"z celkem 1 příspěvku v tématu","few":"z celkem {{count}} příspěvků v tématu","other":"z celkem {{count}} příspěvků v tématu"},"cancel":"Zobrazí znovu všechny příspěvky v tomto tématu."},"split_topic":{"title":"Rozdělit téma","action":"rozdělit téma","topic_name":"Název nového tématu:","error":"Bohužel nastala chyba při rozdělování tématu.","instructions":{"one":"Chystáte se vytvořit nové téma a naplnit ho příspěvkem, který jste označili.","few":"Chystate se vytvořit noté téma a naplnit ho \u003Cb\u003E{{count}}\u003C/b\u003E příspěvky, které jste označili.","other":"Chystate se vytvořit noté téma a naplnit ho \u003Cb\u003E{{count}}\u003C/b\u003E příspěvky, které jste označili."}},"merge_topic":{"title":"Sloučit téma","action":"sloučit téma","error":"Bohužel nastala chyba při slučování tématu.","instructions":{"one":"Prosím, vyberte téma, do kterého chcete příspěvek přesunout.","few":"Prosím, vyberte téma, do kterého chcete tyto \u003Cb\u003E{{count}}\u003C/b\u003E příspěvky přesunout.","other":"Prosím, vyberte téma, do kterého chcete těchto \u003Cb\u003E{{count}}\u003C/b\u003E příspěvků přesunout."}},"multi_select":{"select":"označit","selected":"označeno ({{count}})","delete":"odstranit označené","cancel":"zrušit označování","description":{"one":"Máte označen \u003Cb\u003E1\u003C/b\u003E příspěvek.","few":"Máte označeny \u003Cb\u003E{{count}}\u003C/b\u003E příspěvky.","other":"Máte označeno \u003Cb\u003E{{count}}\u003C/b\u003E příspěvků."}}},"post":{"reply":"Odpovídáte na {{link}} od {{replyAvatar}} {{username}}","reply_topic":"Odpověď na {{link}}","quote_reply":"odpověď s citací","edit":"Editujete {{link}} od uživatele {{replyAvatar}} {{username}}","post_number":"příspěvek č. {{number}}","in_reply_to":"v odpovědi na","reply_as_new_topic":"Odpovědět jako nové téma","continue_discussion":"Pokračující diskuze z {{postLink}}:","follow_quote":"přejít na citovaný příspěvek","deleted_by_author":"(příspěvek odstraněn autorem)","deleted_by":"odstranil","expand_collapse":"rozbalit/sbalit","has_replies":{"one":"Odpověď","few":"Odpovědi","other":"Odpovědi"},"errors":{"create":"Bohužel nastala chyba při vytváření příspěvku. Prosím zkuste to znovu.","edit":"Bohužel nastala chyba při editaci příspěvku. Prosím zkuste to znovu.","upload":"Bohužel nastala chyba při nahrávání příspěvku. Prosím zkuste to znovu.","attachment_too_large":"Soubor, který se snažíte nahrát je bohužel příliš velký (maximální velikost je {{max_size_kb}}kb). Prosím zmenšete ho zkuste to znovu.","image_too_large":"Obrázek, který se snažíte nahrát je bohužel příliš velký (maximální velikost je {{max_size_kb}}kb). Prosím zmenšete ho zkuste to znovu.","too_many_uploads":"Bohužel, najednou smíte nahrát jen jeden soubor.","upload_not_authorized":"Bohužel, soubor, který se snažíte nahrát, není povolený (povolené přípony: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Bohužel, noví uživatelé nemohou nahrávat obrázky.","attachment_upload_not_allowed_for_new_user":"Bohužel, noví uživatelé nemohou nahrávat přílohy."},"abandon":"Opravdu chcete opustit váš příspěvek?","archetypes":{"save":"Uložit nastavení"},"controls":{"reply":"otevře okno pro sepsání odpovědi na tento příspěvek","like":"to se mi líbí","edit":"upravit příspěvek","flag":"nahlásit příspěvek moderátorovi","delete":"smazat příspěvek","undelete":"obnovit příspěvek","share":"sdílet odkaz na tento příspěvek","more":"Více"},"actions":{"flag":"Nahlásit","clear_flags":{"one":"Odebrat nahlášení","few":"Odebrat nahlášení","other":"Odebrat nahlášení"},"it_too":{"off_topic":"Také nahlásit","spam":"Také nahlásit","inappropriate":"Také nahlásit","custom_flag":"Také nahlásit","bookmark":"Také přidat do záložek","like":"To se mi také líbí","vote":"Hlasovat také"},"undo":{"off_topic":"Zrušit nahlášení","spam":"Zrušit nahlášení","inappropriate":"Zrušit nahlášení","bookmark":"Odebrat ze záložek","like":"Už se mi to nelíbí","vote":"Zrušit hlas"},"people":{"off_topic":"{{icons}} označili tento příspěvek jako off-topic","spam":"{{icons}} označili tento příspěvek jako spam","inappropriate":"{{icons}} označili tento příspěvek jako nevhodný","notify_moderators":"{{icons}} nahlásili tento příspěvek","notify_moderators_with_url":"{{icons}} \u003Ca href='{{postUrl}}'\u003Enahlásili tento příspěvek\u003C/a\u003E","notify_user":"{{icons}} zahájili soukromou konverzaci","notify_user_with_url":"{{icons}} zahájijli a \u003Ca href='{{postUrl}}'\u003Esoukromou konverzaci\u003C/a\u003E","bookmark":"{{icons}} si přidali příspěvek do záložek","like":"{{icons}} se líbí tento příspěvek","vote":"{{icons}} hlasovali pro tento příspěvek"},"by_you":{"off_topic":"Označili jste tento příspěvek jako off-topic","spam":"Označili jste tento příspěvek jako spam","inappropriate":"Označili jste tento příspěvek jako nevhodný","notify_moderators":"Nahlásili jste tento příspěvek","notify_user":"Zahájili jste soukromou konverzaci s tímto uživatelem","bookmark":"Přidali jste si tento příspěvek do záložek","like":"Toto se vám líbí","vote":"Hlasovali jste pro tento příspěvek"},"by_you_and_others":{"off_topic":{"one":"Vy a 1 další člověk jste označili tento příspěvek jako off-topic","few":"Vy a {{count}} další lidé jste označili tento příspěvek jako off-topic","other":"Vy a {{count}} dalších lidí jste označili tento příspěvek jako off-topic"},"spam":{"one":"Vy a 1 další člověk jste označili tento příspěvek jako spam","few":"Vy a {{count}} další lidé jste označili tento příspěvek jako spam","other":"Vy a {{count}} dalších lidí jste označili tento příspěvek jako spam"},"inappropriate":{"one":"Vy a 1 další člověk jste označili tento příspěvek jako nevhodný","few":"Vy a {{count}} další lidé jste označili tento příspěvek jako nevhodný","other":"Vy a {{count}} dalších lidí jste označili tento příspěvek jako nevhodný"},"notify_moderators":{"one":"Vy a 1 další člověk jste nahlásili tento příspěvek","few":"Vy a {{count}} další lidé jste nahlásili tento příspěvek","other":"Vy a {{count}} dalších lidí jste nahlásili tento příspěvek"},"notify_user":{"one":"Vy a 1 další člověk jste zahájili soukromou konverzaci s tímto uživatelem","few":"Vy a {{count}} další lidé jste zahájili soukromou konverzaci s tímto uživatelem","other":"Vy a {{count}} dalších lidí jste zahájili soukromou konverzaci s tímto uživatelem"},"bookmark":{"one":"Vy a 1 další člověk jste si přidali tento příspěvek do záložek","few":"Vy a {{count}} další lidé jste si přidali tento příspěvek do záložek","other":"Vy a {{count}} dalších lidí si přidali tento příspěvek do záložek"},"like":{"one":"Vám a 1 dalšímu člověku se tento příspěvek líbí","few":"Vám a {{count}} dalším lidem se tento příspěvek líbí","other":"Vám a {{count}} dalším lidem se tento příspěvek líbí"},"vote":{"one":"Vy a 1 další člověk jste hlasovali pro tento příspěvek","few":"Vy a {{count}} další lidé jste hlasovali pro tento příspěvek","other":"Vy a {{count}} dalších lidí jste hlasovali pro tento příspěvek"}},"by_others":{"off_topic":{"one":"1 člověk označil tento příspěvek jako off-topic","few":"{{count}} lidé označili tento příspěvek jako off-topic","other":"{{count}} lidí označilo tento příspěvek jako off-topic"},"spam":{"one":"1 člověk označil tento příspěvek jako spam","few":"{{count}} lidé označili tento příspěvek jako spam","other":"{{count}} lidí označilo tento příspěvek jako spam"},"inappropriate":{"one":"1 člověk označil tento příspěvek jako nevhodný","few":"{{count}} lidé označili tento příspěvek jako nevhodný","other":"{{count}} lidí označilo tento příspěvek jako nevhodný"},"notify_moderators":{"one":"1 člověk nahlásil tento příspěvek","few":"{{count}} lidé nahlásili tento příspěvek","other":"{{count}} lidí nahlásilo tento příspěvek"},"notify_user":{"one":"1 člověk zahájil soukromou konverzaci s tímto uživatelem","few":"{{count}} lidé zahájili soukromou konverzaci s tímto uživatelem","other":"{{count}} lidí zahájilo soukromou konverzaci s tímto uživatelem"},"bookmark":{"one":"1 člověk si přidal tento příspěvek do záložek","few":"{{count}} lidé si přidali tento příspěvek do záložek","other":"{{count}} lidí si přidalo tento příspěvek do záložek"},"like":{"one":"1 člověku se tento příspěvek líbí","few":"{{count}} lidem se tento příspěvek líbí","other":"{{count}} lidem se tento příspěvek líbí"},"vote":{"one":"1 člověk hlasoval pro tento příspěvek","few":"{{count}} lidé hlasovali pro tento příspěvek","other":"{{count}} lidí hlasovalo pro tento příspěvek"}}},"edits":{"one":"1 úprava","few":"{{count}} úpravy","other":"{{count}} úprav","zero":"žádné úpravy"},"delete":{"confirm":{"one":"Opravdu chcete odstranit tento příspěvek?","few":"Opravdu chcete odstranit všechny tyto příspěvky?","other":"Opravdu chcete odstranit všechny tyto příspěvky?"}}},"category":{"can":"smí\u0026hellip; ","none":"(bez kategorie)","edit":"upravit","edit_long":"Upravit kategorii","view":"Zobrazit témata v kategorii","general":"Obecné","settings":"Nastavení","delete":"Smazat kategorii","create":"Nová kategorie","save":"Uložit kategorii","creation_error":"Během vytváření nové kategorie nastala chyba.","save_error":"Během ukládání kategorie nastala chyba.","more_posts":"zobrazit všechny {{posts}}...","name":"Název kategorie","description":"Popis","topic":"téma kategorie","badge_colors":"Barvy štítku","background_color":"Barva pozadí","foreground_color":"Barva textu","name_placeholder":"Měl by být krátký a výstižný.","color_placeholder":"Jakákoliv webová barva","delete_confirm":"Opravdu chcete odstranit tuto kategorii?","delete_error":"Nastala chyba při odstraňování kategorie.","list":"Seznam kategorií","no_description":"K této kategorii zatím není žádný popis.","change_in_category_topic":"navštivte téma kategorie pro editaci jejího popisu","hotness":"Popularita","already_used":"Tato barva je již použita jinou kategorií","security":"Bezpečnost","auto_close_label":"Automaticky zavírat témata po:","edit_permissions":"Upravit oprávnění","add_permission":"Přidat oprávnění"},"flagging":{"title":"Proč chcete nahlásit tento příspěvek?","action":"Nahlásit příspěvek","take_action":"Zakročit","notify_action":"Oznámit","delete_spammer":"Odstranit spamera","delete_confirm":"Chystáte se odstranit \u003Cb\u003E%{posts}\u003C/b\u003E příspěvků a \u003Cb\u003E%{topics}\u003C/b\u003E témat od tohoto uživatele, smazat jeho účet, a vložit jeho emailovou adresu \u003Cb\u003E%{email}\u003C/b\u003E na seznam permanentně blokovaných. Jste si jistí, že je tento uživatel opravdu spamer?","yes_delete_spammer":"Ano, odstranit spamera","cant":"Bohužel nyní nemůžete tento příspěvek nahlásit.","custom_placeholder_notify_user":"Proč chcete s tímto uživatele mluvit přímo a soukromě? Buďte konstruktivní, konkrétní a hlavně vstřícní.","custom_placeholder_notify_moderators":"Proč příspěvek vyžaduje pozornost moderátora? Dejte nám vědět, co konkrétně vás znepokojuje, a poskytněte relevantní odkazy, je-li to možné.","custom_message":{"at_least":"zadejte alespoň {{n}} znaků","more":"ještě {{n}}...","left":"{{n}} zbývá"}},"topic_summary":{"title":"Souhrn tématu","links_shown":"zobrazit všech {{totalLinks}} odkazů...","clicks":"počet kliknutí","topic_link":"odkaz na téma"},"topic_statuses":{"locked":{"help":"toto téma je uzavřené; další odpovědi nebudou přijímány"},"pinned":{"help":"toto téma je připevněné; bude se zobrazovat na vrcholu seznamu ve své kategorii"},"archived":{"help":"toto téma je archivováno; je zmraženo a nelze ho již měnit"},"invisible":{"help":"toto téma je neviditelné; nebude se zobrazovat v seznamu témat a lze ho navštívit pouze přes přímý odkaz"}},"posts":"Příspěvky","posts_long":"{{number}} příspěvků v tomto tématu","original_post":"Původní příspěvek","views":"Zobrazení","replies":"Odpovědi","views_long":"toto téma bylo zobrazeno {{number}}krát","activity":"Aktivita","likes":"Líbí se","likes_long":"je zde {{number}} 'líbí se' v tomto tématu","top_contributors":"Účastníci","category_title":"Kategorie","history":"Historie","changed_by":"od uživatele {{author}}","categories_list":"Seznam kategorií","filters":{"latest":{"title":"Aktuální","help":"nejaktuálnější témata"},"hot":{"title":"Populární","help":"populární témata z poslední doby"},"favorited":{"title":"Oblíbená","help":"témata, která jste označili jako oblíbená"},"read":{"title":"Přečtená","help":"témata, která jste si přečetli"},"categories":{"title":"Kategorie","title_in":"Kategorie - {{categoryName}}","help":"všechny témata seskupená podle kategorie"},"unread":{"title":{"zero":"Nepřečtená","one":"Nepřečtená (1)","few":"Nepřečtená ({{count}})","other":"Nepřečtená ({{count}})"},"help":"sledovaná témata s nepřečtenými příspěvky"},"new":{"title":{"zero":"Nová","one":"Nová (1)","few":"Nová ({{count}})","other":"Nová ({{count}})"},"help":"nová témata od vaší poslední návštěvy a nové příspěvky v tématech, která sledujete"},"posted":{"title":"Mé příspěvky","help":"témata, do kterých jste přispěli"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","few":"{{categoryName}} ({{count}})","other":"{{categoryName}} ({{count}})"},"help":"populární témata v kategorii {{categoryName}}"}},"browser_update":"Bohužel, \u003Ca href=\"http://www.discourse.org/faq/#browser\"\u003Eváš prohlížeč je příliš starý, aby na něm Discourse mohl fungovat\u003C/a\u003E. Prosím \u003Ca href=\"http://browsehappy.com\"\u003Eaktualizujte svůj prohlížeč\u003C/a\u003E.","permission_types":{"full":"Vytváření / Odpovídání / Prohlížení","create_post":"Odpovídání / Prohlížení","readonly":"Prohlížení"},"type_to_filter":"zadejte text pro filtrování...","admin":{"title":"Discourse Administrace","moderator":"Moderátor","dashboard":{"title":"Administrátorský rozcestník","version":"Verze Discourse","up_to_date":"Používáte nejnovější verzi Discourse.","critical_available":"Je k dispozici důležitá aktualizace.","updates_available":"Jsou k dispozici aktualizace.","please_upgrade":"Prosím aktualizujte!","no_check_performed":"Kontrola na aktualizace nebyla provedena. Ujistěte se, že běží služby sidekiq.","stale_data":"V poslední době neproběhal kontrola aktualizací. Ujistěte se, že běží služby sidekiq.","installed_version":"Nainstalováno","latest_version":"Poslední verze","problems_found":"Byly nalezeny problémy s vaší instalací systému Discourse:","last_checked":"Naposledy zkontrolováno","refresh_problems":"Obnovit","no_problems":"Nenalezeny žádné problémy.","moderators":"Moderátoři:","admins":"Administrátoři:","blocked":"Blokováno:","suspended":"Zakázáno:","private_messages_short":"SZ","private_messages_title":"Soukromé zprávy","reports":{"today":"Dnes","yesterday":"Včera","last_7_days":"Posledních 7 dní","last_30_days":"Posledních 30 dní","all_time":"Za celou dobu","7_days_ago":"Před 7 dny","30_days_ago":"Před 30 dny","all":"Všechny","view_table":"Zobrazit jako tabulku","view_chart":"Zobrazit jako sloupcový graf"}},"commits":{"latest_changes":"Poslední změny: prosím aktualizujte často!","by":"od"},"flags":{"title":"Nahlášení","old":"Staré","active":"Aktivní","agree_hide":"Souhlas (skrýt příspěvek + odeslat SZ)","agree_hide_title":"Skrýt tento příspěvek a automaticky odeslat soukromou zprávu, která uživatele žádá o editaci","defer":"Odložit","defer_title":"Není zapotřebí žádná akce, odloží toto nahlášení na později","delete_post":"Smazat příspěvek","delete_post_title":"Odstraní příspěvek; je-li to první příspěvek v tématu, odstraní celé téma","disagree_unhide":"Nesouhlas (znovu zobrazí příspěvek)","disagree_unhide_title":"Odstraní všechna nahlášení na tomto příspěvku a znovu ho zviditelní","disagree":"Nesouhlas","disagree_title":"Nesouhlas s nahlášením, odstraní všechna nahlášení na tomto příspěvku","delete_spammer_title":"Odstranit uživatele a všechny jeho příspěvky a témata.","flagged_by":"Nahlásil","error":"Něco se pokazilo","view_message":"zobrazit zprávu","no_results":"Nejsou zde žádná nahlášení.","summary":{"action_type_3":{"one":"off-topic","few":"off-topic x{{count}}","other":"off-topic x{{count}}"},"action_type_4":{"one":"nevhodné","few":"nevhodné x{{count}}","other":"nevhodné x{{count}}"},"action_type_6":{"one":"spam","few":"spam x{{count}}","other":"spam x{{count}}"},"action_type_7":{"one":"vlastní","few":"vlastní x{{count}}","other":"vlastní x{{count}}"},"action_type_8":{"one":"spam","few":"spam x{{count}}","other":"spam x{{count}}"}}},"groups":{"title":"Skupiny","edit":"Editovat Skupiny","selector_placeholder":"přidat uživatele","name_placeholder":"Název skupiny, bez mezer, stejná pravidla jako pro uživatelská jména","about":"Zde můžete upravit názvy skupin a členství","can_not_edit_automatic":"Členství v automatických skupinách se přiděluje samo, administrátoři mohou přidělit další role a důveryhodnost uživatelům","delete":"Smazat","delete_confirm":"Smazat toto skupiny?","delete_failed":"Unable to delete group. If this is an automatic group, it cannot be destroyed."},"api":{"title":"API","long_title":"API Informace","key":"Klíč","generate":"Vygenerovat API klíč","regenerate":"Znovu-vygenerovat API klíč","info_html":"Váš API klíč umožní vytvářet a aktualizovat témata pomocí JSONových volání.","note_html":"Uchovejte tento klíč \u003Cstrong\u003Ev bezpečí\u003C/strong\u003E, každý, kdo má tento klíč, může libovolně vytvářet příspěvky na fóru i za ostatní uživatele."},"customize":{"title":"Přizpůsobení","long_title":"Přizpůsobení webu","header":"Hlavička","css":"Stylesheet","override_default":"Přetížit výchozí?","enabled":"Zapnutý?","preview":"náhled","undo_preview":"zrušit náhled","save":"Uložit","new":"Nový","new_style":"Nový styl","delete":"Smazat","delete_confirm":"Smazat toto přizpůsobení?","about":"Přizpůsobení webu vám umožní si nastavit vlastní CSS stylesheet a vlastní nadpisy na webu. Vyberte si z nabídky nebo vložte vlastní přizpůsobení a můžete začít editovat."},"email":{"title":"Email","settings":"Nastavení","logs":"Záznamy","sent_at":"Odesláno","user":"Uživatel","email_type":"Typ emailu","to_address":"Komu","test_email_address":"testovací emailová adresa","send_test":"odeslat testovací email","sent_test":"odesláno!","delivery_method":"Způsob doručení","preview_digest":"Náhled souhrnu","preview_digest_desc":"Toto je nástroj pro zobrazení náhledu, jak bude vypadat obsah emailu se souhrnem, který se zasílá uživatelům.","refresh":"Obnovit","format":"Formát","html":"html","text":"text","last_seen_user":"Uživatel byl naposled přítomen:","reply_key":"Klíč pro odpověď"},"impersonate":{"title":"Vydávat se za uživatele","username_or_email":"Uživatelské jméno nebo emailová adresa","help":"Použijte tento nástroj k přihlášení za jiného uživatele pro ladící a vývojové potřeby.","not_found":"Tento uživatel nebyl nalezen.","invalid":"Bohužel za tohoto uživatele se nemůžete vydávat."},"users":{"title":"Uživatelé","create":"Přidat administrátora","last_emailed":"Email naposledy zaslán","not_found":"Bohužel uživatel s tímto jménem není v našem systému.","active":"Aktivní","nav":{"new":"Noví","active":"Aktivní","pending":"Čeká na schválení","admins":"Administrátoři","moderators":"Moderátoři","suspended":"Zakázaní","blocked":"Blokovaní"},"approved":"Schválen?","approved_selected":{"one":"schválit uživatele","few":"schválit uživatele ({{count}})","other":"schválit uživatele ({{count}})"},"titles":{"active":"Aktivní uživatelé","new":"Noví uživatelé","pending":"Uživatelé čekající na schválení","newuser":"Uživatelé s věrohodností 0 (Nový uživatel)","basic":"Uživatelé s věrohodností 1 (Základní uživatel)","regular":"Uživatelé s věrohodností 2 (Pravidelný uživatel)","leader":"Uživatelé s věrohodností 3 (Vedoucí)","elder":"Uživatelé s věrohodností 4 (Starší)","admins":"Admininstrátoři","moderators":"Moderátoři","blocked":"Blokovaní uživatelé","suspended":"Zakázaní uživatelé"}},"user":{"suspend_failed":"Nastala chyba při zakazování uživatele {{error}}","unsuspend_failed":"Nastala chyba při povolování uživatele {{error}}","suspend_duration":"Jak dlouho má zákaz platit? (dny)","delete_all_posts":"Smazat všechny příspěvky","suspend":"Zakázat","unsuspend":"Povolit","suspended":"Zakázán?","moderator":"Moderátor?","admin":"Administrátor?","blocked":"Zablokovaný?","show_admin_profile":"Administrace","edit_title":"Upravit nadpis","save_title":"Uložit nadpis","refresh_browsers":"Vynutit obnovení prohlížeče","show_public_profile":"Zobrazit veřejný profil","impersonate":"Vydávat se za uživatele","revoke_admin":"Odebrat administrátorská práva","grant_admin":"Udělit administrátorská práva","revoke_moderation":"Odebrat moderátorská práva","grant_moderation":"Udělit moderátorská práva","unblock":"Odblokovat","block":"Zablokovat","reputation":"Reputace","permissions":"Povolení","activity":"Aktivita","like_count":"Obdržel 'líbí'","private_topics_count":"Počet soukromách témat","posts_read_count":"Přečteno příspěvků","post_count":"Vytvořeno příspěvků","topics_entered":"Zobrazil témat","flags_given_count":"Uděleno nahlášení","flags_received_count":"Přijato nahlášení","approve":"Schválit","approved_by":"schválil","approve_success":"Uživatel bys schválen a byl mu zaslán aktivační email s instrukcemi.","approve_bulk_success":"Povedlo se! Všichni uživatelé byli schváleni a byly jim rozeslány notifikace.","time_read":"Čas čtení","delete":"Smazat uživatele","delete_forbidden":"Uživatele nelze odstranit, protože má na fóru zveřejněné příspěvky. Nejprve smažte všechny jeho příspěvky.","delete_confirm":"Jste si jistí, že chce permanentně smazat tohoto uživatele z fóra? Tato akce je nevratná!","delete_and_block":"\u003Cb\u003EAno\u003C/b\u003E, a \u003Cb\u003Ezakázat\u003C/b\u003E registraci z této emailové adresy","delete_dont_block":"\u003Cb\u003EAno\u003C/b\u003E, a \u003Cb\u003Epovolit\u003C/b\u003E registraci z této emailové adresy","deleted":"Uživatel byl smazán.","delete_failed":"Nastala chyba při odstraňování uživatele. Ujistěte se, že jsou všechny příspěvky tohoto uživatele smazané, než budete uživatele mazat.","send_activation_email":"Odeslat aktivační email","activation_email_sent":"Aktivační email byl odeslán.","send_activation_email_failed":"Nastal problém při odesílání aktivačního emailu.","activate":"Aktivovat účet","activate_failed":"Nasstal problém při aktivování tohoto uživatele.","deactivate_account":"Deaktivovat účet","deactivate_failed":"Nastal problém při deaktivování tohoto uživatele.","unblock_failed":"Nastal problém při odblokování uživatele.","block_failed":"Nastal problém při blokování uživatele.","deactivate_explanation":"Deaktivovaný uživatel musí znovu validovat svoji emailovou adresu než se bude moci znovu přihlásit.","banned_explanation":"Zakázaný uživatel se nemůže přihlásit.","block_explanation":"Zablokovaný uživatel nemůže přispívat nebo vytvářet nová témata.","trust_level_change_failed":"Nastal problém při změně důveryhodnosti uživatele."},"site_content":{"none":"Zvolte typ obsahu a můžete začít editovat.","title":"Obsah webu","edit":"Editovat obsah webu"},"site_settings":{"show_overriden":"Zobrazit pouze změněná nastavení","title":"Nastavení webu","reset":"vrátit do původního nastavení","none":"žádné"}}}}};
I18n.locale = 'cs';
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
// language : czech (cs)
// author : petrbela : https://github.com/petrbela
//

(function(){


var months = "leden_únor_březen_duben_květen_červen_červenec_srpen_září_říjen_listopad_prosinec".split("_"),
    monthsShort = "led_úno_bře_dub_kvě_čvn_čvc_srp_zář_říj_lis_pro".split("_");

function plural(n) {
    return (n > 1) && (n < 5) && (~~(n / 10) !== 1);
}

function translate(number, withoutSuffix, key, isFuture) {
    var result = number + " ";
    switch (key) {
    case 's':  // a few seconds / in a few seconds / a few seconds ago
        return (withoutSuffix || isFuture) ? 'pár vteřin' : 'pár vteřinami';
    case 'm':  // a minute / in a minute / a minute ago
        return withoutSuffix ? 'minuta' : (isFuture ? 'minutu' : 'minutou');
    case 'mm': // 9 minutes / in 9 minutes / 9 minutes ago
        if (withoutSuffix || isFuture) {
            return result + (plural(number) ? 'minuty' : 'minut');
        } else {
            return result + 'minutami';
        }
        break;
    case 'h':  // an hour / in an hour / an hour ago
        return withoutSuffix ? 'hodina' : (isFuture ? 'hodinu' : 'hodinou');
    case 'hh': // 9 hours / in 9 hours / 9 hours ago
        if (withoutSuffix || isFuture) {
            return result + (plural(number) ? 'hodiny' : 'hodin');
        } else {
            return result + 'hodinami';
        }
        break;
    case 'd':  // a day / in a day / a day ago
        return (withoutSuffix || isFuture) ? 'den' : 'dnem';
    case 'dd': // 9 days / in 9 days / 9 days ago
        if (withoutSuffix || isFuture) {
            return result + (plural(number) ? 'dny' : 'dní');
        } else {
            return result + 'dny';
        }
        break;
    case 'M':  // a month / in a month / a month ago
        return (withoutSuffix || isFuture) ? 'měsíc' : 'měsícem';
    case 'MM': // 9 months / in 9 months / 9 months ago
        if (withoutSuffix || isFuture) {
            return result + (plural(number) ? 'měsíce' : 'měsíců');
        } else {
            return result + 'měsíci';
        }
        break;
    case 'y':  // a year / in a year / a year ago
        return (withoutSuffix || isFuture) ? 'rok' : 'rokem';
    case 'yy': // 9 years / in 9 years / 9 years ago
        if (withoutSuffix || isFuture) {
            return result + (plural(number) ? 'roky' : 'let');
        } else {
            return result + 'lety';
        }
        break;
    }
}

moment.lang('cs', {
    months : months,
    monthsShort : monthsShort,
    monthsParse : (function (months, monthsShort) {
        var i, _monthsParse = [];
        for (i = 0; i < 12; i++) {
            // use custom parser to solve problem with July (červenec)
            _monthsParse[i] = new RegExp('^' + months[i] + '$|^' + monthsShort[i] + '$', 'i');
        }
        return _monthsParse;
    }(months, monthsShort)),
    weekdays : "neděle_pondělí_úterý_středa_čtvrtek_pátek_sobota".split("_"),
    weekdaysShort : "ne_po_út_st_čt_pá_so".split("_"),
    weekdaysMin : "ne_po_út_st_čt_pá_so".split("_"),
    longDateFormat : {
        LT: "H:mm",
        L : "DD.MM.YYYY",
        LL : "D. MMMM YYYY",
        LLL : "D. MMMM YYYY LT",
        LLLL : "dddd D. MMMM YYYY LT"
    },
    calendar : {
        sameDay: "[dnes v] LT",
        nextDay: '[zítra v] LT',
        nextWeek: function () {
            switch (this.day()) {
            case 0:
                return '[v neděli v] LT';
            case 1:
            case 2:
                return '[v] dddd [v] LT';
            case 3:
                return '[ve středu v] LT';
            case 4:
                return '[ve čtvrtek v] LT';
            case 5:
                return '[v pátek v] LT';
            case 6:
                return '[v sobotu v] LT';
            }
        },
        lastDay: '[včera v] LT',
        lastWeek: function () {
            switch (this.day()) {
            case 0:
                return '[minulou neděli v] LT';
            case 1:
            case 2:
                return '[minulé] dddd [v] LT';
            case 3:
                return '[minulou středu v] LT';
            case 4:
            case 5:
                return '[minulý] dddd [v] LT';
            case 6:
                return '[minulou sobotu v] LT';
            }
        },
        sameElse: "L"
    },
    relativeTime : {
        future : "za %s",
        past : "před %s",
        s : translate,
        m : translate,
        mm : translate,
        h : translate,
        hh : translate,
        d : translate,
        dd : translate,
        M : translate,
        MM : translate,
        y : translate,
        yy : translate
    },
    ordinal : '%d.',
    week : {
        dow : 1, // Monday is the first day of the week.
        doy : 4  // The week that contains Jan 4th is the first week of the year.
    }
});

})();

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};

I18n.pluralizationRules['cs'] = function (n) {
  if (n == 0) return ["zero", "none", "other"];
  if (n == 1) return "one";
  if (n >= 2 && n <= 4) return "few";
  return "other";
}
;
