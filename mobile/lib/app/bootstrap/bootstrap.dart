import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../core/logging/safe_logger.dart';
import '../../core/storage/secure_kv.dart';
import '../config/app_config.dart';
import 'providers.dart';

bool _overridesProvider(
  List<Override> overrides,
  ProviderBase<Object?> provider,
) {
  for (final o in overrides) {
    try {
      // ignore: invalid_use_of_visible_for_testing_member
      final origin = o.origin;
      ProviderBase<Object?> pb;
      if (origin is ProviderBase<Object?>) {
        pb = origin;
      } else {
        // ignore: avoid_dynamic_calls
        pb = (origin as dynamic).provider as ProviderBase<Object?>;
      }
      if (identical(pb, provider)) return true;
      if (pb.name == provider.name &&
          pb.runtimeType.toString() == provider.runtimeType.toString()) {
        return true;
      }
    } catch (_) {}
  }
  return false;
}

Future<ProviderContainer> bootstrap({
  List<Override> overrides = const [],
}) async {
  WidgetsFlutterBinding.ensureInitialized();

  final secureKv = SecureKv(const FlutterSecureStorage(
    aOptions: AndroidOptions(
      resetOnError: true,
    ),
  ),
  );
  final config = AppConfig.fromEnvironment();

  final injected = <Override>[
    if (!_overridesProvider(overrides, appConfigProvider))
      appConfigProvider.overrideWithValue(config),
    if (!_overridesProvider(overrides, secureKvProvider))
      secureKvProvider.overrideWithValue(secureKv),
    ...overrides,
  ];

  final container = ProviderContainer(
    overrides: injected,
  );

  FlutterError.onError = (details) {
    SafeLogger.e(details.exception, details.stack);
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    SafeLogger.e(error, stack);
    return true;
  };

  return container;
}
