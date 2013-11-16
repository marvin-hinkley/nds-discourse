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
MessageFormat.locale.pt_BR = function ( n ) {
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
r += "Há ";
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
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
}});I18n.translations = {"pt_BR":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"tiny":{"half_a_minute":"\u003C 1m","less_than_x_seconds":{"one":"\u003C 1s","other":"\u003C %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003C 1m","other":"\u003C %{count}m"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1y","other":"%{count}y"},"over_x_years":{"one":"\u003E 1y","other":"\u003E %{count}y"},"almost_x_years":{"one":"1y","other":"%{count}y"}},"medium":{"x_minutes":{"one":"1 minuto","other":"%{count} minutos"},"x_hours":{"one":"1 hora","other":"%{count} horas"},"x_days":{"one":"1 dia","other":"%{count} dias"}},"medium_with_ago":{"x_minutes":{"one":"1 minuto atrás","other":"%{count} minutos atrás"},"x_hours":{"one":"1 hora atrás","other":"%{count} horas atrás"},"x_days":{"one":"1 dia atrás","other":"%{count} dias atrás"}}},"share":{"topic":"compartilhe um link para este tópico","post":"compartilhe um link para esta mensagem","close":"fechar","twitter":"compartilhe este link no Twitter","facebook":"compartilhe este link no Facebook","google+":"compartilhe este link no Google+","email":"enviar este link em um email"},"edit":"edite o título ou a categoria deste tópico","not_implemented":"Essa característica ainda não foi implementada, desculpe!","no_value":"Não","yes_value":"Sim","of_value":"de","generic_error":"Pedimos desculpa, ocorreu um erro.","generic_error_with_reason":"Ocorreu um erro: %{error}","log_in":"Entrar","age":"Idade","last_post":"Último post","joined":"Entrou","admin_title":"Admin","flags_title":"Sinalizações","show_more":"mostrar mais","links":"Links","faq":"FAQ","privacy_policy":"Política de Privacidade","mobile_view":"Mobile View","desktop_view":"Desktop View","you":"Você","or":"ou","now":"agora","read_more":"leia mais","more":"Mais","less":"Menos","never":"nunca","daily":"diariamente","weekly":"semanalmente","every_two_weeks":"every two weeks","character_count":{"one":"{{count}} caracteres","other":"{{count}} caracteres"},"in_n_seconds":{"one":"em 1 segundo","other":"em {{count}} segundos"},"in_n_minutes":{"one":"em 1 minuto","other":"em {{count}} minutos"},"in_n_hours":{"one":"em 1 hora","other":"em {{count}} horas"},"in_n_days":{"one":"em 1 dia","other":"em {{count}} dias"},"suggested_topics":{"title":"Tópicos Sugeridos"},"bookmarks":{"not_logged_in":"Desculpe, você precisa entrar na sua conta para adicionar um marcador às mensagens.","created":"Você adicionou um marcador a esta mensagem.","not_bookmarked":"Você leu esta mensagem, clique para adicionar um marcador para ela.","last_read":"Esta é a última postagem que você leu; clique para adicionar um marcador para ela."},"new_topics_inserted":"{{count}} novos tópicos.","show_new_topics":"Clique para mostrar.","preview":"prever","cancel":"cancelar","save":"Gravar Alterações","saving":"Gravando...","saved":"Guardado!","upload":"Upload","uploading":"Enviando...","uploaded":"Enviado!","choose_topic":{"none_found":"Nenhum tópico encontrado.","title":{"search":"Procurar Tópico pelo nome, url ou id:","placeholder":"digite o título do tópico aqui"}},"user_action":{"user_posted_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E postou \u003Ca href='{{topicUrl}}'\u003Eo tópico\u003C/a\u003E","you_posted_topic":"\u003Ca href='{{userUrl}}'\u003EVocê\u003C/a\u003E postou \u003Ca href='{{topicUrl}}'\u003Eo tópico\u003C/a\u003E","user_replied_to_post":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E respondeu \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","you_replied_to_post":"\u003Ca href='{{userUrl}}'\u003EVocê\u003C/a\u003E respondeu a \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","user_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E respondeu ao \u003Ca href='{{topicUrl}}'\u003Etópico\u003C/a\u003E","you_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003EVocê\u003C/a\u003E respondeu ao \u003Ca href='{{topicUrl}}'\u003Etópico\u003C/a\u003E","user_mentioned_user":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E mencionou \u003Ca href='{{user2Url}}'\u003E{{another_user}}\u003C/a\u003E","user_mentioned_you":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E mencionou \u003Ca href='{{user2Url}}'\u003Evocê\u003C/a\u003E","you_mentioned_user":"\u003Ca href='{{user1Url}}'\u003EVocê\u003C/a\u003E mencionou \u003Ca href='{{user2Url}}'\u003E{{user}}\u003C/a\u003E","posted_by_user":"Postado por \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","posted_by_you":"Postado por \u003Ca href='{{userUrl}}'\u003Evocê\u003C/a\u003E","sent_by_user":"Enviado por \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","sent_by_you":"Enviado por \u003Ca href='{{userUrl}}'\u003Evocê\u003C/a\u003E"},"user_action_groups":{"1":"Curtidas dadas","2":"Curtidas recebidos","3":"Guardados","4":"Tópicos","5":"Postagens","6":"Respostas","7":"Menções","9":"Citações","10":"Favoritos","11":"Edições","12":"Itens Enviados","13":"Caixa de Entrada"},"categories":{"category":"Categoria","posts":"Posts","topics":"Tópicos","latest":"Mais recente","latest_by":"mais recente por"},"user":{"said":"{{username}} postou:","profile":"Perfil","show_profile":"Visitar Perfil","mute":"Silenciar","edit":"Editar Preferências","download_archive":"fazer o download do arquivo das minhas mensagens","private_message":"Mensagem Particular","private_messages":"Mensagens","activity_stream":"Atividade","preferences":"Preferências","bio":"Sobre mim","invited_by":"Convidado Por","trust_level":"Nível de Confiança","notifications":"Notificações","dynamic_favicon":"Exibir notificações de novas mensagens no favicon","external_links_in_new_tab":"Abrir todos os links externos em uma nova aba","enable_quoting":"Citar texto selecionado na resposta","change":"alterar","moderator":"{{user}} é um moderador","admin":"{{user}} é um administrador","deleted":"(deletado)","messages":{"all":"Todas","mine":"Minhas","unread":"Não lidas"},"change_password":{"action":"alterar","success":"(email enviado)","in_progress":"(enviando email)","error":"(erro)"},"change_about":{"title":"Alterar Sobre Mim"},"change_username":{"title":"Alterar Nome de Usuário","confirm":"É possível haver consequências ao alterar o nome de usuário. Tem certeza?","taken":"Desculpe, esse nome de usuário já está sendo usado","error":"Houve um erro ao alterar o seu nome de usuário","invalid":"Esse nome de usuário é inválido. Deve conter apenas números e letras"},"change_email":{"title":"Alterar Email","taken":"Desculpe, esse email não é válido","error":"Houve um erro ao alterar o email. Talvez ele já esteja sendo usado neste forum?","success":"Enviamos um email para esse endereço. Por favor segue as instruções de confirmação"},"change_avatar":{"title":"Alterar seu avatar","gravatar":"\u003Ca href='//gravatar.com/emails' target='_blank'\u003EGravatar\u003C/a\u003E, baseado no","gravatar_title":"Mude seu  avatar no website do Gravatar","uploaded_avatar":"Imagem personalizada","uploaded_avatar_empty":"Adicionar imagem personalizada","upload_title":"Suba sua imagem","image_is_not_a_square":"Aviso: Nós recortamos sua imagem, pois não era um quadrado."},"email":{"title":"Email","instructions":"O seu endereço de email não será visível publicamente","ok":"Parece ok. Vamos enviar um email para você confirmar","invalid":"Por favor coloque um endereço de email válido","authenticated":"O seu email foi autenticado por {{provider}}.","frequency":"Vamos lhe enviar emails apenas quando não o virmos há algum tempo e você não tiver visto as coisas que temos enviado"},"name":{"title":"Nome","instructions":"O seu nome completo; não precisa de ser único.","too_short":"O seu nome é muito curto","ok":"O seu nome parece bom"},"username":{"title":"Nome de Usuário","instructions":"As pessoas podem mencionar você usando @{{username}}.","short_instructions":"As pessoas podem mencionar você usando @{{username}}.","available":"O seu nome de usuário está disponível.","global_match":"O email corresponde ao nome de usuário registado.","global_mismatch":"Já está registado. Tente {{suggestion}}?","not_available":"Não está disponível. Tente {{suggestion}}?","too_short":"O seu nome de usuário é muito curto.","too_long":"O seu nome de usuário é muito comprido.","checking":"Verificando disponibilidade do nome de usuário...","enter_email":"Nome de usuário encontrado. Coloque o email referente a ele."},"password_confirmation":{"title":"Senha novamente"},"last_posted":"Último Postagem","last_emailed":"Último Email","last_seen":"Última vez visto","created":"Criado a","log_out":"Log Out","website":"Web Site","email_settings":"Email","email_digests":{"title":"Quando não visito o site, enviar-me um email com um resumo do que é novo","daily":"diariamente","weekly":"semanalmente","bi_weekly":"duas em duas semanas"},"email_direct":"Receber um email quando alguém te cita, responde aos seus posts, ou menciona o seu @nome_de_usuário","email_private_messages":"Recebe um email quando alguém te envia uma mensagem particular","email_always":"Receive email notifications and email digests even if I am active on the forum","other_settings":"Outros","new_topic_duration":{"label":"Considerar tópicos como novos quando","not_viewed":"Não os vi ainda","last_here":"foram postados desde a última vez que estive lá","after_n_days":{"one":"foram postados no último dia","other":"foram postados nos últimos {{count}} dias"},"after_n_weeks":{"one":"foram postados na última semana","other":"foram postados nas últimas {{count}} semanas"}},"auto_track_topics":"Automaticamente vigiar os tópicos em que eu entro","auto_track_options":{"never":"nunca","always":"sempre","after_n_seconds":{"one":"passado 1 segundo","other":"passado {{count}} segundos"},"after_n_minutes":{"one":"passado 1 minuto","other":"passado {{count}} minutos"}},"invited":{"title":"Convites","user":"Usuários convidados","none":"{{username}} ainda não convidou ninguém para o site.","redeemed":"Convites usados","redeemed_at":"Usado em","pending":"Convites Pendentes","topics_entered":"Tópicos em que entrou","posts_read_count":"Postagen Vistos","rescind":"Remover Convite","rescinded":"Convite Removido","time_read":"Tempo de Leitura","days_visited":"Dias Visitados","account_age_days":"Idade da conta em dias"},"password":{"title":"Senha","too_short":"A sua senha é muito curta.","ok":"A sua senha parece estar ok."},"ip_address":{"title":"Último endereço IP"},"avatar":{"title":"Avatar"},"title":{"title":"Título"},"filters":{"all":"Todos"},"stream":{"posted_by":"Postado por","sent_by":"Enviado por","private_message":"mensagem particular","the_topic":"o tópico"}},"loading":"Carregando...","close":"Fechar","learn_more":"sabe mais...","year":"ano","year_desc":"tópicos postados nos últimos 365 dias","month":"mês","month_desc":"tópicos postados nos últimos 30 dias","week":"semana","week_desc":"tópicos postados nos últimos 7 dias","first_post":"Primeiro post","mute":"Silenciar","unmute":"Reativar","best_of":{"title":"Melhor De","enabled_description":"Você está vendo somente as melhores postagens neste tópico. Para ver todas as postagens de novo clique abaixo.","description":"Há \u003Cb\u003E{{count}}\u003C/b\u003E postagen neste tópico. Isso é muito! Gostaria de poupar tempo alterando a vista para mostrar apenas as postagens com mais interações e respostas?","enable":"Alternar para visualização \"Os Melhores\"","disable":"Cancelar \"Os Melhores\""},"private_message_info":{"title":"Conversas Privadas","invite":"Convidar Outros...","remove_allowed_user":"Você realmente quer remover {{name}} dessa mensagem privada?"},"email":"Email","username":"Nome de usuário","last_seen":"Visto pela última vez","created":"Criado","trust_level":"Nível de confiança","create_account":{"title":"Criar Conta","action":"Criar uma agora!","invite":"Ainda sem conta?","failed":"Alguma coisa deu errado, talvez este email já esteja registado, tente usar o link Esqueci a Senha."},"forgot_password":{"title":"Esqueci a Senha","action":"Esqueci minha senha","invite":"Coloque seu nome de usuário ou endereço de email, e nós lhe enviaremos um email para refazer sua senha.","reset":"Recuperar Senha","complete":"Se uma conta corresponder a este nome de usuário ou endereço de email, você receberá um email com instruções de como reiniciar sua senha rapidamente."},"login":{"title":"Entrar","username":"Usuário","password":"Senha","email_placeholder":"endereço de email ou nome de usuário","error":"Erro desconhecido","reset_password":"Recuperar senha","logging_in":"Entrando...","or":"Ou","authenticating":"Autenticando...","awaiting_confirmation":"A sua conta está aguardando ativação, utilize o link 'Esqueci a Senha' para pedir um novo link para ativar o email","awaiting_approval":"Sua conta ainda não foi aprovada por um membro do staff. Você receberá um email quando sua conta for aprovada.","requires_invite":"Desculpe, o acesso a esse fórum é exclusivamente por convite.","not_activated":"Você não pode entrar ainda. Nós lhe enviamos um email de ativação anteriormente no endereço \u003Cb\u003E{{sentTo}}\u003C/b\u003E. Por favor siga as instruções contidas neste email para ativar a sua conta.","resend_activation_email":"Clique aqui para enviar o email de ativação novamente.","sent_activation_email_again":"Nós enviamos mais um email de ativação para você no endereço \u003Cb\u003E{{currentEmail}}\u003C/b\u003E. Pode ser que demore alguns minutos para chegar; verifique sempre sua caixa de spams.","google":{"title":"Entrar com Google","message":"Autenticando com Google (certifique-se de que os bloqueadores de popup estejam desativados)"},"twitter":{"title":"Entrar com Twitter","message":"Autenticando com Twitter (certifique-se de que os bloqueadores de popup estejam desativados)"},"facebook":{"title":"Entrar com Facebook","message":"Autenticando com Facebook (certifique-se de que os bloqueadores de popup estejam desativados)"},"cas":{"title":"Entrar com CAS","message":"Autenticando com CAS (certifique-se de que os bloqueadores de popup estejam desativados)"},"yahoo":{"title":"Entrar com Yahoo","message":"Autenticando com Yahoo (certifique-se de que os bloqueadores de popup estejam desativados)"},"github":{"title":"com GitHub","message":"Autenticando com GitHub (certifique-se de que os bloqueadores de popup estejam desativados)"},"persona":{"title":"com Persona","message":"Autenticando com Mozilla Persona (certifique-se de que os bloqueadores de popup estejam desativados)"}},"composer":{"posting_not_on_topic":"Qual tópico você gostaria de responder?","saving_draft_tip":"a guardar","saved_draft_tip":"guardado","saved_local_draft_tip":"guardado localmente","similar_topics":"Seu tópico é similar a...","drafts_offline":"rascunhos offline","min_length":{"need_more_for_title":"{{n}} no título","need_more_for_reply":"{{n}} para chegar à postagem"},"error":{"title_missing":"Título é obrigatório","title_too_short":"Título tem que ter no mínimo {{min}} caracteres.","title_too_long":"Título pode ter no máximo {{min}} caracteres.","post_missing":"A postagem não pode estar vazia.","post_length":"A postagem tem que ter no mínimo {{min}} caracteres.","category_missing":"Você precisa escolher uma categoria."},"save_edit":"Salvar alterações","reply_original":"Responder no Tópico original","reply_here":"Responda Aqui","reply":"Responder","cancel":"Cancelar","create_topic":"Criar um Tópico","create_pm":"Criar uma Mensagem Particular","users_placeholder":"Adicionar um usuário","title_placeholder":"Escreva seu título aqui. Sobre o que é esta discussão numa pequena frase?","reply_placeholder":"Escreva sua resposta aqui. Utilize Markdown ou BBCode para formatar. Arraste ou cole aqui uma imagem para enviar.","view_new_post":"Ver os seus novas postagens.","saving":"Gravando...","saved":"Gravado!","saved_draft":"Você tem um rascunho da postagem em progresso. Clique em qualquer local nesta caixa para continuar a edição.","uploading":"A enviar...","show_preview":"mostrar pré-visualização \u0026raquo;","hide_preview":"\u0026laquo; esconder pré-visualização","quote_post_title":"Citar postagem inteira","bold_title":"Negrito","bold_text":"texto em negrito","italic_title":"Itálico","italic_text":"texto em itálico","link_title":"Link","link_description":"digite a descrição do link aqui","link_dialog_title":"Inserir Link","link_optional_text":"título opcional","quote_title":"Bloco de Citação","quote_text":"Bloco de Citação","code_title":"Trecho de Código","code_text":"digite o código aqui","upload_title":"Enviar","upload_description":"digite aqui a descrição do arquivo enviado","olist_title":"Lista numerada","ulist_title":"Lista de items","list_item":"Item da Lista","heading_title":"Título","heading_text":"Título","hr_title":"Barra horizontal","undo_title":"Desfazer","redo_title":"Refazer","help":"Ajuda da edição Markdown","toggler":"esconder ou exibir o painel de composição","admin_options_title":"Configurações opcionais de staff para este tópico","auto_close_label":"Fechar Automaticamente este tópico depois de ","auto_close_units":"dias"},"notifications":{"title":"notificações de menção de @nome, respostas às suas postagens e tópicos, mensagens privadas, etc","none":"Não há notifcações neste momento.","more":"ver notificações antigas","mentioned":"\u003Cspan title='mentioned' class='icon'\u003E@\u003C/span\u003E {{username}} {{link}}","quoted":"\u003Ci title='quoted' class='icon icon-quote-right'\u003E\u003C/i\u003E {{username}} {{link}}","replied":"\u003Ci title='replied' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","posted":"\u003Ci title='replied' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","edited":"\u003Ci title='edited' class='icon icon-pencil'\u003E\u003C/i\u003E {{username}} {{link}}","liked":"\u003Ci title='liked' class='icon icon-heart'\u003E\u003C/i\u003E {{username}} {{link}}","private_message":"\u003Ci class='icon icon-envelope-alt' title='private message'\u003E\u003C/i\u003E {{username}} enviou uma mensagem particular para você: {{link}}","invited_to_private_message":"{{username}} convidou você para uma conversa privada: {{link}}","invitee_accepted":"\u003Ci title='accepted your invitation' class='icon icon-signin'\u003E\u003C/i\u003E {{username}} aceitou o seu convite","moved_post":"\u003Ci title='moved post' class='icon icon-arrow-right'\u003E\u003C/i\u003E {{username}} moveu a postagem para {{link}}","total_flagged":"postagens sinalizadas totais"},"upload_selector":{"title":"Enviar arquivo","title_with_attachments":"Adicionar imagem ou arquivo","from_my_computer":"Do Meu Dispositivo","from_the_web":"Da Internet","remote_tip":"digite o endereço de um arquivo no formato http://exemplo.com/imagem.jpg","remote_tip_with_attachments":"digite o endereço de uma imagem ou arquivo no formato http://example.com/file.ext (extensões permitidas: {{authorized_extensions}}).","local_tip":"clique para selecionar um arquivo do seu dispositivo","local_tip_with_attachments":"clique para selecionar uma imagem ou arquivo do seu dispositivo (extensões permitidas: {{authorized_extensions}})","hint":"(você também pode arrastar e soltar no editor para envia-los)","hint_for_chrome":"(você também pode arrastar e soltar ou colar no editor para envia-los)","uploading":"Enviando"},"search":{"title":"procurar por tópicos, posts, usuários, ou categorias","placeholder":"escreve aqui o seu termo de buscar","no_results":"Não foi encontrado nenhum resultado.","searching":"Procurando...","prefer":{"user":"a busca vai dar preferência resultados de @{{username}}","category":"a busca vai dar preferência resultados de {{category}}"}},"site_map":"ir para outra lista de tópicos ou categorias","go_back":"voltar atrás","current_user":"ir para a sua página de usuário","favorite":{"title":"Favorito","help":{"star":"adicionar este tópico a lista de favoritos","unstar":"remover este tópico da lista de favoritos"}},"topics":{"none":{"favorited":"Você não favoritou nenhum tópico até agora. Para favoritar um tópico, clique ou toque na estrela ao lado do título.","unread":"Há tópicos não lidos.","new":"Não há novos tópicos.","read":"Você ainda não leu nenhum tópico.","posted":"Você ainda não escreveu nenhum tópico.","latest":"Não há tópicos populares. Isso é triste.","hot":"Não há tópicos quentes.","category":"Não há tópicos na categoria {{category}}."},"bottom":{"latest":"Não há mais tópicos recentes.","hot":"Não mais tópicos quentes.","posted":"Não há tópicos postados.","read":"Não há mais tópicos lidos.","new":"Não há mais tópicos novos.","unread":"Não há mais tópicos não lidos.","favorited":"Não há mais tópicos favoritos.","category":"Não há mais tópicos na categoria {{category}}."}},"rank_details":{"toggle":"alternar detalhes do rank de tópicos","show":"exibir rank de tópicos","title":"Detalhes do Ranking de Tópicos"},"topic":{"filter_to":"Mostrar apenas os {{post_count}} de {{username}} neste tópico","create":"Criar Tópico","create_long":"Criar um novo Tópico","private_message":"Começar uma nova conversa privada","list":"Tópicos","new":"novo tópico","new_topics":{"one":"1 tópico novo","other":"{{count}} tópicos novos"},"unread_topics":{"one":"1 tópico não lido","other":"{{count}} tópicos não lidos"},"title":"Tópico","loading_more":"Carregando mais tópicos...","loading":"Carregando tópico...","invalid_access":{"title":"Tópico é particular","description":"Desculpe, você não tem acesso aquele tópico!"},"server_error":{"title":"Falha ao carregar tópico","description":"Desculpe, nós não conseguimos carregar este tópico, possivelmente devido a um problema na conexão. Por favor teste novamente. Se o problema persistir, deixe-nos saber."},"not_found":{"title":"Tópico não encontrado","description":"Desculpe, não foi possível encontrar esse tópico. Pode ser que ele tenha sido apagado?"},"unread_posts":{"one":"você possui 1 posts antigo que não foi lido neste tópico","other":"você possui {{count}} posts antigos que não foram lidos neste tópico"},"new_posts":{"one":"há 1 nova postagem neste tópico desde a sua última leitura","other":"há {{count}} novos posts neste tópico desde a sua última leitura"},"likes":{"one":"há 1 curtida neste tópico","other":"há {{count}} curtidas neste tópico"},"back_to_list":"Voltar à lista dos Tópicos","options":"Opções do Tópico","show_links":"mostrar links dentro desta postagem","toggle_information":"alternar detalhes do tópico","read_more_in_category":"Queres ler mais? Procura outros tópicos em {{catLink}} ou {{latestLink}}.","read_more":"Queres ler mais? {{catLink}} ou {{latestLink}}.","browse_all_categories":"Procurar todas as categorias","view_latest_topics":"ver tópicos populares","suggest_create_topic":"Que tal começar um assunto?","read_position_reset":"Sua posição de leitura foi reiniciado.","jump_reply_up":"pular para resposta mais recente","jump_reply_down":"pular para resposta mais antiga","deleted":"Este tópico foi apagado","auto_close_notice":"Este tópico vai ser automaticamente fechado em %{timeLeft}.","auto_close_title":"Configurações para Fechar Automaticamente","auto_close_save":"Salvar","auto_close_cancel":"Cancelar","auto_close_remove":"Não Fechar Automaticamente Este Tópico","progress":{"title":"progresso do tópico","jump_top":"saltar para o primeiro post","jump_bottom":"saltar para o último post","total":"total de posts","current":"postagem atual"},"notifications":{"title":"Notificações a Receber: ","reasons":{"3_2":"Você receberá notificações porque está observando este tópico.","3_1":"Você receberá notificações porque criou este tópico.","3":"Você receberá notificações porque você está acompanhando este tópico.","2_4":"Você receberá notificações porque postou uma resposta neste tópico.","2_2":"Você receberá notificações porque está monitorando este tópico.","2":"Você receberá notificações porque você \u003Ca href=\"/users/{{username}}/preferences\"\u003Eleu este tópico\u003C/a\u003E.","1":"Você receberá notificações apenas se alguém mencionar o seu @nome ou responder à sua postagem.","1_2":"Você receberá notificações apenas se alguém mencionar o seu @nome ou responder à sua postagem.","0":"Você está ignorarando todas as notificações para este tópico.","0_2":"Você está ignorarando todas as notificações para este tópico."},"watching":{"title":"Observar","description":"o mesmo que monitorar, mas ainda será notificado de todos os novos posts."},"tracking":{"title":"Monitorar","description":"você será notificado de posts não lidos, menções ao seu @nome, e respostas às suas postagens."},"regular":{"title":"Regular","description":"você será notificado apenas se alguém mencionar o seu @nome ou responder à sua postagem."},"muted":{"title":"Silenciar","description":"você não será notificado relativamente a nada deste tópico, e não aparecerá na sua lista de não lidos."}},"actions":{"recover":"Recuperar Tópico","delete":"Apagar Tópico","open":"Abrir Tópico","close":"Fechar Tópico","auto_close":"Fechar Automaticamente","unpin":"Remover Destaque do Tópico","pin":"Destacar Tópico","unarchive":"Desarquivar Tópico","archive":"Arquivar Tópico","invisible":"Tornar Invisível","visible":"Tornar Visível","reset_read":"Repor Data de Leitura","multi_select":"Selecionar Postagens para Mover","convert_to_topic":"Converter para Tópico Regular"},"reply":{"title":"Responder","help":"começa a compor uma resposta a este tópico"},"clear_pin":{"title":"Remover destaque","help":"Retirar destaque deste tópico para que ele não apareça mais no topo da sua lista de tópicos"},"share":{"title":"Compartilhar","help":"compartilhar um link para este tópico"},"inviting":"Convidando...","invite_private":{"title":"Convidar para Conversa Privada","email_or_username":"Email ou Nome de Usuário do Convidado","email_or_username_placeholder":"endereço de email ou username","action":"Convite","success":"Obrigado! Convidamos esse usuário para participar nesta conversa privada.","error":"Desculpe, houve um erro ao convidar esse usuário."},"invite_reply":{"title":"Convidar um amigo para Responder","action":"Email de Convite","help":"envie convites aos seus amigos para que eles possam responder a este tópico com um simples clique.","email":"Enviaremos ao seu amigo um pequeno email para que ele possa responder a este tópico com apenas com um clique.","email_placeholder":"endereço de email","success":"Obrigado! Enviamos um convite para \u003Cb\u003E{{email}}\u003C/b\u003E. Você saberá quando eles utilizarem o convite. Você pode ir até a seção de Convites na sua página de usuário para saber quem você já convidou.","error":"Desculpe não podíamos convidar essa pessoa. Talvez já seja um usuário?"},"login_reply":"Entre com sua conta para responder","filters":{"user":"Você está vendo apenas {{n_posts}} {{by_n_users}}.","n_posts":{"one":"1 postagem","other":"{{count}} postagens"},"by_n_users":{"one":"feito por 1 usuário específico","other":"feito por {count}} usuários específicos"},"best_of":"Você está vendo apenas {{n_best_posts}} {{of_n_posts}}.","n_best_posts":{"one":"1 melhor postagem","other":"{{count}} melhores postagens"},"of_n_posts":{"one":"de 1 no tópico","other":"de {{count}} no tópico"},"cancel":"Mostrar novamente todas as postagens deste tópico."},"split_topic":{"title":"Mover para um novo Tópico","action":"mover para novo tópico","topic_name":"Nome do Novo Tópico:","error":"Houve um erro ao mover as postagens para novo tópico.","instructions":{"one":"Você está prestes a criar um novo tópico e populá-lo com a postagem que você selecionou.","other":"Você está prestes a criar um novo tópico e populá-lo com os \u003Cb\u003E{{count}}\u003C/b\u003E postagens que você selecionou."}},"merge_topic":{"title":"Mover para Tópico Existente","action":"mover para tópico existente","error":"Houve um erro ao mover as postagens para aquele tópico.","instructions":{"one":"Por favor selecione o tópico para o qual você gostaria de mover esta postagem.","other":"Por favor selecione o tópico para o qual você gostaria de mover estas \u003Cb\u003E{{count}}\u003C/b\u003E postagens."}},"multi_select":{"select":"selecionar","selected":"({{count}}) selecionados","select_replies":"selecionar +respostas","delete":"apagar selecionados","cancel":"cancelar seleção","description":{"one":"\u003Cb\u003E1\u003C/b\u003E postagem selecionada.","other":"\u003Cb\u003E{{count}}\u003C/b\u003E postagens selecionadas."}}},"post":{"reply":"Em resposta a {{link}} por {{replyAvatar}} {{username}}","reply_topic":"Responder a {{link}}","quote_reply":"citar resposta","edit":"Editar {{link}}","post_number":"postagem {{number}}","in_reply_to":"Em resposta a","last_edited_on":"última edição do post por","reply_as_new_topic":"Responder como um novo Tópico","continue_discussion":"Continuar a discussão desde {{postLink}}:","follow_quote":"ir para a postagem citada","deleted_by_author":{"one":"(postagem removida pelo autor, será automaticamente deletada em  %{count} horas a não ser que seja marcada)","other":"(postagens removidas pelo autor, serão automaticamente deletadas em %{count} horas a não ser que seja marcada)"},"deleted_by":"apagado por","expand_collapse":"expandir/encolher","has_replies":{"one":"Resposta","other":"Respostas"},"errors":{"create":"Desculpe, houve um erro ao criar o seu post. Por favor tenta outra vez.","edit":"Desculpe, houve um erro ao editar o seu post. Por favor tenta outra vez.","upload":"Desculpe, houve um erro ao enviar esse ficheiro. Por favor tenta otura vez.","attachment_too_large":"Desculpe, o arquivo que você está tentando enviar é muito grande (o tamanho máximo é  {{max_size_kb}}kb).","image_too_large":"Desculpe, a imagem que você está tentando enviar é muito grande (o tamanho máximo é {{max_size_kb}}kb), por favor diminua-o e tente novamente.","too_many_uploads":"Desculpe, você pode enviar apenas um arquivos por vez.","upload_not_authorized":"Desculpe, o tipo de arquivo que você está tentando enviar não está autorizado (extensões autorizadas: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Desculpe, novos usuários não podem enviar imagens.","attachment_upload_not_allowed_for_new_user":"Desculpe, novos usuários não podem enviar arquivos."},"abandon":"Tem certeza que quer abandonar o seu post?","archetypes":{"save":"Guardar as Opções"},"controls":{"reply":"começa a compor uma resposta a este tópico","like":"curtir este tópico","edit":"editar este tópico","flag":"denunciar este tópico com uma sinalização para avisar os moderadores","delete":"apagar esta postagem","undelete":"desapagar esta postagem","share":"compartilhar um link para esta postagem","more":"Mais","delete_replies":{"confirm":{"one":"Você quer deletar também a resposta direta a esse post?","other":"Você quer deletar também as {{count}} respostas diretas a esse post?"},"yes_value":"Sim, delete as respostas também","no_value":"Não, apenas o post"}},"actions":{"flag":"Sinalização","clear_flags":{"one":"Apagar sinalização","other":"Apagar sinalizações"},"it_too":{"off_topic":"Sinalizar também","spam":"Sinalizar também","inappropriate":"Sinalizar também","custom_flag":"Sinalizar também","bookmark":"Adicionar marcador também","like":"Dê um Curtir também","vote":"Vote neste também"},"undo":{"off_topic":"Desfazer sinalização","spam":"Desfazer sinalização","inappropriate":"Desfazer sinalização","bookmark":"Remover marcador","like":"Desfazer curtir","vote":"Desfazer votar"},"people":{"off_topic":"{{icons}} sinalizaram isto como off-topic","spam":"{{icons}} sinalizaram isto como spam","inappropriate":"{{icons}} sinalizaram isto como inapropriado","notify_moderators":"{{icons}} notificaram os moderadores","notify_moderators_with_url":"{{icons}} \u003Ca href='{{postUrl}}'\u003Enotificaram os moderadores\u003C/a\u003E","notify_user":"{{icons}} enviou uma mensagem particular","notify_user_with_url":"{{icons}} enviou uma \u003Ca href='{{postUrl}}'\u003Emensagem particular\u003C/a\u003E","bookmark":"{{icons}} adicionaram marcador a isto","like":"{{icons}} curtiram isto","vote":"{{icons}} votaram nisto"},"by_you":{"off_topic":"Você sinalizou isto como off-topic","spam":"Você sinalizou isto como spam","inappropriate":"Você sinalizou isto como inapropriado","notify_moderators":"Você sinalizou isto para moderação","notify_user":"Você enviou uma mensagem particular para este usuário","bookmark":"Você adicionou um marcador para esta postagem","like":"Você curtiu isto","vote":"Você votou nesta postagem"},"by_you_and_others":{"off_topic":{"one":"Você e mais 1 pessoa sinalizaram isto como off-topic","other":"Você e mais {{count}} pessoas sinalizaram isto como off-topic"},"spam":{"one":"Você e mais 1 pessoa sinalizaram isto como spam","other":"Você e mais {{count}} pessoas sinalizaram isto como spam"},"inappropriate":{"one":"Você e mais 1 pessoa sinalizaram isto como inapropriado","other":"Você e mais {{count}} pessoas sinalizaram isto como inapropriado"},"notify_moderators":{"one":"Você e mais 1 pessoa sinalizaram isto para moderação","other":"Você e mais {{count}} pessoas sinalizaram isto para moderação"},"notify_user":{"one":"Você e mais 1 pessoa enviaram mensagens particulares para este usuário","other":"Você e mais {{count}} pessoas enviaram mensagens particulares para este usuário"},"bookmark":{"one":"Você e mais 1 pessoa adicionaram um marcador a esta postagem","other":"Você e mais {{count}} adicionaram um marcador a esta postagem"},"like":{"one":"Você e mais 1 pessoa curtiu isto","other":"Você e mais {{count}} pessoas curtiram isto"},"vote":{"one":"Você e mais 1 pessoa votaram nesta postagem","other":"Você e mais {{count}} pessoas votaram nesta postagem"}},"by_others":{"off_topic":{"one":"1 pessoa sinalizou isto como off-topic","other":"{{count}} pessoas sinalizaram isto como off-topic"},"spam":{"one":"1 pessoa sinalizou isto como spam","other":"{{count}} pessoas sinalizaram isto como spam"},"inappropriate":{"one":"1 pessoa sinalizou isto como inapropriado","other":"{{count}} pessoas sinalizaram isto como inapropriado"},"notify_moderators":{"one":"1 pessoa sinalizou isto para moderação","other":"{{count}} pessoas sinalizaram isto para moderação"},"notify_user":{"one":"1 pessoa enviou mensagem particular para este usuário","other":"{{count}} enviaram mensagem particular para este usuário"},"bookmark":{"one":"1 pessoa adicionou um marcador a esta postagem","other":"{{count}} pessoas adicionaram um marcador a esta postagem"},"like":{"one":"1 pessoa deu curtiu esta postagem","other":"{{count}} pessoas curtiram esta postagem"},"vote":{"one":"1 pessoa votou nesta postagem","other":"{{count}} pessoas votaram nesta postagem"}}},"edits":{"one":"1 edição","other":"{{count}} edições","zero":"sem edições"},"delete":{"confirm":{"one":"Tem certeza que quer apagar esta postagem?","other":"Tem certeza que quer apagar todos essas postagens?"}}},"category":{"can":"pode\u0026hellip; ","none":"(sem categoria)","choose":"Selecione uma categoria\u0026hellip;","edit":"editar","edit_long":"Editar Categoria","view":"Visualizar Tópicos na Categoria","general":"Geral","settings":"Configurações","delete":"Apagar Categoria","create":"Criar Categoria","save":"Salvar Categoria","creation_error":"Houve um erro durante a criação da categoria.","save_error":"Houve um erro ao salvar a categoria.","more_posts":"visualizar todos os {{posts}}...","name":"Nome da Categoria","description":"Descrição","topic":"tópico da categoria","badge_colors":"Badge colors","background_color":"Background color","foreground_color":"Foreground color","name_placeholder":"Deve ser curto e sucinto.","color_placeholder":"Qualquer cor web","delete_confirm":"Tem certeza que quer apagar esta categoria?","delete_error":"Houve um erro ao apagar a categoria.","list":"Lista de Categorias","no_description":"Não há descrição para esta categoria, edite a definição do tópico.","change_in_category_topic":"Editar Descrição","hotness":"Mais Quente","already_used":"Esta cor já foi usada para outra categoria","security":"Segurança","auto_close_label":"Fechar automaticamente tópicos depois de:","edit_permissions":"Editar Permissões","add_permission":"Adicionar Permissões","this_year":"esse ano"},"flagging":{"title":"Porque está sinalizando esta postagem?","action":"Sinalizar Postagem","take_action":"Tomar Atitude","notify_action":"Notificar","delete_spammer":"Deletar Spammer","delete_confirm":"Você ira deletar \u003Cb\u003E%{posts}\u003C/b\u003E posts e \u003Cb\u003E%{topics}\u003C/b\u003E tópicos deste usuário, remover sua conta e adicionar seu e-mail \u003Cb\u003E%{email}\u003C/b\u003E para uma lista que bloqueio permanente. Tem certeza que esse usuário é um spammer?","yes_delete_spammer":"Sim, remover Spammer","cant":"Desculpe, não é possível colocar uma sinalização neste momento.","custom_placeholder_notify_user":"Porque esta postagem requer que você fale diretamente e privativamente com este usuário? Seja específico, construtivo e sempre gentil.","custom_placeholder_notify_moderators":"Porque esta postagem requer atenção do moderador? Diga especificamente como isto te preocupou e forneça links relevantes se possível.","custom_message":{"at_least":"insira pelo menos {{n}} caracteres","more":"{{n}} em falta...","left":"{{n}} restantes"}},"topic_summary":{"title":"Sumário do Tópico","links_shown":"mostrar todos os {{totalLinks}} links...","clicks":"clicks","topic_link":"link do tópico"},"topic_statuses":{"locked":{"help":"este tópico está fechado; não serão aceitas mais respostas"},"pinned":{"help":"este tópico está fixado; irá ser mostrado no topo da sua categoria"},"archived":{"help":"este tópico está arquivado; está congelado e não pode ser alterado"},"invisible":{"help":"este tópico está invisível; não aparecerá na listagem dos tópicos, e pode apenas ser acessado por link direto"}},"posts":"Postagens","posts_long":"há {{number}} postagens neste tópico","original_post":"Postagem Original","views":"Visualizações","replies":"Respostas","views_long":"este tópico foi visto {{number}} vezes","activity":"Atividade","likes":"Curtidas","likes_long":"há {{number}} curtidas neste tópico","top_contributors":"Participantes","category_title":"Categoria","history":"Histórico","changed_by":"por {{author}}","categories_list":"Lista de Categorias","filters":{"latest":{"title":"Populares","help":"os tópicos recentes mais populares"},"hot":{"title":"Quente","help":"uma seleção dos tópicos mais quentes"},"favorited":{"title":"Favoritos","help":"tópicos que marcaste como favorito"},"read":{"title":"Lido","help":"tópicos que você leu"},"categories":{"title":"Categorias","title_in":"Categoria - {{categoryName}}","help":"todos os tópicos agrupados por categoria"},"unread":{"title":{"zero":"Não lido","one":"Não lido (1)","other":"Não lidos ({{count}})"},"help":"tópicos monitorados com postagens não lidas"},"new":{"title":{"zero":"Novo","one":"Novo (1)","other":"Novos ({{count}})"},"help":"novos tópicos desde a sua última visita, e tópicos monitorados com postagens novas"},"posted":{"title":"Minhas postagens","help":"tópicos nos quais você postou"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"tópicos populares na categoria {{categoryName}}"}},"browser_update":"Infelizmente, \u003Ca href=\"http://www.discourse.org/faq/#browser\"\u003Eseu navegador é muito antigo para ser utilizado em um fórum Discours\u003C/a\u003E. Por favor \u003Ca href=\"http://browsehappy.com\"\u003Eatualize seu navegador\u003C/a\u003E.","permission_types":{"full":"Criar / Responder / Ver","create_post":"Responder / Ver","readonly":"Ver"},"type_to_filter":"escreva para filtrar...","admin":{"title":"Discourse Admin","moderator":"Moderador","dashboard":{"title":"Painel Administrativo","last_updated":"Última atualização do Painel Administrativo:","version":"Versão","up_to_date":"Você está atualizado!","critical_available":"Uma atualização crítica está disponível.","updates_available":"Atualizações estão disponíveis.","please_upgrade":"Por favor atualize!","no_check_performed":"Não foi feita verificação por atualizações. Certifique-se de sidekiq esta em execucao.","stale_data":"Não foi feita verificação por atualizações ultimamente. Certifique-se de sidekiq esta em execucao.","installed_version":"Instalado","latest_version":"Última versão","problems_found":"Alguns problemas foram encontrados na sua instalação do Discourse:","last_checked":"Última verificação","refresh_problems":"Atualizar","no_problems":"Nenhum problema encontrado.","moderators":"Moderadores:","admins":"Admins:","blocked":"Bloqueado:","suspended":"Banido:","private_messages_short":"MPs","private_messages_title":"Mensagens Particulares","reports":{"today":"Hoje","yesterday":"Ontem","last_7_days":"Últimos 7 Dias","last_30_days":"Últimos 30 Dias","all_time":"Todo Tempo","7_days_ago":"7 Dias Atrás","30_days_ago":"30 Dias Atrás","all":"Tudo","view_table":"Visualizar como Tabela","view_chart":"Visualizar como Gráfico de Barras"}},"commits":{"latest_changes":"Últimas atualizações: atualize com frequência!","by":"por"},"flags":{"title":"Sinalizações","old":"Antigo","active":"Ativo","agree_hide":"Aceitar (esconder postagem + enviar MP)","agree_hide_title":"Esconder esta postagem e enviar automaticamente uma mensagem particular para o usuário solicitando que ele edite esta postagem urgentemente","defer":"Delegar","defer_title":"Nenhum ação é necessária agora, determine uma ação para esta sinalização posteriormente, ou nunca","delete_post":"Apagar Postagem","delete_post_title":"Apagar o post; se for a primeira postagem apagar o tópico","disagree_unhide":"Discordar (reexibir postagem)","disagree_unhide_title":"Remover qualquer sinalização desta postagem e torná-la visível novamente","disagree":"Rejeitar","disagree_title":"Discordar desta sinalização, remover qualquer sinalização desta postagem","delete_spammer_title":"Deletar o usuário e todos seus posts e tópicos","flagged_by":"Sinalizado por","error":"Algo deu errado","view_message":"Responder","no_results":"Não há sinalizações.","summary":{"action_type_3":{"one":"off-topic","other":"off-topic x{{count}}"},"action_type_4":{"one":"inapropriado","other":"inapropriado x{{count}}"},"action_type_6":{"one":"customizado","other":"customizados x{{count}}"},"action_type_7":{"one":"personalizado","other":"personalizado x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"title":"Grupos","edit":"Editar Grupos","selector_placeholder":"adicionar usuários","name_placeholder":"Nome do grupo, sem espaços, regras iguais ao nome de usuário","about":"Editar participação no grupo e nomes aqui","can_not_edit_automatic":"Participação nos grupos automáticos é determinada automaticamente, gerencie os usuários para determinar papéis e níveis de confiança","delete":"Apagar","delete_confirm":"Apagar este grupos?","delete_failed":"Unable to delete group. If this is an automatic group, it cannot be destroyed."},"api":{"title":"API","long_title":"Informações da API","key":"Chave","generate":"Gerar chave da API","regenerate":"Gerar nova chave da API","info_html":"Sua chave de API permitirá a criação e edição de tópicos usando requests JSON.","note_html":"Guarde esta chave \u003Cstrong\u003Esecretamente\u003C/strong\u003E, todos usuários que tiverem acesso a ela poderão criar postagens arbritários no forum como qualquer usuário."},"customize":{"title":"Personalizar","long_title":"Personalizações do Site","header":"Cabeçalho","css":"Stylesheet","mobile_header":"Cabeçalho Mobile","mobile_css":"Mobile Stylesheet","override_default":"Sobrepor padrão?","enabled":"Habilitado?","preview":"pré-visualização","undo_preview":"desfazer pré-visualização","save":"Guardar","new":"Novo","new_style":"Novo Estilo","delete":"Apagar","delete_confirm":"Apagar esta personalização?","about":"Personalizações do Site permite que você modifique as folhas de estilo e os cabeçalhos do site. Escolha um ou crie um e comece a editar."},"email":{"title":"Email","settings":"Settings","logs":"Registro de Atividade","sent_at":"Enviado para ","user":"Usuário","email_type":"Tipo de Email","to_address":"Para (endereço)","test_email_address":"endereço de email para testar","send_test":"enviar email de teste","sent_test":"enviado!","delivery_method":"Delivery Method","preview_digest":"Preview Digest","preview_digest_desc":"Esta é uma ferramenta para prever o conteúdo dos emails de resumo enviados a partir do seu forum.","refresh":"Atualizar","format":"Formato","html":"html","text":"texto","last_seen_user":"Último Usuário Visto:","reply_key":"Chave de Resposta"},"logs":{"title":"Logs","action":"Ação","created_at":"Criado em","last_match_at":"Última conferência","match_count":"Conferidos","ip_address":"IP","screened_actions":{"block":"bloquear","do_nothing":"ñao fazer nada"},"staff_actions":{"title":"Ações Staff","instructions":"Clique no username e ações para filtrar a lista. Clique nos avatares para ir a página do usuário","clear_filters":"Mostrar tudo","staff_user":"Usuário Staff","target_user":"Usuário destino","subject":"Assunto","when":"Quando","context":"Contexto","details":"Detalhes","previous_value":"Anterior","new_value":"Novo","diff":"Diferença","show":"Mostrar","modal_title":"Detalhes","no_previous":"Não existe valor anterior.","deleted":"Sem novo valor. Registro foi deletado.","actions":{"delete_user":"deletar usuário","change_trust_level":"mudar nível de confiança","change_site_setting":"mudar configuração do site","change_site_customization":"mudar personalização do site","delete_site_customization":"deletar personalização do site"}},"screened_emails":{"title":"Emails exibidos","description":"Quando algúem tenta criar uma nova conta, o e-mail a seguir será verificado e o registro será bloqueado ou alguma outra ação será tomada","email":"Endereço de Email"},"screened_urls":{"title":"URLs exibiadas","description":" As URLs listadas aqui foram postadas por usuários que foram identificados como spammers","url":"URL"}},"impersonate":{"title":"Personificar Usuário","username_or_email":"Nome do Usuário ou Email do Usuário","help":"Utiliza este ferramenta para personificar uma conta de usuário para efeitos de depuração.","not_found":"Esse usuário não consegue ser encotrado.","invalid":"Desculpe, não é possível personificar esse usuário."},"users":{"title":"Usuários","create":"Adicionar Usuário Admin","last_emailed":"Último email enviado","not_found":"Desculpe, esse nome de usuário não existe no nosso sistema.","active":"Ativo","nav":{"new":"Novos","active":"Ativos","pending":"Pendentes","admins":"Administradores","moderators":"Moderadores","suspended":"Banidos","blocked":"Bloqueados"},"approved":"Aprovado?","approved_selected":{"one":"aprovar usuário","other":"aprovar usuários ({{count}})"},"reject_selected":{"one":"rejeitar usuário","other":"rejeitar usuários ({{count}})"},"titles":{"active":"Usuários Ativos","new":"Usuários Novos","pending":"Usuários com Confirmação Pendente","newuser":"Usuários no Nível de Confiança 0 (Usuário Novo)","basic":"Usuários no Nível de Confiança 1 (Usuário Básico)","regular":"Usuários no Nível de Confiança 2 (Usuário Regular)","leader":"Usuários no Nível de Confiança 3 (Líder)","elder":"Usuários no Nível de Confiança 4 (Cavaleiro)","admins":"Usuários Administradores","moderators":"Moderadores","blocked":"Usuários Boqueados","suspended":"Usuários Banidos"},"reject_successful":{"one":"1 usuário rejeitado com sucesso.","other":"%{count} usuários rejeitados com sucesso"},"reject_failures":{"one":"Falha ao rejeitar 1 usuário.","other":"Falha ao rejeitar %{count} usuários."}},"user":{"suspend_failed":"Ocorreu um erro ao banir este usuário {{error}}","unsuspend_failed":"Ocorreu um erro ao desbanir este usuário {{error}}","suspend_duration":"Por quanto tempo gostaria de banir a pessoa? (dias)","delete_all_posts":"Apagar todas postagens","delete_all_posts_confirm":"Você irá deletar %{posts} posts e %{topics} tópicos. Tem certeza?","suspend":"Banir","unsuspend":"Desbanir","suspended":"Banido?","moderator":"Moderador?","admin":"Admin?","blocked":"Bloqueado?","show_admin_profile":"Admin","edit_title":"Editar Título","save_title":"Salvar Título","refresh_browsers":"Forçar atualização da página no browser","show_public_profile":"Mostrar Perfil Público","impersonate":"Personificar","revoke_admin":"Revogar Admin","grant_admin":"Conceder Admin","revoke_moderation":"Revogar Moderação","grant_moderation":"Conceder Moderação","unblock":"Desbloquear","block":"Bloquear","reputation":"Reputação","permissions":"Permissões","activity":"Atividade","like_count":"Curtidas recebidos","private_topics_count":"Tópicos Privados","posts_read_count":"Postagens lidos","post_count":"Postagens criados","topics_entered":"Tópicos que entrou","flags_given_count":"Sinalizações dadas","flags_received_count":"Sinalizações recebidas","approve":"Aprovar","approved_by":"aprovado por","approve_success":"Usuário aprovado e email enviado com instruções de ativação.","approve_bulk_success":"Sucesso! Todos os usuários selecionados foram aprovados e notificados.","time_read":"Tempo de leitura","delete":"Apagar Usuário","delete_forbidden":{"one":"Usuários não podem ser deletados se registrados a mais de %{count} dia, ou ainda tem posts. Delete todos os posts antes de tentar deletar um usuário.","other":"Usuários não podem ser deletados se registrados a mais de %{count} dias, ou ainda tem posts. Delete todos os posts antes de tentar deletar um usuário."},"delete_confirm":"Tem CERTEZA que você quer apagar este usuário permanentemente do site? Esta ação é definitiva!","delete_and_block":"\u003Cb\u003EYes\u003C/b\u003E, and \u003Cb\u003Eblock\u003C/b\u003E signups from this email address","delete_dont_block":"\u003Cb\u003EYes\u003C/b\u003E, but \u003Cb\u003Eallow\u003C/b\u003E signups from this email address","deleted":"O usuário foi apagado.","delete_failed":"Houve um erro ao apagar o usuário. Certifique-se de que todas postagens dele foram apagados antes de tentar apagá-lo.","send_activation_email":"Enviar Email de Ativação","activation_email_sent":"Um email de ativação foi enviado.","send_activation_email_failed":"Houve um problema ao enviar um novo email de ativação. %{error}","activate":"Ativar Conta","activate_failed":"Houve um problema ao tornar o usuário ativo.","deactivate_account":"Desativar Conta","deactivate_failed":"Houve um problema ao desativar o usuário.","unblock_failed":"Houve um problema ao desbloquear o usuário.","block_failed":"Houve um problema ao bloquear o usuário.","deactivate_explanation":"Um usuário desativado deve revalidar seu email.","banned_explanation":"Um usuário banido não pode logar.","block_explanation":"Um usuário bloqueado não pode postar ou iniciar tópicos.","trust_level_change_failed":"Houve um problema ao trocar o nível de confiança do usuário."},"site_content":{"none":"Escolhar um tipo de conteúdo para começar a editar.","title":"Conteúdo","edit":"Editar Conteúdo do Site"},"site_settings":{"show_overriden":"Apenas mostrar valores alterados","title":"Configurações do Site","reset":"restaurar valores padrão","none":"nenhum"}}}}};
I18n.locale = 'pt_BR';
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
// language : brazilian portuguese (pt-br)
// author : Caio Ribeiro Pereira : https://github.com/caio-ribeiro-pereira

moment.lang('pt_BR', {
    months : "Janeiro_Fevereiro_Março_Abril_Maio_Junho_Julho_Agosto_Setembro_Outubro_Novembro_Dezembro".split("_"),
    monthsShort : "Jan_Fev_Mar_Abr_Mai_Jun_Jul_Ago_Set_Out_Nov_Dez".split("_"),
    weekdays : "Domingo_Segunda-feira_Terça-feira_Quarta-feira_Quinta-feira_Sexta-feira_Sábado".split("_"),
    weekdaysShort : "Dom_Seg_Ter_Qua_Qui_Sex_Sáb".split("_"),
    weekdaysMin : "Dom_2ª_3ª_4ª_5ª_6ª_Sáb".split("_"),
    longDateFormat : {
        LT : "HH:mm",
        L : "DD/MM/YYYY",
        LL : "D [de] MMMM [de] YYYY",
        LLL : "D [de] MMMM [de] YYYY LT",
        LLLL : "dddd, D [de] MMMM [de] YYYY LT"
    },
    calendar : {
        sameDay: '[Hoje às] LT',
        nextDay: '[Amanhã às] LT',
        nextWeek: 'dddd [às] LT',
        lastDay: '[Ontem às] LT',
        lastWeek: function () {
            return (this.day() === 0 || this.day() === 6) ?
                '[Último] dddd [às] LT' : // Saturday + Sunday
                '[Última] dddd [às] LT'; // Monday - Friday
        },
        sameElse: 'L'
    },
    relativeTime : {
        future : "em %s",
        past : "%s atrás",
        s : "segundos",
        m : "um minuto",
        mm : "%d minutos",
        h : "uma hora",
        hh : "%d horas",
        d : "um dia",
        dd : "%d dias",
        M : "um mês",
        MM : "%d meses",
        y : "um ano",
        yy : "%d anos"
    },
    ordinal : '%dº'
});

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
