import 'dart:developer' as developer;

import 'redaction_policy.dart';

/// Every message is passed through [RedactionPolicy] before it is logged, so
/// cookies, OTPs, passwords, phone numbers and similar values never reach the
/// log, including messages built from exception objects.
final class SafeLogger {
  SafeLogger._();

  static const int _maxLength = 2000;

  static String _clean(Object message) {
    var text = RedactionPolicy.redactMessage('$message');
    if (text.length > _maxLength) text = '${text.substring(0, _maxLength)}…';
    return text;
  }

  static void d(Object message, [StackTrace? stack]) {
    developer.log(_clean(message), name: 'khmerx.app', stackTrace: stack);
  }

  static void i(Object message, [StackTrace? stack]) {
    developer.log(_clean(message), name: 'khmerx.app', level: 800, stackTrace: stack);
  }

  static void w(Object message, [StackTrace? stack]) {
    developer.log(_clean(message), name: 'khmerx.app', level: 900, stackTrace: stack);
  }

  static void e(Object message, [StackTrace? stack]) {
    developer.log(_clean(message), name: 'khmerx.app', level: 1000, stackTrace: stack);
  }
}
