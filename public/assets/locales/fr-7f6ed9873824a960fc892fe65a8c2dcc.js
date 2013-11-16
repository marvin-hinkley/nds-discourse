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
MessageFormat.locale.fr = function (n) {
  if (n >= 0 && n < 2) {
    return 'one';
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
r += "Il y a ";
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
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
}});I18n.translations = {"fr":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Octet","other":"Octets"},"gb":"Go","kb":"Ko","mb":"Mo","tb":"To"}}}},"dates":{"tiny":{"half_a_minute":"\u003C 1m","less_than_x_seconds":{"one":"\u003C 1s","other":"\u003C %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003C 1m","other":"\u003C %{count}m"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1j","other":"%{count}j"},"about_x_years":{"one":"1a","other":"%{count}a"},"over_x_years":{"one":"\u003E 1a","other":"\u003E %{count}a"},"almost_x_years":{"one":"1y","other":"%{count}a"}},"medium":{"x_minutes":{"one":"1 min","other":"%{count} mins"},"x_hours":{"one":"1 heure","other":"%{count} heures"},"x_days":{"one":"1 jour","other":"%{count} jours"}},"medium_with_ago":{"x_minutes":{"one":"Il y a 1 min","other":"Il y a %{count} mins"},"x_hours":{"one":"Il y a 1 heure","other":"Il y a %{count} heures"},"x_days":{"one":"Il y a 1 jour","other":"Il y a %{count} jours"}}},"share":{"topic":"partager un lien vers cette discussion","post":"partagez un lien vers le message #%{postNumber}","close":"fermer","twitter":"partager ce lien sur Twitter","facebook":"partager ce lien sur Facebook","google+":"partager ce lien sur Google+","email":"envoyer ce lien par email"},"edit":"éditer le titre et la catégorie de cette discussion","not_implemented":"Cette fonctionnalité n'a pas encore été implémentée, désolé.","no_value":"Non","yes_value":"Oui","of_value":"de","generic_error":"Désolé, une erreur est survenue.","generic_error_with_reason":"Un erreur est survenue: %{error}","log_in":"Connexion","age":"Âge","last_post":"Dernier message","joined":"à rejoint","admin_title":"Admin","flags_title":"Signalements","show_more":"afficher plus","links":"Liens","faq":"FAQ","privacy_policy":"Politique de confidentialité","mobile_view":"Vue mode Mobile","desktop_view":"Vue Mode Bureau","you":"Vous","or":"ou","now":"à l'instant","read_more":"lire la suite","more":"Plus","less":"Moins","never":"jamais","daily":"quotidiennes","weekly":"hebdomadaires","every_two_weeks":"bi-mensuelles","character_count":{"one":"{{count}} caractère","other":"{{count}} caractères"},"in_n_seconds":{"one":"dans 1 seconde","other":"dans {{count}} secondes"},"in_n_minutes":{"one":"dans 1 minute","other":"dans {{count}} minutes"},"in_n_hours":{"one":"dans 1 heure","other":"dans {{count}} heures"},"in_n_days":{"one":"dans 1 jour","other":"dans {{count}} jours"},"suggested_topics":{"title":"Discussions Proposées"},"bookmarks":{"not_logged_in":"Désolé vous devez être connecté pour placer ce message dans vos signets.","created":"Vous avez placé ce message dans vos signets.","not_bookmarked":"Vous avez lu ce message; Cliquez pour le placer dans vos signets.","last_read":"Voici le dernier message que vous avez lu; cliquez pour l'ajouter à vos favoris."},"new_topics_inserted":"{{count}} nouvelles discussions.","show_new_topics":"Cliquez pour afficher.","preview":"prévisualiser","cancel":"annuler","save":"Sauvegarder les changements","saving":"Sauvegarde en cours...","saved":"Sauvegardé !","upload":"Envoyer","uploading":"Envoi en cours...","uploaded":"Envoyé!","choose_topic":{"none_found":"Aucune discussion trouvée.","title":{"search":"Recherchez une Discussion par son nom, url ou id :","placeholder":"renseignez ici le titre de la discussion"}},"user_action":{"user_posted_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E a démarré \u003Ca href='{{topicUrl}}'\u003Ela discussion\u003C/a\u003E","you_posted_topic":"\u003Ca href='{{userUrl}}'\u003EVous\u003C/a\u003E avez démarré \u003Ca href='{{topicUrl}}'\u003Ela discussion\u003C/a\u003E","user_replied_to_post":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E a répondu à \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","you_replied_to_post":"\u003Ca href='{{userUrl}}'\u003EVous\u003C/a\u003E avez répondu à \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","user_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E a participé à \u003Ca href='{{topicUrl}}'\u003Ela discussion\u003C/a\u003E","you_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003EVous\u003C/a\u003E avez participé à \u003Ca href='{{topicUrl}}'\u003Ela discussion\u003C/a\u003E","user_mentioned_user":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E a mentionné \u003Ca href='{{user2Url}}'\u003E{{another_user}}\u003C/a\u003E","user_mentioned_you":"\u003Ca href='{{user2Url}}'\u003EVous\u003C/a\u003E avez été mentionné par \u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E","you_mentioned_user":"\u003Ca href='{{user1Url}}'\u003EVous\u003C/a\u003E avez mentionné \u003Ca href='{{user2Url}}'\u003E{{user}}\u003C/a\u003E","posted_by_user":"Rédigé par \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","posted_by_you":"Rédigé par \u003Ca href='{{userUrl}}'\u003Evous\u003C/a\u003E","sent_by_user":"Envoyé par \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","sent_by_you":"Envoyé par \u003Ca href='{{userUrl}}'\u003Evous\u003C/a\u003E"},"user_action_groups":{"1":"J'aime donnés","2":"J'aime reçus","3":"Signets","4":"Discussions","5":"Réponses données","6":"Réponses","7":"Mentions","9":"Citations","10":"Favoris","11":"Editions","12":"Eléments envoyés","13":"Boîte de réception"},"categories":{"all":"toutes les catégories","all_subcategories":"toutes les sous-catégories","category":"Catégorie","posts":"Messages","topics":"Discussions","latest":"Dernières","latest_by":"Dernières par","toggle_ordering":"Changer l'ordre"},"user":{"said":"{{username}} a dit :","profile":"Profil","show_profile":"Visiter le Profil","mute":"Couper","edit":"Éditer les préférences","download_archive":"télécharger l'archive de mes messages","private_message":"Message privé","private_messages":"Messages","activity_stream":"Activité","preferences":"Préférences","bio":"À propos de moi","invited_by":"Invité par","trust_level":"Niveau de confiance","notifications":"Notifications","dynamic_favicon":"Afficher les notifications de messages entrants sur le favicon","external_links_in_new_tab":"Ouvrir tous les liens externes dans un nouvel onglet","enable_quoting":"Activer la citation automatique du texte surligné","change":"modifier","moderator":"{{user}} est un modérateur","admin":"{{user}} est un administrateur","deleted":"(supprimé)","messages":{"all":"Tous","mine":"Le mien","unread":"Non lu"},"change_password":{"success":"(email envoyé)","in_progress":"(email en cours d'envoi)","error":"(erreur)","action":"Envoyer un mail de réinitialisation du mot de passe"},"change_about":{"title":"Modifier à propos de moi"},"change_username":{"title":"Changer le pseudo","confirm":"Si vous changez de pseudo, les citations de vos messages et les mentions @nom seront  cassées. Êtes-vous absolument sûr de le vouloir ?","taken":"Désolé, ce pseudo est déjà pris","error":"Il y a eu une erreur en changeant votre pseudo.","invalid":"Ce pseudo est invalide. Il ne doit être composé que de lettres et de chiffres."},"change_email":{"title":"Changer d'email","taken":"Désolé, cette adresse email est indisponible.","error":"Il y a eu une erreur lors du changement d'email. Cette adresse est peut-être déjà utilisée ?","success":"Nous vous avons envoyé un mail à cette adresse. Merci de suivre les instructions."},"change_avatar":{"title":"Changez votre avatar","gravatar":"\u003Ca href='//gravatar.com/emails' target='_blank'\u003EGravatar\u003C/a\u003E, basé sur","gravatar_title":"Changez votre avatar sur le site Gravatar","uploaded_avatar":"Photo personnalisée","uploaded_avatar_empty":"Ajouter une photo personnalisée","upload_title":"Envoyer votre photo","image_is_not_a_square":"Attention : nous avons coupé l'image pour en faire un carré."},"email":{"title":"Email","instructions":"Votre adresse email ne sera jamais communiquée.","ok":"Ça à l'air bien ! On vous envoie un mail pour confirmer.","invalid":"Merci d'entrer une adresse email valide","authenticated":"Votre adresse email a été authentifiée par {{provider}}.","frequency":"Nous vous envoyons des mails contenant uniquement des informations que vous n'avez pas déjà vues lors d'une précédente connexion."},"name":{"title":"Nom","instructions":"Votre nom complet (pas nécessairement unique). Utilisé aussi pour les recherches par @nom alternatives ; seulement affiché sur votre page utilisateur.","too_short":"Votre nom est trop court.","ok":"Votre nom à l'air sympa !."},"username":{"title":"Pseudo","instructions":"Doit être unique et ne pas contenir d'espace. Les gens pourrons vous mentionner avec @pseudo.","short_instructions":"Les gens peuvent vous mentionner avec @{{username}}.","available":"Votre pseudo est disponible.","global_match":"L'adresse email correspond au pseudo enregistré.","global_mismatch":"Déjà enregistré. Essayez {{suggestion}} ?","not_available":"Pas disponible. Essayez {{suggestion}} ?","too_short":"Votre pseudo est trop court.","too_long":"Votre pseudo est trop long.","checking":"Vérification de la disponibilité de votre pseudo...","enter_email":"Pseudo trouvé. Entrez l'adresse email correspondante."},"password_confirmation":{"title":"Confirmation"},"last_posted":"Dernier message","last_emailed":"Dernier mail","last_seen":"Dernier vu","created":"Créé à","log_out":"Déconnexion","website":"Site Internet","email_settings":"Email","email_digests":{"title":"Quand je ne visite pas ce site, m'envoyer un résumé par mail des nouveautés","daily":"quotidien","weekly":"hebdomadaire","bi_weekly":"tous les 15 jours"},"email_direct":"Recevoir un mail quand quelqu'un vous cite, répond à votre message ou mentionne votre @pseudo","email_private_messages":"Recevoir un mail quand quelqu'un vous envoie un message privé","email_always":"Recevoir des notifications et des résumés par email même si je suis actif sur le forum","other_settings":"Autre","new_topic_duration":{"label":"Considérer une discussion comme nouvelle quand","not_viewed":"Je ne les ai pas encore vues","last_here":"elles ont été publiées depuis ma dernière visite","after_n_days":{"one":"elles ont été publiées hier","other":"elles ont été publiées lors des {{count}} derniers jours"},"after_n_weeks":{"one":"elles ont été publiées la semaine dernière","other":"elles ont été publiées lors des {{count}} dernières semaines"}},"auto_track_topics":"Suivre automatiquement les discussions que j'ai postées","auto_track_options":{"never":"jamais","always":"toujours","after_n_seconds":{"one":"dans une seconde","other":"dans {{count}} secondes"},"after_n_minutes":{"one":"dans une minute","other":"dans {{count}} minutes"}},"invited":{"title":"Invités","user":"Utilisateurs invités","none":"{{username}} n'a invité personne sur le site.","redeemed":"Invités rachetés","redeemed_at":"Racheté à ","pending":"Invités en attente","topics_entered":"Discussions Postées","posts_read_count":"Messages Lus","rescind":"Supprimer l'invitation","rescinded":"Invité supprimé","time_read":"Temps de lecture","days_visited":"Nombre de jours de visite","account_age_days":"Âge du compte en jours"},"password":{"title":"Mot de passe","too_short":"Votre mot de passe est trop court.","ok":"Votre mot de passe a l'air bon."},"ip_address":{"title":"Dernières adresses IP"},"avatar":{"title":"Avatar"},"title":{"title":"Titre"},"filters":{"all":"Tout"},"stream":{"posted_by":"Rédigé par","sent_by":"Envoyé par","private_message":"message privé","the_topic":"la discussion"}},"loading":"Chargement...","close":"Fermeture","learn_more":"en savoir plus...","year":"an","year_desc":"discussions postées dans les 365 derniers jours","month":"mois","month_desc":"discussions postées dans les 30 derniers jours","week":"semaine","week_desc":"discussions postées dans les 7 derniers jours","first_post":"Premier message","mute":"Désactiver","unmute":"Activer","best_of":{"title":"les meilleurs","enabled_description":"Vous êtes actuellement en train de consulter seulement les messages les plus populaires de cette discussion. Pour voir tous les messages, cliquez ci-dessous.","description":"Il y a \u003Cb\u003E{{count}}\u003C/b\u003E messages dans cette discussion. C'est beaucoup ! Voulez-vous gagner du temps en n'affichant que les meilleurs messages ?","enable":"Basculer dans la vue  : \"les meilleurs\"","disable":"Annuler \"les meilleurs\""},"private_message_info":{"title":"Discussion Privée","invite":"Inviter d'autres utilisateurs...","remove_allowed_user":"Voulez-vous vraiment supprimer {{name}} de ce message privé ?"},"email":"Email","username":"Pseudo","last_seen":"Dernière apparition","created":"Créé","trust_level":"Niveau de confiance","create_account":{"title":"Créer un compte","action":"Créer !","invite":"Vous n'avez pas encore de compte ?","failed":"Quelque chose s'est mal passé, peut-être que cette adresse email est déjà enregistrée, essayez le lien Mot de passe oublié."},"forgot_password":{"title":"Mot de passe oublié ?","action":"J'ai oublié mon mot de passe","invite":"Entrez votre pseudo ou votre adresse email, et vous recevrez un nouveau mot de passe par mail.","reset":"Réinitialiser votre mot de passe","complete":"Si un compte correspond à ce nom d'utilisateur ou cette adresse mail, vous allez recevoir rapidement un mail contenant les instructions pour réinitialiser votre mot de passe."},"login":{"title":"Connexion","username":"Pseudo","password":"Mot de passe","email_placeholder":"adresse email ou pseudo","error":"Erreur inconnue","reset_password":"Réinitialiser le mot de passe","logging_in":"Connexion en cours...","or":"ou","authenticating":"Authentification...","awaiting_confirmation":"Votre compte est en attente d'activation, utilisez le lien mot de passe oublié pour demander un nouveau mail d'activation.","awaiting_approval":"Votre compte n'a pas encore été approuvé par un modérateur. Vous recevrez une confirmation par mail lors de l'activation.","requires_invite":"Désolé, l'accès à ce forum est sur invitation seulement.","not_activated":"Vous ne pouvez pas vous encore vous connecter. Nous vous avons envoyé un email d'activation à \u003Cb\u003E{{sentTo}}\u003C/b\u003E. Merci de suivre les instructions afin d'activer votre compte.","resend_activation_email":"Cliquez ici pour réenvoyer l'email d'activation.","sent_activation_email_again":"Nous venous de vous envoyer un nouvel email d'activation à \u003Cb\u003E{{currentEmail}}\u003C/b\u003E. Il peut prendre quelques minutes à arriver; n'oubliez pas de vérifier votre répertoire spam.","google":{"title":"via Google","message":"Authentification via Google (assurez-vous que les popups ne soient pas bloquées)"},"twitter":{"title":"via Twitter","message":"Authentification via Twitter (assurez-vous que les popups ne soient pas bloquées)"},"facebook":{"title":"via Facebook","message":"Authentification via Facebook (assurez-vous que les popups ne soient pas bloquées)"},"cas":{"title":"via CAS","message":"Authentification via CAS (assurez-vous que les popups ne soient pas bloquées)"},"yahoo":{"title":"via Yahoo","message":"Authentification via Yahoo (assurez-vous que les popups ne soient pas bloquées)"},"github":{"title":"via GitHub","message":"Authentification via GitHub (assurez-vous que les popups ne soient pas bloquées)"},"persona":{"title":"via Persona","message":"Authentification via Mozilla Persona (assurez-vous que les popups ne soient pas bloquées)"}},"composer":{"posting_not_on_topic":"A quelle discussion voulez-vous répondre ?","saving_draft_tip":"sauvegarde...","saved_draft_tip":"sauvegardé","saved_local_draft_tip":"sauvegardé en local","similar_topics":"Votre message est trop similaire à...","drafts_offline":"sauvegardé hors ligne","min_length":{"need_more_for_title":"{{n}} caractères restant pour le titre","need_more_for_reply":"{{n}} caractères restant pour le message"},"error":{"title_missing":"Le titre est obligatoire.","title_too_short":"Le titre doit avoir au moins {{min}} caractères.","title_too_long":"Le titre ne doit pas dépasser les {{max}} caractères.","post_missing":"Le message ne peut être vide.","post_length":"Le message doit avoir au moins {{min}} caractères.","category_missing":"Vous devez choisir une catégorie."},"save_edit":"Sauvegarder la modification","reply_original":"Répondre à la discussion initiale","reply_here":"Répondre ici","reply":"Répondre","cancel":"Annuler","create_topic":"Créer une Discussion","create_pm":"Créer un Message Privé","users_placeholder":"Ajouter un utilisateur","title_placeholder":"Choisissez un titre ici. Sur quoi porte cette discussion en quelques mots ?","reply_placeholder":"Saisissez votre réponse ici. Utilisez le Markdown ou le BBCode pour le formatage. Vous pouvez déposer ou coller une image ici.","view_new_post":"Voir votre nouveau message.","saving":"Sauvegarde...","saved":"Sauvegardé !","saved_draft":"Vous avez un brouillon en attente. Cliquez n'importe où pour en reprendre l'édition","uploading":"Envoi en cours...","show_preview":"afficher la prévisualisation \u0026raquo;","hide_preview":"\u0026laquo; cacher la prévisualisation","quote_post_title":"Citer le message en entier","bold_title":"Gras","bold_text":"texte en gras","italic_title":"Italique","italic_text":"texte en italique","link_title":"Lien","link_description":"renseignez ici la description du lien","link_dialog_title":"Insérez le lien","link_optional_text":"titre optionnel","quote_title":"Citation","quote_text":"Citation","code_title":"Bout de code","code_text":"renseignez ici votre code","upload_title":"Envois de fichier","upload_description":"renseignez ici la description de votre fichier","olist_title":"Liste numérotée","ulist_title":"Liste à puces","list_item":"Elément","heading_title":"Titre","heading_text":"Titre","hr_title":"Barre horizontale","undo_title":"Annuler","redo_title":"Refaire","help":"Aide Markdown","toggler":"Afficher ou cacher le composer","admin_options_title":"Paramètres optionnels pour cette discussion","auto_close_label":"Fermer automatiquement cette discussion après :","auto_close_units":"jours"},"notifications":{"title":"Notification des mentions de votre @pseudo, réponses à vos discussions ou messages, etc.","none":"Vous n'avez aucune notification pour le moment.","more":"voir les anciennes notifications","mentioned":"\u003Cspan title='mentionné' class='icon'\u003E@\u003C/span\u003E {{username}} {{link}}","quoted":"\u003Ci title='cité' class='icon icon-quote-right'\u003E\u003C/i\u003E {{username}} {{link}}","replied":"\u003Ci title='avec réponse' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","posted":"\u003Ci title='avec réponse' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","edited":"\u003Ci title='édité' class='icon icon-pencil'\u003E\u003C/i\u003E {{username}} {{link}}","liked":"\u003Ci title='apprécié' class='icon icon-heart'\u003E\u003C/i\u003E {{username}} {{link}}","private_message":"\u003Ci class='icon icon-envelope-altk' title='message privé'\u003E\u003C/i\u003E {{username}} {{link}}","invited_to_private_message":"\u003Ci class='icon icon-envelope-altk' title='message privé'\u003E\u003C/i\u003E {{username}} {{link}}","invitee_accepted":"\u003Ci title='a accepté votre invitation' class='icon icon-signin'\u003E\u003C/i\u003E {{username}} a accepté votre invitation","moved_post":"\u003Ci title='moved post' class='icon icon-arrow-right'\u003E\u003C/i\u003E {{username}} a déplacé {{link}}","total_flagged":"Nombre total de messages signalés"},"upload_selector":{"title":"Ajouter une image","title_with_attachments":"Ajouter une image ou un fichier","from_my_computer":"Depuis mon appareil","from_the_web":"Depuis le web","remote_tip":"saisissez l'adresse d'une image sous la forme http://monsite.com/image.jpg","remote_tip_with_attachments":"saisissez l'url du fichier - par exemple : http://monsite.com/fichier.txt (extensions autorisées : {{authorized_extensions}}).","local_tip":"cliquez pour sélectionner une image depuis votre ordinateur","local_tip_with_attachments":"Cliquez pour sélectionner une image ou un fichier depuis votre ordinateur (extensions autorisées : {{authorized_extensions}}).","hint":"(vous pouvez également faire un glisser-déposer dans l'éditeur pour les télécharger)","hint_for_chrome":"(vous pouvez aussi faire un glisser-déposer ou coller des images dans l'éditeur pour les télécharger)","uploading":"Fichier en cours d'envoi"},"search":{"title":"Rechercher les discussions, messages, utilisateurs ou catégories","placeholder":"saisir votre requête ici","no_results":"Aucun résultat.","searching":"Recherche en cours ...","prefer":{"user":"La recherche priorisera les résultats de @{{username}}","category":"La recherche priorisera les résultats de la catégorie : {{category}}"}},"site_map":"voir une autre liste des discussions ou une catégorie","go_back":"retour","current_user":"voir la page de l'utilisateur","favorite":{"title":"Favoris","help":{"star":"ajouter cette discussion à vos favoris","unstar":"enlever cette discussion de vos favoris"}},"topics":{"none":{"favorited":"Vous n'avez aucune discussion favorite pour le moment. Pour ajouter une discussion aux favoris, cliquez sur l'étoile suivant le titre.","unread":"Vous n'avez aucune discussion non lue.","new":"Vous n'avez aucune discussion non lue.","read":"Vous n'avez lu aucune discussion pour le moment.","posted":"Vous n'avez écrit aucun message pour le moment.","latest":"Il n'y a aucune discussion pour le moment. C'est triste...","hot":"Il n'y a aucune discussion populaire pour le moment.","category":"Il n'y a aucune discussion sur {{category}}."},"bottom":{"latest":"Il n'y a plus de discussion à lire.","hot":"Il n'y a plus de discussion populaire à lire.","posted":"Il n'y a plus de discussion à lire.","read":"Il n'y a plus de discussion à lire.","new":"Il n'y a plus de discussion à lire.","unread":"Il n'y a plus de discussion non lue à lire.","favorited":"Il n'y a plus de discussion favorites à lire.","category":"Il n'y a plus de discussion sur {{category}} à lire."}},"rank_details":{"toggle":"afficher/cacher le détail du classement des discussions","show":"afficher le détail du classement des discussions","title":"Détail du classement des discussions"},"topic":{"filter_to":"Afficher uniquement les {{post_count}} messages de {{username}} dans cette discussion","create":"Créer une discussion","create_long":"Créer une nouvelle discussion","private_message":"Commencer une discussion privée","list":"Liste des discussions","new":"nouvelle discussion","new_topics":{"one":"1 nouvelle discussion","other":"{{count}} nouvelles discussions"},"unread_topics":{"one":"1 discussion non lue","other":"{{count}} discussions non lues"},"title":"discussions","loading_more":"Chargement de discussions supplémentaires...","loading":"Chargement des discussions en cours...","invalid_access":{"title":"Discussion privée","description":"Désolé, vous n'avez pas accès à cette discussion !"},"server_error":{"title":"Discussion impossible à charger","description":"Désolé, nous n'avons pu charger cette discussion, probablement du à un problème de connexion. Merci de réessayer à nouveau. Si le problème persiste, merci de nous le faire savoir."},"not_found":{"title":"Discussion non trouvée","description":"Désolé, nous n'avons pas trouvé cette discussion. Peut-être a t-elle été retirée par un modérateur ?"},"unread_posts":{"one":"vous avez 1 message non lu dans cette discussion","other":"vous avez {{unread}} messages non lus dans cette discussion"},"new_posts":{"one":"il y a 1 nouveau message dans cette discussion depuis la dernière fois","other":"il y a {{new_posts}} nouveaux messages dans cette discussion depuis la dernière fois"},"likes":{"one":"1 personne à aimé cette discussion","other":"{{count}} personnes ont aimés cette discussion"},"back_to_list":"Retour à la liste des discussions","options":"Options de la Discussion","show_links":"afficher les liens de cette discussion","toggle_information":"afficher les détails de la discussion","read_more_in_category":"Vous voulez en lire plus ? Afficher d'autres discussions dans {{catLink}} ou {{latestLink}}.","read_more":"Vous voulez en lire plus? {{catLink}} or {{latestLink}}.","browse_all_categories":"Voir toutes les catégories","view_latest_topics":"voir les dernières discussions","suggest_create_topic":"Pourquoi ne pas créer une nouvelle discussion ?","read_position_reset":"Votre position de lecture à été remise à zéro.","jump_reply_up":"aller à des réponses précédentes","jump_reply_down":"allez à des réponses ultérieures","deleted":"Cette discussion à été supprimée","auto_close_notice":"Cette discussion sera automatiquement fermée %{timeLeft}.","auto_close_title":"Paramètres de fermeture automatique","auto_close_save":"Sauvegarder","auto_close_cancel":"Annuler","auto_close_remove":"Ne pas fermer automatiquement cette discussion","progress":{"title":"progession dans la discussion","jump_top":"aller au premier message","jump_bottom":"aller au dernier message","total":"total messages","current":"message courant"},"notifications":{"title":"","reasons":{"3_2":"Vous recevrez des notifications car vous suivez attentivement cette discussion.","3_1":"Vous recevrez des notifications car vous avez créé cette discussion.","3":"Vous recevrez des notifications car vous suivez cette discussion.","2_4":"Vous recevrez des notifications car vous avez posté une réponse dans cette discussion.","2_2":"Vous recevrez des notifications car vous suivez cette discussion.","2":"Vous recevrez des notifications car vous \u003Ca href=\"/users/{{username}}/preferences\"\u003Eavez lu cette discussion\u003C/a\u003E.","1":"Vous serez notifié seulement si un utilisateur mentionne votre @pseudo ou réponds à vos messages.","1_2":"Vous serez notifié seulement si un utilisateur mentionne votre @pseudo ou réponds à vos messages.","0":"Vous ignorez toutes les notifications de cette discussion.","0_2":"Vous ignorez toutes les notifications de cette discussion."},"watching":{"title":"Suivre attentivement","description":"pareil que le suivi simple, plus une notification systématique pour chaque nouveau message."},"tracking":{"title":"Suivi simple","description":"vous serez notifié des mentions de votre @pseudo et des réponses à vos messages, et en plus du nombre de messages non lus et des nouveaux messages."},"regular":{"title":"Normal","description":"vous recevrez des notifications seulement si un utilisateur mentionne votre @pseudo ou répond à un de vos messages"},"muted":{"title":"Silencieux","description":"vous ne recevrez aucune notification de cette discussion et elle n'apparaitra pas dans l'onglet des discussions non lues."}},"actions":{"recover":"Annuler Suppression de la Discussion","delete":"Supprimer la discussion","open":"Ouvrir la discussion","close":"Fermer la discussion","auto_close":"Fermeture automatique","unpin":"Désépingler la discussion","pin":"Épingler la discussion","unarchive":"Désarchiver la discussion","archive":"Archiver la discussion","invisible":"Rendre invisible","visible":"Rendre visible","reset_read":"Réinitialiser les lectures","multi_select":"Sélectionner les Messages à Déplacer","convert_to_topic":"Convertir en discussion normale"},"reply":{"title":"Répondre","help":"commencez à répondre à cette discussion"},"clear_pin":{"title":"Désépingler","help":"Désépingler cette discussion afin qu'elle n'apparaisse plus en tête des discussions"},"share":{"title":"Partager","help":"partager un lien vers cette discussion"},"inviting":"Inviter...","invite_private":{"title":"Inviter dans la discussion privée","email_or_username":"Adresse email ou @pseudo de l'invité","email_or_username_placeholder":"Adresse email ou @pseudo","action":"Inviter","success":"Merci ! Vous avez invité cet utilisateur à participer à la discussion privée.","error":"Désolé, il y a eu une erreur lors de l'invitation de cet utilisateur."},"invite_reply":{"title":"Inviter des amis à répondre","action":"Envoyer l'invitation","help":"envoyer des invitations à des amis pour qu'ils puissent participer à cette discussion en un simple clic","email":"Nous allons envoyer un mail à votre ami pour lui permettre de participer à cette conversation juste en cliquant sur un lien, sans qu'il ait à se connecter.","email_placeholder":"adresse email","success":"Merci ! Nous avons envoyé un mail à \u003Cb\u003E{{email}}\u003C/b\u003E. Nous vous informerons lorsqu'ils auront retourné votre invitation. Suivez vos invitations dans l'onglet prévu à cet effet sur votre page utilisateur.","error":"Désolé nous ne pouvons pas inviter cette personne. Peut-être est -elle déjà un utilisateur ?"},"login_reply":"Connectez-vous pour répondre","filters":{"user":"Vous voyez seulement {{n_posts}} {{by_n_users}}.","n_posts":{"one":"1 message","other":"{{count}} messages"},"by_n_users":{"one":"de l'utilisateur","other":"rédigés par {{count}} utilisateurs"},"best_of":"Vous voyez seulement {{n_best_posts}} {{of_n_posts}} de cette discussion.","n_best_posts":{"one":"le message","other":"les {{count}} messages"},"of_n_posts":{"one":"le plus populaire","other":"les {{count}} plus populaires"},"cancel":"Réafficher tous les messages de cette discussion."},"split_topic":{"title":"Déplacer vers une Nouvelle Discussion","action":"déplacer vers une nouvelle discussion","topic_name":"Nom de la nouvelle discussion :","error":"Il y a eu une erreur en déplaçant les messages vers une nouvelle discussion.","instructions":{"one":"Vous êtes sur le point de créer une nouvelle discussion avec le message que vous avez sélectionné.","other":"Vous êtes sur le point de créer une nouvelle discussion avec les \u003Cb\u003E{{count}}\u003C/b\u003E messages que vous avez sélectionné."}},"merge_topic":{"title":"Déplacer vers une Discussion Existante","action":"déplacer vers une discussion existante","error":"Il y a eu une erreur en déplaçance ces messages dans cette discussion.","instructions":{"one":"Merci de sélectionner la discussion dans laquelle vous souhaitez déplacer le message que vous avez sélectionné.","other":"Merci de sélectionner la discussion dans laquelle vous souhaitez déplacer les \u003Cb\u003E{{count}}\u003C/b\u003E messages que vous avez sélectionné."}},"multi_select":{"select":"sélectionner","selected":"({{count}}) sélectionnés","select_replies":"selectionner +réponses","delete":"supprimer la sélection","cancel":"annuler la sélection","description":{"one":"vous avez sélectionné \u003Cb\u003E1\u003C/b\u003E message.","other":"Vous avez sélectionné \u003Cb\u003E{{count}}\u003C/b\u003E messages."}}},"post":{"reply":"Répondre à {{link}} par {{replyAvatar}} {{username}}","reply_topic":"Répondre à {{link}}","quote_reply":"Citer","edit":"Éditer {{link}} par {{replyAvatar}} {{username}}","post_number":"message {{number}}","in_reply_to":"Réponse courte","last_edited_on":"message dernièrement édité le","reply_as_new_topic":"Répondre dans une nouvelle conversation","continue_discussion":"Continuer la discussion suivante {{postLink}}:","follow_quote":"Voir le message cité","deleted_by_author":{"one":"(message supprimé par son auteur, sera supprimé automatiquement dans %{count} heure à moins qu'il ne soit signalé)","other":"(message supprimé par son auteur, sera supprimé automatiquement dans %{count} heures à moins qu'il ne soit signalé)"},"deleted_by":"supprimé par","expand_collapse":"étendre/réduire","has_replies":{"one":"Réponse","other":"Réponses"},"errors":{"create":"Désolé, il y a eu une erreur lors de la publication de votre message. Merci de réessayer.","edit":"Désolé, il y a eu une erreur lors de l'édition de votre message. Merci de réessayer.","upload":"Désolé, il y a eu une erreur lors de l'envoi du fichier. Merci de réessayer.","attachment_too_large":"Désolé, le fichier que vous êtes en train d'envoyer est trop grand (taille maximum de {{max_size_kb}} Ko).","image_too_large":"Désolé, l'image que vous êtes en train d'envoyer est trop grande (taille maximum de {{max_size_kb}} Ko). Merci de le redimensionner et de réessayer.","too_many_uploads":"Désolé, vous ne pouvez envoyer qu'un seul fichier à la fois.","upload_not_authorized":"Désolé, le fichier que vous êtes en train d'envoyer n'est pas autorisé (extensions autorisées : {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Désolé, les nouveaux utilisateurs ne peuvent pas envoyer d'image.","attachment_upload_not_allowed_for_new_user":"Désolé, les nouveaux utilisateurs ne peuvent pas envoyer de fichier."},"abandon":"Voulez-vous vraiment abandonner ce message ?","archetypes":{"save":"Sauvegarder les options"},"controls":{"reply":"Rédiger une réponse à ce message","like":"J'aime ce message","edit":"Éditer ce message","flag":"Signaler ce message à la modération","delete":"Supprimer ce message","undelete":"Annuler la suppression de ce message","share":"Partager un lien vers ce message","more":"Plus","delete_replies":{"confirm":{"one":"Voulez-vous aussi supprimer la réponse qui suit directement ce message ?","other":"Voulez-vous aussi supprimer les  {{count}} réponse qui suivent directement ce message ?"},"yes_value":"Oui, supprimer les réponses égalements","no_value":"Non, juste ce message"}},"actions":{"flag":"Signaler","clear_flags":{"one":"Annuler le signalement","other":"Annuler les signalements"},"it_too":{"off_topic":"Le signaler également","spam":"Le signaler également","inappropriate":"Le signaler également","custom_flag":"Le signaler également","bookmark":"L'ajouter également en favoris","like":"L'aimer également","vote":"Votez pour lui également"},"undo":{"off_topic":"Annuler le signalement","spam":"Annuler le signalement","inappropriate":"Annuler le signalement","bookmark":"L'enlever des favoris","like":"Annuler j'aime","vote":"Retirer votre vote"},"people":{"off_topic":"{{icons}} l'ont signalé comme étant hors-sujet","spam":"{{icons}} l'ont signalé comme étant du spam","inappropriate":"{{icons}} l'ont signalé comme inapproprié","notify_moderators":"{{icons}} l'ont signalé pour modération","notify_moderators_with_url":"{{icons}} \u003Ca href='{{postUrl}}'\u003El'ont signalé pour modération\u003C/a\u003E","notify_user":"{{icons}} ont démarré une conversation privée","notify_user_with_url":"{{icons}} ont démarré une \u003Ca href='{{postUrl}}'\u003Econversation privée\u003C/a\u003E","bookmark":"{{icons}} l'ont ajouté à leurs favoris","like":"{{icons}} l'ont aimé","vote":"{{icons}} ont voté pour"},"by_you":{"off_topic":"Vous l'avez signalé comme étant hors-sujet","spam":"Vous l'avez signalé comme étant du spam","inappropriate":"Vous l'avez signalé comme inapproprié","notify_moderators":"Vous l'avez signalé pour modération","notify_user":"Vous avez démarré une conversation privée avec cet utilisateur","bookmark":"Vous l'avez ajouté à vos favoris","like":"Vous l'avez aimé","vote":"Vous avez voté pour"},"by_you_and_others":{"off_topic":{"one":"Vous et 1 autre personne l'avez signalé comme étant hors-sujet","other":"Vous et {{count}} autres personnes l'avez signalé comme étant hors-sujet"},"spam":{"one":"Vous et 1 autre personne l'avez signalé comme étant du spam","other":"Vous et {{count}} autres personnes l'avez signalé comme étant du spam"},"inappropriate":{"one":"Vous et 1 autre personne l'avez signalé comme inapproprié","other":"Vous et {{count}} autres personnes l'avez signalé comme inapproprié"},"notify_moderators":{"one":"Vous et 1 autre personne l'avez signalé pour modération","other":"Vous et {{count}} autres personnes l'avez signalé pour modération"},"notify_user":{"one":"Vous et 1 autre personne avez démarré une conversation privée avec cet utilisateur","other":"Vous et {{count}} autres personnes avez démarré une conversation privée avec cet utilisateur"},"bookmark":{"one":"Vous et 1 autre personne l'avez ajouté à vos favoris","other":"Vous et {{count}} autres personnes l'avez ajouté à vos favoris"},"like":{"one":"Vous et 1 autre personne l'avez aimé","other":"Vous et {{count}} autres personnes l'avez aimé"},"vote":{"one":"Vous et 1 autre personne avez voté pour","other":"Vous et {{count}} autres personnes avez voté pour"}},"by_others":{"off_topic":{"one":"1 personne l'a signalé comme étant hors-sujet","other":"{{count}} personnes l'ont signalé comme étant hors-sujet"},"spam":{"one":"1 personne a signalé ceci comme étant du spam","other":"{{count}} personnes ont signalé ceci comme étant du spam"},"inappropriate":{"one":"1 personne a signalé ceci comme étant inapproprié","other":"{{count}} personnes ont signalé ceci comme étant inapproprié"},"notify_moderators":{"one":"1 personne a signalé ceci pour modération","other":"{{count}} personnes ont signalé pour modération"},"notify_user":{"one":"1 personne a démarré une conversation privée avec cet utilisateur","other":"{{count}} personnes ont démarré une conversation privée avec cet utilisateur"},"bookmark":{"one":"1 personne a ajouté ceci à ses favoris","other":"{{count}} personnes ont ajouté ceci à leurs favoris"},"like":{"one":"1 personne a aimé ceci","other":"{{count}} personnes ont aimé ceci"},"vote":{"one":"1 personne a voté pour ce message","other":"{{count}} personnes ont voté pour ce message"}}},"edits":{"one":"une édition","other":"{{count}} éditions","zero":"pas d'édition"},"delete":{"confirm":{"one":"Êtes-vous sûr de vouloir supprimer ce message ?","other":"Êtes-vous sûr de vouloir supprimer tous ces messages ?"}}},"category":{"can":"peut\u0026hellip; ","none":"(pas de catégorie)","choose":"Sélectionner une catégorie\u0026hellip;","edit":"éditer","edit_long":"Editer la catégorie","view":"Voir les discussions dans cette catégorie","general":"Général","settings":"Paramètres","delete":"Supprimer la catégorie","create":"Créer la catégorie","save":"Enregistrer la catégorie","creation_error":"Il y a eu une erreur lors de la création de la catégorie.","save_error":"Il y a eu une erreur lors de la sauvegarde de la catégorie.","more_posts":"voir tous les {{posts}}...","name":"Nom de la catégorie","description":"Description","topic":"Catégorie de la discussion","badge_colors":"Couleurs du badge","background_color":"Couleur du fond","foreground_color":"Couleur du texte","name_placeholder":"Devrait être concis.","color_placeholder":"N'importe quelle couleur","delete_confirm":"Voulez-vous vraiment supprimer cette catégorie ?","delete_error":"Il y a eu une erreur lors de la suppression.","list":"Liste des catégories","no_description":"Il n'y a pas de description pour cette catégorie.","change_in_category_topic":"Editer la description","hotness":"Buzz","already_used":"Cette couleur est déjà utilisée par une autre catégorie","security":"Sécurité","auto_close_label":"Fermer automatiquement après :","edit_permissions":"Editer les Permissions","add_permission":"Ajouter une Permission","this_year":"cette année","position":"position","parent":"Catégorie parente"},"flagging":{"title":"Pourquoi voulez-vous signaler ce message ?","action":"Signaler ce message","take_action":"Signaler","notify_action":"Notifier","delete_spammer":"Supprimer le spammeur","delete_confirm":"Vous vous apprêtez à supprimer \u003Cb\u003E%{posts}\u003C/b\u003E messages et  \u003Cb\u003E%{topics}\u003C/b\u003E discussions de cet utilisateur, supprimer son compte et à ajouter son email \u003Cb\u003E%{email}\u003C/b\u003E à la liste des utilisateurs bloqués. Etes-vous sûr que cet utilisateur est un spammeur ?","yes_delete_spammer":"Oui, supprimer le spammeur","cant":"Désolé, vous ne pouvez pas signaler ce message pour le moment","custom_placeholder_notify_user":"Pour quelles raisons contactez-vous cet utilisateur par messagerie privée au sujet de cette discussion ? Soyez précis, construstif et toujours aimable.","custom_placeholder_notify_moderators":"Pourquoi ce message requière-t-il l'attention des modérateurs ? Dites-nous ce qui vous dérange spécifiquement, et fournissez des liens pertinents si possible.","custom_message":{"at_least":"saisissez au moins {{n}} caractères","more":"{{n}} restants...","left":"{{n}} restants"}},"topic_summary":{"title":"Résumé de la discussion","links_shown":"montrer les {{totalLinks}} liens...","clicks":"clics","topic_link":"lien de la discussion"},"topic_statuses":{"locked":{"help":"cette discussion est close, elle n'accepte plus de nouvelles réponses"},"pinned":{"help":"cette discussion est épinglée, elle s'affichera en haut de sa catégorie"},"archived":{"help":"cette discussion est archivée, elle est gelée et ne peut être modifiée"},"invisible":{"help":"cette discussion est invisible, elle ne sera pas affichée dans la liste des discussions et est seulement accessible via un lien direct"}},"posts":"Messages","posts_long":"il y a {{number}} messages dans cette discussion","original_post":"Message original","views":"Vues","replies":"Réponses","views_long":"cette discussion a été vue {{number}} fois","activity":"Activité","likes":"J'aime","likes_long":"il y a {{number}} j'aime dans cette discussion","top_contributors":"Participants","category_title":"Catégorie","history":"Historique","changed_by":"par {{author}}","categories_list":"Liste des Catégories","filters":{"latest":{"title":"Récentes","help":"discussions récentes"},"hot":{"title":"Populaires","help":"discussions populaires"},"favorited":{"title":"Favoris","help":"discussions que vous avez ajoutées à vos favoris"},"read":{"title":"Lues","help":"discussions que vous avez lues"},"categories":{"title":"Catégories","title_in":"Catégorie - {{categoryName}}","help":"toutes les discussions regroupées par catégorie"},"unread":{"title":{"zero":"Non lue (0)","one":"Non lue (1)","other":"Non lues ({{count}})"},"help":"discussions suivies contenant des réponses non lues"},"new":{"title":{"zero":"Nouvelle (0)","one":"Nouvelle (1)","other":"Nouvelles ({{count}})"},"help":"nouvelles discussions depuis votre dernière visite"},"posted":{"title":"Mes Messages","help":"discussions auxquelles vous avez participé"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"dernières discussions dans la catégorie {{categoryName}}"}},"browser_update":"Malheureusement, \u003Ca href=\"http://www.discourse.org/faq/#browser\"\u003Evotre navigateur est trop vieux pour afficher ce forum Discourse\u003C/a\u003E. Merci \u003Ca href=\"http://browsehappy.com\"\u003Ede mettre à jour votre navigateur\u003C/a\u003E.","permission_types":{"full":"Créer / Répondre / Voir","create_post":"Répondre / Voir","readonly":"Voir"},"type_to_filter":"Commencez à taper pour filtrer...","admin":{"title":"Administation Discourse","moderator":"Modérateur","dashboard":{"title":"Panel d'administration","last_updated":"Panel d'administration dernière mise à jour :","version":"Version de Discourse","up_to_date":"Vous utilisez la dernière version de Discourse.","critical_available":"Une mise à jour critique est disponible.","updates_available":"Des mises à jour sont disponibles.","please_upgrade":"Veuillez mettre à jour !","no_check_performed":"Une vérification des mises à jour n'a pas été effectuée. Vérifiez que sidekiq est en cours d'exécution.","stale_data":"Une vérification des mises à jour n'a pas été effectuée récemment. Vérifiez que sidekiq est en cours d'exécution.","installed_version":"Version installée","latest_version":"Dernière version","problems_found":"Quelques problèmes ont été trouvés dans votre installation de Discourse :","last_checked":"Dernière vérification","refresh_problems":"Rafraîchir","no_problems":"Aucun problème n'à été trouvé.","moderators":"Modérateurs :","admins":"Administateurs :","blocked":"Bloqués :","suspended":"Banni :","private_messages_short":"MPs","private_messages_title":"Messages Privés","reports":{"today":"Aujourd'hui","yesterday":"Hier","last_7_days":"les 7 derniers jours","last_30_days":"les 30 derniers jours","all_time":"depuis toujours","7_days_ago":"il y a 7 jours","30_days_ago":"il y a 30 jours","all":"Tous","view_table":"Tableau","view_chart":"Graphique à barre"}},"commits":{"latest_changes":"derniers changements: merci de mettre à jour régulièrement !","by":"par"},"flags":{"title":"Signalements","old":"Ancien","active":"Actifs","agree_hide":"D'accord (masquer le message + envoi d'un message privée)","agree_hide_title":"Masquer ce message et envoyer automatiquement un message privé à l'utilisateur afin qu'il le modifie rapidement.","defer":"Différé","defer_title":"Aucune action nécessaire pour l'instant, différer tout action sur ce signalement jusqu'à une date ultérieure, voire jamais","delete_post":"Supprimer le message","delete_post_title":"Supprimer le message; si c'est le premier message, supprime la discussion","disagree_unhide":"Pas d'accord (ré-afficher le message)","disagree_unhide_title":"Retirer tous signalement de ce message et le rendre à nouveau visible","disagree":"Pas d'accord","disagree_title":"Pas d'accord avec ce signalement, retrait de tous signalement de ce message","delete_spammer_title":"Supprimer cet utilisateur, tous ses messages et discussions.","flagged_by":"Signalé par","error":"Quelque chose s'est mal passé","view_message":"Voir le message","no_results":"Il n'y a aucun signalements.","summary":{"action_type_3":{"one":"hors sujet","other":"hors sujet x{{count}}"},"action_type_4":{"one":"inaproprié","other":"inaproprié x{{count}}"},"action_type_6":{"one":"personnalisé","other":"personnalisé x{{count}}"},"action_type_7":{"one":"personnalisé","other":"personnalisé x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"title":"Groupes","edit":"Editer les groupes","selector_placeholder":"ajouter des utilisateurs","name_placeholder":"Nom du groupe, sans espace, mêmes règles que pour les noms d'utilisateurs","about":"Modifier votre adhésion et les noms ici","can_not_edit_automatic":"L'adhésion au groupe est défini automatiquement, les administrateurs assignent des rôles et niveaux de confiance","delete":"Supprimer","delete_confirm":"Supprimer ce groupe ?","delete_failed":"Impossible de supprimer le groupe. Si c'est un groupe automatique il ne peut être détruit."},"api":{"generate_master":"Générer une clé principale pour l'API","none":"Il n'y a pas pour l'instant de clé pour l'API.","user":"Utilisateur","title":"API","key":"Clé","generate":"Générer une clé pour l'API","regenerate":"Regénérer une clé pour l'API","revoke":"Révoquer","confirm_regen":"Êtes-vous sûr de vouloir remplacer cette clé API avec une nouvelle?","confirm_revoke":"Êtes-vous sûr de vouloir révoquer cette clé?","info_html":"Cette clé vous permettra de créer et mettre à jour des discussions à l'aide d'appels JSON.","all_users":"Tous les utilisateurs","note_html":"Gardez cette clé \u003Cstrong\u003Esecrète\u003C/strong\u003E ! Tous les personnes qui la possède peuvent créer des messages sur ce forum au nom de n'import quel utilisateur."},"customize":{"title":"Personnaliser","long_title":"Personnalisation du site","header":"En-tête","css":"Feuille de style","mobile_header":"Entête Mobile","mobile_css":"Feuille de style Mobile","override_default":"Ne pas inclure la feuille de style par défaut","enabled":"Activé ?","preview":"prévisualiser","undo_preview":"annuler la prévisualisation","save":"Sauvegarder","new":"Nouveau","new_style":"Nouveau style","delete":"Supprimer","delete_confirm":"Supprimer cette personnalisation","about":"La personnalisation du site vous permet de modifier les feuilles de styles et en-têtes de votre site. Choisissez ou ajouter un style pour commencer l'édition."},"email":{"title":"Email","settings":"Paramètres","logs":"Journaux","sent_at":"Envoyer à","user":"Utilisateur","email_type":"Type d'email","to_address":"À l'adresse","test_email_address":"Adresse mail à tester","send_test":"Envoyer le mail de test","sent_test":"Envoyé !","delivery_method":"Moyen d'envoi","preview_digest":"Prévisualisation de l'email","preview_digest_desc":"Ceci est un outil pour prévisualiser le contenu de l'email envoyé depuis votre forum.","refresh":"Rafraîchir","format":"Format","html":"html","text":"texte","last_seen_user":"Dernière utilisateur vu :","reply_key":"Répondre"},"logs":{"title":"Journaux","action":"Action","created_at":"Créé","last_match_at":"Dernière occurence","match_count":"Occurences","ip_address":"IP","delete":"Supprimer","edit":"Modifier","save":"Enregistrer","screened_actions":{"block":"bloquer","do_nothing":"ne rien faire"},"staff_actions":{"title":"Actions des modérateurs","instructions":"Cliquez sur les pseudos et les actions pour filtrer la liste. Cliquez sur les avatars pour aller aux pages des utilisateurs.","clear_filters":"Tout Afficher","staff_user":"Membre de l'équipe des modérateurs","target_user":"Utilisateur cible","subject":"Sujet","when":"Quand","context":"Contexte","details":"Détails","previous_value":"Précédent","new_value":"Nouveau","diff":"Diff","show":"Afficher","modal_title":"Détails","no_previous":"Il n'y a pas de valeur précédente.","deleted":"Pas de nouvelle valeur. L'enregistrement a été supprimé.","actions":{"delete_user":"Supprimer l'utilisateur","change_trust_level":"Modifier le niveau de confiance","change_site_setting":"modifier les paramètres du site","change_site_customization":"Modifier la personnalisation du site","delete_site_customization":"Supprimer la personnalisation du site"}},"screened_emails":{"title":"Emails affichés","description":"Lorsque quelqu'un essaye de créé un nouveau compte, les adresses mail suivantes seront vérifiées et l'inscription sera bloquée, ou une autre action sera réalisée.","email":"Adresse mail"},"screened_urls":{"title":"URL affichées","description":"Les URL listées ici ont été utilisées dans des messages émis par des utilisateurs ayant été identifié comme spammeur.","url":"URL"},"screened_ips":{"title":"Adresses IP affichées","description":"Adresses IP sous surveillance. Utilisez \"Autoriser\" pour les ajouter à la liste blanche","delete_confirm":"Etes-vous certain de vouloir supprimer la règle pour %{ip_address}?","actions":{"block":"Bloquer","do_nothing":"Autoriser"},"form":{"label":"Nouvelle:","ip_address":"Adresse IP","add":"Ajouter"}}},"impersonate":{"title":"Se faire passer pour un utilisateur","username_or_email":"Pseudo ou adresse mail de l'utilisateur","help":"Utiliser cet outil pour usurper l'identité d'un utilisateur (développeur).","not_found":"Cet utilisateur n'a pas été trouvé.","invalid":"Désolé, vous ne pouvez pas vous faire passer pour cet utilisateur."},"users":{"title":"Utilisateurs","create":"Ajouter un administateur","last_emailed":"Derniers contacts","not_found":"Désolé cet utilisateur n'existe pas dans notre système.","active":"Actif","nav":{"new":"Nouveau","active":"Actif","pending":"En attente","admins":"Administrateurs","moderators":"Modérateurs","suspended":"Banni","blocked":"Bloqué"},"approved":"Approuvé ?","approved_selected":{"one":"Approuver l'utilisateur","other":"Approuver les {{count}} utilisateurs"},"reject_selected":{"one":"utilisateur rejeté","other":"utilisateurs rejetés ({{count}})"},"titles":{"active":"Utilisateurs actifs","new":"Nouveaux utilisateurs","pending":"Utilisateur en attente","newuser":"Utilisateurs de niveau 0 (Nouveaux utilisateurs)","basic":"Utilisateurs de niveau 1 (Utilisateurs basiques)","regular":"Utilisateurs de niveau 2 (Utilisateurs réguliers)","leader":"Utilisateurs de niveau 3 (Utilisateurs expérimentés)","elder":"Utilisateurs de niveau 4 (Utilisateurs avancés)","admins":"Administrateurs","moderators":"Modérateurs","blocked":"Utilisateurs bloqués","suspended":"Utilisateurs bannis"},"reject_successful":{"one":"Utilisateur rejeté avec succès.","other":"%{count} utilisateurs rejetés avec succès."},"reject_failures":{"one":"Utilisateur dont le rejet a échoué.","other":"%{count} utilisateurs dont le rejet a échoué."}},"user":{"suspend_failed":"Il y a eu un problème pendant le bannissement de cet utilisateur {{error}}","unsuspend_failed":"Il y a eu un problème pendant le débannissement de cet utilisateur {{error}}","suspend_duration":"Pour combien de temps voulez-vous bannir cet utilisateur ? (jours)","delete_all_posts":"Supprimer tous les messages","delete_all_posts_confirm":"Vous allez supprimer supprimer %{posts} messages et %{topics} discussions. Êtes-vous sûr ?","suspend":"Bannir","unsuspend":"Débannir","suspended":"Banni ?","moderator":"Modérateur ?","admin":"Admin ?","blocked":"Bloqué ?","show_admin_profile":"Admin","edit_title":"Editer le titre","save_title":"Sauvegarder le titre","refresh_browsers":"Forcer le rafraîchissement du navigateur","show_public_profile":"Afficher le profil public","impersonate":"Incarner","revoke_admin":"Révoquer les droits d'admin","grant_admin":"Accorder les droits d'admin","revoke_moderation":"Révoquer les droits de modération","grant_moderation":"Accorder les droits de modération","unblock":"Débloquer","block":"Bloquer","reputation":"Réputation","permissions":"Permissions","activity":"Activité","like_count":"J'aime reçus","private_topics_count":"Discussions privées","posts_read_count":"Messages lus","post_count":"Messages postés","topics_entered":"Discussions avec participation","flags_given_count":"Signalements effectués","flags_received_count":"Signalements reçus","approve":"Approuvé","approved_by":"approuvé par","approve_success":"Utilisateur approuvé et email avec les instructions d'activation envoyé.","approve_bulk_success":"Bravo! Tous les utlisateurs sélectionnés ont été approuvés et notifiés.","time_read":"Temps de lecture","delete":"Supprimer Utilisateur","delete_forbidden":{"one":"Cet utilisateur ne peut pas être supprimé s'il s'est inscrit il y a plus de %{count} jour, ou s'il a des messages. Supprimez tous ses messages avant de supprimer cet utilisateur.","other":"Cet utilisateur ne peut pas être supprimé s'il s'est inscrit il y a plus de %{count} jours, ou s'il a des messages. Supprimez tous ses messages avant de supprimer cet utilisateur."},"delete_confirm":"Êtes-vous SUR de vouloir supprimer cet utilisateur ? Cette action est définitive !","delete_and_block":"\u003Cb\u003EOui\u003C/\u003E, et \u003Cb\u003Ebloquer\u003C/b\u003E l'inscription avec cette adresse mail","delete_dont_block":"\u003Cb\u003EOui\u003C/\u003E, mais \u003Cb\u003Epermettre\u003C/b\u003E l'inscription avec cette adresse mail","deleted":"L'utilisateur a été supprimé.","delete_failed":"Il y a eu une erreur lors de la suppression de l'utilisateur. Veuillez vous assurez que tous ses messages ont bien été supprimmés avant d'essayer de supprimer l'utilisateur.","send_activation_email":"Envoyer le mail d'activation","activation_email_sent":"Un email d'activation a été envoyé.","send_activation_email_failed":"Il y a eu un problème lors du renvoi du mail d'activation. %{error}","activate":"Activer le compte","activate_failed":"Il y a eu un problème lors de l'activation du compte.","deactivate_account":"Désactive le compte","deactivate_failed":"Il y a eu un problème lors de la désactivation du compte.","unblock_failed":"Problème rencontré lors du déblocage de l'utilisateur.","block_failed":"Problème rencontré lors du blocage de l'utilisateur.","deactivate_explanation":"Un compte désactivé doit être revalidé par email.","banned_explanation":"Un utilisateur banni ne peut se connecter.","block_explanation":"Un utilisateur bloqué ne peut poster ou créer de discussions.","trust_level_change_failed":"Il y a eu un problème lors de la modification du niveau de confiance de l'utilisateur."},"site_content":{"none":"Choisissez un type de contenu afin de commencer l'édition.","title":"Contenu du site","edit":"Modifier le contenu du site"},"site_settings":{"show_overriden":"Ne montrer que ce qui a été changé","title":"Paramètres du site","reset":"rétablir par défaut","none":"rien"}}}}};
I18n.locale = 'fr';
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
// language : french (fr)
// author : John Fischer : https://github.com/jfroffice

moment.lang('fr', {
    months : "janvier_février_mars_avril_mai_juin_juillet_août_septembre_octobre_novembre_décembre".split("_"),
    monthsShort : "janv._févr._mars_avr._mai_juin_juil._août_sept._oct._nov._déc.".split("_"),
    weekdays : "dimanche_lundi_mardi_mercredi_jeudi_vendredi_samedi".split("_"),
    weekdaysShort : "dim._lun._mar._mer._jeu._ven._sam.".split("_"),
    weekdaysMin : "Di_Lu_Ma_Me_Je_Ve_Sa".split("_"),
    longDateFormat : {
        LT : "HH:mm",
        L : "DD/MM/YYYY",
        LL : "D MMMM YYYY",
        LLL : "D MMMM YYYY LT",
        LLLL : "dddd D MMMM YYYY LT"
    },
    calendar : {
        sameDay: "[Aujourd'hui à] LT",
        nextDay: '[Demain à] LT',
        nextWeek: 'dddd [à] LT',
        lastDay: '[Hier à] LT',
        lastWeek: 'dddd [dernier à] LT',
        sameElse: 'L'
    },
    relativeTime : {
        future : "dans %s",
        past : "il y a %s",
        s : "quelques secondes",
        m : "une minute",
        mm : "%d minutes",
        h : "une heure",
        hh : "%d heures",
        d : "un jour",
        dd : "%d jours",
        M : "un mois",
        MM : "%d mois",
        y : "un an",
        yy : "%d ans"
    },
    ordinal : function (number) {
        return number + (number === 1 ? 'er' : '');
    },
    week : {
        dow : 1, // Monday is the first day of the week.
        doy : 4  // The week that contains Jan 4th is the first week of the year.
    }
});

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
