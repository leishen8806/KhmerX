import 'dart:async';

import 'dart:ui' show Locale;

import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

enum KycLocationStage { position, address }

enum KycLocationStatus { ok, denied, deniedForever, serviceOff, failed }

final class KycLocationResult {
  const KycLocationResult(this.status, [this.address = '']);
  final KycLocationStatus status;
  final String address;
}

/// Current position -> a readable address line (platform geocoder, Google
/// backed on Android). Abstracted for tests.
abstract interface class KycLocationSource {
  Future<KycLocationResult> currentAddress({
    required String languageCode,
    void Function(KycLocationStage stage)? onStage,
  });
}

final class DeviceKycLocationSource implements KycLocationSource {
  @override
  Future<KycLocationResult> currentAddress({
    required String languageCode,
    void Function(KycLocationStage stage)? onStage,
  }) async {
    try {
      onStage?.call(KycLocationStage.position);
      if (!await Geolocator.isLocationServiceEnabled()) {
        return const KycLocationResult(KycLocationStatus.serviceOff);
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever) {
        return const KycLocationResult(KycLocationStatus.deniedForever);
      }
      if (perm == LocationPermission.denied) {
        return const KycLocationResult(KycLocationStatus.denied);
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );
      onStage?.call(KycLocationStage.address);
      // The platform geocoder can hang when the device has no geocoding
      // backend: do not wait for it forever.
      final marks = await Geocoding()
          .placemarkFromCoordinates(
            pos.latitude,
            pos.longitude,
            locale: Locale(languageCode),
          )
          .timeout(const Duration(seconds: 10));
      final parts = <String>[];
      if (marks.isNotEmpty) {
        final m = marks.first;
        for (final p in [
          m.street,
          m.subLocality,
          m.locality,
          m.subAdministrativeArea,
          m.administrativeArea,
        ]) {
          final t = (p ?? '').trim();
          if (t.isNotEmpty && !parts.contains(t)) parts.add(t);
        }
      }
      if (parts.isEmpty) return const KycLocationResult(KycLocationStatus.failed);
      return KycLocationResult(KycLocationStatus.ok, parts.join(', '));
    } on Object {
      return const KycLocationResult(KycLocationStatus.failed);
    }
  }
}
