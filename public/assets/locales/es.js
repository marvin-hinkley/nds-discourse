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
MessageFormat.locale.es = function ( n ) {
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
    })({});I18n.translations = {"es":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"tiny":{"half_a_minute":"menos de un minuto","less_than_x_seconds":{"one":"menos de un segundo","other":"menos de %{count} segundos"},"x_seconds":{"one":"un segundo","other":"%{count} segundos"},"less_than_x_minutes":{"one":"menos de 1 minuto","other":"menos de %{count} minutos"},"x_minutes":{"one":"un minuto","other":"%{count} minutos"},"about_x_hours":{"one":"alrededor de 1 hora","other":"alrededor de %{count} horas"},"x_days":{"one":"un día","other":"%{count} días"},"about_x_months":{"one":"alrededor de un mes","other":"alrededor de %{count} meses"},"x_months":{"one":"un mes","other":"%{count} meses"},"about_x_years":{"one":"alrededor de un año","other":"%{count} años"},"over_x_years":{"one":"más de un año","other":"más de %{count} años"},"almost_x_years":{"one":"casi un año","other":"casi %{count} años"}}},"share":{"topic":"comparte un enlace en este tema","post":"comparte un enlace en esta publicación","close":"cerrar"},"edit":"editar el título y la categoría de este tema","not_implemented":"Esta característica no ha sido implementada aún, ¡lo sentimos!","no_value":"No","yes_value":"Sí","of_value":"de","generic_error":"Lo sentimos, ha ocurrido un error.","log_in":"Ingreso","age":"Edad","last_post":"Última publicación","admin_title":"Admin","flags_title":"Banderas","show_more":"ver más","links":"Enlaces","faq":"FAQ","you":"Tú","ok":"Hecho","or":"o","now":"ahora mismo","read_more":"leer más","more":"Más","less":"Menos","never":"nunca","daily":"cada día","weekly":"cada semana","every_two_weeks":"cada dos semanas","character_count":{"one":"{{count}} caracter","other":"{{count}} caracteres"},"suggested_topics":{"title":"temas sugeridos"},"bookmarks":{"not_logged_in":"Lo sentimos, debes haber ingresado para marcar publicaciones.","created":"Has marcado esta publicación como favorita.","not_bookmarked":"Has leído esta publicación, haz click para marcarla como favorita.","last_read":"Esta es la última publicación que has leído."},"new_topics_inserted":"{{count}} nuevos temas.","show_new_topics":"Click para mostrar.","preview":"vista previa","cancel":"cancelar","save":"Guardar Cambios","saving":"Guardando...","saved":"¡Guardado!","user_action":{"user_posted_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E publicó \u003Ca href='{{topicUrl}}'\u003Eel tema\u003C/a\u003E","you_posted_topic":"\u003Ca href='{{userUrl}}'\u003ETú\u003C/a\u003E publicaste \u003Ca href='{{topicUrl}}'\u003Eel tema\u003C/a\u003E","user_replied_to_post":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E contestó a \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","you_replied_to_post":"\u003Ca href='{{userUrl}}'\u003ETú\u003C/a\u003E contestaste a \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","user_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E contestó a \u003Ca href='{{topicUrl}}'\u003Eel tema\u003C/a\u003E","you_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003ETú\u003C/a\u003E contestaste \u003Ca href='{{topicUrl}}'\u003Eel tema\u003C/a\u003E","user_mentioned_user":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E mencionó a \u003Ca href='{{user2Url}}'\u003E{{another_user}}\u003C/a\u003E","user_mentioned_you":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E \u003Ca href='{{user2Url}}'\u003Ete\u003C/a\u003E mencionó","you_mentioned_user":"\u003Ca href='{{user1Url}}'\u003ETú\u003C/a\u003E mencionaste a \u003Ca href='{{user2Url}}'\u003E{{user}}\u003C/a\u003E","posted_by_user":"Publicado por \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","posted_by_you":"Publicado por \u003Ca href='{{userUrl}}'\u003Eti\u003C/a\u003E","sent_by_user":"Enviado por \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","sent_by_you":"Enviado por \u003Ca href='{{userUrl}}'\u003Eti\u003C/a\u003E"},"user_action_groups":{"1":"Likes dados","2":"Likes recibidos","3":"Marcadores","4":"temas","5":"Mensajes","6":"Respuestas","7":"Menciones","9":"Citas","10":"Favoritos","11":"Ediciones","12":"Items enviados","13":"Bandeja de entrada"},"user_action_descriptions":{"6":"Respuestas"},"user":{"profile":"Perfil","title":"Usuario","mute":"Silenciar","edit":"Editar Preferencias","download_archive":"descargar un archivo con mis publicaciones","private_message":"Mensaje privado","private_messages":"Mensajes","activity_stream":"Actividad","preferences":"Preferencias","bio":"Acerca de mí","change_password":{"action":"cambiar","success":"(email enviado)","in_progress":"(enviando email)","error":"(error)"},"invited_by":"Invitado por","trust_level":"Nivel de Confianza","external_links_in_new_tab":"Abrir todos los links externos en una nueva pestaña","enable_quoting":"Activar respuesta citando el texto resaltado","change_username":{"action":"cambiar","title":"Cambiar nombre de usuario","confirm":"Si cambias tu nombre de usuario, todas las citas de tus publicaciones y tus menciones desaparecerán. ¿Estás totalmente seguro de querer cambiarlo?","taken":"Lo sentimos, pero este nombre de usuario no está disponible.","error":"Ha ocurrido un error al cambiar tu nombre de usuario.","invalid":"Este nombre de usuario no es válido. Debe incluir sólo números y letras"},"change_email":{"action":"cambiar","title":"Cambiar Email","taken":"Lo sentimos, pero este email no está disponible.","error":"Ha ocurrido un error al cambiar tu email. ¿Tal vez esa dirección ya está en uso?","success":"Te hemos enviado un email a esa dirección. Por favor sigue las instrucciones de confirmación."},"email":{"title":"Email","instructions":"Tu email nunca será mostrado al público.","ok":"De acuerdo. Te enviaremos un email para confirmar.","invalid":"Por favor ingresa una dirección de email válida.","authenticated":"Tu email ha sido autenticado por {{provider}}.","frequency":"Sólo te enviaremos emails si no te hemos visto recientemente y todavía no has visto lo que te estamos enviando."},"name":{"title":"Nombre","instructions":"La versión larga de tu nombre; no tiene por qué ser único. Usado para coincidir con @nombre y mostrado sólo en tu página de usuario.","too_short":"Tu nombre es demasiado corto.","ok":"Tu nombre es válido."},"username":{"title":"Nombre de usuario","instructions":"Debe ser único, sin espacios. La gente puede mencionarte como @{{username}}.","short_instructions":"La gente puede mencionarte como @{{username}}.","available":"Tu nombre de usuario está disponible.","global_match":"El email coincide con el nombre de usuario registrado.","global_mismatch":"Ya está registrado. Intenta {{suggestion}}?","not_available":"No disponible. Intenta {{suggestion}}?","too_short":"Tu nombre de usuario es demasiado corto.","too_long":"Tu nombre de usuario es demasiado largo.","checking":"Comprobando disponibilidad de nombre de usuario...","enter_email":"Nombre de usuario encontrado. Por favor, Introduce el email correspondiente."},"password_confirmation":{"title":"Introduce de nuevo la contraseña"},"last_posted":"Último publicado","last_emailed":"Último Enviado por email","last_seen":"Último visto","created":"Creado el","log_out":"Cerrar sesión","website":"Sitio Web","email_settings":"Email","email_digests":{"title":"Cuando no visite el sitio, envíenme un resumen vía email de las novedades","daily":"diariamente","weekly":"semanalmente","bi_weekly":"cada dos semanas"},"email_direct":"Quiero recibir un email cuando alguien cite, responda, o mencione tu @nombredeusuario","email_private_messages":"Quiero recibir un email cuando alguien te envíe un mensaje privado","other_settings":"Otros","new_topic_duration":{"label":"Considerar que los temas son nuevos cuando","not_viewed":"Todavía no los he visto","last_here":"han sido publicados después de la última vez que estuve aquí","after_n_days":{"one":"han sido publicados en el último día","other":"han sido publicados en los últimos {{count}} días"},"after_n_weeks":{"one":"han sido publicados en la última semana","other":"han sido publicados en las últimas {{count}} semanas"}},"auto_track_topics":"Seguir automáticamente los temas que leo","auto_track_options":{"never":"nunca","always":"siempre","after_n_seconds":{"one":"después de 1 segundo","other":"después de {{count}} segundos"},"after_n_minutes":{"one":"después de 1 minuto","other":"después de {{count}} minutos"}},"invited":{"title":"Invitaciones","user":"Invitar Usuario","none":"{{username}} no ha invitado a ningún usuario al sitio.","redeemed":"Invitaciones aceptadas","redeemed_at":"Aceptada el","pending":"Invitaciones pendientes","topics_entered":"temas vistos","posts_read_count":"Publicaciones leídas","rescind":"Eliminar invitación","rescinded":"Invitación eliminada","time_read":"Tiempo de lectura","days_visited":"Días visitados","account_age_days":"Antigüedad de la cuenta en días"},"password":{"title":"Contraseña","too_short":"Tu contraseña es muy corta.","ok":"Tu contraseña es valida."},"ip_address":{"title":"Última dirección IP"},"avatar":{"title":"Avatar"},"filters":{"all":"Todos"},"stream":{"posted_by":"Publicado por","sent_by":"Enviado por","private_message":"mensaje privado","the_topic":"el tema"}},"loading":"Cargando...","close":"Cerrar","learn_more":"aprender más...","year":"año","year_desc":"temas publicados en los últimos 365 días","month":"mes","month_desc":"temas publicados en los últimos 30 días","week":"semana","week_desc":"temas publicados en los últimos 7 días","first_post":"Primera publicación","mute":"Silenciar","unmute":"Quitar silencio","best_of":{"title":"Lo Mejor De","description":"Hay \u003Cb\u003E{{count}}\u003C/b\u003E publicaciones en este tema. ¡Son muchas! ¿Te gustaría ahorrar algo de tiempo viendo sólo las publicaciones con más interacciones y respuestas?","button":"Cambiar a la vista \"Lo Mejor De\""},"private_message_info":{"title":"Conversación Privada","invite":"Invitar Otros..."},"email":"Email","username":"Nombre de usuario","last_seen":"Visto por última vez","created":"Creado","trust_level":"Nivel de confianza","create_account":{"title":"Crear Cuenta","action":"¡Crea una ahora!","invite":"¿Todavía no tienes cuenta?","failed":"Algo salió mal, tal vez este email ya fue registrado, intenta con el enlace 'olvidé la contraseña'"},"forgot_password":{"title":"Olvidé mi Contraseña","action":"Olvidé mi contraseña","invite":"Introduce tu nombre de usuario o tu dirección de email, y te enviaremos un correo electrónico para cambiar tu contraseña.","reset":"Cambiar Contraseña","complete":"Dentro de poco deberías recibir un email con las instrucciones para cambiar tu contraseña."},"login":{"title":"Iniciar Sesión","username":"Nombre de usuario","password":"Contraseña","email_placeholder":"dirección de email o nombre de usuario","error":"Error desconocido","reset_password":"Reestabler contraseña","logging_in":"Iniciando sesión...","or":"O","authenticating":"Autenticando...","awaiting_confirmation":"Tu cuenta está pendiente de activación, usa el enlace de 'olvidé contraseña' para recibir otro email de activación.","awaiting_approval":"Tu cuenta todavía no ha sido aprobada por un moderador. Recibirás un email cuando sea aprobada.","not_activated":"No puedes iniciar sesión todavía. Anteriormente te hemos enviado un email de activación a \u003Cb\u003E{{sentTo}}\u003C/b\u003E. Por favor sigue las instrucciones en ese email para activar tu cuenta.","resend_activation_email":"Has click aquí para enviar el email de activación nuevamente.","sent_activation_email_again":"Te hemos enviado otro email de activación a \u003Cb\u003E{{currentemail}}\u003C/b\u003E. Podría tardar algunos minutos en llegar; asegúrate de revisar tu carpeta de spam.","google":{"title":"con Google","message":"Autenticando con Google (asegúrate de desactivar cualquier bloqueador de pop ups)"},"twitter":{"title":"con Twitter","message":"Autenticando con Twitter (asegúrate de desactivar cualquier bloqueador de pop ups)"},"facebook":{"title":"con Facebook","message":"Autenticando con Facebook (asegúrate de desactivar cualquier bloqueador de pop ups)"},"yahoo":{"title":"con Yahoo","message":"Autenticando con Yahoo (asegúrate de desactivar cualquier bloqueador de pop ups)"},"github":{"title":"con GitHub","message":"Autenticando con GitHub (asegúrate de desactivar cualquier bloqueador de pop ups)"},"persona":{"title":"con Persona","message":"Autenticando con Mozilla Persona (asegúrate de desactivar cualquier bloqueador de pop ups)"}},"composer":{"posting_not_on_topic":"Estas respondiendo al tema \"{{title}}\", pero estas viendo un tema distinto.","saving_draft_tip":"guardando","saved_draft_tip":"guardado","saved_local_draft_tip":"guardado localmente","similar_topics":"Tu tema es similar a...","drafts_offline":"borradores offline","min_length":{"need_more_for_title":"{{n}} para completar el título","need_more_for_reply":"{{n}} para completar la respuesta"},"save_edit":"Guardar edición","reply_original":"Responder en el tema original","reply_here":"Responder aquí","reply":"Responder","cancel":"Cancelar","create_topic":"Crear tema","create_pm":"Crear mensaje privado","users_placeholder":"Agregar usuario","title_placeholder":"Escribe tu título aquí. Explica en pocas palabras sobre qué trata esta discusión.","reply_placeholder":"Escribe tu respuesta aquí. Puedes usar Markdown o BBCode para dar formato. Arrastra o pega una imagen aquí para subirla.","view_new_post":"Ver tu nueva publicación.","saving":"Guardando...","saved":"¡Guardado!","saved_draft":"Tienes en progreso un borrador de una publicación. Haz click en cualquier parte de este recuadro para reanudar la edición.","uploading":"Subiendo...","show_preview":"mostrar vista previa \u0026raquo;","hide_preview":"\u0026laquo; ocultar vista previa","bold_title":"Negrita","bold_text":"Texto en negrita","italic_title":"Cursiva","italic_text":"Texto en cursiva","link_title":"Hipervinculo","link_description":"introduzca descripción de enlace aquí","link_dialog_title":"Insertar enlace","link_optional_text":"titulo opcional","quote_title":"Cita","quote_text":"Cita","code_title":"Código de muestra","code_text":"introduce código aquí","upload_title":"Imagen","upload_description":"introduce una descripción de la imagen aquí","olist_title":"Lista numerada","ulist_title":"Lista con viñetas","list_item":"Lista de items","heading_title":"Encabezado","heading_text":"Encabezado","hr_title":"Linea Horizontal","undo_title":"Deshacer","redo_title":"Rehacer","help":"Ayuda de edición Markdown"},"notifications":{"title":"notificaciones por menciones de tu @nombre, respuestas a tus publicaciones y temas, mensajes privados, etc.","none":"No tienes notificaciones por el momento.","more":"ver antiguas notificaciones","mentioned":"\u003Cspan title='mencionado' class='icon'\u003E@\u003C/span\u003E {{username}} {{link}}","quoted":"\u003Ci title='citado' class='icon icon-quote-right'\u003E\u003C/i\u003E {{username}} {{link}}","replied":"\u003Ci title='replicado' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","posted":"\u003Ci title='replicado' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","edited":"\u003Ci title='editado' class='icon icon-pencil'\u003E\u003C/i\u003E {{username}} {{link}}","liked":"\u003Ci title='gustaron' class='icon icon-heart'\u003E\u003C/i\u003E {{username}} {{link}}","private_message":"\u003Ci class='icon icon-envelope-alt' title='mensaje privado'\u003E\u003C/i\u003E Tienes un mensaje privado de {{username}}: {{link}}","invited_to_private_message":"{{username}} te ha invitado a una conversación privada: {{link}}","invitee_accepted":"\u003Ci title='aceptó tu invitación' class='icon icon-signin'\u003E\u003C/i\u003E {{username}} ha aceptado tu invitación","moved_post":"\u003Ci title='publicación trasladada' class='icon icon-arrow-right'\u003E\u003C/i\u003E {{username}} ha traladado la publicación a {{link}}"},"upload_selector":{"title":"Insertar imagen","from_my_computer":"Desde mi dispositivo","from_the_web":"Desde la Web","add_title":"Agregar imagen","remote_tip":"introduce la dirección de una imagen de la siguiente forma: http://ejemplo.com/imagen.jpg","local_tip":"click para seleccionar la imagen desde su dispositivo.","upload_title":"Subir","uploading":"Subiendo imagen"},"search":{"title":"buscar por temas, publicaciones, usuarios o categorías","placeholder":"escribe tu búsqueda aquí","no_results":"No se encontraron resultados.","searching":"Buscando ...","prefer":{"user":"la búsqueda preferirá resultados por @{{username}}","category":"la búsqueda preferirá resultados en {{category}}"}},"site_map":"ir a otra lista de temas o categoría","go_back":"volver","current_user":"ir a tu página de usuario","favorite":{"title":"Favoritos","help":"agregar este tema a tu lista de favoritos"},"topics":{"none":{"favorited":"Todavía no has marcado ningún tema como favorito. Para marcar uno, haz click o toca con el dedo la estrella que está junto al título del tema.","unread":"No existen temas que sigas y que ya no hayas leído.","new":"No tienes temas nuevos por leer.","read":"Todavía no has leído ningún tema.","posted":"Todavía no has publicado en ningún tema.","latest":"No hay temas populares. Qué pena...","category":"No hay temas en la categoría {{category}}."},"bottom":{"latest":"No hay más temas populares para leer.","posted":"No hay más temas publicados para leer.","read":"No hay más temas leídos.","new":"No hay temas nuevos para leer.","unread":"No hay más temas que no hayas leídos.","favorited":"No hay más temas favoritos para leer.","category":"No hay más temas en la categoría {{category}}."}},"topic":{"create":"Crear tema","create_long":"Crear un nuevo tema","private_message":"Comenzar una conversación privada","list":"temas","new":"nuevo tema","title":"tema","loading_more":"Cargando más temas...","loading":"Cargando tema...","invalid_access":{"title":"Este tema es privado","description":"Lo sentimos, ¡no tienes acceso a este tema!"},"server_error":{"title":"El tema falló al intentar ser cargado","description":"Lo sentimos, no pudimos cargar el tema, posiblemente debido a problemas de conexión. Por favor, inténtalo nuevamente. Si el problema persiste, por favor contacta con soporte."},"not_found":{"title":"tema no encontrado","description":"Lo sentimos, no pudimos encontrar ese tema. ¿Tal vez fue eliminado por un moderador?"},"unread_posts":"tienes {{unread}} viejas publicaciones sin leer en este tema","new_posts":"hay {{new_posts}} nuevas publicaciones en este tema desde la última vez que lo leíste","likes":{"one":"este tema le gusta a 1 persona","other":"este tema les gusta a {{count}} personas"},"back_to_list":"Volver a la lista de temas","options":"Opciones del tema","show_links":"mostrar enlaces dentro de este tema","toggle_information":"detalles del tema","read_more_in_category":"Quieres leer mas? Consulta otros temas en {{catLink}} or {{latestLink}}.","read_more":"¿Quieres seguir leyendo? {{catLink}} or {{latestLink}}.","browse_all_categories":"Ver todas las categorías","view_latest_topics":"ver los últimos temas","suggest_create_topic":"¿Por qué no creas un tema?","read_position_reset":"Tu posición de lectura se ha reiniciado.","jump_reply_up":"saltar a respuesta anterior","jump_reply_down":"saltar a ultima respuesta","progress":{"title":"avances","jump_top":"saltar al primer mensaje","jump_bottom":"saltar al ultimo mensaje","total":"total","current":"mensaje actual"},"notifications":{"title":"","reasons":{"3_2":"Recibirás notificaciones porque estás viendo este tema.","3_1":"Recibirás notificaciones porque creaste este tema.","3":"Recibirás notificaciones porque estás viendo este tema.","2_4":"Recibirás notificaciones porque has posteado una respuesta en este tema.","2_2":"Recibirás notificaciones porque estás siguiendo este tema.","2":"Recibirás notificaciones porque tu \u003Ca href=\"/users/{{username}}/preferences\"\u003Ehas leido este tema\u003C/a\u003E.","1":"Serás notificado solo si alguien menciona tu @nombre o responde a tu post.","1_2":"Serás notificado solo si alguien menciona tu @nombre o responde a tu post.","0":"Estás ignorando todas las notificaciones en este tema.","0_2":"Estás ignorando todas las notificaciones en este tema."},"watching":{"title":"Viendo","description":"igual que Siguiendo, además serás notificado de todos los nuevos posts."},"tracking":{"title":"Siguiendo","description":"serás notificado de los mensajes sin leer, menciones a tu @nombre y respuestas a tus posts."},"regular":{"title":"Normal","description":"serás notificado solo si alguien menciona tu @nombre o responde a tus posts."},"muted":{"title":"Silenciado","description":"no serás notificado de nada en este tema, y no aparecerá en tu pestaña de no leidos."}},"actions":{"delete":"Eliminar tema","open":"Abrir tema","close":"Cerrar tema","unpin":"Dejar de destacar","pin":"Destacar tema","unarchive":"Desarchivar tema","archive":"Archivar tema","invisible":"Hacer Invisible","visible":"Hacer Visible","reset_read":"Restablecer Datos","multi_select":"Selecciona los mensajes a mover","convert_to_topic":"Convertir en tema normal"},"reply":{"title":"Responder","help":"comienza a escribir una respuesta a este tema"},"clear_pin":{"title":"Eliminar Destacado","help":"Elimina el estado 'Destacado' de este tema para que no aparezca más en lo más alto de tu lista de temas"},"share":{"title":"Compartir","help":"comparte un link a este tema"},"inviting":"Invitando...","invite_private":{"title":"Invitar por mensaje Privado","email_or_username":"Invitación por email o nombre de usuario","email_or_username_placeholder":"dirección de email o nombre de usuario","action":"Invitar","success":"¡Gracias! Hemos invitado a ese usuario a participar en este mensaje privado.","error":"Lo sentimos hubo un error invitando a ese usuario."},"invite_reply":{"title":"Invitar amigos a responder","action":"Invitar por email","help":"enviar invitaciones a tus amigos para que puedan responder a este tema con un solo click","email":"Le enviaremos a tu amigo un breve email permitiéndole responder a este tema haciendo click en un enlace.","email_placeholder":"dirección de email","success":"¡Gracias! Hemos enviado una invitación a \u003Cb\u003E{{email}}\u003C/b\u003E. Te avisaremos cuando acepte su invitación. Verifica la pestaña de invitaciones en tu pagina de usuario para llevar un registro de quién has invitado.","error":"Lo sentimos, no podemos invitar a esa persona. ¿Tal vez ya es un usuario?"},"login_reply":"Inicia sesión para responder","filters":{"user":"Estás viendo sólo {{n_posts}} {{by_n_users}}.","n_posts":{"one":"1 mensaje","other":"{{count}} mensajes"},"by_n_users":{"one":"hechos por 1 usuario específico","other":"hechos por {{count}} usuarios específicos"},"best_of":"Estás viendo el {{n_best_posts}} {{of_n_posts}}.","n_best_posts":{"one":"1 mejor mensaje","other":"{{count}} mejores mensajes"},"of_n_posts":{"one":"de 1 en el tema","other":"de {{count}} en el tema"},"cancel":"Mostrar todos los mensajes en este tema de nuevo.."},"move_selected":{"title":"Mover mensajes seleccionados","topic_name":"Nuevo nombre:","error":"Lo sentimos, hubo un error al mover los mensajes.","instructions":{"one":"Está a punto de crear un nuevo tema y rellenarlo con el mensaje que ha seleccionado.","other":"Está a punto de crear un nuevo tema y rellenarlo con el \u003Cb\u003E{{count}}\u003C/b\u003E mensajes que ha seleccionado."}},"multi_select":{"select":"seleccionar","selected":"seleccionado ({{count}})","delete":"eliminar seleccionado","cancel":"cancelar selección","move":"mover seleccionado","description":{"one":"Ha seleccionado \u003Cb\u003E1\u003C/b\u003E mensaje.","other":"Ha seleccionado \u003Cb\u003E{{count}}\u003C/b\u003E mensajes."}}},"post":{"reply":"Respondiendo a {{link}} por {{replyAvatar}} {{username}}","reply_topic":"Responder a {{link}}","quote_reply":"citar respuesta","edit":"Edición {{link}} por {{replyAvatar}} {{username}}","post_number":"mensaje {{number}}","in_reply_to":"en respuesta a","reply_as_new_topic":"Responder como nuevo tema","continue_discussion":"Continuando la discusión desde {{postLink}}:","follow_quote":"ir al mensaje citado","deleted_by_author":"(mensaje eliminado por el autor)","has_replies":{"one":"Respuesta","other":"Respuestas"},"errors":{"create":"Lo sentimos, hubo un error al crear tu publicación. Por favor, inténtalo de nuevo.","edit":"Lo sentimos, hubo un error al editar tu publicación. Por favor, inténtalo de nuevo.","upload":"Lo sentimos, hubo un error al subir el archivo. Por favor, inténtalo de nuevo."},"abandon":"¿Estás seguro que deseas abandonar tu publicación?","archetypes":{"save":"Guardar opciones"},"controls":{"reply":"componer una respuesta para esta publicación","like":"me gusta esta publicación","edit":"edita esta publicación","flag":"marca esta publicación para atención de los moderadores","delete":"elimina esta publicación","undelete":"deshace la eliminación de esta publicación","share":"comparte un enlace a esta publicación","more":"Más"},"actions":{"flag":"Informar","clear_flags":{"one":"Limpiar informe","other":"Limpiar informes"},"it_too":{"off_topic":"Informar de esto también","spam":"Informar de esto también","inappropriate":"Informar de esto también","custom_flag":"Informar de esto también","bookmark":"Guardarlo como favorito tambien","like":"Hacer \"Me gusta\" también","vote":"Votar por esto también"},"undo":"Deshacer {{alsoName}}","by_you_and_others":{"zero":"Tú {{long_form}}","one":"Tú y otra persona {{long_form}}","other":"Tú y {{count}} other personas {{long_form}}"},"by_others":{"one":"1 persona {{long_form}}","other":"{{count}} personas {{long_form}}"}},"edits":{"one":"1 edición","other":"{{count}} ediciones","zero":"sin ediciones"},"delete":{"confirm":{"one":"¿Está seguro que desea eliminar el mensaje?","other":"¿Está seguro que desea eliminar todos esos mensajes?"}}},"category":{"none":"(sin categoría)","edit":"editar","edit_long":"Editar categoría","view":"Ver temas en la categoría","delete":"Eliminar categoría","create":"Crear categoría","more_posts":"ver todos {{posts}}...","name":"Nombre de la categoría","description":"Descripción","topic":"categoría","color":"Color","name_placeholder":"Debe ser corto y conciso.","color_placeholder":"Cualquier color web","delete_confirm":"¿Estás seguro de que quieres eliminar esta categoría?","list":"Lista de categorías","no_description":"No existe descripción de esta categoría, editar la definición de tema.","change_in_category_topic":"Editar descripción"},"flagging":{"title":"¿Por qué estas informando sobre este mensaje?","action":"Informar sobre este mensaje","cant":"Lo sentimos, no se puede informar sobre el tema en este momento.","custom_placeholder":"¿Por qué este mensaje requiere atención de un moderador? Haznos saber específicamente qué te preocupa, e intenta proporcionar enlaces relevantes cuando sea posible.","custom_message":{"at_least":"introduce al menos {{n}} caracteres","more":"{{n}} para ir...","left":"{{n}} restantes"}},"topic_summary":{"title":"Resumen de temas","links_shown":"mostrar los {{totalLinks}} links..."},"topic_statuses":{"locked":{"help":"este tema está cerrado; ya no aceptan nuevas respuestas"},"pinned":{"help":"este tema está destacado; se mostrará en la parte superior de su categoría"},"archived":{"help":"este tema está archivado; está congelado y no puede ser cambiado"},"invisible":{"help":"este tema es invisible; no se mostrará en la lista de temas, y sólo se puede acceder a través de un enlace directo"}},"posts":"Publicaciones","posts_long":"{{number}} publicaciones en este tema","original_post":"Publicación Original","views":"Vistas","replies":"Respuestas","views_long":"este tema ha sido visto {{number}} veces","activity":"Actividad","likes":"Les gusta","top_contributors":"Participantes","category_title":"Categoría","history":"Historia","changed_by":"por {{author}}","categories_list":"Lista de categorías","filters":{"latest":{"title":"Populares","help":"los temas más recientes más populares"},"favorited":{"title":"Favoritos","help":"temas que has marcado como favoritos"},"read":{"title":"Leídos","help":"temas que ya has leído"},"categories":{"title":"Categorías","title_in":"Categoría - {{categoryName}}","help":"todos los temas agrupados por categoría"},"unread":{"title":{"zero":"No leídos","one":"No leído (1)","other":"No leídos ({{count}})"},"help":"seguir temas con mensajes no leídos"},"new":{"title":{"zero":"Nuevos","one":"Nuevo (1)","other":"Nuevos ({{count}})"},"help":"temas nuevos desde su última visita"},"posted":{"title":"Mis Mensajes","help":"temas que has publicado"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"últimos temas en el {{categoryName}} categoría"}},"type_to_filter":"type to filter...","admin":{"title":"Administrador","dashboard":{"title":"Panel","welcome":"Bienvenido a la sección de administración.","version":"Versión instalada","up_to_date":"Está ejecutando la última versión de Discourse.","critical_available":"Actualización crítica disponible.","updates_available":"Hay actualizaciones disponibles.","please_upgrade":"Por favor actualice!","latest_version":"Última versión","reports":{"today":"Hoy","yesterday":"Ayer","last_7_days":"Últimos 7 Días","last_30_days":"Últimos 30 Días","all_time":"Todo el tiempo","7_days_ago":"Hace 7 Días","30_days_ago":"Hace 30 Días"}},"flags":{"title":"Reportes","old":"Antiguo","active":"Activo","clear":"Limpiar Reportes","clear_title":"descartar todos los reportes en este mensaje (will unhide hidden posts)","delete":"Eliminar Mensaje","delete_title":"eliminar mensaje (si es el primer mensaje eliminar tema)","flagged_by":"Reportado por"},"groups":{"title":"Groups","edit":"Edit Groups","selector_placeholder":"add users","name_placeholder":"Group name, no spaces, same as username rule","about":"Edit your group membership and names here","can_not_edit_automatic":"Automatic group membership is determined automatically, administer users to assign roles and trust levels","delete":"Delete","delete_confirm":"Delete this group?","delete_failed":"Unable to delete group. If this is an automatic group, it cannot be destroyed."},"api":{"title":"API","long_title":"API Information","key":"Key","generate":"Generate API Key","regenerate":"Regenerate API Key","info_html":"Your API key will allow you to create and update topics using JSON calls.","note_html":"Keep this key \u003Cstrong\u003Esecret\u003C/strong\u003E, all users that have it may create arbitrary posts on the forum as any user."},"customize":{"title":"Personalizar","header":"Encabezado","css":"Hoja de estilo","override_default":"No incluir hoja de estilo estándar","enabled":"Activado?","preview":"vista previa","undo_preview":"deshacer vista previa","save":"Guardar","delete":"Eliminar","delete_confirm":"Eliminar esta personalización?"},"email":{"title":"Email","sent_at":"Enviado a","email_type":"Email","to_address":"A dirección","test_email_address":"dirección de email para probar","send_test":"enviar mensaje de prueba","sent_test":"enviado!"},"impersonate":{"title":"Hacerse pasar por el Usuario","username_or_email":"Nombre de usuario o Email de Usuario","help":"Utilice esta herramienta para suplantar una cuenta de usuario con fines de depuración.","not_found":"Dicho usuario no puede ser encontrado.","invalid":"Lo sentimos, usted no puede hacerse pasar por ese usuario."},"users":{"title":"Usuarios","create":"Añadir Usuario como Administrador","last_emailed":"Ultimo email enviado","not_found":"Lo sentimos ese nombre de usuario no existe en el sistema.","active":"Activo","nav":{"new":"Nuevo","active":"Activo","pending":"Pendiente"},"approved":"Aprobado?","approved_selected":{"one":"aprobar usuario","other":"aprobar usuarios ({{count}})"}},"user":{"suspend_failed":"Algo salió mal baneando este usuario {{error}}","unsuspend_failed":"Algo salió mal quitando ban a este usuario {{error}}","suspend_duration":"¿Cuánto tiempo le gustaría aplicar ban al usuario? (days)","delete_all_posts":"Eliminar todos los mensajes","suspend":"Banear","unsuspend":"Quitar ban","suspended":"Baneado?","moderator":"Moderador?","admin":"Administrador?","show_admin_profile":"Administrador","refresh_browsers":"Forzar recarga del navegador","show_public_profile":"Ver perfil público","impersonate":"Suplantar a","revoke_admin":"Revocar Administrador","grant_admin":"Conceder Administración","revoke_moderation":"Revocar Moderación","grant_moderation":"Conceder Moderación","reputation":"Reputación","permissions":"Permisos","activity":"Actividad","like_count":"Me gusta Recibidos","private_topics_count":"temas Privados","posts_read_count":"Mensajes Leídos","post_count":"Mensajes Creados","topics_entered":"temas Ingresados","flags_given_count":"Reportes Dados","flags_received_count":"Reportes Recibidos","approve":"Aprobar","approved_by":"aprobado por","time_read":"Tiempo de lectura"},"site_settings":{"show_overriden":"Sólo mostrar lo sobreescrito","title":"Ajustes del Sitio","reset":"Reestabler los ajustes por defecto"}}}}};
I18n.locale = 'es';
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
// language : spanish (es)
// author : Julio Napurí : https://github.com/julionc

moment.lang('es', {
    months : "enero_febrero_marzo_abril_mayo_junio_julio_agosto_septiembre_octubre_noviembre_diciembre".split("_"),
    monthsShort : "ene._feb._mar._abr._may._jun._jul._ago._sep._oct._nov._dic.".split("_"),
    weekdays : "domingo_lunes_martes_miércoles_jueves_viernes_sábado".split("_"),
    weekdaysShort : "dom._lun._mar._mié._jue._vie._sáb.".split("_"),
    weekdaysMin : "Do_Lu_Ma_Mi_Ju_Vi_Sá".split("_"),
    longDateFormat : {
        LT : "H:mm",
        L : "DD/MM/YYYY",
        LL : "D [de] MMMM [de] YYYY",
        LLL : "D [de] MMMM [de] YYYY LT",
        LLLL : "dddd, D [de] MMMM [de] YYYY LT"
    },
    calendar : {
        sameDay : function () {
            return '[hoy a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
        },
        nextDay : function () {
            return '[mañana a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
        },
        nextWeek : function () {
            return 'dddd [a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
        },
        lastDay : function () {
            return '[ayer a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
        },
        lastWeek : function () {
            return '[el] dddd [pasado a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
        },
        sameElse : 'L'
    },
    relativeTime : {
        future : "en %s",
        past : "hace %s",
        s : "unos segundos",
        m : "un minuto",
        mm : "%d minutos",
        h : "una hora",
        hh : "%d horas",
        d : "un día",
        dd : "%d días",
        M : "un mes",
        MM : "%d meses",
        y : "un año",
        yy : "%d años"
    },
    ordinal : '%dº',
    week : {
        dow : 1, // Monday is the first day of the week.
        doy : 4  // The week that contains Jan 4th is the first week of the year.
    }
});

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
