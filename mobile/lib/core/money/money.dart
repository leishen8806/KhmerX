import 'dart:ui';

import 'package:equatable/equatable.dart';
import 'package:intl/intl.dart';

final class Money extends Equatable {
  final int cents;

  const Money._(this.cents);

  factory Money.fromCents(int cents) {
    if (cents < 0 || cents > 0x1FFFFFFFFFFFFF) {
      throw StateError('Money value out of safe integer range: $cents');
    }
    return Money._(cents);
  }

  Money operator +(Money other) {
    final result = cents + other.cents;
    if ((other.cents > 0 && result < cents) || (other.cents < 0 && result > cents)) {
      throw StateError('Integer overflow during Money addition');
    }
    return Money.fromCents(result);
  }

  Money operator -(Money other) {
    final result = cents - other.cents;
    if ((other.cents > 0 && result > cents) || (other.cents < 0 && result < cents)) {
      throw StateError('Integer overflow during Money subtraction');
    }
    return Money.fromCents(result);
  }

  @override
  List<Object?> get props => [cents];
}

final class MoneyFormatter {
  const MoneyFormatter._();

  static String format(Money money, Locale locale, {String? currencyCode}) {
    final numberFormat = NumberFormat.currency(
      locale: locale.toLanguageTag(),
      symbol: '',
      decimalDigits: 2,
    );
    final amount = money.cents / 100.0;
    final formattedNumber = numberFormat.format(amount);
    final currency = currencyCode ?? _defaultCurrencyFor(locale);
    return '$formattedNumber $currency';
  }

  static String _defaultCurrencyFor(Locale locale) {
    switch (locale.languageCode) {
      case 'km':
        return 'USD';
      case 'zh':
        return 'USD';
      case 'en':
      default:
        return 'USD';
    }
  }
}
