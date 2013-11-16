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
MessageFormat.locale.nl = function ( n ) {
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
r += "Er ";
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
r += "is <a href='/unread'>1 ongelezen</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "zijn <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " ongelezen</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += " <a href='/new'>1 nieuwe</a> topic";
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
r += "zijn ";
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
})() + " nieuwe</a> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " over, of ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "bekijk andere topics in ";
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
}});I18n.translations = {"nl":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"tiny":{"half_a_minute":"\u003C 1m","less_than_x_seconds":{"one":"\u003C 1s","other":"\u003C %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003C 1m","other":"\u003C %{count}m"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}u"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1j","other":"%{count}j"},"over_x_years":{"one":"\u003E 1j","other":"\u003E %{count}j"},"almost_x_years":{"one":"1j","other":"%{count}j"}},"medium":{"x_minutes":{"one":"1 min","other":"%{count} mins"},"x_hours":{"one":"1 uur","other":"%{count} uren"},"x_days":{"one":"1 dag","other":"%{count} dagen"}},"medium_with_ago":{"x_minutes":{"one":"1 min geleden","other":"%{count} mins geleden"},"x_hours":{"one":"1 uur geleden","other":"%{count} uren geleden"},"x_days":{"one":"1 day geleden","other":"%{count} dagen geleden"}}},"share":{"topic":"Deel een link naar deze topic","post":"Deel een link naar bericht #%{postNumber}","close":"sluit","twitter":"deel deze link op Twitter","facebook":"deel deze link op Facebook","google+":"deel deze link op Google+","email":"deel deze link via e-mail"},"edit":"bewerk de titel en categorie van deze topic","not_implemented":"Deze functie is helaas nog niet beschikbaar, sorry!","no_value":"Nee","yes_value":"Ja","of_value":"van","generic_error":"Sorry, er is iets fout gegaan.","generic_error_with_reason":"Er is iets fout gegaan: %{error}","log_in":"Log in","age":"Leeftijd","last_post":"Laatste bericht","joined":"Lid sinds","admin_title":"Beheer","flags_title":"Meldingen","show_more":"meer...","links":"Links","faq":"FAQ","privacy_policy":"Privacy Policy","mobile_view":"Mobiele versie","desktop_versie":"Desktopversie","you":"Jij","or":"of","now":"zonet","read_more":"lees verder","more":"Meer","less":"Minder","never":"nooit","daily":"dagelijks","weekly":"wekelijks","every_two_weeks":"elke twee weken","character_count":{"one":"{{count}} teken","other":"{{count}} tekens"},"in_n_seconds":{"one":"over 1 seconde","other":"over {{count}} secondes"},"in_n_minutes":{"one":"over 1 minuut","other":"over {{count}} minuten"},"in_n_hours":{"one":"over 1 uur","other":"over {{count}} uren"},"in_n_days":{"one":"over 1 dag","other":"over {{count}} dagen"},"suggested_topics":{"title":"Aanbevolen topics"},"bookmarks":{"not_logged_in":"Sorry, maar je moet ingelogd zijn om dit bericht aan je bladwijzers toe te kunnen voegen.","created":"Je hebt dit bericht aan je bladwijzers toegevoegd.","not_bookmarked":"Je hebt dit bericht gelezen; klik om deze aan je bladwijzers toe te voegen.","last_read":"Dit is het laatste bericht dat je gelezen hebt, klik om te bookmarken."},"new_topics_inserted":"{{count}} nieuwe topics.","show_new_topics":"Klik om te bekijken.","preview":"voorbeeld","cancel":"Annuleer","save":"Bewaar wijzigingen","saving":"Wordt opgeslagen...","saved":"Opgeslagen!","upload":"Upload","uploading":"Uploaden...","uploaded":"Geupload!","choose_topic":{"none_found":"Geen topics gevonden.","title":{"search":"Zoek naar een topic op naam, url of id:","placeholder":"typ hier de titel van de topic"}},"user_action":{"user_posted_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E plaatste \u003Ca href='{{topicUrl}}'\u003Edeze topic\u003C/a\u003E","you_posted_topic":"\u003Ca href='{{userUrl}}'\u003EJij\u003C/a\u003E plaatste \u003Ca href='{{topicUrl}}'\u003Edeze topic\u003C/a\u003E","user_replied_to_post":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E reageerde op \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","you_replied_to_post":"\u003Ca href='{{userUrl}}'\u003EJij\u003C/a\u003E reageerde op \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","user_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E reageerde op \u003Ca href='{{topicUrl}}'\u003Ethe topic\u003C/a\u003E","you_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003EJij\u003C/a\u003E reageerde op \u003Ca href='{{topicUrl}}'\u003Ethe topic\u003C/a\u003E","user_mentioned_user":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E noemde \u003Ca href='{{user2Url}}'\u003E{{another_user}}\u003C/a\u003E","user_mentioned_you":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E noemde \u003Ca href='{{user2Url}}'\u003Ejou\u003C/a\u003E","you_mentioned_user":"\u003Ca href='{{user1Url}}'\u003EJij\u003C/a\u003E noemde \u003Ca href='{{user2Url}}'\u003E{{user}}\u003C/a\u003E","posted_by_user":"Geplaatst door \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","posted_by_you":"Geplaatst door \u003Ca href='{{userUrl}}'\u003Ejou\u003C/a\u003E","sent_by_user":"Verzonden door \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","sent_by_you":"Verzonden door \u003Ca href='{{userUrl}}'\u003Ejou\u003C/a\u003E"},"user_action_groups":{"1":"Likes gegeven","2":"Likes ontvangen","3":"Bladwijzers","4":"Topics","5":"Berichten","6":"Reacties","7":"Genoemd","9":"Citaten","10":"Favorieten","11":"Wijzigingen","12":"Verzonden items","13":"Inbox"},"categories":{"all":"alle categoriëen","only_category":"only {{categoryName}}","category":"Categorie","posts":"Berichten","topics":"Topics","latest":"Laatste","latest_by":"Laatste door","toggle_ordering":"schakel sorteermethode","subcategories":"Subcategoriëen:"},"user":{"said":"{{username}} zei:","profile":"Profiel","show_profile":"Bekijk profiel","mute":"Negeer","edit":"Wijzig voorkeuren","download_archive":"download een archief van mijn berichten","private_message":"Privé-bericht","private_messages":"Berichten","activity_stream":"Activiteit","preferences":"Voorkeuren","bio":"Over mij","invited_by":"Uitgenodigd door","trust_level":"Trustlevel","notifications":"Notificaties","dynamic_favicon":"Laat notificatie voor nieuw bericht zien in favicon","external_links_in_new_tab":"Open alle externe links in een nieuw tabblad","enable_quoting":"Activeer antwoord-met-citaat voor geselecteerde tekst","change":"verander","moderator":"{{user}} is een moderator","admin":"{{user}} is een admin","deleted":"(verwijderd)","messages":{"all":"Alle","mine":"Mijn","unread":"Ongelezen"},"change_password":{"success":"(e-mail verzonden)","in_progress":"(e-mail wordt verzonden)","error":"(fout)","action":"Stuur wachtwoord-reset-mail"},"change_about":{"title":"Wijzig bio"},"change_username":{"title":"Wijzig gebruikersnaam","confirm":"Het wijzigen van je gebruikersnaam kan consequenties hebben. Weet je zeker dat je dit wil doen?","taken":"Sorry, maar die gebruikersnaam is al in gebruik.","error":"Het veranderen van je gebruikersnaam is mislukt.","invalid":"Die gebruikersnaam is ongeldig. Gebruik alleen nummers en letters."},"change_email":{"title":"Wijzig e-mail","taken":"Sorry, dat e-mailadres is niet beschikbaar.","error":"Het veranderen van je e-mailadres is mislukt. Wellicht is deze al in gebruik?","success":"We hebben een mail gestuurd naar dat adres. Volg de bevestigingsinstructies in die mail."},"change_avatar":{"title":"Wijzig je avatar","gravatar":"\u003Ca href='//gravatar.com/emails' target='_blank'\u003EGravatar\u003C/a\u003E, gebaseerd op","gravatar_title":"Verander je avatar op Gravatars website","uploaded_avatar":"Eigen afbeelding","uploaded_avatar_empty":"Voeg een eigen afbeelding toe","upload_title":"Upload je afbeelding","image_is_not_a_square":"Let op: we hebben je afbeelding bijgesneden omdat het geen vierkant is."},"email":{"title":"E-mail","instructions":"Je e-mail adres zal nooit publieklijk zichtbaar zijn.","ok":"Prima. We zullen je een e-mail sturen ter bevestiging.","invalid":"Vul een geldig e-mailadres in.","authenticated":"Je e-mailadres is bevestigd door {{provider}}.","frequency":"We zullen je alleen maar mailen als we je een tijd niet gezien hebben, en als je toevallig hetgeen waarover we je mailen nog niet hebt gezien op onze site."},"name":{"title":"Naam","instructions":"De langere versie van je naam; die hoeft niet uniek te zijn.","too_short":"Je naam is te kort.","ok":"Wat een mooie naam!"},"username":{"title":"Gebruikersnaam","instructions":"Moet uniek zijn, geen spaties. Mensen kunnen naar je verwijzen als @{{username}}","short_instructions":"Mensen kunnen naar je verwijzen als @{{username}}.","available":"Je gebruikersnaam is beschikbaar.","global_match":"Je e-mailadres komt overeen met je geregistreerde gebruikersnaam.","global_mismatch":"Is al geregistreerd. Gebruikersnaam {{suggestion}} proberen?","not_available":"Niet beschikbaar. Gebruikersnaam {{suggestion}} proberen?","too_short":"Je gebruikersnaam is te kort.","too_long":"Je gebruikersnaam is te lang.","checking":"Beschikbaarheid controleren...","enter_email":"Gebruikersnaam gevonden. Vul het gekoppelde e-mailadres in."},"password_confirmation":{"title":"Nogmaals het wachtwoord"},"last_posted":"Laatste bericht","last_emailed":"Laatst gemailed","last_seen":"Laatst gezien","created":"Lid sinds","log_out":"Log uit","website":"Website","email_settings":"E-mail","email_digests":{"title":"Stuur me een mail met de laatste updates wanneer ik de site niet bezoek.","daily":"dagelijks","weekly":"wekelijks","bi_weekly":"elke twee weken"},"email_direct":"Ontvang een mail wanneer iemand je citeert, reageert op je bericht of je @gebruikersnaam noemt.","email_private_messages":"Ontvang een mail wanneer iemand je een privé-bericht heeft gestuurd.","email_always":"Ontvang notificaties en topicoverzichten zelfs als ik actief ben op het forum.","other_settings":"Overige","new_topic_duration":{"label":"Beschouw topics als nieuw wanneer","not_viewed":"ik ze nog heb niet bekeken","last_here":"ze geplaatst waren nadat ik hier voor het laatst was","after_n_days":{"one":"ze in de afgelopen dag geplaatst zijn","other":"ze de afgelopen {{count}} dagen geplaatst zijn"},"after_n_weeks":{"one":"ze in de afgelopen week geplaatst zijn","other":"ze in de afgelopen {{count}} weken geplaatst zijn"}},"auto_track_topics":"Houd automatisch topics bij die ik bezoek","auto_track_options":{"never":"nooit","always":"altijd","after_n_seconds":{"one":"na één seconde","other":"na {{count}} seconden"},"after_n_minutes":{"one":"na één minuut","other":"na {{count}} minuten"}},"invited":{"title":"Uitnodigingen","user":"Uitgenodigd lid","none":"{{username}} heeft nog geen mensen uitgenodigd voor deze site.","redeemed":"Verzilverde uitnodigingen","redeemed_at":"Verzilverd op","pending":"Uitstaande uitnodigingen","topics_entered":"Topics bezocht","posts_read_count":"Berichten gelezen","rescind":"Verwijder uitnodiging","rescinded":"Uitnodiging verwijderd","time_read":"Tijd gelezen","days_visited":"Dagen bezocht","account_age_days":"leeftijd van account in dagen"},"password":{"title":"Wachtwoord","too_short":"Je wachtwoord is te kort.","ok":"Je wachtwoord ziet er goed uit."},"ip_address":{"title":"Laatste IP-adres"},"avatar":{"title":"Profielfoto"},"title":{"title":"Titel"},"filters":{"all":"Alle"},"stream":{"posted_by":"Geplaatst door","sent_by":"Verzonden door","private_message":"privé-bericht","the_topic":"de topic"}},"loading":"Laden...","close":"Sluit","learn_more":"leer meer...","year":"jaar","year_desc":"topics die in de afgelopen 365 dagen gepost zijn","month":"maand","month_desc":"topics die in de afgelopen 30 dagen gepost zijn","week":"week","week_desc":"topics die in de afgelopen 7 dagen gepost zijn","first_post":"Eerste bericht","mute":"Negeer","unmute":"Tonen","best_of":{"title":"Best of","enabled_description":"Je kijkt nu naar de beste berichten van deze topic. Klik hieronder om alle berichten te zien.","description":"Er zijn \u003Cb\u003E{{count}}\u003C/b\u003E berichten in deze topic. Dat zijn een hoop! Zou je tijd willen besparen door alleen de berichten te zien met de meeste interactie en reacties?","enable":"Schakel naar 'Best of'-weergave","disable":"Schakel naar normale weergave"},"private_message_info":{"title":"Privé-bericht","invite":"Nodig anderen uit...","remove_allowed_user":"Weet je zeker dat je {{name}} wil verwijderen uit deze priveconversatie?"},"email":"E-mail","username":"Gebruikersnaam","last_seen":"Laatst gezien","created":"Gemaakt op","trust_level":"Trustlevel","create_account":{"title":"Maak een account","action":"Maak er direct een!","invite":"Heb je nog geen account?","failed":"Er ging iets mis, wellicht is het e-mailadres al geregistreerd. Probeer de 'Wachtwoord vergeten'-link."},"forgot_password":{"title":"Wachtwoord vergeten","action":"Ik ben mijn wachtwoord vergeten","invite":"Vul je gebruikersnaam of e-mailadres in en we sturen je een wachtwoord-herstel-mail.","reset":"Herstel wachtwoord","complete":"Als er een account is met die naam of dat e-mailadres, zou je binnenkort een mail moeten ontvangen met instructies hoe je je wachtwoord kan herstellen."},"login":{"title":"Log in","username":"Gebruikersnaam","password":"Wachtwoord","email_placeholder":"e-mailadres of gebruikersnaam","error":"Er is een onbekende fout opgetreden","reset_password":"Herstel wachtwoord","logging_in":"Inloggen...","or":"Of","authenticating":"Authenticatie...","awaiting_confirmation":"Je account is nog niet geactiveerd. Gebruik de 'Wachtwoord vergeten'-link om een nieuwe activatie-mail te ontvangen.","awaiting_approval":"Je account is nog niet goedgekeurd door iemand van de staf. Je krijgt van ons een mail wanneer dat gebeurd is.","requires_invite":"Toegang tot dit forum is alleen op uitnodiging.","not_activated":"Je kan nog niet inloggen. We hebben je een activatie-mail gestuurd (naar \u003Cb\u003E{{currentEmail}}\u003C/b\u003E). Het kan een aantal minuten duren voor deze aan komt. Check ook je spamfolder.","resend_activation_email":"Klik hier om de activatiemail opnieuw te ontvangen.","sent_activation_email_again":"We hebben een nieuwe activatiemail gestuurd naar \u003Cb\u003E{{currentEmail}}\u003C/b\u003E. Het kan een aantal minuten duren voor deze aan komt. Check ook je spamfolder.","google":{"title":"met Google","message":"Authenticatie met Google (zorg ervoor dat je popup blocker uit staat)"},"twitter":{"title":"met Twitter","message":"Authenticatie met Twitter (zorg ervoor dat je popup blocker uit staat)"},"facebook":{"title":"met Facebook","message":"Authenticatie met Facebook (zorg ervoor dat je popup blocker uit staat)"},"cas":{"title":"met CAS","message":"Authenticatie met CAS (zorg ervoor dat je popup blocker uit staat)"},"yahoo":{"title":"met Yahoo","message":"Authenticatie met Yahoo (zorg ervoor dat je popup blocker uit staat)"},"github":{"title":"met Github","message":"Authenticatie met Github (zorg ervoor dat je popup blocker uit staat)"},"persona":{"title":"met Persona","message":"Authenticatie met Mozilla Persona (zorg ervoor dat je popup blocker uit staat)"}},"composer":{"posting_not_on_topic":"In welke topic wil je je antwoord plaatsen?","saving_draft_tip":"wordt opgeslagen","saved_draft_tip":"opgeslagen","saved_local_draft_tip":"lokaal opgeslagen","similar_topics":"Jouw topic heeft overeenkomsten met...","drafts_offline":"concepten offline","min_length":{"need_more_for_title":"Nog {{n}} tekens nodig voor de titel","need_more_for_reply":"Nog {{n}} tekens nodig voor het bericht"},"error":{"title_missing":"Je bent de titel vergeten.","title_too_short":"De titel moet tenminste {{min}} tekens bevatten.","title_too_long":"De titel mag maximaal {{max}} tekens bevatten.","post_missing":"Berichten kunnen niet leeg zijn.","post_length":"Berichten moeten tenminste {{min}} tekens bevatten.","category_missing":"Je hebt nog geen categorie gekozen."},"save_edit":"Bewaar wijzigingen","reply_original":"Reageer op oorspronkelijke topic","reply_here":"Reageer hier","reply":"Reageer","cancel":"Annuleer","create_topic":"Maak topic","create_pm":"Maak privé-bericht","users_placeholder":"Voeg een lid toe","title_placeholder":"Typ hier je title. Beschrijf in één korte zin waar deze discussie over gaat.","reply_placeholder":"Typ hier. Gebruik Markdown of BBCode voor de tekstopmaak. Sleep of plak een afbeelding hierin om deze te uploaden.\"","view_new_post":"Bekijk je nieuwe bericht.","saving":"Opslaan...","saved":"Opgeslagen!","saved_draft":"Je hebt nog een conceptbericht open staan. Klik in dit veld om verder te gaan met bewerken.","uploading":"Uploaden...","show_preview":"laat voorbeeld zien \u0026raquo;","hide_preview":"\u0026laquo; verberg voorbeeld","quote_post_title":"Citeer hele bericht","bold_title":"Vet","bold_text":"Vetgedrukte tekst","italic_title":"Cursief","italic_text":"Cursieve tekst","link_title":"Hyperlink","link_description":"geef hier een omschrijving","link_dialog_title":"Voeg hyperlink toe","link_optional_text":"optionele titel","quote_title":"Citaat","quote_text":"Citaat","code_title":"Opgemaakte tekst","code_text":"geef hier de opgemaakte tekst","upload_title":"Afbeelding","upload_description":"geef een omschrijving voor de afbeelding op","olist_title":"Genummerde lijst","ulist_title":"Lijst met bullets","list_item":"Lijstonderdeel","heading_title":"Kop","heading_text":"Kop","hr_title":"Horizontale lijn","undo_title":"Herstel","redo_title":"Opnieuw","help":"Hulp over Markdown","toggler":"verberg of toon de editor","admin_options_title":"Optionele stafinstellingen voor deze topic","auto_close_label":"Sluit topic automatisch na:","auto_close_units":"dagen"},"notifications":{"title":"notificaties van @naam vermeldingen, reacties op je berichten en topics, privé-berichten, etc.","none":"Er zijn nu geen notificaties.","more":"bekijk oudere notificaties","mentioned":"\u003Cspan title='genoemd' class='icon'\u003E@\u003C/span\u003E {{username}} {{link}}","quoted":"\u003Ci title='geciteerd' class='icon icon-quote-right'\u003E\u003C/i\u003E {{username}} {{link}}","replied":"\u003Ci title='beantwoord' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","posted":"\u003Ci title='beantwoord' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","edited":"\u003Ci title='gewijzigd' class='icon icon-pencil'\u003E\u003C/i\u003E {{username}} {{link}}","liked":"\u003Ci title='leuk' class='icon icon-heart'\u003E\u003C/i\u003E {{username}} {{link}}","private_message":"\u003Ci class='icon icon-envelope-alt' title='privé-bericht'\u003E\u003C/i\u003E {{username}} {{link}}","invited_to_private_message":"\u003Ci class='icon icon-envelope-alt' title='privé-bericht'\u003E\u003C/i\u003E {{username}} {{link}}","invitee_accepted":"\u003Ci title='heeft je uitnodiging geaccepteerd' class='icon icon-signin'\u003E\u003C/i\u003E {{username}} heeft je uitnodiging geaccepteerd en heeft zich ingeschreven om deel te nemen.","moved_post":"\u003Ci title='bericht verplaatst' class='icon icon-arrow-right'\u003E\u003C/i\u003E {{username}} verplaatst {{link}}","total_flagged":"aantal gemarkeerde berichten"},"upload_selector":{"title":"Voeg een afbeelding toe","title_with_attachments":"Voeg een afbeelding of bestand toe","from_my_computer":"Vanaf mijn apparaat","from_the_web":"Vanaf het web","remote_tip":"vul een internetadres in van een afbeelding in deze vorm: http://example.com/image.jpg","remote_tip_with_attachments":"vul een internetadres in van een afbeelding of bestand in deze vorm: http://example.com/bestand.ext (toegestane extensies: {{authorized_extensions}}).","local_tip":"klik om een afbeelding vanaf je apparaat te selecteren.","local_tip_with_attachments":"klik om een afbeelding of bestand vanaf je apparaat te selecteren (toegestane extensies: {{authorized_extensions}}).","hint":"(je kan afbeeldingen ook slepen in de editor om deze te uploaden)","hint_for_chrome":"(je kan afbeeldingen ook slepen of plakken in de editor om deze te uploaden)","uploading":"Afbeelding uploaden"},"search":{"title":"zoek naar topics, posts, leden of categoriëen","placeholder":"typ je zoekterm hier","no_results":"Geen resultaten gevonden.","searching":"Zoeken...","prefer":{"user":"er wordt voornamelijk gezocht naar berichten van @{{username}}","category":"er wordt voornamelijk gezocht naar berichten in categorie {{category}}"}},"site_map":"ga naar een andere topic-lijst of categorie","go_back":"ga terug","current_user":"ga naar je gebruikerspagina","favorite":{"title":"Favoriet","help":{"star":"Voeg deze topic toe aan je favorietenlijst","unstar":"Verwijder deze topic uit je favorietenlijst"}},"topics":{"none":{"favorited":"Je hebt nog geen topics tussen je favorieten staan. Om een topic toe te voegen, klik of druk op de ster naast de topictitel.","unread":"Je hebt geen ongelezen topics.","new":"Je hebt geen nieuwe topics.","read":"Je hebt nog geen topics gelezen.","posted":"Je hebt nog niet in een topic gereageerd.","latest":"Er zijn geen populaire topics. Dat is jammer.","hot":"Er zijn geen polulaire topics.","category":"Er zijn geen topics in {{category}}"},"bottom":{"latest":"Er zijn geen recente topics.","hot":"Er zijn geen polulaire topics meer.","posted":"Er zijn geen geplaatste topics meer.","read":"Er zijn geen gelezen topics meer.","new":"Er zijn geen nieuwe topics meer.","unread":"Er zijn geen ongelezen topics meer.","favorited":"Er zijn geen favoriete topics meer.","category":"Er zijn geen topics meer in {{category}}."}},"rank_details":{"toggle":"schakel details topic rangorde aan/uit","show":"bekijk details topic rangorde","title":"Details topic rangorde"},"topic":{"filter_to":"Laat alleen de {{post_count}} berichten van {{username}} in deze topic zien","create":"Maak topic","create_long":"Maak een nieuw topic","private_message":"Stuur een privé-bericht","list":"Topics","new":"nieuw topic","new_topics":{"one":"1 nieuwe topic","other":"{{count}} nieuwe topics"},"unread_topics":{"one":"1 ongelezen topic","other":"{{count}} ongelezen topics"},"title":"Topic","loading_more":"Er worden meer topics geladen...","loading":"Bezig met laden van topic...","invalid_access":{"title":"Topic is privé","description":"Sorry, je hebt geen toegang tot deze topic."},"server_error":{"title":"Topic laden mislukt","description":"Sorry, we konden deze topic niet laden, waarschijnlijk door een verbindingsprobleem. Probeer het later opnieuw. Als het probleem blijft, laat het ons dan weten."},"not_found":{"title":"Topic niet gevonden","description":"Sorry, we konden de opgevraagde topic niet vinden. Wellicht is het verwijderd door een moderator?"},"unread_posts":{"one":"je hebt 1 ongelezen bericht in deze topic","other":"je hebt {{count}} ongelezen berichten in deze topic"},"new_posts":{"one":"er is 1 nieuw bericht in deze topic sinds je dit voor het laatst gelezen hebt","other":"er zijn {{count}} nieuwe berichten in deze topic sinds je dit voor het laatst gelezen hebt"},"likes":{"one":"er is één waardering in deze topic","other":"er zijn {{likes}} waarderingen in deze topic"},"back_to_list":"Terug naar topiclijst","options":"Topic opties","show_links":"laat links binnen deze topic zien","toggle_information":"Zet topic details aan/uit","read_more_in_category":"Wil je meer lezen? Kijk dan voor andere topics in {{catLink}} of {{latestLink}}.","read_more":"Wil je meer lezen? {{catLink}} of {{latestLink}}.","browse_all_categories":"Bekijk alle categorieën","view_latest_topics":"bekijk populaire topics","suggest_create_topic":"Wil je een nieuwe topic schrijven?","read_position_reset":"Je leespositie is gereset.","jump_reply_up":"spring naar een eerdere reactie","jump_reply_down":"spring naar een latere reactie","deleted":"Deze topic is verwijderd","auto_close_notice":"Deze topic wordt automatisch over %{timeLeft} gesloten.","auto_close_title":"Instellingen voor automatisch sluiten","auto_close_save":"Opslaan","auto_close_remove":"Sluit deze topic niet automatisch","progress":{"title":"topic voortgang","jump_top":"spring naar eerste bericht","jump_bottom":"spring naar laatste bericht","total":"totaal aantal berichten","current":"huidige bericht"},"notifications":{"title":"","reasons":{"3_2":"Je ontvangt notificaties omdat je deze topic in de gaten houdt.","3_1":"Je ontvangt notificaties omdat jij deze topic gemaakt hebt.","3":"Je ontvangt notificaties omdat je deze topic in de gaten houdt.","2_4":"Je ontvangt notificaties omdat je een reactie aan deze topic hebt geplaatst.","2_2":"Je ontvangt notificaties omdat je deze topic volgt.","2":"Je ontvangt notificaties omdat je \u003Ca href=\"/users/{{username}}/preferences\"\u003Edeze topic hebt gelezen\u003C/a\u003E.","1":"Je krijgt alleen een notificatie als iemand je @naam noemt of reageert op je bericht.","1_2":"Je krijgt alleen een notificatie als iemand je @naam noemt of reageert op je bericht.","0":"Je negeert alle notificaties in deze topic.","0_2":"Je negeert alle notificaties in deze topic."},"watching":{"title":"In de gaten houden","description":"zelfde als 'volgen', plus dat je ook een notificatie krijgt van alle nieuwe berichten."},"tracking":{"title":"Volgen","description":"je krijgt een notificatie als je @naam genoemd wordt en wanneer er gereageerd wordt op je berichten. Daarnaast zie je een teller met ongelezen en nieuwe berichten."},"regular":{"title":"Normaal","description":"Je zal alleen een notificatie krijgen als iemand je @naam vermeldt of een reactie geeft op je berichten."},"muted":{"title":"Negeren","description":"je zal geen notificaties krijgen voor deze topic en het zal ook niet verschijnen in je 'ongelezen'-tab."}},"actions":{"recover":"Herstel topic","delete":"Verwijder topic","open":"Open topic","close":"Sluit topic","auto_close":"Automatisch sluiten","unpin":"Ontpin topic","pin":"Pin topic","unarchive":"De-archiveer topic","archive":"Archiveer topic","invisible":"Maak onzichtbaar","visible":"Maak zichtbaar","reset_read":"Reset leesdata","multi_select":"Selecteer berichten voor samenvoegen/splitsen","convert_to_topic":"Zet om naar normale topic"},"reply":{"title":"Reageer","help":"Schrijf een reactie op deze topic"},"clear_pin":{"title":"Verwijder pin","help":"Annuleer de gepinde status van deze topic, zodat het niet langer bovenaan je topiclijst verschijnt."},"share":{"title":"Deel","help":"Deel een link naar deze topic"},"inviting":"Uitnodigen...","invite_private":{"title":"Stuur een privé-bericht","email_or_username":"E-mail of gebruikersnaam van genodigde","email_or_username_placeholder":"e-mailadres of gebruikersnaam","action":"Uitnodigen","success":"Bedankt! We hebben deze persoon dit privé-bericht gestuurd.","error":"Sorry, er is iets misgegaan bij het uitnodigen van deze persoon"},"invite_reply":{"title":"Nodig vrienden uit om te reageren","action":"Mail uitnodiging","help":"verstuur uitnodigingen naar vrienden zodat zij met één klik kunnen reageren op deze topic","email":"We zullen je vrienden een korte e-mail sturen waardoor zij op deze topic kunnen reageren door op een link te klikken.","email_placeholder":"e-mailadres","success":"Bedankt! We hebben een uitnodiging verstuurd naar \u003Cb\u003E{{email}}\u003C/b\u003E. We laten je direct weten wanneer ze je uitnodiging hebben geaccepteerd. Check de \"Uitnodigingen\"-tab op je gebruikerspagina om bij te houden wie je hebt uitgenodigd.","error":"Sorry, we kunnen deze persoon niet uitnodigen. Wellicht is deze al een lid op onze site?"},"login_reply":"Log in om te reageren","filters":{"user":"Je ziet momenteel alleen {{n_posts}} {{by_n_users}}.","n_posts":{"one":"één bericht","other":"{{count}} berichten"},"by_n_users":{"one":"van één specifiek lid","other":"van {{count}} specifieke leden"},"best_of":"Je ziet momenteel alleen {{n_best_posts}} {{of_n_posts}}","n_best_posts":{"one":"het enige 'Best of' bericht.","other":"de {{count}} 'Best of' berichten"},"of_n_posts":{"one":"","other":"van {{count}} in deze topic."},"cancel":"Laat alle posts in deze topic zien."},"split_topic":{"title":"Splits topic","action":"splits topic","topic_name":"Naam nieuwe topic","error":"Er ging iets mis bij het splitsen van die topic.","instructions":{"one":"Je staat op het punt een nieuwe topic aan te maken en het te vullen met het bericht dat je geselecteerd hebt.","other":"Je staat op het punt een nieuwe topic aan te maken en het te vullen met de \u003Cb\u003E{{count}}\u003C/b\u003E berichten die je geselecteerd hebt."}},"merge_topic":{"title":"Voeg topic samen","action":"voeg topic samen","error":"There was an error merging that topic.","instructions":{"one":"Selecteer de topic waarnaar je het bericht wil verplaatsen.","other":"Selecteer de topic waarnaar je de \u003Cb\u003E{{count}}\u003C/b\u003E berichten wil verplaatsen."}},"multi_select":{"select":"selecteer","selected":"geselecteerd ({{count}})","select_replies":"selecteer +antwoorden","delete":"verwijder geselecteerde","cancel":"annuleer selectie","description":{"one":"Je hebt \u003Cb\u003Eéén\u003C/b\u003E bericht geselecteerd.","other":"Je hebt \u003Cb\u003E{{count}}\u003C/b\u003E berichten geselecteerd."}}},"post":{"reply":"Reageren op {{link}} door {{replyAvatar}} {{username}}","reply_topic":"Reageer op {{link}}","quote_reply":"citeer","edit":"Bewerken van {{link}} door {{replyAvatar}} {{username}}","post_number":"bericht {{number}}","in_reply_to":"in reactie op","last_edited_on":"bericht gewijzig op","reply_as_new_topic":"Reageer in een nieuwe topic","continue_discussion":"Voortzetting van de discussie {{postLink}}:","follow_quote":"ga naar het geciteerde bericht","deleted_by_author":{"one":"(bericht ingetrokken door de schrijver), wordt automatisch verwijderd over %{count} uur, tenzij gemarkeerd.","other":"(berichten ingetrokken door de schrijver), worden automatisch verwijderd over %{count} uur, tenzij gemarkeerd."},"deleted_by":"verwijderd door","expand_collapse":"uit-/invouwen","has_replies":{"one":"Reactie","other":"Reacties"},"errors":{"create":"Sorry, er is iets misgegaan bij het plaatsen van je bericht. Probeer het nog eens.","edit":"Sorry, er is iets misgegaan bij het bewerken van je bericht. Probeer het nog eens.","upload":"Sorry, er is iets misgegaan bij het uploaden van je bestand. Probeer het nog eens.","attachment_too_large":"Sorry, het bestand dat je wil uploaden is te groot (maximum grootte is {{max_size_kb}}kb).","image_too_large":"Sorry, de afbeelding je wil uploaden is te groot (maximum grootte is {{max_size_kb}}kb), verklein de afbeelding en probeer het opnieuw.","too_many_uploads":"Sorry, je kan maar één afbeelding tegelijk uploaden.","upload_not_authorized":"Sorry, je mag dat type bestand niet uploaden (toegestane extensies: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Sorry, nieuwe gebruikers mogen nog geen afbeeldingen uploaden.","attachment_upload_not_allowed_for_new_user":"Sorry, nieuwe gebruikers mogen nog geen bestanden uploaden."},"abandon":"Weet je zeker dat je het schrijven van dit bericht wil afbreken?","archetypes":{"save":"Bewaar instellingen"},"controls":{"reply":"reageer op dit bericht","like":"vind dit bericht leuk","edit":"bewerk dit bericht","flag":"meld dit bericht of stuur er een notificatie over","delete":"verwijder dit bericht","undelete":"herstel dit bericht","share":"deel een link naar dit bericht","more":"Meer","delete_replies":{"confirm":{"one":"Wil je ook het directe antwoord op dit bericht verwijderen?","other":"Wil je ook de {{count}} directe antwoorden op dit bericht verwijderen?"},"yes_value":"Ja, verwijder deze antwoorden ook","no_value":"Nee, alleen dit bericht"}},"actions":{"flag":"Markeer","clear_flags":{"one":"Verwijder markering","other":"Verwijder markeringen"},"it_too":{"off_topic":"Markeer het ook","spam":"Markeer het ook","inappropiate":"Markeer het ook","custom_flag":"Markeer het ook","bookmark":"Zet het ook in je favorieten","like":"Vind het ook leuk","vote":"Stem ook"},"undo":{"off_topic":"Verwijder markering","spam":"Verwijder markering","inappropiate":"Verwijder markering","bookmark":"Verwijder uit je favorieten","like":"Vind het niet meer leuk","vote":"Stem niet meer"},"people":{"off_topic":"{{icons}} markeerden dit als off-topic","spam":"{{icons}} markeerden dit als spam","inappropriate":"{{icons}} markeerden dit als ongepast","notify_moderators":"{{icons}} lichtte moderators in","notify_moderators_with_url":"{{icons}} \u003Ca href='{{postUrl}}'\u003Elichtte moderators in\u003C/a\u003E","notify_user":"{{icons}} verstuurde een privé-bericht","notify_user_with_url":"{{icons}} verstuurde een \u003Ca href='{{postUrl}}'\u003Eprivé-bericht\u003C/a\u003E","bookmark":"{{icons}} voegden dit toe aan hun favorieten","like":"{{icons}} vinden dit leuk","vote":"{{icons}} hebben hier op gestemd"},"by_you":{"off_topic":"Jij markeerde dit als off-topic","spam":"Jij markeerde dit als spam","inappropriate":"Jij markeerde dit als ongepast","notify_moderators":"Jij markeerde dit voor moderatie","notify_user":"Jij stuurde een privé-bericht naar deze persoon","bookmark":"Jij voegde dit bericht toe aan je favorieten","like":"Jij vindt dit leuk","vote":"Jij hebt op dit bericht gestemd"},"by_you_and_others":{"off_topic":{"one":"Jij en iemand anders markeerden dit als off-topic","other":"Jij en {{count}} anderen markeerden dit als off-topic"},"spam":{"one":"Jij en iemand anders markeerden dit als spam","other":"Jij en {{count}} anderen markeerden dit als spam"},"inappropriate":{"one":"Jij en iemand anders markeerde dit als ongepast","other":"Jij en {{count}} anderen markeerden dit als ongepast"},"notify_moderators":{"one":"Jij en iemand anders markeerden dit voor moderatie","other":"Jij en {{count}} anderen markeerden dit voor moderatie"},"notify_user":{"one":"Jij en iemand anders stuurden een privé-bericht naar deze persoon","other":"Jij en {{count}} anderen stuurden een privé-bericht naar deze persoon"},"bookmark":{"one":"Jij en iemand anders voegden dit bericht toe aan de favorieten","other":"Jij en {{count}} anderen voegden dit bericht toe aan de favorieten"},"like":{"one":"Jij en iemand anders vinden dit leuk","other":"Jij en {{count}} anderen vinden dit leuk"},"vote":{"one":"Jij en iemand anders hebben op dit bericht gestemd","other":"Jij en {{count}} anderen hebben op dit bericht gestemd"}},"by_others":{"off_topic":{"one":"Iemand heeft dit bericht gemarkeerd als off-topic","other":"{{count}} Mensen hebben dit bericht gemarkeerd als off-topic"},"spam":{"one":"Iemand heeft dit bericht gemarkeerd als spam","other":"{{count}} Mensen hebben dit bericht gemarkeerd als spam"},"inappropriate":{"one":"Iemand heeft dit bericht gemarkeerd als ongepast ","other":"{{count}} Mensen hebben dit bericht gemarkeerd als ongepast"},"notify_moderators":{"one":"Iemand heeft dit bericht gemarkeerd voor moderatie","other":"{{count}} Mensen hebben dit bericht gemarkeerd voor moderatie"},"notify_user":{"one":"Iemand stuurde een privé-bericht naar deze persoon","other":"{{count}} Mensen stuurden een privé-bericht naar deze persoon"},"bookmark":{"one":"Iemand heeft dit bericht toegevoegd aan zijn favorieten","other":"{{count}} Mensen hebben dit bericht toegevoegd aan hun favorieten"},"like":{"one":"Iemand vindt dit leuk","other":"{{count}} Mensen vinden dit leuk"},"vote":{"one":"Iemand heeft op dit bericht gestemd","other":"{{count}} Mensen hebben op dit bericht gestemd"}}},"edits":{"one":"één bewerking","other":"{{count}} bewerkingen","zero":"geen bewerkingen"},"delete":{"confirm":{"one":"Weet je zeker dat je dit bericht wil verwijderen?","other":"Weet je zeker dat je al deze berichten wil verwijderen?"}}},"category":{"can":"can\u0026hellip; ","none":"(geen categorie)","choose":"Selecteer een categorie\u0026hellip;","edit":"bewerk","edit_long":"Bewerk categorie","view":"Bekijk topics in categorie","general":"Algemeen","settings":"Instellingen","delete":"Verwijder categorie","create":"Maak categorie","save":"Bewaar categorie","creation_error":"Er ging bij het maken van de categorie iets mis.","save_error":"Er ging iets mis bij het opslaan van de categorie.","more_posts":"bekijk alle {{posts}}...","name":"Naam categorie","description":"Omschrijving","topic":"Onderwerp van de categorie","badge_colors":"badgekleuren","background_color":"achtergrondkleur","foreground_color":"voorgrondkleur","name_placeholder":"Moet kort en duidelijk zijn.","color_placeholder":"Kan elke web-kleur zijn","delete_confirm":"Weet je zeker dat je deze categorie wil verwijderen?","delete_error":"Er ging iets mis bij het verwijderen van deze categorie","list":"Lijst van categorieën","no_description":"Er is geen omschrijving voor deze categorie","change_in_category_topic":"Wijzig omschrijving","hotness":"Populariteit","already_used":"Deze kleur is al in gebruik door een andere categorie","security":"Beveiliging","auto_close_label":"Sluit topics automatisch na:","edit_permissions":"Wijzig permissies","add_permission":"Nieuwe permissie","this_year":"dit jaar","position":"positie","parent":"Bovenliggende categorie"},"flagging":{"title":"Waarom meld je dit bericht?","action":"Meld bericht","take_action":"Onderneem actie","notify_action":"Meld","delete_spammer":"Verwijder spammer","delete_confirm":"Je gaat nu \u003Cb\u003E%{posts}\u003C/b\u003E berichten en \u003Cb\u003E%{topics}\u003C/b\u003E van deze gebruiker verwijderen, hun account verwijderen, nieuwe aanmeldingen vanaf hun IP-adres \u003Cb\u003E%{ip_address}\u003C/b\u003E blokkeren en hun e-mailadres \u003Cb\u003E%{email}\u003C/b\u003E op een permanente blokkeerlijst zetten. Weet je zeker dat dit een spammer is?","yes_delete_spammer":"Ja, verwijder spammer","cant":"Sorry, je kan dit bericht momenteel niet melden.","custom_placeholder_notify_user":"Wat maakt dat je de schrijver persoonlijk iets wil melden? Wees specifiek, constructief en altijd aardig.","custom_placeholder_notify_moderators":"Waarom heeft dit bericht aandacht van een moderator nodig? Laat ons specifiek weten waar je je zorgen om maakt en stuur relevante links mee waar mogelijk.","custom_message":{"at_least":"Gebruik ten minste {{n}} tekens","more":"Nog {{n}} te gaan...","left":"Nog {{n}} resterend"}},"topic_summary":{"title":"Topic samenvatting","links_shown":"laat alle {{totalLinks}} links zien...","clicks":"clicks","topic_link":"link naar topic"},"topic_statuses":{"locked":{"help":"deze topic is gesloten; nieuwe reacties worden niet langer geaccepteerd"},"pinned":{"help":"deze topic is gepind; het zal bovenaan de lijst van topics in zijn categorie staan."},"archived":{"help":"deze topic is gearchiveerd; het is bevroren en kan niet meer veranderd worden"},"invisible":{"help":"deze topic is onzichtbaar; het zal niet worden weergegeven in topiclijsten en kan alleen via een directe link bezocht worden"}},"posts":"Berichten","posts_long":"er zijn {{number}} berichten in deze topic","original_post":"Originele bericht","views":"Bekeken","replies":"Reacties","views_long":"deze topic is {{number}} keer bekeken","activity":"Activiteit","likes":"Leuk","likes_long":"er zijn {{count}} likes in deze topic","top_contributors":"Deelnemers","category_title":"Categorie","history":"Geschiedenis","changed_by":"door {{author}}","categories_list":"Categorielijst","filters":{"latest":{"title":"Recent","help":"de meest recente topics"},"hot":{"title":"Populair","help":"een selectie van de meest populaire topics"},"favorited":{"title":"Favorieten","help":"topics die je als favoriet hebt ingesteld"},"read":{"title":"Gelezen","help":"topics die je hebt gelezen, in de volgorde wanneer je ze voor het laatst gelezen hebt"},"categories":{"title":"Categorieën","title_in":"Categorie - {{categoryName}}","help":"alle topics gesorteerd op categorie"},"unread":{"title":{"zero":"Ongelezen","one":"Ongelezen (1)","other":"Ongelezen ({{count}})"},"help":"gevolgde topics met ongelezen berichten"},"new":{"title":{"zero":"Nieuw","one":"Nieuw (1)","other":"Nieuw ({{count}})"},"help":"nieuwe topics sinds je laatse bezoek"},"posted":{"title":"Mijn berichten","help":"topics waarin je een bericht hebt geplaatst"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"recente topics in de categorie {{categoryName}}"}},"browser_update":"Helaas \u003Ca href=\"http://www.discourse.org/faq/#browser\"\u003Eis je browser te oud om te kunnen werken met dit forum\u003C/a\u003E. \u003Ca href=\"http://browsehappy.com\"\u003EUpgrade je browser\u003C/a\u003E.","permission_types":{"full":"Maak topic / Reageer / Bekijk","create_post":"Reageer / Bekijk","readonly":"Bekijk"},"type_to_filter":"typ om te filteren...","admin":{"title":"Discourse Beheer","moderator":"Moderator","dashboard":{"title":"Dashboard","last_updated":"Dashboard laatst bijgewerkt:","version":"versie","up_to_date":"Je bent up to date!","critical_available":"Er is een belangrijke update beschikbaar","updates_available":"Er zijn updates beschikbaar","please_upgrade":"Werk de software bij alsjeblieft","no_check_performed":"Er is nog niet op updates gecontroleerd. Zorgen dat sidekiq loopt.\"","stale_data":"Er is al een tijdje niet op updates gecontroleerd. Zorgen dat sidekiq loopt.\"","installed_version":"Geïnstalleerd","latest_version":"Recent","problems_found":"Er zijn een aantal problemen gevonden met je Discourse installatie:","last_checked":"Laatste check","refresh_problems":"Laad opnieuw","no_problems":"Er zijn geen problemen gevonden","moderators":"Moderators:","admins":"Admins:","blocked":"Geblokkeerd:","suspended":"Geband:","private_messages_short":"PBs","private_messages_title":"Privé-berichten","reports":{"today":"Vandaag","yesterday":"Gisteren","last_7_days":"Afgelopen 7 dagen","last_30_days":"Afgelopen 30 dagen","all_time":"Sinds het begin","7_days_ago":"7 Dagen geleden","30_days_ago":"30 Dagen geleden","all":"Alle","view_table":"Bekijk als tabel","view_chart":"Bekijk als staafdiagram"}},"commits":{"latest_changes":"Laatste wijzigingen: update regelmatig!","by":"door"},"flags":{"title":"Meldingen","old":"Oud","active":"Actief","agree_hide":"Mee eens (verberg bericht + stuur PM)","agree_hide_title":"Verberg dit bericht en stuur de gebruiker automatisch een privé-bericht met het dringende verzoek het bericht aan te passen","defer":"Stel uit","defer_title":"Er hoeft nu niets gedaan te worden, stel acties op deze markering uit voor de toekomst. Of nooit.","delete_post":"Verwijder bericht","delete_post_title":"Verwijder bericht; de hele topic als dit het eerste bericht is","disagree_unhide":"Niet mee eens (toon bericht)","disagree_unhide_title":"Verwijder elke markering van dit bericht en maak het weer zichtbaar","disagree":"Niet mee eens","disagree_title":"Niet eens met de markering, verwijder elke markering van dit bericht","delete_spammer_title":"Verwijder de gebruiker en al hun berichten en topics.","flagged_by":"Gemarkeerd door","error":"Er ging iets mis","view_message":"Reageer","no_results":"Er zijn geen markeringen","summary":{"action_type_3":{"one":"off-topic","other":"off-topic x{{count}}"},"action_type_4":{"one":"ongepast","other":"ongepast x{{count}}"},"action_type_6":{"one":"custom","other":"custom x{{count}}"},"action_type_7":{"one":"custom","other":"custom x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"title":"Groepen","edit":"Wijzig groepen","selector_placeholder":"voeg leden toe","name_placeholder":"Groepsnaam, geen spaties, zelfde regels als bij een gebruikersnaam","about":"Wijzig hier je deelname aan groepen en je namen","can_not_edit_automatic":"Automatisch lidmaatschap van groepen wordt automatisch bepaald. Beheer rollen en trust levels van gebruikers","delete":"Verwijder","delete_confirm":"Verwijder deze groepen?","delete_failed":"Unable to delete group. If this is an automatic group, it cannot be destroyed."},"api":{"generate_master":"Genereer Master API Key","none":"Er zijn geen actieve API keys","user":"Gebruiker","title":"API","key":"API Key","generate":"Genereer API Key","regenerate":"Genereer API Key opnieuw","revoke":"Intrekken","confirm_regen":"Weet je zeker dat je die API Key wil vervangen door een nieuwe?","confirm_revoke":"Weet je zeker dat je die API Key wil intrekken?","info_html":"Met deze API key kun je met behulp van JSON calls topics maken en bewerken.","all_users":"Alle gebruikers","note_html":"Houd deze key \u003Cstrong\u003Egeheim\u003C/strong\u003E, gebruikers die deze key hebben kunnen zich als elke andere gebruiker voordoen op het forum en topics aanmaken."},"customize":{"title":"Aanpassingen","long_title":"Aanpassingen aan de site","header":"Header","css":"Stylesheet","mobile_header":"Mobiele header","mobile_css":"Mobiele stylesheet","override_default":"Sluit de standaard stylesheet uit","enabled":"Ingeschakeld?","preview":"voorbeeld","undo_preview":"herstel voorbeeld","save":"Opslaan","new":"Nieuw","new_style":"Nieuwe stijl","delete":"Verwijder","delete_confirm":"Verwijder deze aanpassing?","about":"Met aanpassingen aan de site kun je stylesheets en headers wijzigen. Kies of voeg een toe om te beginnen."},"email":{"title":"E-mail","settings":"Instellingen","logs":"Log","sent_at":"Verzonden op","user":"Gebruiker","email_type":"E-mailtype","to_address":"Ontvangeradres","test_email_address":"e-mailadres om te testen","send_test":"verstuur test e-mail","sent_test":"Verzonden!","delivery_method":"Verzendmethode","preview_digest":"Preview Digest","preview_digest_desc":"Hiermee kun je een voorbeeld van de digest email zien die vanaf het forum wordt verstuurd.","refresh":"Refresh","format":"Formaat","html":"html","text":"text","last_seen_user":"Laatste gebruiker:","reply_key":"Reply key"},"logs":{"title":"Logs","action":"Actie","created_at":"Gemaakt","blocked_emails":{"title":"Geblokkeerde e-mails","description":"Als iemand een nieuw account probeert te maken zijn deze mailadressen niet toegestaan. De registratie zal worden tegengehouden.","email":"E-mailadres","last_match_at":"Laatst gematched","match_count":"Matches","actions":{"block":"blokkeeer","do_nothing":"doe niets"}},"staff_actions":{"title":"Stafacties","instructions":"Klik op gebruikersnamen en acties om te filteren. Klik op avatars om naar de gebruikerspagina te gaan.","clear_filters":"Bekijk alles","staff_user":"Staflid","target_user":"Selecteer gebruiker","subject":"Onderwerp","when":"Wanneer","context":"Context","details":"Details","previous_value":"Vorige","new_value":"Nieuw","diff":"Diff","show":"Bekijk","modal_title":"Details","no_previous":"Er is geen vorige waarde","deleted":"Geen nieuwe waarde. De record was verwijderd.","actions":{"delete_user":"verwijder gebruiker","change_trust_level":"verander trust level","change_site_setting":"verander instellingen","change_site_customization":"verander site aanpassingen","delete_site_customization":"verwijder site aanpassingen","ban_user":"ban gebruiker","unban_user":"hef ban op"},"screened_emails":{"title":"Gescreende e-mails","description":"Nieuwe accounts met een van deze mailadressen worden geblokkeerd of een andere actie wordt ondernomen.","email":"E-mailadres"},"screened_urls":{"title":"Gescreende urls","description":"Deze urls zijn gebruikt door gebruikers die als spammer gemarkeerd zijn.","url":"URL"},"screened_ips":{"title":"Gescreende ip-adressen","description":"IP-adressen die in de gaten worden gehouden. Kies 'sta toe' om deze op een witte lijst te zetten.","delete_confirm":"Weet je zeker dat je de regel voor %{ip_address} wil verwijderen?","actions":{"block":"Blokkeer","do_nothing":"Sta toe"},"form":{"label":"Nieuw:","ip_address":"IP-adres","add":"Voeg toe"}}}},"impersonate":{"title":"Log in als gebruiker","username_or_email":"Gebruikersnaam of e-mailadres van gebruiker","help":"Gebruik dit hulpmiddel om in te loggen als een gebruiker voor debug-doeleinden.","not_found":"Die gebruiker kan niet gevonden worden.","invalid":"Sorry, maar als deze gebruiker mag je niet inloggen."},"users":{"title":"Leden","create":"Voeg beheerder toe","last_emailed":"Laatste mail verstuurd","not_found":"Sorry, deze gebruikersnaam bestaat niet in ons systeem.","active":"Actief","nav":{"new":"Nieuw","active":"Actief","pending":"Te beoordelen","admins":"Admins","moderators":"Moderatoren","suspended":"Verbannen","blocked":"Geblokt"},"approved":"Goedgekeurd?","approved_selected":{"one":"accepteer lid","other":"accepteer {{count}} leden"},"reject_selected":{"one":"weiger lid","other":"weiger {{count}} leden"},"titles":{"active":"Actieve leden","new":"Nieuwe leden","pending":"Nog niet geaccepteerde leden","newuser":"Leden met Trust Level 0 (Nieuw lid)","basic":"Leden met Trust Level 1 (Lid)","regular":"Leden met Trust Level 2 (Regulier lid)","leader":"Leden met Trust Level 3 (Leider)","elder":"Leden met Trust Level 4 (Stamoudste)","admins":"Administrators","moderators":"Moderators","blocked":"Geblokkeerde leden","suspended":"Verbannen leden"},"reject_successful":{"one":"1 Gebruiker met succes geweigerd","other":"%{count} Gebruikers met succes geweigerd"},"reject_failures":{"one":"Weigering van 1 gebruiker is niet gelukt","other":"Weigering van %{count} gebruikers is niet gelukt"}},"user":{"suspend_failed":"Er ging iets fout met het blokkeren van deze gebruiker: {{error}}","unsuspend_failed":"Er ging iets fout bij het deblokkeren van deze gebruiker: {{error}}","suspend_duration":"Hoe lang wil je deze gebruiker blokkeren?","ban_duretion_units":"(dagen)","ban_reason_label":"Waarom ban je? Als de gebruiker in probeert te loggen, zullen ze deze tekst zien. Hou het kort.","ban_reason":"Reden voor ban","banned_by":"Verbannen door","delete_all_posts":"Verwijder alle berichten","delete_all_posts_confirm":"Je gaat %{posts} en %{topics} verwijderen. Zeker weten?","suspend":"Blokkeer","unsuspend":"Deblokkeer","suspended":"Geblokkeerd?","moderator":"Moderator?","admin":"Beheerder?","blocked":"Geblokkeerd?","show_admin_profile":"Beheerder","edit_title":"Wijzig titel","save_titel":"Bewaar titel","refresh_browsers":"Forceer browser refresh","show_public_profile":"Bekijk openbaar profiel","impersonate":"Log in als gebruiker","revoke_admin":"Ontneem beheerdersrechten","grant_admin":"Geef Beheerdersrechten","revoke_moderation":"Ontneem modereerrechten","grant_moderation":"Geef modereerrechten","unblock":"Deblokkeer","block":"Blokkeer","reputation":"Reputatie","permissions":"Toestemmingen","activity":"Activiteit","like_count":"Ontvangen 'Vind ik leuk'","private_topics_count":"Privé-topics","posts_read_count":"Berichten gelezen","post_count":"Berichten gemaakt","topics_entered":"Topics binnengegaan","flags_given_count":"Meldingen gedaan","flags_received_count":"Meldigen ontvangen","approve":"Accepteer","approved_by":"Geaccepteerd door","approve_succes":"Gebruiker geaccepteerd en e-mail verzonden met instructies voor activering.","approve_bulk_success":"Alle geselecteerde gebruikers zijn geaccepteerd en een e-mail met instructies voor activering is verstuurd.","time_read":"Tijd gelezen","delete":"Verwijder gebruiker","delete_forbidden":{"one":"Gebruikers kunnen niet worden verwijders als ze zich meer dan %{count} dag geleden registreerden of als ze berichten geplaatst hebben. Verwijder alle berichten voordat je een gebruiker probeert te verwijderen.","other":"Gebruikers kunnen niet worden verwijders als ze zich meer dan %{count} dagen geleden registreerden of als ze berichten geplaatst hebben. Verwijder alle berichten voordat je een gebruiker probeert te verwijderen."},"delete_confirm":"Weet je zeker dat je deze gebruiker definitief wil verwijderen? Deze handeling is permanant!","delete_and_block":"\u003Cb\u003EJa\u003C/b\u003E, en \u003Cb\u003Eblokkeer\u003C/b\u003E registraties met datzelfde e-mail- en IP-adres","delete_dont_block":"\u003Cb\u003EJa\u003C/b\u003E, maar \u003Cb\u003Esta nieuwe registraties toe\u003C/b\u003E met datzelfde e-mail- en IP-adres","deleted":"De gebruiker is verwijderd.","delete_failed":"Er ging iets mis bij het verwijderen van deze gebruiker. Zorg er voor dat alle berichten van deze gebruiker eerst verwijderd zijn.","send_activation_email":"Verstuur activatiemail","activation_email_sent":"Een activatiemail is verstuurd.","send_activation_email_failed":"Er ging iets mis bij het versturen van de activatiemail.","activate":"Activeer account","activate_failed":"Er ging iets mis bij het activeren van deze gebruiker.","deactivate_account":"Deactiveer account","deactivate_failed":"Er ging iets mis bij het deactiveren van deze gebruiker.","unblock_failed":"Er ging iets mis bij het deblokkeren van deze gebruiker.","block_failed":"Er ging iets mis bij het blokkeren van deze gebruiker.","deactivation_explanation":"Een gedeactiveerde gebruiker moet zijn e-mailadres opnieuw bevestigen.","banned_explanation":"Een verbannen gebruiker kan niet meer inloggen.","block_explanation":"Een geblokkeerde gebruiker kan geen topics maken of reageren op topics.","trust_level_change_failed":"Er ging iets mis bij het wijzigen van het trust level van deze gebruiker.","ban_modal_title":"Ban gebruiker"},"site_content":{"none":"Selecteer een tekst om deze te bewerken","title":"Teksten","edit":"Bewerk teksten"},"site_settings":{"show_overriden":"Bekijk alleen bewerkte instellingen","title":"Instellingen","reset":"herstel naar standaardinstellingen","none":"geen"}}}}};
I18n.locale = 'nl';
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
// language : dutch (nl)
// author : Joris Röling : https://github.com/jjupiter
//
(function(){

var monthsShortWithDots = "jan._feb._mrt._apr._mei_jun._jul._aug._sep._okt._nov._dec.".split("_"),
    monthsShortWithoutDots = "jan_feb_mrt_apr_mei_jun_jul_aug_sep_okt_nov_dec".split("_");

moment.lang('nl', {
    months : "januari_februari_maart_april_mei_juni_juli_augustus_september_oktober_november_december".split("_"),
    monthsShort : function (m, format) {
        if (/-MMM-/.test(format)) {
            return monthsShortWithoutDots[m.month()];
        } else {
            return monthsShortWithDots[m.month()];
        }
    },
    weekdays : "zondag_maandag_dinsdag_woensdag_donderdag_vrijdag_zaterdag".split("_"),
    weekdaysShort : "zo._ma._di._wo._do._vr._za.".split("_"),
    weekdaysMin : "Zo_Ma_Di_Wo_Do_Vr_Za".split("_"),
    longDateFormat : {
        LT : "HH:mm",
        L : "DD-MM-YYYY",
        LL : "D MMMM YYYY",
        LLL : "D MMMM YYYY LT",
        LLLL : "dddd D MMMM YYYY LT"
    },
    calendar : {
        sameDay: '[Vandaag om] LT',
        nextDay: '[Morgen om] LT',
        nextWeek: 'dddd [om] LT',
        lastDay: '[Gisteren om] LT',
        lastWeek: '[afgelopen] dddd [om] LT',
        sameElse: 'L'
    },
    relativeTime : {
        future : "over %s",
        past : "%s geleden",
        s : "een paar seconden",
        m : "één minuut",
        mm : "%d minuten",
        h : "één uur",
        hh : "%d uur",
        d : "één dag",
        dd : "%d dagen",
        M : "één maand",
        MM : "%d maanden",
        y : "één jaar",
        yy : "%d jaar"
    },
    ordinal : function (number) {
        return number + ((number === 1 || number === 8 || number >= 20) ? 'ste' : 'de');
    },
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
