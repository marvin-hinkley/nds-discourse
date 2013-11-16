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
MessageFormat.locale.en = function ( n ) {
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
    })({"topic.read_more_in_category_MF" : function(){ return "Invalid Format: Plural Function not found for locale: nb_NO";} , "topic.read_more_MF" : function(){ return "Invalid Format: Plural Function not found for locale: nb_NO";}});I18n.translations = {"nb_NO":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"kB","mb":"MB","tb":"TB"}}}},"share":{"topic":"del en link til dette emnet","post":"del en link til dette innlegget","close":"lukk","twitter":"del denne linken på Twitter","facebook":"del denne linken på Facebook","google+":"del denne linken på Google+","email":"del denne linken i en email"},"edit":"rediget tittelen og kategorien til dette emnet","not_implemented":"Den egenskapen har ikkje blitt implementert enda, beklager!","no_value":"Nei","yes_value":"Ja","of_value":"av","generic_error":"Beklager, det har oppstått en feil.","log_in":"Logg Inn","age":"Alder","last_post":"Siste Innlegg","admin_title":"Admin","flags_title":"Flagg","show_more":"vis mer","links":"Links","faq":"FAQ","you":"du","or":"eller","now":"akkurat nå","read_more":"les mer","in_n_seconds":{"one":"på 1 sekund","other":"på {{count}} sekunder"},"in_n_minutes":{"one":"på 1 minutt","other":"om {{count}} minutter"},"in_n_hours":{"one":"på 1 time","other":"på {{count}} timer"},"in_n_days":{"one":"på 1 dag","other":"på {{count}} dager"},"suggested_topics":{"title":"Anbefalte Emner"},"bookmarks":{"not_logged_in":"Beklager, du må være innlogget for å bokmerke innlegg.","created":"Du har bokmerket dette innlegget.","not_bookmarked":"Du har lest dette innlegget; klikk for å bokmerke det","last_read":"Dette er det siste innlegget du har lest."},"new_topics_inserted":"{{count}} nye innlegg.","show_new_topics":"Klikk for å vise.","preview":"forhåndsvisning","cancel":"avbryt","save":"Lagre Endringer","saving":"Lagrer...","saved":"Lagret!","choose_topic":{"none_found":"Ingen emner funnet.","title":{"search":"Søk etter et emne ved navn, url eller id:","placeholder":"skriv emnetittelen her"}},"user_action":{"user_posted_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E postet \u003Ca href='{{topicUrl}}'\u003Eemnet\u003C/a\u003E","you_posted_topic":"\u003Ca href='{{userUrl}}'\u003EDu\u003C/a\u003E postet \u003Ca href='{{topicUrl}}'\u003Eemnet\u003C/a\u003E","user_replied_to_post":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E besvarte \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","you_replied_to_post":"\u003Ca href='{{userUrl}}'\u003EDu\u003C/a\u003E besvarte \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","user_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E besvarte \u003Ca href='{{topicUrl}}'\u003Eemnet\u003C/a\u003E","you_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003EDu\u003C/a\u003E besvarte \u003Ca href='{{topicUrl}}'\u003Eemnet\u003C/a\u003E","user_mentioned_user":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E nevnte \u003Ca href='{{user2Url}}'\u003E{{another_user}}\u003C/a\u003E","user_mentioned_you":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E nevnte \u003Ca href='{{user2Url}}'\u003Edeg\u003C/a\u003E","you_mentioned_user":"\u003Ca href='{{user1Url}}'\u003EDu\u003C/a\u003E nevnte \u003Ca href='{{user2Url}}'\u003E{{user}}\u003C/a\u003E","posted_by_user":"Postet av \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","posted_by_you":"Postet av \u003Ca href='{{userUrl}}'\u003Edeg\u003C/a\u003E","sent_by_user":"Sendt av \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","sent_by_you":"Sendt av \u003Ca href='{{userUrl}}'\u003Edeg\u003C/a\u003E"},"user_action_groups":{"1":"Likes Gitt","2":"Likes Mottatt","3":"Bokmerker","4":"Emner","5":"Svar gitt","6":"Svar mottatt","7":"Omtalelser","9":"Sitater","10":"Favoritter","11":"Redigeringer","12":"Sendte Elementer","13":"Innboks"},"user":{"profile":"Profile","title":"Bruker","mute":"Mute","edit":"Edit Preferences","download_archive":"last ned arkiv av mine innlegg","private_message":"Private Meldinger","private_messages":"Meldinger","activity_stream":"Aktivitet","preferences":"Preferanser","bio":"Om meg","invited_by":"Invitert Av","trust_level":"Tillitsnivå","external_links_in_new_tab":"Åpne alle eksterne linker i ny fane","enable_quoting":"Aktiver siter svar for uthevet tekst","moderator":"{{user}} er en moderator","admin":"{{user}} er en admin","change_password":{"action":"endre","success":"(email sendt)","in_progress":"(sender email)","error":"(feil)"},"change_username":{"action":"endre","title":"Endre Brukernavn","confirm":"Det kan være kosekvenser ved å endre ditt brukernavn. Er du sikker på at du vil gjøre det?","taken":"Beklager, det brukernavnet er tatt.","error":"Det skjedde en feil ved endring av ditt brukernavn.","invalid":"Det brukernavnet er ugyldig. Det kan bare inneholde nummer og bokstaver."},"change_email":{"action":"endre","title":"Endre Email","taken":"Beklager, den emailen er ikke tilgjengelig.","error":"Det skjedde en feil ved endring av din email. Kanskje den addressen allerede er i bruk?","success":"Vi har sent en email til den addressen. Vennligst følg meldingens instruksjoner for bekreftelse."},"email":{"title":"Email","instructions":"Din email vil aldri bli vist til offentligheten.","ok":"Ser bra ut. Vi sender deg en email for å bekrefte.","invalid":"Vennligst skriv inn en gyldig emailaddresse.","authenticated":"Din email har blitt autentisert av {{provider}}.","frequency":"Vi sender deg bare en email om vi ikke har sett deg nylig og du har ikke allerede sett tingen vi varslet deg om."},"name":{"title":"Naavn","instructions":"Den lange versjonen av ditt navn;  trenger ikke å være unik. Brukt for alternativ @brukernavn matching og vist bare på brukersiden din.","too_short":"Navnet ditt er for kort.","ok":"Navnet ditt ser bra ut."},"username":{"title":"Brukernavn","instructions":"Må være unikt, uten mellomrom. Folk kan nevne deg som @brukernavn.","short_instructions":"Folk kan nevne deg som @{{username}}.","available":"Ditt brukernavn er tilgjengelig.","global_match":"Email matcher det registrerte brukernavnet.","global_mismatch":"Allerede registrert. Prøv {{suggestion}}?","not_available":"Ikke tilgjengelig. Prøv {{suggestion}}?","too_short":"Ditt brukernavn er for kort.","too_long":"Ditt brukernavn er for langt.","checking":"Sjekker brukernavns tilgjengelighet...","enter_email":"Brukernavn funnet. Skriv inn matchende email."},"password_confirmation":{"title":"Passord Igjen"},"last_posted":"Siste Innlegg","last_emailed":"Sist Kontaktet","last_seen":"Sist Sett","created":"Laget Ved","log_out":"Logg Ut","website":"Webside","email_settings":"Email","email_digests":{"title":"Når jeg ikke besøker siden, send meg ett sammendrag på email om siste nytt","daily":"daglig","weekly":"ukentlig","bi_weekly":"hver andre uke"},"email_direct":"Motta en email når noen siterer deg, svarer på ditt innlegg, eller nevner ditt @brukernavn","email_private_messages":"Notta en email når noen sender deg en privat melding","other_settings":"Annet","new_topic_duration":{"label":"Anse emner som nye når","not_viewed":"Jeg har ikke sett dem ennå","last_here":"de var postet siden jeg var her sist","after_n_days":{"one":"de var postet i løpet av dagen","other":"de var postet i de siste {{count}} dagene"},"after_n_weeks":{"one":"de var postet i løpet av uken","other":"de vart postet i det siste {{count}} ukene"}},"auto_track_topics":"Følg automatisk emner jeg åpner","auto_track_options":{"never":"aldri","always":"alltid","after_n_seconds":{"one":"etter 1 sekund","other":"etter {{count}} sekunder"},"after_n_minutes":{"one":"etter 1 minutt","other":"etter {{count}} minutter"}},"invited":{"title":"invitasjoner","user":"Invitert Bruker","none":"{{username}} har ikke invitert noen brukere til siden.","redeemed":"Løs inn invitasjoner","redeemed_at":"Løst inn ved","pending":"Ventende Invitasjoner","topics_entered":"Emner Lagt Inn","posts_read_count":"Innlegg Lest","rescind":"Fjern Invitasjon","rescinded":"Invitasjon Fjernet","time_read":"Lesetid","days_visited":"Dager Besøkt","account_age_days":"Kontoalder i dager"},"password":{"title":"Passord","too_short":"Passordet ditt er for kort","ok":"Passordet ditt ser bra ut"},"ip_address":{"title":"Siste IP Addresse"},"avatar":{"title":"Profilbilde"},"filters":{"all":"Alle"},"stream":{"posted_by":"Poste av","sent_by":"Sent av","private_message":"private meldinger","the_topic":"emnet"}},"loading":"Laster...","close":"Lukk","learn_more":"lær mer...","year":"år","year_desc":"emner postet i de siste 365 dager","month":"måned","month_desc":"emner postet i de siste 30 dager","week":"uke","week_desc":"emner postet i de siste 7 dager","first_post":"Første innlegg","mute":"Demp","unmute":"Udemp","best_of":{"title":"De Beste","enabled_description":"Du er for øyeblikket i De Beste modus i dette emnet.","description":"Det er \u003Cb\u003E{{count}}\u003C/b\u003E innlegg i dette emnet. Det er mange! Will du spare tid ved å vise bare de beste innleggene?","enable":"Bytt til \"De Beste\" modus","disable":"Avslutt \"De Beste\""},"private_message_info":{"title":"Private Meldinger","invite":"Inviter Andre..."},"email":"Email","username":"Brukernavn","last_seen":"Sist Sett","created":"Laget","trust_level":"Tillitsnivå","create_account":{"title":"Lag Konto","action":"Lag en nå!","invite":"Har du ikke en konto ennå?","failed":"Something went wrong, perhaps this email is already registered, try the forgot password link"},"forgot_password":{"title":"Glemt Passord","action":"Jeg glemte mitt passord","invite":"Skriv inn ditt brukernavn eller e-postaddresse, så sender vi deg en email for å tilbakestille ditt passord.","reset":"Tilbakestill Passord","complete":"Du burde snart motta en email med instruksjoner om hvordan du kan tilbakestille ditt passord."},"login":{"title":"Logg Inn","username":"Brukernavn","password":"Passord","email_placeholder":"email addresse eller brukernavn","error":"Ukjent feil","reset_password":"Tilbakestill Passord","logging_in":"Logger Inn...","or":"Eller","authenticating":"Autentiserer...","awaiting_confirmation":"Din konto avventer aktivering. Bruk 'Glemt Passord' linken for å sende en ny emailfor aktivering.","awaiting_approval":"Din kont har ikkje blitt godkjent av en moderator enda. Du vil motta en email når den er godkjent.","not_activated":"Du kan ikke logge inn enda. Vi sente en email for aktivering til deg \u003Cb\u003E{{sentTo}}\u003C/b\u003E.. Vennligst følg instruksjonene i den emailen for å aktivere din konto.","resend_activation_email":"Klikk her for å sende emailen for aktivering igjen.","sent_activation_email_again":"Vi sendte deg enda en email for aktivering til \u003Cb\u003E{{currentEmail}}\u003C/b\u003E. Det kan ta noen minutter før den kommer fram; sørg for at du sjekker spamfolderen din.","google":{"title":"med Google","message":"Autentiserer med Google (sørg for at du tillater pop-up vindu)"},"twitter":{"title":"med Twitter","message":"Autentiserer med Twitter (sørg for at du tillater pop-up vindu)"},"facebook":{"title":"med Facebook","message":"Autentiserer med Facebook (sørg for at du tillater pop-up vindu)"},"cas":{"title":"Logg in med CAS","message":"Autentiserer med CAS (sørg for at du tillater pop-up vindu)"},"yahoo":{"title":"med Yahoo","message":"Autentiserer med Yahoo (sørg for at du tillater pop-up vindu)"},"github":{"title":"med GitHub","message":"Autentiserer med GitHub (sørg for at du tillater pop-up vindu)"},"persona":{"title":"med Persona","message":"Autentiserer med Mozilla Persona (sørg for at du tillater pop-up vindu)"}},"composer":{"posting_not_on_topic":"Du svarer på emnet \"{{title}}\", men for øyeblikket ser du på et annet emne.","saving_draft_tip":"lagrer","saved_draft_tip":"lagret","saved_local_draft_tip":"lagret lokalt","similar_topics":"Emnet ditt har likheter med...","drafts_offline":"utkast offline","min_length":{"need_more_for_title":"{{n}} igen for tittelen","need_more_for_reply":"{{n}} igjen for svaret"},"error":{"title_missing":"Tittel er obligatorisk.","title_too_short":"Tittelen må være minst {{min}} tegn lang.","title_too_long":"Tittelen må være mindre enn {{max}} tegn lang.","post_missing":"Innlegget kan ikke være tomt.","post_length":"Innlegget må være minst {{min}} tegn langt.","category_missing":"Du må velge en kategory."},"save_edit":"Lagre Endring","reply_original":"Besvar det Originale Emnet","reply_here":"Svar Her","reply":"Svar","cancel":"Avbryt","create_topic":"Lag Emne","create_pm":"Lag Privat Melding","users_placeholder":"Legg til en bruker","title_placeholder":"Skriv tittelen din her. I en kort setning, hva handler denne diskusjonen om?","reply_placeholder":"Skriv her. Bruk Markdown eller BBCode for formatering. Dra eller lim inn et bilde for å laste det opp.","view_new_post":"Set ditt nye innlegg.","saving":"Lagrer...","saved":"Lagret!","saved_draft":"Du har et innleggsutlegg i utvikling. Klikk et sted i denne boksen for å gjenoppta redigering.","uploading":"Laster opp...","show_preview":"se forhånsvisning \u0026raquo;","hide_preview":"\u0026laquo; skjul forhåndsvisning","quote_post_title":"Siter hele innlegget","bold_title":"Sterk","bold_text":"sterk tekst","italic_title":"Kursiv","italic_text":"kursiv tekst","link_title":"Hyperlink","link_description":"beskriv linken her","link_dialog_title":"Legg inn Hyperlink","link_optional_text":"valgfri tittel","quote_title":"Sitatramme","quote_text":"Sitatramme","code_title":"Kode Utsnitt","code_text":"Legg inn kode her","upload_title":"Bilde","upload_description":"beskriv bildet her","olist_title":"Nummerert Liste","ulist_title":"Kulepunkt Liste","list_item":"Listeelement","heading_title":"Overskrift","heading_text":"Overskrift","hr_title":"Horisontalt Skille","undo_title":"Angre","redo_title":"Gjenta","help":"Hjelp for redigering i Markdown","toggler":"gjem eller vis redigeringspanelet","admin_options_title":"Valgfrie emne-instillinger for ansatte","auto_close_label":"Auto-lås emnet etter:","auto_close_units":"dager"},"notifications":{"title":"notifikasjoner fra @brukernavn omtalelser, svar til dine innlegg og emner, private meldinger, osv","none":"Du har ingen notifikasjoner akkurat nå.","more":"se gamle notifikasjoner","mentioned":"\u003Cspan title='omtalt' class='icon'\u003E@\u003C/span\u003E {{username}} {{link}}","quoted":"\u003Ci title='sitert' class='icon icon-quote-right'\u003E\u003C/i\u003E {{username}} {{link}}","replied":"\u003Ci title='besvart' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","posted":"\u003Ci title='innlegg' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","edited":"\u003Ci title='redigert' class='icon icon-pencil'\u003E\u003C/i\u003E {{username}} {{link}}","liked":"\u003Ci title='likt' class='icon icon-heart'\u003E\u003C/i\u003E {{username}} {{link}}","private_message":"\u003Ci class='icon icon-envelope-alt' title='private melding'\u003E\u003C/i\u003E {{username}} {{link}}","invited_to_private_message":"\u003Ci class='icon icon-envelope-alt' title='invitert til private melding'\u003E\u003C/i\u003E {{username}} {{link}}","invitee_accepted":"\u003Ci title='accepted your invitation' class='icon icon-signin'\u003E\u003C/i\u003E {{username}} aksepterte din invitasjon","moved_post":"\u003Ci title='flyttet innlegg' class='icon icon-arrow-right'\u003E\u003C/i\u003E {{username}} flyttet til {{link}}","total_flagged":"totalt markerte innlegg"},"upload_selector":{"title":"Legg til Bilde","from_my_computer":"Fra Min Enhet","from_the_web":"Fra Nettet","remote_tip":"skriv inn addressen til et bilde, f.eks. http://example.com/image.jpg","local_tip":"klikk for å velge et bilde fra din enhet.","uploading":"Laster opp bilde"},"search":{"title":"søk etter emner, innlegg, brukere eller kategorier","placeholder":"skriv inn søkeordene dine her","no_results":"Ingen resultater funnet.","searching":"Søker ...","prefer":{"user":"søket vil foretrekke resultater av @{{username}}","category":"søket vil foretrekke resultater i {{category}}"}},"site_map":"gå til en annen emneliste eller kategori","go_back":"gå tilbake","current_user":"go til din brukerside","favorite":{"title":"Favoritt","help":{"star":"legg dette emnet til favorittlisten din","unstar":"fjern dette emnet fra favorittlisten din"}},"topics":{"none":{"favorited":"Du har ikke meket noen emner som favoritt enda. For å merke ett emne, klikk på stjernen ved siden av tittelen.","unread":"Du har ingen uleste emner å lese.","new":"Du har ingen nye emner å lese.","read":"Du har ikke lest noen emner enda.","posted":"Du har ikke postet i noen emner enda.","latest":"Det er ingen siste emner. Det er trist.","hot":"Det er ingen hotte emner.","category":"Det er ingen {{category}} emner."},"bottom":{"latest":"Det er ikke noen siste emner igjen å lese.","hot":"Det er ikke noen hotte emner igjen å lese.","posted":"Det er ikke noen postede emner igjen å lese.","read":"Det er ikke noen leste emner igjen å lese.","new":"Det er ikke noen nye emner igjen å lese.","unread":"Det er ikke noen uleste emner igjen å lese.","favorited":"Det er ikke noen favorittemner igjen å lese.","category":"Det er ikke noen {{category}} emner igjen."}},"rank_details":{"toggle":"toggle topic rank details","show":"show topic rank details","title":"Topic Rank Details"},"topic":{"create":"Lag Emne","create_long":"Lag ett nytt Emne","private_message":"Start enn private melding","list":"Emner","new":"nytt emne","title":"Emne","loading_more":"Laster flere emner","loading":"Behandler emnet...","invalid_access":{"title":"Emnet er privat","description":"Beklager, du har ikke tilgang til det emnet!"},"server_error":{"title":"Emnet kunne ikke bli behandlet","description":"Beklager, vi kunne ikke behanldle det emnet, muligens på grunn av et tilkoblingsproblem. Vennligst prøv igjen. Om problemet vedvarer, fortell oss."},"not_found":{"title":"Emnet kunne ikke bli funnet","description":"Beklager, vi kunne ikke finne det emnet. Kanskjer det ble fjernet av en moderator?"},"unread_posts":"du har {{unread}} gamle uleste innlett i dette emnet","new_posts":"det er {{new_posts}} nye innlegg i dette emnet siden du sist leste det","likes":{"one":"det er 1 like i dette emnet","other":"det er {{count}} likes i dette emnet"},"back_to_list":"Tilbake til Emnelisten","options":"Valg for Emner","show_links":"vis linker i dette emnet","toggle_information":"vis/skjul emnedetaljer","read_more_in_category":"Vil du lese mer? Bla gjennom andre emner i {{catLink}} eller {{latestLink}}.","read_more":"Vil du lese mer? {{catLink}} eller {{latestLink}}.","browse_all_categories":"Se alle kategorier","view_latest_topics":"se siste emner","suggest_create_topic":"Hvorfor ikke lage ett emne?","read_position_reset":"Din leseposisjon har blitt tilbakestilt.","jump_reply_up":"hopp til tidligere svar","jump_reply_down":"hopp til siste svar","deleted":"Emnet har blitt slettet","auto_close_notice":"Dette emnet vil automatisk lukkes %{timeLeft}.","auto_close_title":"Auto-Lukk Innstillinger","auto_close_save":"Lagre","auto_close_cancel":"Avbryt","auto_close_remove":"Ikke Auto-Lukk Dette Emnet","progress":{"title":"emnefrangang","jump_top":"hopp til første innlegg","jump_bottom":"hopp til siste innlegg","total":"innlegg totalt","current":"gjeldende innlegg"},"notifications":{"title":"","reasons":{"3_2":"Du vil motta notifikasjoner fordi iaktar dette emnet.","3_1":"Du vil motta notifikasjoner fordi du laget dette emnet.","3":"Du vil motta notifikasjoner fordi du iaktar dette emnet.","2_4":"Du vil motta notifikasjoner fordi du svarte på dette emnet.","2_2":"Du vil motta notifikasjoner fordi følger dette emnet.","2":"Du vil motta notifikasjoner fordi du \u003Ca href=\"/users/{{username}}/preferences\"\u003Eread this topic\u003C/a\u003E.","1":"Du vil bli varslet bare om noen nevner ditt @brukernavn eller svarer på ditt innlegg.","1_2":"Du vil bli varslet bare om noen nevner ditt @brukernavn eller svarer på ditt innlegg.","0":"Du ignorerer alle varslinger på dette emnet.","0_2":"Du ignorerer alle varslinger på dette emnet."},"watching":{"title":"Iaktar","description":"samme som å Følge, pluss at du vil bli varslet om alle nye innlegg."},"tracking":{"title":"Følger","description":"du vil bli varslet om @brukernavn henvendelser svar til dine innlegg, pluss at du vil se et antall uleste og nye innlegg."},"regular":{"title":"Vanlig","description":"du vil bli varslet bare om noen nevner ditt @brukernavn eller svarer på ditt innlegg."},"muted":{"title":"Dempet","description":"du vil ikke bli varslet om noen ting i dette emnet, og  det vil ikke visest som ulest."}},"actions":{"delete":"Slett Emne","open":"Åpne Emne","close":"Lukk Emne","auto_close":"Auto-Lukk","unpin":"Løsgjør Emne","pin":"Fastsett Emne","unarchive":"Uarkiver Emne","archive":"Arkiver Emne","invisible":"Gjør Usynlig","visible":"Gjør Synlig","reset_read":"Tilbakestill Lesedata","multi_select":"Velg for Sammenslåing/Oppdeling","convert_to_topic":"Konverter til Vanlig Emne"},"reply":{"title":"Svar","help":"begynn å skrive et svar til dette emnet"},"clear_pin":{"title":"Løsgjør Emne","help":"Løsgjør fastsatt-statusen til dette emnet så det ikke lenger visest på toppen av din emneliste."},"share":{"title":"Del","help":"del en link til dette emnet"},"inviting":"Inviterer...","invite_private":{"title":"Inviter til Privat Melding","email_or_username":"Invitertes email eller brukernavn.","email_or_username_placeholder":"email eller brukernavn.","action":"Inviter","success":"Takk! Vi har invitert den personen til å delta i denne private meldingen.","error":"Beklager, det oppstod en feil ved å invitere den brukeren."},"invite_reply":{"title":"Inviter Venner til å Svare","action":"Email Invitasjon","help":"send invitasjoner til venner så de kan svare på dette emnet med et enkelt klikk","email":"We sender en kort email til vennen din, så de kan svare på dette emnet ved å følge en link.","email_placeholder":"email","success":"Takk! Vi har sendt ut en invitasjon til \u003Cb\u003E{{email}}\u003C/b\u003E. Vi vil varsle deg når de følger opp din invitasjon. Sjekk 'invitasjoner' fanen på brukersiden din for en oversikt over hvem du har invitert.","error":"Beklager, vi kunne ikke invitere den personen. Kanskje de allerede er en bruker?"},"login_reply":"Logg Inn for å Svare","filters":{"user":"Du ser bare på {{n_posts}} {{by_n_users}}.","n_posts":{"one":"1 innlegg","other":"{{count}} innlegg"},"by_n_users":{"one":"skrevet av 1 spesifikk bruker","other":"skrevet av {{count}} spesifikke brukere"},"best_of":"Du ser på {{n_best_posts}} {{of_n_posts}}.","n_best_posts":{"one":"1 beste innlegg","other":"{{count}} beste innlegg"},"of_n_posts":{"one":"av 1 i emnet","other":"av {{count}} i emnet"},"cancel":"Vis alle innlegg i dette emnet igjen."},"split_topic":{"title":"Del opp Emne","action":"del opp emne","topic_name":"Nytt Emnenavn:","error":"Det oppsto en feil ved deling av dette emnet.","instructions":{"one":"Du er i gang med å lage ett nytt emne basert på innlegget du har valgt..","other":"Du er i gang med å lage ett nytt emne basert på \u003Cb\u003E{{count}}\u003C/b\u003E innlegg du har valgt."}},"merge_topic":{"title":"Slå sammen Emne","action":"slå sammen emne","error":"Det oppsto en feil ved sammenslåing av dette emnet.","instructions":{"one":"Vennligst velg det emnet du vil flytte det innlegget til.","other":"Vennligst velg emnet du vil flytte de \u003Cb\u003E{{count}}\u003C/b\u003E innleggene til."}},"multi_select":{"select":"velg","selected":"valgte ({{count}})","delete":"fjern valgte","cancel":"avbryt valg","description":{"one":"Du har valgt \u003Cb\u003E1\u003C/b\u003E innlegg.","other":"Du har valgt \u003Cb\u003E{{count}}\u003C/b\u003E innlegg."}}},"post":{"reply":"Svarer på {{link}} av {{replyAvatar}} {{username}}","reply_topic":"Svar til {{link}}","quote_reply":"siter svar","edit":"Redigerer {{link}} av {{replyAvatar}} {{username}}","post_number":"post {{number}}","in_reply_to":"i svar til","reply_as_new_topic":"Svar som et nytt Emne","continue_discussion":"Fortsetter diskusjonen fra {{postLink}}:","follow_quote":"gå til det siterte innlegget","deleted_by_author":"(innlegg fjernet av forfatter)","expand_collapse":"utvid/vis","has_replies":{"one":"Svar","other":"Svar"},"errors":{"create":"Beklager, det oppstod en feil ved å publisere ditt innlegg. Vennligst prøv igjen.","edit":"Beklager, det oppstod en feil ved redigeringen av ditt innlegg. Vennligst prøv igjen.","upload":"Sorry, there was an error uploading that file. Please try again.","image_too_large":"Beklager, filen du prøve å laste opp er for stor (maks størrelse er {{max_size_kb}}kb), vennligst reduser størrelsen og prøv igjen.","too_many_uploads":"Beklager, du kan bare laste opp ett bilde om gangen."},"abandon":"Er du sikker på at du vil forlate innlegget ditt?","archetypes":{"save":"Lagre Alternativene"},"controls":{"reply":"begynn å skrive et svar til dette innlegget","like":"lik dette innlegget","edit":"rediger dette innlegget","flag":"marker dette innlegget for oppmerksomhet eller send en varsling om det","delete":"slett dette innlegget","undelete":"gjenopprett dette innlegget","share":"del en link til dette innlegget","more":"Mer"},"actions":{"flag":"Markering","clear_flags":{"one":"Fjern markering","other":"Fjern markeringer"},"it_too":{"off_topic":"Marker det også","spam":"Marker det også","inappropriate":"Marker det også","custom_flag":"Marker det også","bookmark":"Bokmerk det også","like":"Lik det også","vote":"Stem for det også"},"undo":{"off_topic":"Angre markering","spam":"Angre markering","inappropriate":"Angre markering","bookmark":"Angre bokmerke","like":"Angre like","vote":"Angre stemme"},"people":{"off_topic":"{{icons}} markerte dette som urelevant","spam":"{{icons}} markerte dette som spam","inappropriate":"{{icons}} markerte dette som upassende","notify_moderators":"{{icons}} varslet moderatorene","notify_moderators_with_url":"{{icons}} \u003Ca href='{{postUrl}}'\u003Evarslet moderatorene\u003C/a\u003E","notify_user":"{{icons}} send en private melding","notify_user_with_url":"{{icons}} sendte en \u003Ca href='{{postUrl}}'\u003Eprivat melding\u003C/a\u003E","bookmark":"{{icons}} bokmerket dette","like":"{{icons}} likte dette","vote":"{{icons}} stemte for dette"},"by_you":{"off_topic":"Du markerte dette som urelevant","spam":"Du markerte dette som spam","inappropriate":"Du markerte dette som upassende","notify_moderators":"Du markerte dette for moderering","notify_user":"Du sendte en private melding til denne brukeren","bookmark":"Du bokmerket dette innlegget","like":"Du likte dette","vote":"Du stemte for dette innlegget"},"by_you_and_others":{"off_topic":{"one":"Du og 1 annen markerte dette som urelevant","other":"Du og {{count}} andre markerte dette som urelevant"},"spam":{"one":"Du og 1 annen markerte dette som spam","other":"Du og {{count}} andre markerte dette som spam"},"inappropriate":{"one":"Du og 1 annen markerte dette som upassende","other":"Du og {{count}} andre markerte dette som upassende"},"notify_moderators":{"one":"Du og 1 annen markerte dette for moderering","other":"Du og {{count}} andre markerte dette for moderering"},"notify_user":{"one":"Du og 1 annen sendte en privat melding til denne brukeren","other":"Du og {{count}} andre sendte en privat melding til denne brukeren"},"bookmark":{"one":"Du og 1 annen bokmerket dette innlegget","other":"Du og {{count}} andre bokmerket dette innlegget"},"like":{"one":"Du og 1 annen likte dette","other":"Du og {{count}} andre likte dette"},"vote":{"one":"Du og 1 annen stemte på dette innlegget","other":"Du og {{count}} andre stemte på dette innlegget"}},"by_others":{"off_topic":{"one":"1 bruker markerte dette som urelevant","other":"{{count}} brukere markerte dette som urelevant"},"spam":{"one":"1 bruker markerte dette som spam","other":"{{count}} brukere markerte dette som spam"},"inappropriate":{"one":"1 bruker markerte dette som upassende","other":"{{count}} brukere markerte dette som upassende"},"notify_moderators":{"one":"1 bruker markerte dette for moderering","other":"{{count}} brukere markerte dette for moderering"},"notify_user":{"one":"1 bruker sendte en privat melding til denne brukeren","other":"{{count}} brukere sendte en privat melding til denne brukeren"},"bookmark":{"one":"1 bruker bokmerket dette innlegget","other":"{{count}} brukere bokmerket dette innlegget"},"like":{"one":"1 bruker likte dette","other":"{{count}} brukere likte dette"},"vote":{"one":"1 bruker stemte på dette innlegget","other":"{{count}} brukere stemte på dette innlegget"}}},"edits":{"one":"1 redigering","other":"{{count}} redigeringer","zero":"ingen redigeringer"},"delete":{"confirm":{"one":"Er du sikker på at du vil slette det innlegget?","other":"Er du sikker på at du vil slette alle de innleggene?"}}},"category":{"none":"(no category)","edit":"rediger","edit_long":"Rediger Kategori","view":"Se Emner i Kategori","general":"Generellt","settings":"Innstillinger","delete":"Slett Kategori","create":"Lag Kategori","save":"Lagre Kategori","creation_error":"Det oppstod en feil ved å lage denne kategorien.","save_error":"Det oppstod en feil ved lagrinen av denne kategorien.","more_posts":"se alle {{posts}}...","name":"Kategorinavn","description":"Beskrivelse","topic":"kategori emne","badge_colors":"Badge colors","background_color":"Bakgrunnsfarge","foreground_color":"Forgrunnsfarge","name_placeholder":"Bør være kortfattet.","color_placeholder":"Enhver webfarge","delete_confirm":"Er du sikker på at du vil slette denne kategorien?","delete_error":"Det oppstod en feil ved å slette denne kategorien.","list":"List Kategorier","no_description":"Det er ingen beskrivelse på denne kategorien.","change_in_category_topic":"Rediger Beskrivelse","hotness":"Temperatur","already_used":"Denne fargen er i bruk av en annen kategori","is_secure":"Sikker kategori?","add_group":"Legg til Gruppe","security":"Sikkerhet","allowed_groups":"Tillatte Grupper:","auto_close_label":"Auto-lukk Emner Etter:"},"flagging":{"title":"Hvorfor markerer du dette innlegget?","action":"Market Innlegg","take_action":"Ta Handling","notify_action":"Varsle","cant":"Beklager, du kan ikke markere dette innlettet nå.","custom_placeholder_notify_user":"Hvorfor krever dette innlegget at du snakker til denne brukeren privat og direkte? Vær presis og  høfflig.","custom_placeholder_notify_moderators":"Hvorfor krever dette innlegget oppmerksomheten til en moderator? La oss vite nøyaktig hva du er bekymret over og del all relevant informasjon og linker.","custom_message":{"at_least":"skriv minst {{n}} bokstaver","more":"{{n}} igjen...","left":"{{n}} gjenstående"}},"topic_summary":{"title":"Emneoppsummering","links_shown":"vis alle {{totalLinks}} linker...","clicks":"klikk","topic_link":"emnelink"},"topic_statuses":{"locked":{"help":"dette emnet er låst; det aksepterer ikke lenger nye svar"},"pinned":{"help":"dette emnet er fastsatt; det vil visest på toppen av sin kategori"},"archived":{"help":"dette emnet er arkivert; det er fryst og kan ikke bli aktivert"},"invisible":{"help":"dette emnet er usynlig; det blir ikke vist i emnelister, og kan bare bli åpnet via en direkte link"}},"posts":"Innlegg","posts_long":"{{number}} innlegg i dette emnet","original_post":"Originalt Innlegg","views":"Seere","replies":"Svar","views_long":"dette emnet har blit sett {{number}} ganger","activity":"Aktivitet","likes":"Likes","top_contributors":"Deltakere","category_title":"Kategori","history":"Historie","changed_by":"av {{author}}","categories_list":"Kategoriliste","filters":{"latest":{"title":"Nye","help":"de nyeste emnene"},"hot":{"title":"Hot","help":"en seleksjon av de hotteste emnene"},"favorited":{"title":"Favorisert","help":"emner du har markert som favoritter"},"read":{"title":"Lest","help":"emner du har lest, i den rekkefølgen du har lest dem"},"categories":{"title":"Kategorier","title_in":"Kategori - {{categoryName}}","help":"alle emner sortert etter kategori"},"unread":{"title":{"zero":"Ulest","one":"Ulest (1)","other":"Ulest ({{count}})"},"help":"følgte emner med uleste innlegg"},"new":{"title":{"zero":"Ny","one":"Ny (1)","other":"Ny ({{count}})"},"help":"nye emner siden ditt siste besøk"},"posted":{"title":"Mine Innlegg","help":"emner du har postet i"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"siste emner i {{categoryName}}-kategorien"}},"browser_update":"Desverre,\u003Ca href=\"http://www.discourse.org/faq/#browser\"\u003Enettleseren din er for gammel for  å fungere med Discourse\u003C/a\u003E. Vennligst \u003Ca href=\"http://browsehappy.com\"\u003Eoppgrader\u003C/a\u003E.","type_to_filter":"skriv for å filtrere...","admin":{"title":"Discourse Admin","moderator":"Moderator","dashboard":{"title":"Dashbord","version":"Versjon","up_to_date":"Du har den seneste versjonen!","critical_available":"En kritisk oppdatering er tilgjengelig.","updates_available":"Oppdateringer er tilgjengelig.","please_upgrade":"Vennligst oppgrader!","installed_version":"Installert","latest_version":"Seneste","problems_found":"Det har oppstått noen problemer med din installasjon av Discourse:","last_checked":"Sist sjekket","refresh_problems":"Last inn siden på nytt","no_problems":"Ingen problemer ble funnet.","moderators":"Moderatorer:","admins":"Adminer:","private_messages_short":"PMer","private_messages_title":"Private Meldinger","reports":{"today":"I dag","yesterday":"I går","last_7_days":"Siste 7 Dager","last_30_days":"Siste 30 Dager","all_time":"All Tid","7_days_ago":"7 Dager Siden","30_days_ago":"30 Dager Siden","all":"Alle","view_table":"Se som Tabell","view_chart":"Se som Stolpediagram"}},"commits":{"latest_changes":"Siste endringer: Vennligst oppgrader ofte!","by":"av"},"flags":{"title":"Markeringer","old":"Gamle","active":"Aktive","clear":"Fjern Markeringer","clear_title":"avvis alle markeringer på dette innlegget (vil gjenopprette skjulte innlegg)","delete":"Slett Innlegg","delete_title":"slett innlegg (hvis det er det første innlegget, slett hele emnet)","flagged_by":"Markert av","error":"Noe gikk galt","view_message":"Svar"},"groups":{"title":"Grupper","edit":"Rediger Grupper","selector_placeholder":"legg til brukere","name_placeholder":"Gruppenavn, ingen mellomrom, samme som reglene for brukernavn","about":"Edit your group membership and names here","can_not_edit_automatic":"Automatic group membership is determined automatically, administer users to assign roles and trust levels","delete":"Slett","delete_confirm":"Slette denne grupper?","delete_failed":"Unable to delete group. If this is an automatic group, it cannot be destroyed."},"api":{"title":"API","long_title":"API Informasjon","key":"Nøkkel","generate":"Generer API Nøkkel","regenerate":"Regenerer API Nøkkel","info_html":"Din API nøkkel vil tillate deg å lage og oppdatere emner ved å bruke JSON samteler.","note_html":"Bevar denne nøkkelen \u003Cstrong\u003Ehemmelig\u003C/strong\u003E. Alle brukere som har den kan lage nye innlegg som hvilken som helst bruker på forumet."},"customize":{"title":"Tilpasse","long_title":"Sidetilpassninger","header":"Header","css":"Stilark","override_default":"Ikke inkluder standard stilark","enabled":"Aktivert?","preview":"forhåndsvisning","undo_preview":"avbryt forhåndsvisning","save":"Lagre","new":"Ny","new_style":"Ny Stil","delete":"Slett","delete_confirm":"Slett denne tilpasningen?","about":"Sidetilpasning lar deg endre silark og headers på siden. Velg eller legg til en for å starte redigeringen."},"email_logs":{"title":"Email","sent_at":"Sendt","email_type":"Email Type","to_address":"Til Addresse","test_email_address":"email for å teste","send_test":"send test email","sent_test":"sendt!"},"impersonate":{"title":"Gi deg ut for å være en annen Bruker","username_or_email":"Brukernavn eller Email til bruker","help":"Bruk dette verktøyet for å bruke en annen bruker's konto for debugging.","not_found":"Den brukeren kunne ikke bli funnet.","invalid":"Beklager, du kan ikke gi deg ut for å være den brukeren."},"users":{"title":"Brukere","create":"Legg til Admin Bruker","last_emailed":"Sist Kontaktet via Email","not_found":"Beklager, det brukernavner eksisterer ikke i systemet vårt.","active":"Aktiv","nav":{"new":"Ny","active":"Aktiv","pending":"Ventende"},"approved":"Godkjent?","approved_selected":{"one":"godkjenn bruker","other":"godkjenn brukere ({{count}})"},"titles":{"active":"Aktive Brukere","new":"Nye Brukere","pending":"Brukere som venter på evaluering","newuser":"Brukere på tillitsnivå 0 (Ny Bruker)","basic":"Brukere på tillitsnivå 1 (Grunnleggende Bruker)","regular":"Brukere på tillitsnivå 2 (Ordinær Bruker)","leader":"Brukere på tillitsnivå 3 (Leder)","elder":"Brukere på tillitsnivå 4 (Eldre)","admins":"Admins","moderators":"Moderatorer"}},"user":{"suspend_failed":"Noe gikk galt ved å bannlyse denne brukeren {{error}}","unsuspend_failed":"Noe gikk galt ved å gjeninsette denne brukeren {{error}}","suspend_duration":"Hvor lenge vil du bannlyse denne brukeren? (dager)","delete_all_posts":"Slett alle innlegg","suspend":"Bannlyst","unsuspend":"Gjeninnsett\"","suspended":"Banlyst?","moderator":"Moderator?","admin":"Admin?","show_admin_profile":"Admin","refresh_browsers":"Tving nettleser refresh","show_public_profile":"Vis Offentlig Profil","impersonate":"Gi deg ut for å være en annen","revoke_admin":"Tilbakedra Admin","grant_admin":"Innfri Admin","revoke_moderation":"Tilbakedra Moderering","grant_moderation":"Innfri Moderering","reputation":"Rykte","permissions":"Tillatelser","activity":"Aktivitet","like_count":"Likes Mottatt","private_topics_count":"Private Emner","posts_read_count":"Innlegg Lest","post_count":"Innlegg Skrevet","topics_entered":"Emner Opprettet","flags_given_count":"Markeringer Gitt","flags_received_count":"Markeringer Mottatt","approve":"Godta","approved_by":"Godtatt Av","time_read":"Lesetid","delete":"Slett Bruker","delete_forbidden":"Denne brukeren kan ikke bli slettet fordi den har fortsatt innlett. Slett alle brukerens innlegg først.","delete_confirm":"Er du HELT SIKKER på at du vil slette denne brukeren fra siden? Denne handlingen er permanent.","deleted":"Brukeren ble slettet.","delete_failed":"Det oppstod en feil ved slettingen av den brukeren. Sørg for at alle av brukerens innlegg er slettet før du prøver å slette brukeren.","send_activation_email":"Send Aktiveringsemail","activation_email_sent":"En aktiveringsemail har blitt sendt.","send_activation_email_failed":"Det oppstod et problem ved sendingen av enda en aktiveringsemail.","activate":"Aktiver Konto","activate_failed":"Det oppstod et problem ved aktiveringen av den brukeren.","deactivate_account":"Deaktiver Konto","deactivate_failed":"Det oppstod et problem ved deaktiveringen av den brukeren."},"site_content":{"none":"Velg et type innhold du vil begynne å redigere.","title":"Innhold","edit":"Rediger Sideinnhold"},"site_settings":{"show_overriden":"Bare vis overstyrte","title":"Innstillinger","reset":"tilbakestill til standard"}}}}};
I18n.locale = 'nb_NO';
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
// language : norwegian bokmål (nb)
// author : Espen Hovlandsdal : https://github.com/rexxars

moment.lang('nb_NO', {
    months : "januar_februar_mars_april_mai_juni_juli_august_september_oktober_november_desember".split("_"),
    monthsShort : "jan_feb_mar_apr_mai_jun_jul_aug_sep_okt_nov_des".split("_"),
    weekdays : "søndag_mandag_tirsdag_onsdag_torsdag_fredag_lørdag".split("_"),
    weekdaysShort : "søn_man_tir_ons_tor_fre_lør".split("_"),
    weekdaysMin : "sø_ma_ti_on_to_fr_lø".split("_"),
    longDateFormat : {
        LT : "HH:mm",
        L : "YYYY-MM-DD",
        LL : "D MMMM YYYY",
        LLL : "D MMMM YYYY LT",
        LLLL : "dddd D MMMM YYYY LT"
    },
    calendar : {
        sameDay: '[I dag klokken] LT',
        nextDay: '[I morgen klokken] LT',
        nextWeek: 'dddd [klokken] LT',
        lastDay: '[I går klokken] LT',
        lastWeek: '[Forrige] dddd [klokken] LT',
        sameElse: 'L'
    },
    relativeTime : {
        future : "om %s",
        past : "for %s siden",
        s : "noen sekunder",
        m : "ett minutt",
        mm : "%d minutter",
        h : "en time",
        hh : "%d timer",
        d : "en dag",
        dd : "%d dager",
        M : "en måned",
        MM : "%d måneder",
        y : "ett år",
        yy : "%d år"
    },
    ordinal : '%d.',
    week : {
        dow : 1, // Monday is the first day of the week.
        doy : 4  // The week that contains Jan 4th is the first week of the year.
    }
});

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
