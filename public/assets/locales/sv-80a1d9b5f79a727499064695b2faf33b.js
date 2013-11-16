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
MessageFormat.locale.sv = function ( n ) {
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
    })({});I18n.translations = {"sv":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"share":{"topic":"dela en länk till denna tråd","post":"dela en länk till denna tråd","close":"stäng","twitter":"dela denna länk via Twitter","facebook":"dela denna länk via Facebook","google+":"dela denna länk via Google+"},"edit":"ändra titel och kategori för denna tråd","not_implemented":"Den funktionen har inte implementerats än, tyvärr!","no_value":"Nej","yes_value":"Ja","of_value":"av","generic_error":"Tyvärr, ett fel har uppstått.","log_in":"Logga In","age":"Ålder","last_post":"Sista inlägget","admin_title":"Admin","flags_title":"Flaggningar","show_more":"visa mer","links":"Länkar","faq":"FAQ","you":"Du","or":"eller","now":"just nu","suggested_topics":{"title":"Föreslagna Trådar"},"bookmarks":{"not_logged_in":"Tyvärr måste du vara inloggad för att bokmärka inlägg.","created":"Du har bokmärkt detta inlägg.","not_bookmarked":"Du har läst detta inlägg; klicka för att bokmärka det.","last_read":"Detta är det sista inlägget du läst."},"new_topics_inserted":"{{count}} nya trådar.","show_new_topics":"Klicka för att visa.","preview":"förhandsgranska","cancel":"avbryt","save":"Spara Ändringar","saving":"Sparar...","saved":"Sparat!","user_action_descriptions":{"6":"Svar"},"user":{"profile":"Profil","title":"Användare","mute":"Dämpa","edit":"Ändra Inställningar","download_archive":"ladda ner ett arkiv med mina inlägg","private_message":"Privata Meddelanden","private_messages":"Meddelanden","activity_stream":"Aktivitet","preferences":"Inställningar","bio":"Om mig","change_password":"byt","invited_by":"Inbjuden Av","trust_level":"Pålitlighetsnivå","external_links_in_new_tab":"Öppna alla externa länkar i en ny flik","enable_quoting":"Aktivera citatsvar för markerad text","change_username":{"action":"byt","title":"Byt Användarnamn","confirm":"Det kan finnas konsekvenser till att byta ditt användarnamn. Är du helt säker på att du vill?","taken":"Tyvärr det användarnamn är taget.","error":"Det uppstod ett problem under bytet av ditt användarnamn.","invalid":"Det användarnamnet är ogiltigt. Det får bara innehålla siffror och bokstäver"},"change_email":{"action":"byt","title":"Byt E-post","taken":"Tyvärr den adressen är inte tillgänglig.","error":"Det uppstod ett problem under bytet av din e-post. Är kanske adressen redan upptagen?","success":"Vi har skickat ett mail till den adressen. Var god följ bekräftelseinstruktionerna."},"email":{"title":"E-post","instructions":"Din e-postadress kommer aldrig att visas för allmänheten.","ok":"Ser bra ut. Vi kommer maila dig för att bekräfta.","invalid":"Vad god ange en giltig e-postadress.","authenticated":"Din e-post har verifierats av {{provider}}.","frequency":"Vi kommer bara maila dig om vi inte har sett dig nyligen och du inte redan sett det vi mailar dig om."},"name":{"title":"Namn","instructions":"Den längre versionen av ditt namn; behöver inte vara unikt. Används som ett alternativt @namn och visas bara på din användarsida.","too_short":"Ditt namn är för kort.","ok":"Ditt namn ser bra ut."},"username":{"title":"Användarnamn","instructions":"Måste vara unikt, inga mellanrum. Personer kan omnämna dig som @{{username}}.","short_instructions":"Personer kan omnämna dig som @{{username}}.","available":"Ditt användarnamn är tillgängligt.","global_match":"E-posten matchar det registrerade användarnamnet.","global_mismatch":"Redan registrerat. Prova {{suggestion}}?","not_available":"Inte tillgängligt. Prova {{suggestion}}?","too_short":"Ditt användarnamn är för kort.","too_long":"Ditt användarnamn är för långt.","checking":"Kollar användarnamnets tillgänglighet...","enter_email":"Användarnamn hittat. Ange matchande e-post."},"password_confirmation":{"title":"Lösenord Igen"},"last_posted":"Senaste Inlägg","last_emailed":"Senast Mailad","last_seen":"Senast Sedd","created":"Skapad Vid","log_out":"Logga Ut","website":"Webbplats","email_settings":"E-post","email_digests":{"title":"När jag inte besöker sidan, skicka mig ett sammandrag via mail om vad som är nytt","daily":"dagligen","weekly":"veckovis","bi_weekly":"varannan vecka"},"email_direct":"Ta emot ett mail när någon citerar dig, svarar på dina inlägg, eller nämner ditt @användarnamn","email_private_messages":"Ta emot ett mail när någon skickar dig ett privat meddelande","other_settings":"Övrigt","new_topic_duration":{"label":"Betrakta trådar som nya när","not_viewed":"Jag inte har kollat på dem än","last_here":"de postades efter jag var här sist","after_n_days":{"one":"de postades det senaste dygnet","other":"de postades inom de senaste {{count}} dagarna"},"after_n_weeks":{"one":"de postades den senaste veckan","other":"de postades inom de senaste {{count}} veckorna"}},"auto_track_topics":"Följ automatiskt trådar jag besöker","auto_track_options":{"never":"aldrig","always":"alltid","after_n_seconds":{"one":"efter 1 sekund","other":"efter {{count}} sekunder"},"after_n_minutes":{"one":"efter 1 minut","other":"efter {{count}} minuter"}},"invited":{"title":"Inbjudningar","user":"Inbjuden Användare","none":"{{username}} har inte bjudit in några användare till webbplatsen.","redeemed":"Inlösta Inbjudnignar","redeemed_at":"Inlöst Vid","pending":"Avvaktande Inbjudningar","topics_entered":"Trådar Besökta","posts_read_count":"Inlägg Lästa","rescind":"Ta Bort Inbjudan","rescinded":"Inbjudan borttagen","time_read":"Lästid","days_visited":"Dagar Besökta","account_age_days":"Kontoålder i dagar"},"password":{"title":"Lösenord","too_short":"Ditt lösenord är för kort.","ok":"Ditt lösenord ser bra ut."},"ip_address":{"title":"Senaste IP-adress"},"avatar":{"title":"Profilbild"},"filters":{"all":"Alla"},"stream":{"posted_by":"Postat av","sent_by":"Skickat av","private_message":"privat meddelande","the_topic":"tråden"}},"loading":"Laddar...","close":"Stäng","learn_more":"lär dig mer...","year":"år","year_desc":"trådar postade i de senaste 365 dagarna","month":"månad","month_desc":"trådar postade i de senaste 30 dagarna","week":"vecka","week_desc":"trådar postade i de senaste 7 dagarna","first_post":"Första inlägget","mute":"Dämpa","unmute":"Avdämpa","best_of":{"title":"Bäst Av","enabled_description":"Just nu visar du \"Bäst Av\"-läget för denna tråd.","description":"Det finns \u003Cb\u003E{{count}}\u003C/b\u003E inlägg i den här tråden. Det är många! Vill du spara tid genom att byta så du bara ser de inlägg med flest interaktioner och svar?","enable":"Byt till \"Bäst Av\"-läget","disable":"Avbryt \"Bäst Av\""},"private_message_info":{"title":"Privat Konversation","invite":"Bjud In Andra..."},"email":"E-post","username":"Användarnamn","last_seen":"Senast Sedd","created":"Skapad","trust_level":"Pålitlighetsnivå","create_account":{"title":"Skapa Konto","action":"Skapa ett nu!","invite":"har du inget konto än?","failed":"Något gick fel, kanske är denna e-post redan registrerad, försök glömt lösenordslänken"},"forgot_password":{"title":"Glömt Lösenord","action":"Jag har glömt mitt lösenord","invite":"Skriv in ditt användarnamn eller e-postadress, så vi skickar dig ett mail om lösenordsåterställning.","reset":"Återställ Lösenord","complete":"Du borde få ett mail med instruktioner om hur du återställer ditt lösenord inom kort."},"login":{"title":"Logga In","username":"Inloggning","password":"Lösenord","email_placeholder":"e-postadress eller användarnamn","error":"Okänt fel","reset_password":"Återställ Lösenord","logging_in":"Loggar In...","or":"Eller","authenticating":"Autentiserar...","awaiting_confirmation":"Ditt konto väntar på aktivering, använd glömt lösenordslänken för att skicka ett nytt aktiveringsmail.","awaiting_approval":"Ditt konto har inte godkänts av en moderator än. Du kommer att få ett mail när det är godkänt.","not_activated":"Du kan inte logga in än. Vi har tidigare skickat ett aktiveringsmail till dig via \u003Cb\u003E{{sentTo}}\u003C/b\u003E. Var god följ instruktionerna i det mailet för att aktivera ditt konto.","resend_activation_email":"Klicka här för att skicka aktiveringsmailet igen.","sent_activation_email_again":"Vi har skickat ännu ett aktiveringsmail till dig via \u003Cb\u003E{{currentEmail}}\u003C/b\u003E. Det kan ta ett par minuter för det att komma fram; var noga med att kolla din skräppost.","google":{"title":"med Google","message":"Autentiserar med Google (kolla så att pop up-blockare inte är aktiverade)"},"twitter":{"title":"med Twitter","message":"Autentiserar med Twitter (kolla så att pop up-blockare inte är aktiverade)"},"facebook":{"title":"med Facebook","message":"Autentiserar med Facebook (kolla så att pop up-blockare inte är aktiverade)"},"yahoo":{"title":"med Yahoo","message":"Autentiserar med Yahoo (kolla så att pop up-blockare inte är aktiverade)"},"github":{"title":"med GitHub","message":"Autentiserar med GitHub (kolla så att pop up-blockare inte är aktiverade)"},"persona":{"title":" med Persona","message":"Autentiserar med Mozilla Persona (kolla så att pop up-blockare inte är aktiverade)"}},"composer":{"posting_not_on_topic":"Du svarar på tråden \"{{title}}\", men du besöker just nu en annan tråd.","saving_draft_tip":"sparar","saved_draft_tip":"sparat","saved_local_draft_tip":"sparat lokalt","similar_topics":"Din tråd liknar...","drafts_offline":"utkast offline","min_length":{"need_more_for_title":"{{n}} tecken kvar för titeln","need_more_for_reply":"{{n}} tecken kvar för svaret"},"save_edit":"Spara Ändring","reply_original":"Svara på Ursprungstråd","reply_here":"Svara Här","reply":"Svara","cancel":"Avbryt","create_topic":"Skapa Tråd","create_pm":"Skapa Privat Meddelande","users_placeholder":"Lägg till en användare","title_placeholder":"Skriv din titel här. Vad handlar denna diskussion om i en kort mening?","reply_placeholder":"Skriv ditt svar här. Använd Markdown eller BBCode för formatering. Dra eller klista in en bild här för att ladda upp den.","view_new_post":"Visa ditt nya inlägg.","saving":"Sparar...","saved":"Sparat!","saved_draft":"Du har ett pågående inläggsutkast. Klicka någonstans i denna ruta för att fortsätta redigera.","uploading":"Laddar upp...","show_preview":"visa förhandsgranskning \u0026raquo;","hide_preview":"\u0026laquo; dölj förhandsgranskning","bold_title":"Fet","bold_text":"fet text","italic_title":"Kursiv","italic_text":"kursiv text","link_title":"Hyperlänk","link_description":"skriv en länkbeskrivning här","link_dialog_title":"Infoga Hyperlänk","link_optional_text":"valfri titel","quote_title":"Citat","quote_text":"Citat","code_title":"Kodexempel","code_text":"skriv din kod här","upload_title":"Bild","upload_description":"skriv en bildbeskrivning här","olist_title":"Numrerad Lista","ulist_title":"Punktlista","list_item":"Listobjekt","heading_title":"Rubrik","heading_text":"Rubrik","hr_title":"Horisontell linje","undo_title":"Ångra","redo_title":"Återställ","help":"Markdown Redigeringshjälp"},"notifications":{"title":"notifikationer med omnämnanden av @namn, svar på dina inlägg och trådar, privata meddelanden, etc","none":"Du har inte notifikationer just nu.","more":"visa äldre notifikationer","mentioned":"\u003Cspan title='omnämnd' class='icon'\u003E@\u003C/span\u003E {{username}} {{link}}","quoted":"\u003Ci title='citerad' class='icon icon-quote-right'\u003E\u003C/i\u003E {{username}} {{link}}","replied":"\u003Ci title='svarad' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","posted":"\u003Ci title='svarad' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","edited":"\u003Ci title='ändrad' class='icon icon-pencil'\u003E\u003C/i\u003E {{username}} {{link}}","liked":"\u003Ci title='gillad' class='icon icon-heart'\u003E\u003C/i\u003E {{username}} {{link}}","private_message":"\u003Ci class='icon icon-envelope-alt' title='privat meddelande'\u003E\u003C/i\u003E {{username}} skickade dig ett privat meddelande: {{link}}","invited_to_private_message":"{{username}} bjöd in dig till en privat konversation: {{link}}","invitee_accepted":"\u003Ci title='accepterade din inbjudan' class='icon icon-signin'\u003E\u003C/i\u003E {{username}} accepterade din inbjudan","moved_post":"\u003Ci title='flyttade inlägg' class='icon icon-arrow-right'\u003E\u003C/i\u003E {{username}} flyttade inlägg till {{link}}"},"upload_selector":{"title":"Infoga Bild","from_my_computer":"Från Min Enhet","from_the_web":"Från Internet","remote_tip":"skriv in en adress till en bild i formen http://exempel.se/bild.jpg","local_tip":"klicka för att välja en bild från din enhet.","uploading":"Laddar upp bild"},"search":{"title":"sök efter trådar, inlägg, användare, eller kategorier","placeholder":"skriv din sökterm här","no_results":"Inga resultat hittades.","searching":"Söker ..."},"site_map":"gå till en annan trådlista eller kategori","go_back":"gå tillbaka","current_user":"gå till din användarsida","favorite":{"title":"Favorit","help":{"star":"lägg till denna tråd i din favoritlista","unstar":"ta bort denna tråd från din favoritlista"}},"topics":{"none":{"favorited":"Du har inte favoritmarkerat några trådar än. För att favoritmarkera en tråd, klicka eller tryck på stjärnan brevid titeln.","unread":"Du har inga olästa trådar att läsa.","new":"Du har inga nya trådar att läsa.","read":"Du har inte läst några trådar än.","posted":"Du har inte postat i några trådar än.","latest":"Det finns inga senaste trådar. Det är lite sorgligt.","hot":"Det finns inga heta trådar.","category":"Det finns inga {{category}}-trådar."},"bottom":{"latest":"Det finns inga fler senaste trådar att läsa.","hot":"Det finns inga fler heta trådar att läsa.","posted":"Det finns inga fler postade trådar att läsa","read":"Det finns inga fler lästa trådar att läsa.","new":"Det finns inga fler nya trådar att läsa.","unread":"Det finns inga fler oläsa trådar att läsa.","favorited":"Det finns inga fler favoritmarkerade trådar att läsa.","category":"Det finns inga fler {{category}}-trådar."}},"rank_details":{"toggle":"växla på/av trådranksdetaljer","show":"visa trådranksdetaljer","title":"Trådranksdetaljer"},"topic":{"create":"Skapa Tråd","create_long":"Skapa en nytt Tråd","private_message":"Starta en privat konversation","list":"Trådar","new":"ny tråd","title":"Tråd","loading_more":"Laddar fler Trådar...","loading":"Laddar tråd...","invalid_access":{"title":"Tråden är privat","description":"Tyvärr, du har inte behörighet till den tråden."},"server_error":{"title":"Tråden misslyckades med att ladda","description":"Tyvärr, vi kunde inte ladda den tråden, troligen p.g.a. ett anslutningsproblem. Var go försök igen. Om problemet kvarstår, låt oss gärna veta det!"},"not_found":{"title":"Tråden hittades inte","description":"Tyvärr, vi kunde inte hitta den tråden. Kanske har den tagits bort av en moderator?"},"unread_posts":"du har {{unread}} gamla olästa inlägg i den här tråden","new_posts":"det finns {{new_posts}} nya inlägg i den här tråden sen du senaste läste det","likes":{"one":"det finns 1 gillning i den här tråden","other":"det finns {{count}} gillningar i den här tråden"},"back_to_list":"Tillbaka till Trådlistan","options":"Trådinställningar","show_links":"visa länkar som finns i den här tråden","toggle_information":"slå på/av tråddetaljer","read_more_in_category":"Vill du läsa mer? Bläddra bland andra trådar i {{catLink}} eller {{latestLink}}.","read_more":"Vill du läsa mer? {{catLink}} eller {{latestLink}}.","browse_all_categories":"Bläddra bland alla kategorier","view_latest_topics":"visa senaste trådar","suggest_create_topic":"Varför inte skapa en tråd?","read_position_reset":"Din läsposition har blivit återställd.","jump_reply_up":"hoppa till tidigare svar","jump_reply_down":"hoppa till senare svar","deleted":"Tråden har raderats","progress":{"title":"trådplacering","jump_top":"hoppa till första inlägget","jump_bottom":"hoppa till sista inlägget","total":"antal inlägg","current":"nuvarande inlägg"},"notifications":{"title":"","reasons":{"3_2":"Du kommer ta emot notifikationer för att du kollar in denna tråd.","3_1":"Du kommer ta emot notifikationer för att du skapade denna tråd.","3":"Du kommer ta emot notifikationer för att du kollar in denna tråd.","2_4":"Du kommer ta emot notifikationer för att du postade ett svar till denna tråd.","2_2":"Du kommer ta emot notifikationer för att du följer denna tråd.","2":"Du kommer ta emot notifikationer för att du \u003Ca href=\"/users/{{username}}/preferences\"\u003Eläser denna tråd\u003C/a\u003E.","1":"Du kommer bara meddelandes om någon nämner ditt @namn eller svara på dina inlägg.","1_2":"Du kommer bara meddelandes om någon nämner ditt @namn eller svara på dina inlägg.","0":"Du ignorerar alla notifikationer för denna tråd.","0_2":"Du ignorerar alla notifikationer för denna tråd."},"watching":{"title":"Kollar","description":"samma som Följer, plus att du meddelas om alla nya inlägg."},"tracking":{"title":"Följer","description":"du meddelas om omnämnanden av @namn, och svar på dina inlägg, plus att du ser antal olästa och nya inlägg.."},"regular":{"title":"Vanlig","description":"du meddelas bara om någon nämner ditt @namn eller svarar på ditt inlägg."},"muted":{"title":"Dämpad","description":"du kommer inte meddelas om denna tråd alls, och den kommer inte visas i din flik med olästa."}},"actions":{"delete":"Radera Tråd","open":"Öppna Tråd","close":"Stäng Tråd","unpin":"Avnåla Tråd","pin":"Nåla Tråd","unarchive":"Dearkivera Tråd","archive":"Arkivera Tråd","invisible":"Gör Osynlig","visible":"Gör Synlig","reset_read":"Återställ Läsdata","multi_select":"Växla på/av flervalsfunktion","convert_to_topic":"Konvertera till Vanlig Tråd"},"reply":{"title":"Svara","help":"börja komponera ett svar till denna tråd"},"clear_pin":{"title":"Rensa nål","help":"Rensa den nålade statusen från denna tråd så den inte längre hamnar i toppen av din trådlista"},"share":{"title":"Dela","help":"dela en länk till denna tråd"},"inviting":"Bjuder in...","invite_private":{"title":"Bjud in till Privat Konversation","email_or_username":"Den Inbjudnas E-post eller Användarnamn","email_or_username_placeholder":"e-postadress eller användarnamn","action":"Bjud In","success":"Tack! Vi har bjudit in den användaren att delta i denna privata konversation.","error":"Tyvärr det uppstod ett fel under inbjudandet av den användaren."},"invite_reply":{"title":"Bjud in Vänner att Svara","help":"skicka inbjudningar till vänner så de kan svara i den här tråden med ett enda klick","email":"Vi skickar din vän ett kort mail så de kan svara i den här tråden genom att klicka på en länk.","email_placeholder":"e-postadress","success":"Tack! Vi har mailat ut ett inbjudan till \u003Cb\u003E{{email}}\u003C/b\u003E. Vi låter dig veta när de löst in sin inbjudan. Kolla in fliken med Inbjudningar på din användarsida för att hålla koll på vem du har bjudit in.","error":"Tyvärr vi kunde inte bjudan in den personen. Kanske är den redan en användare?"},"login_reply":"Logga In för att Svara","filters":{"user":"Du visar bara {{n_posts}} {{by_n_users}}.","n_posts":{"one":"1 inlägg","other":"{{count}} inlägg"},"by_n_users":{"one":"skapat av 1 specifik användare","other":"skapat av {{count}} specifika användare"},"best_of":"Du visar bara {{n_best_posts}} {{of_n_posts}}.","n_best_posts":{"one":"1 bästa inlägg","other":"{{count}} bästa inlägg"},"of_n_posts":{"one":"av 1 i tråden","other":"av {{count}} i tråden"},"cancel":"Visa alla inlägg i den här tråden igen."},"move_selected":{"title":"Flytta Markerade Inlägg","topic_name":"Nya Trådens Namn:","error":"Tyvärr, det uppstod ett problem under flytten av de inläggen.","instructions":{"one":"Du håller på att skapa en ny tråd och fylla den med inlägget som du markerat.","other":"Du håller på att skapa en ny tråd och fylla den med de \u003Cb\u003E{{count}}\u003C/b\u003E inlägg som du markerat."}},"multi_select":{"select":"markera","selected":"markerade ({{count}})","delete":"radera markerade","cancel":"avbryt markering","move":"flytta markerade","description":{"one":"Du har markerat \u003Cb\u003E1\u003C/b\u003E inlägg.","other":"Du har markerat \u003Cb\u003E{{count}}\u003C/b\u003E inlägg."}}},"post":{"reply":"Svarar på {{link}} av {{replyAvatar}} {{username}}","reply_topic":"Svar på {{link}}","quote_reply":"citatsvar","edit":"Ändra {{link}} av {{replyAvatar}} {{username}}","post_number":"inlägg {{number}}","in_reply_to":"som svar till","reply_as_new_topic":"Svara som ny Tråd","continue_discussion":"Fortsätter diskussionen från {{postLink}}:","follow_quote":"gå till det citerade inlägget","deleted_by_author":"(inlägg borttaget av författaren)","has_replies":{"one":"Svara","other":"Svar"},"errors":{"create":"Tyvärr, det uppstod ett fel under skapandet av ditt inlägg. Var god försök igen.","edit":"Tyvärr, det uppstod ett fel under ändringen av ditt inlägg. Var god försök igen.","upload":"Tyvärr, det uppstod ett fel under uppladdandet av den filen. Vad god försök igen.","image_too_large":"Tyvärr, filen som du försöker ladda upp är för stor (maxstorlek är {{max_size_kb}}kb), var god ändra storlek och försök igen.","too_many_uploads":"Tyvärr, du kan bara ladda upp en bild i taget."},"abandon":"Är du säker på att du vill överge ditt inlägg?","archetypes":{"save":"Spara Inställningar"},"controls":{"reply":"börja komponera ett svar till detta inlägg","like":"gilla detta inlägg","edit":"ändra detta inlägg","flag":"flagga detta inlägg för moderatorsuppmärksamhet","delete":"radera detta inlägg","undelete":"återställ detta inlägg","share":"dela en länk till detta inlägg","more":"Mer"},"actions":{"flag":"Flaga","clear_flags":{"one":"Ta bort flagga","other":"Ta bort flaggningar"},"it_too":{"off_topic":"Flagga det också","spam":"Flagga det också","inappropriate":"Flagga det också","custom_flag":"Flagga det också","bookmark":"Bokmärk det också","like":"Gilla det också","vote":"Rösta för det också"},"undo":{"off_topic":"Ångra flaggning","spam":"Ångra flaggning","inappropriate":"Ångra flaggning","custom_flag":"Ångra flaggning","bookmark":"Ångra bokmärkning","like":"Ångra gillning","vote":"Ångra röstning"},"people":{"off_topic":"{{icons}} markerade detta som off-topic","spam":"{{icons}} markerade detta som spam","inappropriate":"{{icons}} markerade detta som olämpligt","custom_flag":"{{icons}} flaggade detta","bookmark":"{{icons}} bokmärkte detta","like":"{{icons}} gillade detta","vote":"{{icons}} röstade för detta"},"by_you":{"off_topic":"Du flaggade detta som off-topic","spam":"Du flaggade detta som spam","inappropriate":"Du flaggade detta som olämpligt","custom_flag":"Du flaggade detta för moderation","bookmark":"Du bokmärkte detta inlägg","like":"Du gillade detta","vote":"Du röstade för detta inlägg"},"by_you_and_others":{"off_topic":{"one":"Du och 1 annan flaggade detta som off-topic","other":"Du och {{count}} andra personer flaggade detta som off-topic"},"spam":{"one":"Du och 1 annan flaggade detta som spam","other":"Du och {{count}} andra personer flaggade detta som spam"},"inappropriate":{"one":"Du och 1 annan flaggade detta som olämpligt","other":"Du och {{count}} andra personer flaggade detta som olämpligt"},"custom_flag":{"one":"Du och 1 annan flaggade detta för moderation","other":"Du och {{count}} andra personer flaggade detta för moderation"},"bookmark":{"one":"Du och 1 annan bokmärkte detta inlägg","other":"Du och {{count}} andra personer bokmärkte detta inlägg"},"like":{"one":"Du och 1 annan gillade detta","other":"Du och {{count}} andra personer gillade detta"},"vote":{"one":"Du och 1 annan röstade för detta inlägg","other":"Du och {{count}} andra personer röstade för detta inlägg"}},"by_others":{"off_topic":{"one":"1 person flaggade detta som off-topic","other":"{{count}} personer flaggade detta som off-topic"},"spam":{"one":"1 person flaggade detta som spam","other":"{{count}} personer flaggade detta som spam"},"inappropriate":{"one":"1 person flaggade detta som olämpligt","other":"{{count}} personer flaggade detta som olämpligt"},"custom_flag":{"one":"1 person flaggade detta för moderation","other":"{{count}} personer flaggade detta för moderation"},"bookmark":{"one":"1 person bokmärkte detta inlägg","other":"{{count}} personer bokmärkte detta inlägg"},"like":{"one":"1 person gillade detta","other":"{{count}} personer gillade detta"},"vote":{"one":"1 person röstade för detta inlägg","other":"{{count}} personer röstade för detta inlägg"}}},"edits":{"one":"1 ändring","other":"{{count}} ändringar","zero":"inga ändringar"},"delete":{"confirm":{"one":"Är du säker på att du vill radera detta inlägg?","other":"Är du säker på att du vill radera alla dessa inlägg?"}}},"category":{"none":"(ingen kategori)","edit":"ändra","edit_long":"Ändra Kategori","view":"Visa Trådar i Kategori","delete":"Radera Kategori","create":"Skapa Kategori","creation_error":"Det uppstod ett fel när kategorin skulle skapas.","more_posts":"visa alla {{posts}}...","name":"Kategorinamn","description":"Beskrivning","topic":"Kategoristråd","badge_colors":"Emblemsfärg","background_color":"Bakgrundsfärg","foreground_color":"Förgrundsfärg","name_placeholder":"Ska vara kort och koncist.","color_placeholder":"Någon webbfärg","delete_confirm":"Är du säker på att du vill radera den kategorin?","list":"Lista Kategorier","no_description":"Det finns ingen beskrivning för denna kategori.","change_in_category_topic":"besök kategorins tråd för att ändra beskrivning","hotness":"Hethet"},"flagging":{"title":"Varför flaggar du detta inlägg?","action":"Flagga Inlägg","cant":"Tyvärr, du kan inte flagga detta inlägg just nu.","custom_placeholder":"Varför kräver detta inlägg en moderators uppmärksamhet? Låt oss veta specifikt vad du är orolig för, och ta med relevanta länkar om möjligt.","custom_message":{"at_least":"skriv åtminstone {{n}} tecken","more":"{{n}} fler...","left":"{{n}} kvar"}},"topic_summary":{"title":"Trådsammanfattning","links_shown":"Visa alla {{totalLinks}} länkar..."},"topic_statuses":{"locked":{"help":"denna tråd är låst; den accepterar inte längre nya svar"},"pinned":{"help":"denna tråd är nålad; den kommer att visas högst upp i sin kategori"},"archived":{"help":"denna tråd är arkiverad; den är frusen och kan inte ändras"},"invisible":{"help":"denna tråd är osynlig; den kommer inte att visas i trådlistor, och kan endast besökas via direktlänkar"}},"posts":"Inlägg","posts_long":"{{number}} inlägg i den här tråden","original_post":"Originalinlägg","views":"Visningar","replies":"Svar","views_long":"denna tråd har visats {{number}} gånger","activity":"Aktivitet","likes":"Gillningar","top_contributors":"Deltagare","category_title":"Kategori","history":"Historik","changed_by":"av {{author}}","categories_list":"Kategorilista","filters":{"latest":{"title":"Senaste","help":"det populäraste trådarna nyligen"},"hot":{"title":"Hett","help":"ett urval av de hetaste trådarna"},"favorited":{"title":"Favoriter","help":"trådar du favoritmarkerat"},"read":{"title":"Lästa","help":"trådar du har läst, i den ordningen du senast läste dem"},"categories":{"title":"Kategorier","title_in":"Kategori - {{categoryName}}","help":"alla trådar grupperade efter kategori"},"unread":{"title":{"zero":"Olästa","one":"Olästa (1)","other":"Olästa ({{count}})"},"help":"följda trådar med olästa inlägg"},"new":{"title":{"zero":"Nya","one":"Nya (1)","other":"Nya ({{count}})"},"help":"nya trådar sen ditt senaste besök"},"posted":{"title":"Mina Inlägg","help":"trådar som du har postat i"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"senaste trådarna i {{categoryName}}-kategorin"}},"browser_update":"Tyvärr, \u003Ca href=\"http://www.discourse.org/faq/#browser\"\u003Edin webbläsare är för gammal för att fungera på detta Discourse-forum\u003C/a\u003E. Var god \u003Ca href=\"http://browsehappy.com\"\u003Euppgradera din webbläsare\u003C/a\u003E.","type_to_filter":"skriv för att filtrera...","admin":{"title":"Discourse Admin","moderator":"Moderator","dashboard":{"title":"Översiktspanel","version":"Version","up_to_date":"Du är aktuell!","critical_available":"En kritisk uppdatering är tillgänglig.","updates_available":"Uppdateringar är tillgängliga.","please_upgrade":"Var god uppgradera!","installed_version":"Installerad","latest_version":"Senaste","problems_found":"Några problem har hittas med din installation av Discourse:","moderators":"Moderatorer:","admins":"Administratörer:"},"reports":{"today":"Idag","yesterday":"Igår","last_7_days":"Senaste 7 Dagarna","last_30_days":"Senaste 30 Dagarna","all_time":"Från Början","7_days_ago":"7 Dagar Sedan","30_days_ago":"30 Dagar Sedan","all":"Alla","view_table":"Visa som Tabell","view_chart":"Visa som Stapeldiagram"},"commits":{"latest_changes":"Senaste ändringarna: snälla uppdatera ofta!","by":"av"},"flags":{"title":"Flaggningar","old":"Gamla","active":"Aktiva","clear":"Rensa Flaggningar","clear_title":"rensa alla flaggningar av detta inlägg (kommer visa gömda inlägg)","delete":"Radera Inlägg","delete_title":"radera inlägg (om det är första inlägget radera tråd)","flagged_by":"Flaggad av","error":"Någonting gick snett"},"groups":{"title":"Groups","edit":"Edit Groups","selector_placeholder":"add users","name_placeholder":"Group name, no spaces, same as username rule","about":"Edit your group membership and names here","can_not_edit_automatic":"Automatic group membership is determined automatically, administer users to assign roles and trust levels","delete":"Radera","delete_confirm":"Delete this group?","delete_failed":"Unable to delete group. If this is an automatic group, it cannot be destroyed."},"api":{"title":"API","long_title":"API Information","key":"Key","generate":"Generate API Key","regenerate":"Regenerate API Key","info_html":"Your API key will allow you to create and update topics using JSON calls.","note_html":"Keep this key \u003Cstrong\u003Esecret\u003C/strong\u003E, all users that have it may create arbitrary posts on the forum as any user."},"customize":{"title":"Anpassa","header":"Sidhuvud","css":"Stilmall","override_default":"Skriv över standard?","enabled":"Aktiverad?","preview":"förhandsgranska","undo_preview":"ångra förhandsgranskning","save":"Spara","new":"Ny","new_style":"Ny Stil","delete":"Radera","delete_confirm":"Radera denna anpassning?"},"email":{"title":"E-postloggar","sent_at":"Skickat","email_type":"E-posttyp","to_address":"Till adress","test_email_address":"e-postadress att testa","send_test":"skicka testmail","sent_test":"skickat!"},"impersonate":{"title":"Imitera Användare","username_or_email":"Användare eller E-post för Användare","help":"Använd detta verktyg för att imitera en användare i felsökningssyfte.","not_found":"Den användaren kan inte hittas.","invalid":"Tyvärr, du kan inte imitera den användaren."},"users":{"title":"Användare","create":"Lägg till Administratör","last_emailed":"Senast Mailad","not_found":"Tyvärr den användaren existerar inte i vårt system.","active":"Aktiv","nav":{"new":"Ny","active":"Aktiv","pending":"Avvaktande"},"approved":"Godkänd?","approved_selected":{"one":"godkänd användare","other":"godkänd användare ({{count}})"}},"user":{"suspend_failed":"Någonting gick fel under avstängningen av denna användare {{error}}","unsuspend_failed":"Någonting gick fel under upplåsningen av denna användare {{error}}","suspend_duration":"Hur länge vill du stänga av denna användare? (dagar)","delete_all_posts":"Radera alla inlägg","suspend":"Stäng av","unsuspend":"Lås upp","suspended":"Avstängd?","moderator":"Moderator?","admin":"Administratör?","show_admin_profile":"Administratör","refresh_browsers":"Tvinga webbläsaruppdatering","show_public_profile":"Visa Publik Profil","impersonate":"Imitera","revoke_admin":"Återkalla Administratör","grant_admin":"Bevilja Administratör","revoke_moderation":"Återkalla Moderering","grant_moderation":"Bevilja Moderering","reputation":"Rykte","permissions":"Rättigheter","activity":"Aktivitet","like_count":"Gillningar Mottagna","private_topics_count":"Antal Privata Trådar","posts_read_count":"Inlägg Lästa","post_count":"Inlägg Skapade","topics_entered":"Trådar Besökta","flags_given_count":"Givna Flaggnignar","flags_received_count":"Mottagna Flaggningar","approve":"Godkänn","approved_by":"godkänd av","time_read":"Lästid"},"site_content":{"none":"Välj typ av innehåll för att börja ändra.","title":"Sidinnehåll","edit":"Ändra sidinnehåll"},"site_settings":{"show_overriden":"Visa bara överskrivna","title":"Webbplatsinställningar","reset":"återställ till standard"}}}}};
I18n.locale = 'sv';
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
// language : swedish (sv)
// author : Jens Alm : https://github.com/ulmus

moment.lang('sv', {
    months : "januari_februari_mars_april_maj_juni_juli_augusti_september_oktober_november_december".split("_"),
    monthsShort : "jan_feb_mar_apr_maj_jun_jul_aug_sep_okt_nov_dec".split("_"),
    weekdays : "söndag_måndag_tisdag_onsdag_torsdag_fredag_lördag".split("_"),
    weekdaysShort : "sön_mån_tis_ons_tor_fre_lör".split("_"),
    weekdaysMin : "sö_må_ti_on_to_fr_lö".split("_"),
    longDateFormat : {
        LT : "HH:mm",
        L : "YYYY-MM-DD",
        LL : "D MMMM YYYY",
        LLL : "D MMMM YYYY LT",
        LLLL : "dddd D MMMM YYYY LT"
    },
    calendar : {
        sameDay: '[Idag klockan] LT',
        nextDay: '[Imorgon klockan] LT',
        lastDay: '[Igår klockan] LT',
        nextWeek: 'dddd [klockan] LT',
        lastWeek: '[Förra] dddd[en klockan] LT',
        sameElse: 'L'
    },
    relativeTime : {
        future : "om %s",
        past : "för %s sedan",
        s : "några sekunder",
        m : "en minut",
        mm : "%d minuter",
        h : "en timme",
        hh : "%d timmar",
        d : "en dag",
        dd : "%d dagar",
        M : "en månad",
        MM : "%d månader",
        y : "ett år",
        yy : "%d år"
    },
    ordinal : function (number) {
        var b = number % 10,
            output = (~~ (number % 100 / 10) === 1) ? 'e' :
            (b === 1) ? 'a' :
            (b === 2) ? 'a' :
            (b === 3) ? 'e' : 'e';
        return number + output;
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
