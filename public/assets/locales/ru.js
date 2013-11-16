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
MessageFormat.locale.ru = function (n) {
  if ((n % 10) == 1 && (n % 100) != 11) {
    return 'one';
  }
  if ((n % 10) >= 2 && (n % 10) <= 4 &&
      ((n % 100) < 12 || (n % 100) > 14) && n == Math.floor(n)) {
    return 'few';
  }
  if ((n % 10) === 0 || ((n % 10) >= 5 && (n % 10) <= 9) ||
      ((n % 100) >= 11 && (n % 100) <= 14) && n == Math.floor(n)) {
    return 'many';
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
    })({});I18n.translations = {"ru":{"js":{"number":{"human":{"storage_units":{"format":"! '%n %u'","units":{"byte":{"one":"Байт","other":"Байт","few":"Байта","many":"Байт"},"gb":"ГБ","kb":"КБ","mb":"МБ","tb":"ТБ"}}}},"dates":{"tiny":{"half_a_minute":"\u003C 1мин","less_than_x_seconds":{"one":"\u003C 1сек","other":"\u003C %{count}сек","few":"\u003C %{count}сек","many":"\u003C %{count}сек"},"x_seconds":{"one":"1сек","other":"%{count}сек","few":"%{count}сек","many":"%{count}сек"},"less_than_x_minutes":{"one":"\u003C 1мин","other":"\u003C %{count}мин","few":"\u003C %{count}мин","many":"\u003C %{count}мин"},"x_minutes":{"one":"1м","other":"%{count}мин","few":"%{count}мин","many":"%{count}мин"},"about_x_hours":{"one":"1ч","other":"%{count}ч","few":"%{count}ч","many":"%{count}ч"},"x_days":{"one":"1д","other":"%{count}д","few":"%{count}д","many":"%{count}д"},"about_x_years":{"one":"1г","other":"%{count}лет","few":"%{count}лет","many":"%{count}лет"},"over_x_years":{"one":"\u003E 1г","other":"\u003E %{count}лет","few":"\u003E %{count}лет","many":"\u003E %{count}лет"},"almost_x_years":{"one":"1г","other":"%{count}лет","few":"%{count}лет","many":"%{count}лет"}},"medium":{"x_minutes":{"one":"1 минута","other":"%{count} минут","few":"%{count} минуты","many":"%{count} минут"},"x_hours":{"one":"1 час","other":"%{count} часов","few":"%{count} часа","many":"%{count} часов"},"x_days":{"one":"1 день","other":"%{count} дней","few":"%{count} дня","many":"%{count} дней"}},"medium_with_ago":{"x_minutes":{"one":"минуту назад","other":"%{count} минут назад","few":"%{count} минуты назад","many":"%{count} минут назад"},"x_hours":{"one":"час назад","other":"%{count} часов назад","few":"%{count} часа назад","many":"%{count} часов назад"},"x_days":{"one":"день назад","other":"%{count} дней назад","few":"%{count} дня назад","many":"%{count} дней назад"}}},"share":{"topic":"поделиться ссылкой на тему","post":"ссылка на сообщение #%{postNumber}","close":"закрыть","twitter":"поделиться ссылкой через Twitter","facebook":"поделиться ссылкой через Facebook","google+":"поделиться ссылкой через Google+","email":"поделиться ссылкой по email"},"edit":"отредактировать название и категорию темы","not_implemented":"Извините, эта функция еще не реализована!","no_value":"Нет","yes_value":"Да","of_value":"из","generic_error":"Извините, произошла ошибка.","generic_error_with_reason":"Произошла ошибка: %{error}","log_in":"Войти","age":"Возраст","last_post":"Последнее сообщение","joined":"Присоединен","admin_title":"Админка","flags_title":"Жалобы","show_more":"показать еще","links":"Ссылки","faq":"FAQ","privacy_policy":"Политика конфиденциальности","mobile_view":"Для мобильных устройств","desktop_view":"Для настольных устройств","you":"Вы","or":"или","now":"только что","read_more":"читать еще","more":"Больше","less":"Меньше","never":"никогда","daily":"ежедневно","weekly":"еженедельно","every_two_weeks":"каждые две недели","character_count":{"one":"{{count}} символ","other":"{{count}} символов","few":"{{count}} символа","many":"{{count}} символов"},"in_n_seconds":{"one":"через 1 секунду","other":"через {{count}} секунд","few":"через {{count}} секунды","many":"через {{count}} секунд"},"in_n_minutes":{"one":"через 1 минуту","other":"через {{count}} минут","few":"через {{count}} минуты","many":"через {{count}} минут"},"in_n_hours":{"one":"через 1 час","other":"через {{count}} часов","few":"через {{count}} часа","many":"через {{count}} часов"},"in_n_days":{"one":"через 1 день","other":"через {{count}} дней","few":"через {{count}} дня","many":"через {{count}} дней"},"suggested_topics":{"title":"Похожие темы"},"bookmarks":{"not_logged_in":"Пожалуйста, войдите на форум для добавления в закладки.","created":"Вы добавили сообщение в закладки.","not_bookmarked":"Сообщение прочитано. Щелкните, чтобы добавить в закладки.","last_read":"Это последнее прочитанное сообщение; щелкните, чтобы добавить в избранное."},"new_topics_inserted":"новых тем: {{count}}","show_new_topics":"Показать.","preview":"предпросмотр","cancel":"отмена","save":"Сохранить","saving":"Сохранение...","saved":"Сохранено!","upload":"Загрузить","uploading":"Загрузка...","uploaded":"Загружено!","choose_topic":{"none_found":"Темы не найдены.","title":{"search":"Искать тему по названию, ссылке или уникальному номеру:","placeholder":"введите здесь название темы"}},"user_action":{"user_posted_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E создал \u003Ca href='{{topicUrl}}'\u003Eтему\u003C/a\u003E","you_posted_topic":"\u003Ca href='{{userUrl}}'\u003EВы\u003C/a\u003E создали \u003Ca href='{{topicUrl}}'\u003Eтему\u003C/a\u003E","user_replied_to_post":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E ответил(а) на сообщение \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","you_replied_to_post":"\u003Ca href='{{userUrl}}'\u003EВы\u003C/a\u003E ответили на сообщение \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E","user_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E ответил(а) в \u003Ca href='{{topicUrl}}'\u003Eтеме\u003C/a\u003E","you_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003EВы\u003C/a\u003E ответили в \u003Ca href='{{topicUrl}}'\u003Eтеме\u003C/a\u003E","user_mentioned_user":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E упомянул \u003Ca href='{{user2Url}}'\u003E{{another_user}}\u003C/a\u003E","user_mentioned_you":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E упомянул\u003Ca href='{{user2Url}}'\u003EВас\u003C/a\u003E","you_mentioned_user":"\u003Ca href='{{user1Url}}'\u003EВы\u003C/a\u003E упомянули\u003Ca href='{{user2Url}}'\u003E{{user}}\u003C/a\u003E","posted_by_user":"Размещено пользователем \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","posted_by_you":"Размещено \u003Ca href='{{userUrl}}'\u003EВами\u003C/a\u003E","sent_by_user":"Отправлено пользователем \u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E","sent_by_you":"Отправлено \u003Ca href='{{userUrl}}'\u003EВами\u003C/a\u003E"},"user_action_groups":{"1":"Отдал симпатий","2":"Получил симпатий","3":"Закладки","4":"Темы","5":"Сообщения","6":"Ответы","7":"Упоминания","9":"Цитаты","10":"Избранное","11":"Изменения","12":"Отправленные","13":"Входящие"},"categories":{"all":"Все категории","only_category":"только {{categoryName}}","category":"Категория","posts":"Сообщения","topics":"Темы","latest":"Последние","latest_by":"последние по","toggle_ordering":"изменить сортировку","subcategories":"Подкатегории:"},"user":{"said":"{{username}} писал(а):","profile":"Профайл","show_profile":"Visit Profile","mute":"Отключить","edit":"Настройки","download_archive":"скачать архив ваших сообщений","private_message":"Личное сообщение","private_messages":"Личные сообщения","activity_stream":"Активность","preferences":"Настройки","bio":"Обо мне","invited_by":"Приглашен пользователем","trust_level":"Уровень доверия","notifications":"Уведомления","dynamic_favicon":"Отображать события на favicon","external_links_in_new_tab":"Открывать все внешние ссылки в новой вкладке","enable_quoting":"Позволить отвечать с цитированием выделенного текста","change":"изменить","moderator":"{{user}} - модератор","admin":"{{user}} - админ","deleted":"(удален)","messages":{"all":"Все","mine":"Мои","unread":"Непрочитанные"},"change_password":{"success":"(письмо отправлено)","in_progress":"(отправка письма)","error":"(ошибка)","action":"Отправить сообщение для сброса пароля"},"change_about":{"title":"Изменить информацию обо мне"},"change_username":{"title":"Изменить имя пользователя","confirm":"Если вы измените имя пользователя, то все предыдущие цитирования и обращения по @name станут неработоспособными. Вы уверены, что вы хотите это сделать?","taken":"Имя пользователя уже занято.","error":"При изменении имени пользователя произошла ошибка.","invalid":"Имя пользователя должно состоять только из цифр и латинских букв"},"change_email":{"title":"Изменить Email","taken":"Данный адрес электронной почты недоступен.","error":"Произошла ошибка. Возможно, этот адрес электронной почты уже используется?","success":"На указанный адрес электронной почты отправлено письмо с инструкциями."},"change_avatar":{"title":"Изменить свой аватар","gravatar":"На основе \u003Ca href='//gravatar.com/emails' target='_blank'\u003EGravatar\u003C/a\u003E","gravatar_title":"Измените свой аватар на вебсайте Gravatar","uploaded_avatar":"Собственный аватар","uploaded_avatar_empty":"Добавить собственный аватар","upload_title":"Загрузка собственного аватара","image_is_not_a_square":"Внимание: изображение было кадрировано, т.к. оно не квадратное."},"email":{"title":"Email","instructions":"Ваш адрес электронной почты всегда скрыт.","ok":"Отлично, мы послали вам письмо с инструкциями.","invalid":"Введите действительный адрес электронной почты.","authenticated":"Адрес электронной почты подтвержден {{provider}}.","frequency":"В случае вашего отсутствия на форуме вы будете получать уведомления только о новых сообщениях."},"name":{"title":"Имя","instructions":"Ваше полное имя или псевдоним. Необязательно уникальное. Показывается только на вашей странице пользователя.","too_short":"Ваше имя слишком короткое.","ok":"Допустимое имя."},"username":{"title":"Имя пользователя","instructions":"Должно быть уникальным и без пробелов. Пользователи могут упоминать вас по @username.","short_instructions":"Пользователи могут упоминать вас по @{{username}}.","available":"Имя пользователя доступно.","global_match":"Адрес электронной почты совпадает с зарегистрированным.","global_mismatch":"Уже занято. Попробуйте {{suggestion}}?","not_available":"Недоступно. Попробуйте {{suggestion}}?","too_short":"Имя пользователя слишком короткое.","too_long":"Имя пользователя слишком длинное.","checking":"Проверяю доступность имени пользователя...","enter_email":"Имя пользователя найдено. Введите адрес электронной почты."},"password_confirmation":{"title":"Пароль еще раз"},"last_posted":"Последнее сообщение","last_emailed":"Последнее письмо","last_seen":"Последний визит","created":"Регистрация","log_out":"Выйти","website":"Веб-сайт","email_settings":"Электронная почта","email_digests":{"title":"В случае моего отсутствия на форуме, присылайте мне сводку новостей","daily":"ежедневно","weekly":"еженедельно","bi_weekly":"каждые две недели"},"email_direct":"Получение уведомлений по электронной почте об ответах на ваши сообщения, цитировании вас или упоминании вас по @username","email_private_messages":"Получение уведомлений по электронной почте о личных сообщениях","email_always":"Получать почтовые уведомления и дайджесты даже если я активен на форуме","other_settings":"Прочее","new_topic_duration":{"label":"Считать темы новыми, если","not_viewed":"они еще не просмотрены вами","last_here":"они были размещены после вашего последнего посещения","after_n_days":{"one":"они были размещены за последние сутки","other":"они были размещены за последние {{count}} дней","few":"были размещены за последние {{count}} дня","many":"они были размещены за последние {{count}} дней"},"after_n_weeks":{"one":"они были размещены за последнюю неделю","other":"они были размещены за последние {{count}} недель","few":"они были размещены за последние {{count}} недели","many":"они были размещены за последние {{count}} недель"}},"auto_track_topics":"Автоматически отслеживать темы, которые я просматриваю","auto_track_options":{"never":"никогда","always":"всегда","after_n_seconds":{"one":"спустя 1 секунду","other":"спустя {{count}} секунд","few":"спустя {{count}} секунды","many":"спустя {{count}} секунд"},"after_n_minutes":{"one":"спустя 1 минуту","other":"спустя {{count}} минут","few":"спустя {{count}} минуты","many":"спустя {{count}} минут"}},"invited":{"title":"Приглашения","user":"Приглашенный пользователь","none":"{{username}} не пригласил ни одного пользователя на форум.","redeemed":"Принятые приглашения","redeemed_at":"Принято","pending":"Еще не принятые приглашения","topics_entered":"Просмотрено тем","posts_read_count":"Прочитано сообщений","rescind":"Отозвать приглашение","rescinded":"Приглашение отозвано","time_read":"Время чтения","days_visited":"Дней посещения","account_age_days":"Дней с момента регистрации"},"password":{"title":"Пароль","too_short":"Пароль слишком короткий.","ok":"Допустимый пароль."},"ip_address":{"title":"Последний IP адрес"},"avatar":{"title":"Аватар"},"title":{"title":"Заголовок"},"filters":{"all":"Всего"},"stream":{"posted_by":"Опубликовано","sent_by":"Отправлено","private_message":"личное сообщение","the_topic":"тема"}},"loading":"Загрузка...","close":"Закрыть","learn_more":"подробнее...","year":"год","year_desc":"создано тем за последние 365 дней","month":"месяц","month_desc":"создано тем за последние 30 дней","week":"неделя","week_desc":"создано тем за последние 7 дней","first_post":"Первое сообщение","mute":"Отключить","unmute":"Включить","best_of":{"title":"Наиболее популярное","enabled_description":"Вы просматриваете только популярные сообщения в данной теме. Для просмотра всех сообщений нажмите кнопку ниже.","description":"В теме \u003Cb\u003E{{count}}\u003C/b\u003E сообщений. Хотите сэкономить время и просмотреть только те сообщения, которые привлекли к себе больше всего внимания и ответов?","enable":"Просмотреть наиболее популярные сообщения","disable":"Переключиться в режим просмотра всех сообщений"},"private_message_info":{"title":"Личное сообщение","invite":"Пригласить других...","remove_allowed_user":"Вы действительно хотите удалить {{name}} из данного личного сообщения?"},"email":"Email","username":"Имя пользователя","last_seen":"Был","created":"Тема создана","trust_level":"Уровень доверия","create_account":{"title":"Создать учетную запись","action":"Зарегистрироваться!","invite":"Ещё не зарегистрированы?","failed":"Произошла ошибка. Возможно, этот Email уже используется. Попробуйте восстановить пароль"},"forgot_password":{"title":"Забыли пароль?","action":"Я забыл свой пароль","invite":"Введите ваше имя пользователя или email, и мы отправим вам ссылку на восстановление пароля.","reset":"Сброс пароля","complete":"Если существует аккаунт, совпадающий с именем пользователя или почтовым адресом, то в скором времени вы получите сообщение с инструкциями по сбросу пароля."},"login":{"title":"Войти","username":"Имя пользователя","password":"Пароль","email_placeholder":"email или имя пользователя","error":"Непредвиденная ошибка","reset_password":"Сброс пароля","logging_in":"Проверка...","or":"или","authenticating":"Проверка...","awaiting_confirmation":"Ваша учетная запись требует активации. Для того чтобы получить активационное письмо повторно, воспользуйтесь опцией сброса пароля.","awaiting_approval":"Ваша учетная запись еще не одобрена. Вы получите письмо, когда это случится.","requires_invite":"К сожалению, доступ к форуму только по приглашениям.","not_activated":"Прежде чем вы сможете воспользоваться новой учетной записью, вам необходимо ее активировать. Мы отправили вам на почту \u003Cb\u003E{{sentTo}}\u003C/b\u003E подробные инструкции, как это cделать.","resend_activation_email":"Щелкните здесь, чтобы мы повторно выслали вам письмо для активации учетной записи.","sent_activation_email_again":"По адресу \u003Cb\u003E{{currentEmail}}\u003C/b\u003E повторно отправлено письмо с кодом активации. Доставка сообщения может занять несколько минут. Имейте в виду, что иногда по ошибке письмо может попасть в папку Спам.","google":{"title":"с помощью Google","message":"Вход с помощью учетной записи Google (всплывающие окна должны быть разрешены)"},"twitter":{"title":"с помощью Twitter","message":"Вход с помощью учетной записи Twitter (всплывающие окна должны быть разрешены)"},"facebook":{"title":"с помощью Facebook","message":"Вход с помощью учетной записи Facebook (всплывающие окна должны быть разрешены)"},"cas":{"title":"Войти с помощью CAS","message":"Вход с помощью учетной записи CAS (всплывающие окна должны быть разрешены)"},"yahoo":{"title":"с помощью Yahoo","message":"Вход с помощью учетной записи Yahoo (всплывающие окна должны быть разрешены)"},"github":{"title":"с помощью GitHub","message":"Вход с помощью учетной записи GitHub (всплывающие окна должны быть разрешены)"},"persona":{"title":"с помощью Persona","message":"Вход с помощью учетной записи Mozilla Persona (всплывающие окна должны быть разрешены)"}},"composer":{"posting_not_on_topic":"В какой теме вы хотите ответить?","saving_draft_tip":"сохранение","saved_draft_tip":"сохранено","saved_local_draft_tip":"сохранено локально","similar_topics":"Ваша тема похожа на...","drafts_offline":"Сохраненные черновики","min_length":{"need_more_for_title":"для заголовка необходимо еще {{n}} символов","need_more_for_reply":"осталось {{n}} символов"},"error":{"title_missing":"Необходим заголовок.","title_too_short":"Заголовок должен содержать минимум {{min}} символов.","title_too_long":"Заголовок может содержать максимум {{max}} символов.","post_missing":"Сообщение не может быть пустым.","post_length":"Сообщение должно содержать минимум {{min}} символов.","category_missing":"Нужно выбрать категорию."},"save_edit":"Сохранить","reply_original":"Ответ в первоначальной теме","reply_here":"Ответить в текущей теме","reply":"Ответить","cancel":"Отменить","create_topic":"Создать тему","create_pm":"Написать личное сообщение","users_placeholder":"Добавить пользователя","title_placeholder":"Напечатайте здесь заголовок. В чём, в двух словах, суть предстоящего обсуждения?","reply_placeholder":"Печатайте здесь. Для форматирования текста используйте Markdown и BBCode. Перетяните или вставьте изображение, чтобы загрузить его на сервер.","view_new_post":"Посмотреть созданное вами сообщение.","saving":"Сохранение...","saved":"Сохранено!","saved_draft":"Вы в данный момент создаете сообщение. Нажмите в любом месте, чтобы вернуться к редактированию.","uploading":"Загрузка...","show_preview":"предпросмотр \u0026raquo;","hide_preview":"\u0026laquo; скрыть предпросмотр","quote_post_title":"Процитировать всё сообщение","bold_title":"Выделение жирным","bold_text":"текст, выделенный жирным","italic_title":"Выделение курсивом","italic_text":"текст, выделенный курсивом","link_title":"Ссылка","link_description":"введите описание ссылки","link_dialog_title":"Вставить ссылку","link_optional_text":"необязательное название","quote_title":"Цитата","quote_text":"Цитата","code_title":"Форматированный текст","code_text":"введите форматированный текст","upload_title":"Загрузить","upload_description":"введите здесь описание загружаемого объекта","olist_title":"Нумерованный список","ulist_title":"Маркированный список","list_item":"Элемент списка","heading_title":"Заголовок","heading_text":"Заголовок","hr_title":"Горизонтальный разделитель","undo_title":"Отменить","redo_title":"Повторить","help":"Справка по Markdown","toggler":"скрыть / показать панель редактирования","admin_options_title":"Дополнительные настройки темы","auto_close_label":"Автоматически закрыть тему после:","auto_close_units":"дней"},"notifications":{"title":"уведомления об упоминании @name в сообщениях, ответах на ваши сообщения и темы, личные сообщения и т.д.","none":"На данный момент уведомлений нет.","more":"посмотреть более ранние уведомления","mentioned":"\u003Cspan title='mentioned' class='icon'\u003E@\u003C/span\u003E {{username}} {{link}}","quoted":"\u003Ci title='quoted' class='icon icon-quote-right'\u003E\u003C/i\u003E {{username}} {{link}}","replied":"\u003Ci title='replied' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","posted":"\u003Ci title='replied' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","edited":"\u003Ci title='edited' class='icon icon-pencil'\u003E\u003C/i\u003E {{username}} {{link}}","liked":"\u003Ci title='liked' class='icon icon-heart'\u003E\u003C/i\u003E {{username}} {{link}}","private_message":"\u003Ci class='icon icon-envelope-alt' title='private message'\u003E\u003C/i\u003E {{username}} {{link}}","invited_to_private_message":"\u003Ci class='icon icon-envelope-alt' title='private message'\u003E\u003C/i\u003E {{username}} {{link}}","invitee_accepted":"\u003Ci title='принятое приглашение' class='icon icon-signin'\u003E\u003C/i\u003E {{username}} принял ваше приглашение","moved_post":"\u003Ci title='moved post' class='icon icon-arrow-right'\u003E\u003C/i\u003E {{username}} переместил сообщение в {{link}}","total_flagged":"всего сообщений с жалобами"},"upload_selector":{"title":"Add an image","title_with_attachments":"Add an image or a file","from_my_computer":"From my device","from_the_web":"From the web","remote_tip":"введите адрес изображения в формате http://example.com/image.jpg","remote_tip_with_attachments":"Введите адрес изображения или файла в формате http://example.com/file.ext (список доступных расширений: {{authorized_extensions}}).","local_tip":"кликните для выбора изображения с вашего устройства","local_tip_with_attachments":"кликните для выбора изображения с вашего устройства (доступные расширения: {{authorized_extensions}})","hint":"(вы так же можете перетащить объект в редактор для его загрузки)","hint_for_chrome":"(вы так же можете перетащить или вставить изображение в редактор для его загрузки)","uploading":"Загрузка"},"search":{"title":"поиск по темам, сообщениям, пользователям или категориям","placeholder":"условия поиска...","no_results":"Ничего не найдено.","searching":"Поиск ...","prefer":{"user":"при поиске отдавать предпочтение @{{username}}","category":"при поиске отдавать предпочтение {{category}}"}},"site_map":"перейти к другому списку тем или другой категории","go_back":"вернуться","current_user":"перейти на вашу страницу пользователя","favorite":{"title":"Избранные","help":{"star":"добавить тему в избранное","unstar":"удалить тему из избранного"}},"topics":{"none":{"favorited":"Вы еще не добавили ни одной темы в избранное. Чтобы тема попала в избранное, нажмите на звездочку рядом с названием темы.","unread":"У вас нет непрочитанных тем.","new":"У вас нет новых тем.","read":"Вы еще не прочитали ни одной темы.","posted":"Вы не принимали участие в обсуждении.","latest":"Новых тем нет.","hot":"Популярных тем нет.","category":"В категории {{category}} отсутствуют темы."},"bottom":{"latest":"Тем больше нет.","hot":"Популярных тем больше нет.","posted":"Созданных тем больше нет.","read":"Прочитанных тем больше нет.","new":"Больше нет новых тем.","unread":"Больше нет непрочитанных тем.","favorited":"Избранных тем больше нет.","category":"Больше в категории {{category}} нет тем."}},"rank_details":{"toggle":"скрыть / показать детальный рейтинг темы","show":"показать детальный рейтинг темы","title":"Детальный рейтинг темы"},"topic":{"filter_to":"Show only the {{post_count}} posts by {{username}} in this topic","create":"Создать тему","create_long":"Создать новую тему","private_message":"Написать личное сообщение","list":"Темы","new":"новая тема","new_topics":{"one":"1 новая тема","other":"{{count}} новых тем","few":"{{count}} новых темы","many":"{{count}} новых тем"},"unread_topics":{"one":"1 непрочитанная тема","other":"{{count}} непрочитанных тем","few":"{{count}} непрочитанных темы","many":"{{count}} непрочитанных тем"},"title":"Тема","loading_more":"Загружаю темы...","loading":"Загружаю тему...","invalid_access":{"title":"Частная тема","description":"К сожалению, у вас нет прав доступа к теме!"},"server_error":{"title":"Не удалось загрузить тему","description":"К сожалению, мы не смогли загрузить тему, возможно, из-за проблемы подключения. Попробуйте еще раз. Если проблема повторится, пожалуйста, сообщите нам об этом."},"not_found":{"title":"Тема не найдена","description":"К сожалению, запрошенная тема не найдена. Возможно, она была удалена модератором."},"unread_posts":{"one":"1 непрочитанное сообщение в данной теме","other":"{{count}} непрочитанных сообщений в данной теме","few":"{{count}} непрочитанных сообщений в данной теме","many":"{{count}} непрочитанных сообщений в данной теме"},"new_posts":{"one":"1 новое сообщение в данной теме","other":"{{count}} непрочитанных сообщений в данной теме","few":"{{count}} непрочитанных сообщений в данной теме","many":"{{count}} непрочитанных сообщений в данной теме"},"likes":{"one":"эта тема нравится одному участнику","other":"эта тема нравится {{count}} участникам","few":"тема понравилась {{count}} пользователям","many":"тема понравилась {{count}} пользователям"},"back_to_list":"Вернуться к списку тем","options":"Опции темы","show_links":"показать ссылки в теме","toggle_information":"скрыть / показать подробную информацию о теме","read_more_in_category":"Хотите почитать что-нибудь еще? Просмотрите темы в {{catLink}} или {{latestLink}}.","read_more":"Хотите почитать что-нибудь еще? {{catLink}} or {{latestLink}}.","browse_all_categories":"Просмотреть все категории","view_latest_topics":"посмотреть последние темы","suggest_create_topic":"Почему бы вам не создать новую тему?","read_position_reset":"Закладка перемещена.","jump_reply_up":"перейти к более ранним ответам","jump_reply_down":"перейти к более поздним ответам","deleted":"Тема удалена","auto_close_notice":"Тема будет автоматически закрыта через %{timeLeft}.","auto_close_title":"Настройки закрытия темы","auto_close_save":"Сохранить","auto_close_cancel":"Отменить","auto_close_remove":"Не закрывать тему автоматически","progress":{"title":"текущее местоположение в теме","jump_top":"перейти к первому сообщению","jump_bottom":"перейти к последнему сообщению","total":"всего сообщений","current":"текущее сообщение"},"notifications":{"title":"\u0026nbsp;","reasons":{"3_2":"Вы будете получать уведомления, потому что вы наблюдаете за темой.","3_1":"Вы будете получать уведомления, потому что вы создали тему.","3":"Вы будете получать уведомления, потому что вы наблюдаете за темой.","2_4":"Вы будете получать уведомления, потому что вы ответили в теме.","2_2":"Вы будете получать уведомления, потому что вы отслеживаете тему.","2":"Вы будете получать уведомления, потому что вы \u003Ca href=\"/users/{{username}}/preferences\"\u003Eчитали тему\u003C/a\u003E.","1":"Вы получите уведомление, только если кто-нибудь упомянет вас по @name или ответит на ваше сообщение.","1_2":"Вы получите уведомление, только если кто-нибудь упомянет вас по @name или ответит на ваше сообщение.","0":"Вы не получаете уведомления по теме.","0_2":"Вы не получаете уведомления по теме."},"watching":{"title":"Наблюдение","description":"то же самое, что и режим отслеживания, но вы дополнительно будете получать уведомления обо всех новых сообщениях."},"tracking":{"title":"Отслеживание","description":"вам будет прислано уведомление, если кто-то упомянет вас по @name или ответит на ваше сообщение, а также вы будете видеть количество сообщений, новых и непрочитанных вами."},"regular":{"title":"Стандартный","description":"вам будет прислано уведомление, если кто-то упомянет вас по @name или ответит на ваше сообщение."},"muted":{"title":"Выключено","description":"тема не показывается на вкладке \u003Cb\u003EНепрочитанные\u003C/b\u003E, уведомления о новых сообщениях в теме вам не отправляются."}},"actions":{"recover":"Отменить удаление темы","delete":"Удалить тему","open":"Открыть тему","close":"Закрыть тему","auto_close":"Автоматическое закрытие","unpin":"Отлепить тему","pin":"Прилепить тему","unarchive":"Разархивировать тему","archive":"Архивировать тему","invisible":"Сделать невидимой","visible":"Сделать видимой","reset_read":"Сбросить счетчики","multi_select":"Выбрать сообщения для перемещения","convert_to_topic":"Преобразовать в обычную тему"},"reply":{"title":"Ответить","help":"ответить в теме"},"clear_pin":{"title":"Отлепить","help":"Отлепить тему, чтобы она более не показывалась в самом начале списка тем"},"share":{"title":"Поделиться","help":"Поделиться ссылкой на тему"},"inviting":"Высылаю приглашение...","invite_private":{"title":"Отправить личное сообщение","email_or_username":"Адрес электронной почты или имя пользователя того, кого вы хотите пригласить","email_or_username_placeholder":"адрес электронной почты или имя пользователя","action":"Пригласить","success":"Личное сообщение было отправлено.","error":"К сожалению, в процессе приглашения пользователя произошла ошибка."},"invite_reply":{"title":"Подключить друзей","action":"Выслать приглашение по электронной почте","help":"отправьте приглашения своим друзьям, чтобы они тоже смогли поучаствовать в обсуждении темы","email":"Будет отправлено небольшое почтовое сообщение, которое позволит ответить в теме просто кликнув по ссылке без необходимости входа.","email_placeholder":"адрес электронной почты","success":"Приглашение отправлено по адресу \u003Cb\u003E{{email}}\u003C/b\u003E. Мы вышлем вам уведомление, когда вашим приглашением воспользуются. Проверьте вкладку \u003Cb\u003EПриглашения\u003C/b\u003E на вашей странице пользователя, чтобы видеть, кого вы уже пригласили.","error":"К сожалению, мы не смогли пригласить этого человека. Возможно, он уже пользователь форума?"},"login_reply":"Войдите, чтобы ответить","filters":{"user":"Отображено только {{n_posts}} от {{by_n_users}}.","n_posts":{"one":"1 сообщение","other":"{{count}} сообщений","few":"{{count}} сообщения","many":"{{count}} сообщений"},"by_n_users":{"one":"от одного пользователя","other":"от {{count}} пользователей","few":"от {{count}} пользователя","many":"от {{count}} пользователей"},"best_of":"Отображено только {{n_best_posts}} из {{of_n_posts}}.","n_best_posts":{"one":"1 лучшее","other":"{{count}} лучших","few":"{{count}} лучших","many":"{{count}} лучших"},"of_n_posts":{"one":"из 1 в теме","other":"из {{count}} в теме","few":"из {{count}} в теме","many":"из {{count}} в теме"},"cancel":"Показать все сообщения в этой теме еще раз."},"split_topic":{"title":"Переместить в новую тему","action":"переместить в новую тему","topic_name":"Новый заголовок темы:","error":"Во время перемещения сообщений в новую тему возникла ошибка.","instructions":{"one":"Создать новую тему, перенеся в нее выбранное сообщение.","other":"Создать новую тему, перенеся в нее  \u003Cb\u003E{{count}}\u003C/b\u003E выбранных сообщений.","few":"Создать новую тему, перенеся в нее  \u003Cb\u003E{{count}}\u003C/b\u003E выбранные сообщения.","many":"Создать новую тему, перенеся в нее  \u003Cb\u003E{{count}}\u003C/b\u003E выбранных сообщений."}},"merge_topic":{"title":"Переместить в существующую тему","action":"переместить в существующую тему","error":"Во время перемещения сообщений в тему возникла ошибка.","instructions":{"one":"Выберите тему, в которую хотите перенести сообщение.","other":"Выберите тему, в которую хотите перенести \u003Cb\u003E{{count}}\u003C/b\u003E выбранных сообщений.","few":"Выберите тему, в которую хотите перенести \u003Cb\u003E{{count}}\u003C/b\u003E выбранные сообщения.","many":"Выберите тему, в которую хотите перенести \u003Cb\u003E{{count}}\u003C/b\u003E выбранных сообщений."}},"multi_select":{"select":"выбрать","selected":"выбрано ({{count}})","select_replies":"выбрать +ответы","delete":"удалить выбранные","cancel":"отменить выделение","description":{"one":"Вы выбрали \u003Cb\u003E1\u003C/b\u003E сообщение.","other":"Вы выбрали \u003Cb\u003E{{count}}\u003C/b\u003E сообщений.","few":"Вы выбрали \u003Cb\u003E{{count}}\u003C/b\u003E сообщения.","many":"Вы выбрали \u003Cb\u003E{{count}}\u003C/b\u003E сообщений."}}},"post":{"reply":"Ответить на {{link}} от {{replyAvatar}} {{username}}","reply_topic":"Ответить на {{link}}","quote_reply":"ответить цитированием","edit":"Изменить {{link}} от {{replyAvatar}} {{username}}","post_number":"сообщение {{number}}","in_reply_to":"в ответе","last_edited_on":"последний раз сообщение редактировалось","reply_as_new_topic":"Ответить в новой теме","continue_discussion":"Продолжить обсуждение из {{postLink}}:","follow_quote":"перейти к цитируемому сообщению","deleted_by_author":{"one":"(сообщение отозвано автором и будет автоматически удалено через %{count} час при отсутствии жалоб)","other":"(сообщение отозвано автором и будет автоматически удалено через %{count} часов при отсутствии жалоб)","few":"(сообщение отозвано автором и будет автоматически удалено через %{count} часа при отсутствии жалоб)","many":"(сообщение отозвано автором и будет автоматически удалено через %{count} часов при отсутствии жалоб)"},"deleted_by":"Удалено","expand_collapse":"развернуть/свернуть","has_replies":{"one":"ответ","other":"ответов","few":"ответа","many":"ответов"},"errors":{"create":"К сожалению, не удалось создать сообщение. Попробуйте еще раз.","edit":"К сожалению, не удалось изменить сообщение. Попробуйте еще раз.","upload":"К сожалению, не удалось загрузить файл. Попробуйте еще раз.","attachment_too_large":"Файл, который вы пытаетесь загрузить, слишком большой (максимальный разрешенный размер {{max_size_kb}}КБ).","image_too_large":"Изображение, которое вы пытаетесь загрузить, слишком большое (максимальный разрешенный размер {{max_size_kb}}КБ), пожалуйста, уменьшите размер изображения и повторите попытку.","too_many_uploads":"К сожалению, за один раз можно загрузить только одно изображение.","upload_not_authorized":"К сожалению, вы не можете загрузить файл данного типа (список разрешенных типов файлов: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"К сожалению, загрузка изображений недоступна новым пользователям.","attachment_upload_not_allowed_for_new_user":"К сожалению, загрузка файлов недоступна новым пользователям."},"abandon":"Удалить сохраненный черновик?","archetypes":{"save":"Параметры сохранения"},"controls":{"reply":"начать составление ответа на сообщение","like":"мне нравится","edit":"Изменить сообщение","flag":"Личное сообщение автору / пожаловаться на сообщение","delete":"удалить сообщение","undelete":"отменить удаление","share":"поделиться ссылкой на сообщение","more":"Ещё","delete_replies":{"confirm":{"one":"Хотите так же удалить ответ на данное сообщение?","other":"Хотите так же удалить {{count}} ответов на данное сообщение?","few":"Хотите так же удалить {{count}} ответа на данное сообщение?","many":"Хотите так же удалить {{count}} ответов на данное сообщение?"},"yes_value":"Да, так же удалить ответы","no_value":"Нет, удалить только сообщение"}},"actions":{"flag":"Жалоба","clear_flags":{"one":"Очистить уведомление","other":"Очистить жалобы","few":"Очистить жалобы","many":"Очистить жалобы"},"it_too":{"off_topic":"Пожаловаться","spam":"Пожаловаться","inappropriate":"Пожаловаться","custom_flag":"Пожаловаться","bookmark":"Добавить в закладки","like":"Мне тоже нравится","vote":"Проголосовать"},"undo":{"off_topic":"Отозвать жалобу","spam":"Отозвать жалобу","inappropriate":"Отозвать жалобу","bookmark":"Удалить из закладок","like":"Больше не нравится","vote":"Отозвать голос"},"people":{"off_topic":"{{icons}} отметили как оффтопик","spam":"{{icons}} отметили как спам","inappropriate":"{{icons}} отметили как неуместное","notify_moderators":"{{icons}} пожаловались модераторам","notify_moderators_with_url":"{{icons}} \u003Ca href='{{postUrl}}'\u003Eпожаловались модераторам\u003C/a\u003E","notify_user":"{{icons}} отправил(и) личное сообщение","notify_user_with_url":"{{icons}} отправил(и) \u003Ca href='{{postUrl}}'\u003Eличное сообщение\u003C/a\u003E","bookmark":"{{icons}} добавили в закладки","like":"{{icons}} выразили симпатию","vote":"{{icons}} проголосовали за"},"by_you":{"off_topic":"Помечена вами как оффтопик","spam":"Помечена вами как спам","inappropriate":"Помечена вами как неуместное","notify_moderators":"Вы отправили жалобу модератору","notify_user":"Вы отправили автору личное сообщение","bookmark":"Вы добавили сообщение в закладки","like":"Вам нравится","vote":"Вы проголосовали за данное сообщение"},"by_you_and_others":{"off_topic":{"one":"Вы и еще 1 человек отметили сообщение как оффтопик","other":"Вы и еще {{count}} человек отметили сообщение как оффтопик","few":"Вы и еще {{count}} человека отметили сообщение как оффтопик","many":"Вы и еще {{count}} человек отметили сообщение как оффтопик"},"spam":{"one":"Вы и еще 1 человек отметили сообщение как спам","other":"Вы и еще {{count}} человек отметили сообщение как спам","few":"Вы и еще {{count}} человека отметили сообщение как спам","many":"Вы и еще {{count}} человек отметили сообщение как спам"},"inappropriate":{"one":"Вы и еще 1 человек отметили сообщение как неуместное","other":"Вы и еще {{count}} человек отметили сообщение как неуместное","few":"Вы и еще {{count}} человека отметили сообщение как неуместное","many":"Вы и еще {{count}} человек отметили сообщение как неуместное"},"notify_moderators":{"one":"Вы и еще 1 человек пожаловались на сообщение","other":"Вы и еще {{count}} человек пожаловались на сообщение","few":"Вы и еще {{count}} человека пожаловались на сообщение","many":"Вы и еще {{count}} человек пожаловались на сообщение"},"notify_user":{"one":"Вы и еще 1 пользователь отправили автору личное сообщение","other":"Вы и еще {{count}} пользователя отправили автору личное сообщение","few":"Вы и еще {{count}} человека отправили личное сообщение пользователю","many":"Вы и еще {{count}} человек отправили личное сообщение пользователю"},"bookmark":{"one":"Вы и еще 1 человек добавили это сообщение в закладки","other":"Вы и еще {{count}} человек добавили это сообщение в закладки","few":"Вы и еще {{count}} человека добавили это сообщение в закладки","many":"Вы и еще {{count}} человек добавили это сообщение в закладки"},"like":{"one":"Это понравилось вам и еще 1 пользователю","other":"Это понравилось вам и еще {{count}} пользователям","few":"Это понравилось вам и еще {{count}} пользователям","many":"Это понравилось вам и еще {{count}} пользователям"},"vote":{"one":"Вы и еще 1 человек проголосовали за это сообщение","other":"Вы и еще {{count}} человек проголосовали за это сообщение","few":"Вы и еще {{count}} человека проголосовали за сообщение","many":"Вы и еще {{count}} человек проголосовали за сообщение"}},"by_others":{"off_topic":{"one":"1 человек отметил это сообщение как оффтопик","other":"{{count}} человек отметили это сообщение как оффтопик","few":"{{count}} человека отметили сообщение как оффтопик","many":"{{count}} человек отметили это сообщение как оффтопик"},"spam":{"one":"1 человек отметил это сообщение как спам","other":"{{count}} человек отметили это сообщение как спам","few":"{{count}} человека отметили это сообщение как спам","many":"{{count}} человек отметили это сообщение как спам"},"inappropriate":{"one":"1 человек отметил это сообщение как неуместное","other":"{{count}} человек отметили это сообщение как неуместное","few":"{{count}} человека отметили это сообщение как неуместное","many":"{{count}} человек отметили это сообщение как неуместное"},"notify_moderators":{"one":"1 человек пожаловался на это сообщение","other":"{{count}} человек пожаловались на это сообщение","few":"{{count}} человека пожаловались на это сообщение","many":"{{count}} человек пожаловались на это сообщение"},"notify_user":{"one":"1 человек отправил личное сообщение этому пользователю","other":"{{count}} человек отправили личное сообщение этому пользователю","few":"{{count}} человека отправили личное сообщение этому пользователю","many":"{{count}} человек отправили личное сообщение этому пользователю"},"bookmark":{"one":"1 человек добавил это сообщение в закладки","other":"{{count}} человек добавили это сообщение в закладки","few":"{{count}} человека добавили это сообщение в закладки","many":"{{count}} человек добавили это сообщение в закладки"},"like":{"one":"Это понравилось 1 пользователю","other":"Это понравилось {{count}} пользователям","few":"Это понравилось {{count}} пользователям","many":"Это понравилось {{count}} пользователям"},"vote":{"one":"1 человек проголосовал за это сообщение","other":"{{count}} людей проголосовали за это сообщение","few":"{{count}} человека проголосовали за это сообщение","many":"{{count}} людей проголосовали за это сообщение"}}},"edits":{"one":"редактировалось 1 раз","other":"редактировалось {{count}} раз","zero":"не редактировалось","few":"редактировалось {{count}} раза","many":"редактировалось {{count}} раз"},"delete":{"confirm":{"one":"Вы уверены, что хотите удалить это сообщение?","other":"Вы уверены, что хотите удалить эти сообщения?","few":"Вы уверены, что хотите удалить сообщения?","many":"Вы уверены, что хотите удалить сообщения?"}}},"category":{"can":"может\u0026hellip; ","none":"(без категории)","choose":"Выберете категорию\u0026hellip;","edit":"изменить","edit_long":"Изменить категорию","view":"Просмотр тем по категориям","general":"Общие","settings":"Настройки","delete":"Удалить категорию","create":"Создать категорию","save":"Сохранить","creation_error":"При создании новой категории возникла ошибка.","save_error":"При сохранении категории возникла ошибка.","more_posts":"просмотреть все {{posts}}...","name":"Название категории","description":"Описание","topic":"тема в категории","badge_colors":"Цвета метки","background_color":"Цвет фона","foreground_color":"Цвет переднего плана","name_placeholder":"Должно быть кратким и емким.","color_placeholder":"Любой цвет из веб-палитры","delete_confirm":"Вы действительно хотите удалить категорию?","delete_error":"При удалении категории произошла ошибка.","list":"Список категорий","no_description":"Для этой категории нет описания, отредактируйте определение темы.","change_in_category_topic":"Изменить описание","hotness":"Популярность","already_used":"Цвет уже используется другой категорией","security":"Безопасность","auto_close_label":"Закрыть тему через:","edit_permissions":"Изменить права доступа","add_permission":"Добавить права","this_year":"в год","position":"местоположение","parent":"Родительская категория"},"flagging":{"title":"Выберите действие над сообщением","action":"Пожаловаться","take_action":"Принять меры","notify_action":"Отправить","delete_spammer":"Удалить спамера","delete_confirm":"Вы собираетесь удалить \u003Cb\u003E%{posts}\u003C/b\u003E сообщений и \u003Cb\u003E%{topics}\u003C/b\u003E тем этого пользователя, а так же удалить его учетную запись, добавить его IP адрес \u003Cb\u003E%{ip_address}\u003C/b\u003E и его почтовый адрес \u003Cb\u003E%{email}\u003C/b\u003E в черный список. Вы действительно уверены, что ваши помыслы чисты и действия не продиктованы гневом?","yes_delete_spammer":"Да, удалить спамера","cant":"Извините, но вы не можете сейчас послать жалобу.","custom_placeholder_notify_user":"Почему это сообщение побудило вас обратиться к этому пользователю напрямую и в частном порядке? Будьте конкретны, будьте конструктивны и всегда доброжелательны.","custom_placeholder_notify_moderators":"Почему это сообщение побудило вас обратиться с жалобой к модератору? Сообщите нам конкретно, чем вы обеспокоены и предоставьте соответствующие ссылки, где это возможно.","custom_message":{"at_least":"введите как минимум {{n}} символов","more":"ещё {{n}} символов...","left":"осталось {{n}} символов"}},"topic_summary":{"title":"Сводка по теме","links_shown":"показать все {{totalLinks}} ссылок...","clicks":"переходов","topic_link":"ссылка на тему"},"topic_statuses":{"locked":{"help":"закрытая тема (в этой теме больше нельзя отвечать)"},"pinned":{"help":"прилепленная тема (будет показана в начале списка тем соответствующей категории)"},"archived":{"help":"архивная тема (заморожена и не может быть изменена)"},"invisible":{"help":"скрытая тема (не показывается в списке тем, доступ к теме осуществляется только по прямой ссылке)"}},"posts":"Сообщ.","posts_long":"{{number}} сообщений в теме","original_post":"Начальное сообщение","views":"Просм.","replies":"Ответов","views_long":"тема просмотрена {{number}} раз","activity":"Активность","likes":"Нрав.","likes_long":"{{number}} лайков в теме","top_contributors":"Участники","category_title":"Категория","history":"История","changed_by":"автором {{author}}","categories_list":"Список категорий","filters":{"latest":{"title":"Последние","help":"самые последние темы"},"hot":{"title":"Популярные","help":"подборка популярных тем"},"favorited":{"title":"Избранное","help":"темы, которые вы добавили в список избранных"},"read":{"title":"Прочитанные","help":"темы, которые вас заинтересовали (в обратном хронологическом порядке)"},"categories":{"title":"Категории","title_in":"Категория - {{categoryName}}","help":"все темы, сгруппированные по категориям"},"unread":{"title":{"zero":"Непрочитанные","one":"Непрочитанные (1)","other":"Непрочитанные ({{count}})","few":"Непрочитанные ({{count}})","many":"Непрочитанные ({{count}})"},"help":"отслеживаемые темы с непрочитанными сообщениями"},"new":{"title":{"zero":"Новые","one":"Новые (1)","other":"Новые ({{count}})","few":"Новые ({{count}})","many":"Новые ({{count}})"},"help":"новые темы с момента вашего последнего посещения"},"posted":{"title":"Мои","help":"темы, в которых вы принимали участие"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})","few":"{{categoryName}} ({{count}})","many":"{{categoryName}} ({{count}})"},"help":"последние темы в категории {{categoryName}}"}},"browser_update":"К сожалению, \u003Ca href=\"http://www.discourse.org/faq/#browser\"\u003Eваш браузер слишком устарел\u003C/a\u003E для комфортного просмотра нашего форума. Пожалуйста, \u003Ca href=\"http://browsehappy.com\"\u003Eобновите ваш браузер\u003C/a\u003E.","permission_types":{"full":"Создавать / Отвечать / Просматривать","create_post":"Отвечать / Просматривать","readonly":"Просматривать"},"type_to_filter":"Введите текст для фильтрации...","admin":{"title":"Discourse Admin","moderator":"Модератор","dashboard":{"title":"Панель","last_updated":"Последнее обновление панели:","version":"Версия","up_to_date":"Вы используете самую свежию версию!","critical_available":"Доступно критическое обновление.","updates_available":"Доступны обновления.","please_upgrade":"Пожалуйста, обновитесь!","no_check_performed":"Проверка обновлений не производится. Убедитесь, что запущен процесс sidekiq.","stale_data":"Проверка обновлений не в последнее время не производилась. Убедитесь, что запущен процесс sidekiq.","installed_version":"Установленная","latest_version":"Текущая","problems_found":"Мы обнаружили некоторые проблемы в вашей установке Discourse:","last_checked":"Последняя проверка","refresh_problems":"Обновить","no_problems":"Проблемы не обнаружены.","moderators":"Модераторы:","admins":"Администраторы:","blocked":"Заблокированы:","suspended":"Забанены:","private_messages_short":"ЛС","private_messages_title":"Личные сообщения","reports":{"today":"Сегодня","yesterday":"Вчера","last_7_days":"7 дней","last_30_days":"30 дней","all_time":"За все время","7_days_ago":"7 дней","30_days_ago":"30 дней","all":"Все","view_table":"Просмотр в виде таблицы","view_chart":"Просмотр в графическом виде"}},"commits":{"latest_changes":"Обновления в репозитории Github","by":"от"},"flags":{"title":"Жалобы","old":"Старые","active":"Активные","agree_hide":"Согласиться (скрыть сообщение + послать ЛС)","agree_hide_title":"Скрыть сообщение и автоматически отправить пользователю личное сообщение с просьбой исправить свое сообщение","defer":"Отложить","defer_title":"Не предпринимать никаких действий, отложить жалобу для дальнейшего рассмотрения","delete_post":"Удалить сообщение","delete_post_title":"Удалить сообщение (или тему, если оно идет первым в теме)","disagree_unhide":"Отменить (открыть сообщение)","disagree_unhide_title":"Удалить все жалобы с сообщения и сделать его видимым","disagree":"Отказаться","disagree_title":"Удалить все жалобы с данного сообщения","delete_spammer_title":"Удалить пользователя и все его сообщения.","flagged_by":"Отмечено","error":"что-то пошло не так","view_message":"Ответить","no_results":"Жалоб нет.","summary":{"action_type_3":{"one":"оффтопик","other":"оффтопик x{{count}}","few":"оффтопик x{{count}}","many":"оффтопик x{{count}}"},"action_type_4":{"one":"неуместно","other":"неуместное x{{count}}","few":"неуместное x{{count}}","many":"неуместное x{{count}}"},"action_type_6":{"one":"Обычное","other":"{{count}} обычных","few":"x{{count}} обычное","many":"{{count}} обычных"},"action_type_7":{"one":"Обычное","other":"обычное x{{count}}","few":"обычное x{{count}}","many":"обычное x{{count}}"},"action_type_8":{"one":"спам","other":"СПАМ x{{count}}","few":"СПАМ x{{count}}","many":"СПАМ x{{count}}"}}},"groups":{"title":"Группы","edit":"Изменить группы","selector_placeholder":"добавить пользователей","name_placeholder":"Название группы, без пробелов, по тем же правилам, что и имя пользователя.","about":"Здесь можно редактировать группы и имена групп","can_not_edit_automatic":"Принадлежность пользователя к системным группам определяется автоматически, однако вы можете самостоятельно переназначить группу пользователя и уровень доверия","delete":"Удалить","delete_confirm":"Удалить данную группу?","delete_failed":"Невозможно удалить группу. Если это автоматически созданная группа, то она не может быть удалена."},"api":{"generate_master":"Сгенерировать ключ API","none":"Отсутствует ключ API.","user":"Пользователь","title":"API","key":"Ключ API","generate":"Сгенерировать","regenerate":"Перегенерировать","revoke":"Отозвать","confirm_regen":"Вы уверены, что хотите заменить ключ API?","confirm_revoke":"Вы уверены, что хотите отозвать этот ключ?","info_html":"Ваш API ключ позволит вам создавать и обновлять темы, используя JSON calls.","all_users":"Все пользователи","note_html":"Никому \u003Cstrong\u003Eне сообщайте\u003C/strong\u003E эти ключи, Тот, у кого они есть, сможет создавать сообщения, выдавая себя за любого пользователя форума."},"customize":{"title":"Оформление","long_title":"Стили и заголовки","header":"Заголовок","css":"Таблица стилей","mobile_header":"Заголовок для мобильных устройств","mobile_css":"Стиль для мобильных устройств","override_default":"Не использовать стандартную таблицу стилей","enabled":"Разрешить?","preview":"как будет","undo_preview":"как было","save":"Сохранить","new":"Новое","new_style":"Новый стиль","delete":"Удалить","delete_confirm":"Удалить настройки?","about":"Настройка сайта позволяет изменять таблицы стилей и заголовки. Выберите или добавьте что-нибудь для начала редактирования."},"email":{"title":"Email","settings":"Настройки","logs":"Логи","sent_at":"Отправлено","user":"Пользователь","email_type":"Вид сообщения","to_address":"Адрес","test_email_address":"Электронный адрес для проверки","send_test":"отправить тестовое письмо","sent_test":"отправлено!","delivery_method":"Метод отправки","preview_digest":"Обзор сводки","preview_digest_desc":"Инструмент для просмотра содержимого сводки, отсылаемой форумом по электронной почте пользователям.","refresh":"Обновить","format":"Формат","html":"html","text":"текст","last_seen_user":"Последнее посещение:","reply_key":"Ключ ответа"},"logs":{"title":"Логи","action":"Действие","created_at":"Создано","last_match_at":"Последнее совпадение","match_count":"Совпадения","ip_address":"IP","delete":"Удалить","edit":"Изменить","save":"Сохранить","screened_actions":{"block":"блокировать","do_nothing":"ничего не делать"},"staff_actions":{"title":"Действия персонала","instructions":"Клиекните по имени пользователя и действиям для фильтрации списка. Кликните по аватару для получения страницы пользователя.","clear_filters":"Показать все","staff_user":"Пользователь","target_user":"Целевой пользователь","subject":"Тема","when":"Когда","context":"Контекст","details":"Подробности","previous_value":"Старое","new_value":"Новое","diff":"Различия","show":"Показать","modal_title":"Подробности","no_previous":"Старое значение отсутствует.","deleted":"Новое значение отсутствует. Запись была удалена.","actions":{"delete_user":"удаление пользователя","change_trust_level":"изменение уровня доверия","change_site_setting":"изменение настройки сайта","change_site_customization":"изменение настроек сайта","delete_site_customization":"удаление настроек сайта"}},"screened_emails":{"title":"Отслеживаемые почтовые адреса","description":"Когда кто-то создает новую учетную запись, проверяется данный почтовый адрес и регистрация блокируется или производятся другие дополнительные действия.","email":"Почтовый адрес"},"screened_urls":{"title":"Отслеживаемые ссылки","description":"Список ссылок от пользователей, которые были идентифицированы как спамеры.","url":"URL"},"screened_ips":{"title":"Наблюдаемые IP адреса","description":"IP адреса за которыми вести наблюдение. Используйте \"Разрешить\" для добавления IP адреса в белый список.","delete_confirm":"Вы уверены, что хотите удалить правило для %{ip_address}?","actions":{"block":"Заблокировать","do_nothing":"Разрешить"},"form":{"label":"Новые:","ip_address":"IP адрес","add":"Добавить"}}},"impersonate":{"title":"Представиться как пользователь","username_or_email":"Имя пользователя или Email","help":"Здесь вы можете представится системе как пользователь форума, для отладки.","not_found":"Пользователь не найден.","invalid":"Извините, но вы не можете представиться этим пользователем."},"users":{"title":"Пользователи","create":"Добавить администратора","last_emailed":"Последнее письмо","not_found":"К сожалению, этот пользователь не зарегистрирован.","active":"Активные","nav":{"new":"Новые","active":"Активные","pending":"Ожидает одобрения","admins":"Администраторы","moderators":"Модераторы","suspended":"Забаненые","blocked":"Заблокированные"},"approved":"Подтвердить?","approved_selected":{"one":"одобрить пользователя","other":"одобрить пользователей ({{count}})","few":"одобрить пользователей ({{count}})","many":"одобрить пользователей ({{count}})"},"reject_selected":{"one":"Отказать пользователю","other":"Отказать {{count}} пользователей","few":"Отказать {{count}} пользователям","many":"Отказать {{count}} пользователям"},"titles":{"active":"Активные пользователи","new":"Новые пользователи","pending":"Пользователи, ожидающие одобрения","newuser":"Пользователи с уровнем доверия 0 (Новые пользователи)","basic":"Пользователи с уровнем доверия 1 (Базовые пользователи)","regular":"Пользователи с уровнем доверия 2 (Постоянные пользователи)","leader":"Пользователи с уровнем доверия 3 (Лидеры)","elder":"Пользователи с уровнем доверия 4 (Опытные пользователи)","admins":"Администраторы","moderators":"Модераторы","blocked":"Заблокированные пользователи","suspended":"Забаненые пользователи"},"reject_successful":{"one":"Отказано одному пользователю.","other":"Отказано %{count} пользователей.","few":"Отказано %{count} пользователям.","many":"Отказано %{count} пользователям."},"reject_failures":{"one":"Ошибка отказа одному пользователю.","other":"Ошибка отказа %{count} пользователей.","few":"Ошибка отказа %{count} пользователям.","many":"Ошибка отказа %{count} пользователям."}},"user":{"suspend_failed":"Ошибка при наложении бана {{error}}","unsuspend_failed":"Ошибка при снятии бана {{error}}","suspend_duration":"Насколько вы хотите забанить пользователя? (в днях)","delete_all_posts":"Удалить все сообщения","delete_all_posts_confirm":"Вы собираетесь удалить %{posts} сообщений и %{topics} тем. Вы уверены?","suspend":"Забанить","unsuspend":"Разбанить","suspended":"Забанен?","moderator":"Модератор?","admin":"Администратор?","blocked":"Заблокирован?","show_admin_profile":"Администратор","edit_title":"Редактировать заголовок","save_title":"Сохранить заголовок","refresh_browsers":"Выполнить перезагрузку браузера","show_public_profile":"Показать публичный профайл","impersonate":"Представиться как пользователь","revoke_admin":"Лишить прав Администратора","grant_admin":"Выдать права Администратора","revoke_moderation":"Лишить прав Модератора","grant_moderation":"Выдать права Модератора","unblock":"Разблокировать","block":"Заблокировать","reputation":"Репутация","permissions":"Права","activity":"Активность","like_count":"Получил симпатий","private_topics_count":"Частные темы","posts_read_count":"Прочитано сообщений","post_count":"Создано сообщений","topics_entered":"Просмотрено тем","flags_given_count":"Отправлено жалоб","flags_received_count":"Получено жалоб","approve":"Одобрить","approved_by":"Одобрено","approve_success":"Пользователь одобрен, на его электронную почту послано письмо с инструкцией\nпо активации.\n","approve_bulk_success":"Успех! Все выбранные пользователи одобрены\nи уведомлены.\n","time_read":"Время чтения","delete":"Удалить пользователя","delete_forbidden":{"one":"Пользователь не может быть удален, если он зарегистрирован больше чем %{count} день назад и у него есть сообщения. Удалите все сообщения перед удалением пользователя.","other":"Пользователь не может быть удален, если он зарегистрирован больше чем %{count} дней назад и у него есть сообщения. Удалите все сообщения перед удалением пользователя.","few":"Пользователь не может быть удален, если он зарегистрирован больше чем %{count} дня назад и у него есть сообщения. Удалите все сообщения перед удалением пользователя.","many":"Пользователь не может быть удален, если он зарегистрирован больше чем %{count} дней назад и у него есть сообщения. Удалите все сообщения перед удалением пользователя."},"delete_confirm":"Вы уверены, что хотите удалить пользователя? Это действие необратимо!","delete_and_block":"\u003Cb\u003EДа\u003C/b\u003E, и \u003Cb\u003Eзапретить\u003C/b\u003E регистрацию с данного email и IP адреса","delete_dont_block":"\u003Cb\u003EДа\u003C/b\u003E, но \u003Cb\u003Eразрешить\u003C/b\u003E регистрацию с данного email и IP адреса","deleted":"Пользователь удален.","delete_failed":"При удалении пользователя возникла ошибка. Для удаления пользователя необходимо сначала удалить все его сообщения.","send_activation_email":"Послать активационное письмо","activation_email_sent":"Активационное письмо отправлено.","send_activation_email_failed":"К сожалению, возникла ошибка при повторной отправке сообщения для активации %{error}","activate":"Активировать","activate_failed":"Во время активации пользователя произошла ошибка.","deactivate_account":"Деактивировать","deactivate_failed":"Во время деактивации пользователя произошла ошибка.","unblock_failed":"Не удалось разблокировать пользователя.","block_failed":"Не удалось заблокировать пользователя.","deactivate_explanation":"Потребовать повторного подтверждения email.","banned_explanation":"Забаненный пользователь не может войти.","block_explanation":"Заблокированный не может отвечать и создавать новые темы.","trust_level_change_failed":"Возникла ошибка при изменении уровня доверия пользователя."},"site_content":{"none":"Выберите тип контента, чтобы начать редактирование.","title":"Контент сайта","edit":"Изменить контент сайта"},"site_settings":{"show_overriden":"Показывать только переопределенные","title":"Настройки сайта","reset":"вернуть по умолчанию","none":"(нет)"}}}}};
I18n.locale = 'ru';
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
// language : russian (ru)
// author : Viktorminator : https://github.com/Viktorminator
// Author : Menelion Elensúle : https://github.com/Oire
//
(function(){

function plural(word, num) {
    var forms = word.split('_');
    return num % 10 === 1 && num % 100 !== 11 ? forms[0] : (num % 10 >= 2 && num % 10 <= 4 && (num % 100 < 10 || num % 100 >= 20) ? forms[1] : forms[2]);
}

function relativeTimeWithPlural(number, withoutSuffix, key) {
    var format = {
        'mm': 'минута_минуты_минут',
        'hh': 'час_часа_часов',
        'dd': 'день_дня_дней',
        'MM': 'месяц_месяца_месяцев',
        'yy': 'год_года_лет'
    };
    if (key === 'm') {
        return withoutSuffix ? 'минута' : 'минуту';
    }
    else {
        return number + ' ' + plural(format[key], +number);
    }
}

function monthsCaseReplace(m, format) {
    var months = {
        'nominative': 'январь_февраль_март_апрель_май_июнь_июль_август_сентябрь_октябрь_ноябрь_декабрь'.split('_'),
        'accusative': 'января_февраля_марта_апреля_мая_июня_июля_августа_сентября_октября_ноября_декабря'.split('_')
    },

    nounCase = (/D[oD]? *MMMM?/).test(format) ?
        'accusative' :
        'nominative';

    return months[nounCase][m.month()];
}

function weekdaysCaseReplace(m, format) {
    var weekdays = {
        'nominative': 'воскресенье_понедельник_вторник_среда_четверг_пятница_суббота'.split('_'),
        'accusative': 'воскресенье_понедельник_вторник_среду_четверг_пятницу_субботу'.split('_')
    },

    nounCase = (/\[ ?[Вв] ?(?:прошлую|следующую)? ?\] ?dddd/).test(format) ?
        'accusative' :
        'nominative';

    return weekdays[nounCase][m.day()];
}

moment.lang('ru', {
    months : monthsCaseReplace,
    monthsShort : "янв_фев_мар_апр_май_июн_июл_авг_сен_окт_ноя_дек".split("_"),
    weekdays : weekdaysCaseReplace,
    weekdaysShort : "вск_пнд_втр_срд_чтв_птн_сбт".split("_"),
    weekdaysMin : "вс_пн_вт_ср_чт_пт_сб".split("_"),
    longDateFormat : {
        LT : "HH:mm",
        L : "DD.MM.YYYY",
        LL : "D MMMM YYYY г.",
        LLL : "D MMMM YYYY г., LT",
        LLLL : "dddd, D MMMM YYYY г., LT"
    },
    calendar : {
        sameDay: '[Сегодня в] LT',
        nextDay: '[Завтра в] LT',
        lastDay: '[Вчера в] LT',
        nextWeek: function () {
            return this.day() === 2 ? '[Во] dddd [в] LT' : '[В] dddd [в] LT';
        },
        lastWeek: function () {
            switch (this.day()) {
            case 0:
                return '[В прошлое] dddd [в] LT';
            case 1:
            case 2:
            case 4:
                return '[В прошлый] dddd [в] LT';
            case 3:
            case 5:
            case 6:
                return '[В прошлую] dddd [в] LT';
            }
        },
        sameElse: 'L'
    },
    relativeTime : {
        future : "через %s",
        past : "%s назад",
        s : "несколько секунд",
        m : relativeTimeWithPlural,
        mm : relativeTimeWithPlural,
        h : "час",
        hh : relativeTimeWithPlural,
        d : "день",
        dd : relativeTimeWithPlural,
        M : "месяц",
        MM : relativeTimeWithPlural,
        y : "год",
        yy : relativeTimeWithPlural
    },
    // FIXME: this is not Russian ordinals format
    ordinal : '%d.',
    week : {
        dow : 1, // Monday is the first day of the week.
        doy : 7  // The week that contains Jan 1st is the first week of the year.
    }
});

})();

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};

I18n.pluralizationRules['ru'] = function (n) {
  if (n == 0) return ["zero", "none", "other"];
  if (n % 10 == 1 && n % 100 != 11) return "one";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "few";
  return "many";
}
;
