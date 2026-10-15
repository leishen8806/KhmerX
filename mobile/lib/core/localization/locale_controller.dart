import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'locale_store.dart';

final class LocaleController extends Notifier<Locale?> {
  static const Locale fallback = Locale('en');

  @override
  Locale? build() {
    _load();
    return null;
  }

  Future<void> _load() async {
    final store = LocaleStore(ref);
    final tag = await store.load();
    if (tag == null) return;
    final parts = tag.split('_');
    state = Locale(parts.first, parts.length > 1 ? parts.last : null);
  }

  Future<void> set(Locale? locale) async {
    state = locale;
    final store = LocaleStore(ref);
    await store.save(locale?.toLanguageTag());
  }
}

final localeControllerProvider =
    NotifierProvider<LocaleController, Locale?>(LocaleController.new);
