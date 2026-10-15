import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../../core/error/error_mapper.dart';
import '../../../core/error/failure.dart';
import '../../../core/network/api_client_factory.dart';
import '../../../core/network/endpoints.dart';
import '../../../core/session/company_id.dart';
import '../../../core/util/either.dart';
import '../domain/kyc_case.dart';
import '../domain/kyc_schema.dart';

/// KYC network access (docs 76 §3). The server is the single source of truth:
/// every call returns the server's view of the case.
class KycRepository {
  KycRepository({required this.factory});

  final ApiClientFactory factory;

  Future<Either<AppFailure, KycCase>> fetch(CompanyId id) async {
    try {
      final client = await factory.get(id);
      final resp = await client.request<Object?>(Endpoints.getKyc);
      final parsed = KycCase.tryParse(resp.data);
      if (parsed == null) {
        return Left(UnknownFailure(
          originalError: 'Unexpected KYC response',
          statusCode: resp.statusCode,
        ));
      }
      return Right(parsed);
    } on Object catch (e, st) {
      return Left(_map(e, st));
    }
  }

  /// `submit == false` saves a draft. [revision] must be the latest one the
  /// app received, otherwise the server answers 409.
  Future<Either<AppFailure, KycCase>> save(
    CompanyId id, {
    required int revision,
    required Map<String, String> values,
    required Map<String, KycFileRef> files,
    required bool consent,
    required bool submit,
  }) async {
    final cleaned = <String, String>{};
    for (final f in kKycFields) {
      final raw = values[f.id];
      if (raw == null) continue;
      cleaned[f.id] = kycNormalize(f, raw);
    }
    final body = <String, Object?>{
      'action': submit ? 'submit' : 'save',
      'revision': revision,
      'profile': {
        'values': cleaned,
        'files': {
          for (final e in files.entries) e.key: {'id': e.value.id},
        },
        'consent': consent,
        'declarationVersion': kKycConsentVersion,
      },
    };
    try {
      final client = await factory.get(id);
      final resp = await client.request<Object?>(Endpoints.postKyc, data: body);
      final parsed = KycCase.tryParse(resp.data);
      if (parsed == null) {
        return Left(UnknownFailure(
          originalError: 'Unexpected KYC response',
          statusCode: resp.statusCode,
        ));
      }
      return Right(parsed);
    } on Object catch (e, st) {
      return Left(_map(e, st));
    }
  }

  /// Uploads one material. Content, name and path are never logged.
  Future<Either<AppFailure, KycFileRef>> upload(
    CompanyId id, {
    required String slot,
    required Uint8List bytes,
  }) async {
    try {
      final client = await factory.get(id);
      final resp = await client.request<Object?>(
        Endpoints.postKycFile,
        data: bytes,
        headers: {'x-kyc-slot': slot},
        contentType: 'application/octet-stream',
      );
      final data = resp.data;
      if (data is Map && data['id'] is String) {
        return Right(KycFileRef(
          id: data['id'] as String,
          slot: slot,
          size: (data['size'] is num) ? (data['size'] as num).toInt() : bytes.length,
          type: data['type']?.toString() ?? '',
        ));
      }
      return Left(UnknownFailure(
        originalError: 'Unexpected upload response',
        statusCode: resp.statusCode,
      ));
    } on Object catch (e, st) {
      return Left(_map(e, st));
    }
  }

  AppFailure _map(Object e, StackTrace st) {
    if (e is AppFailure) return e;
    if (e is DioException) {
      final inner = e.error;
      if (inner is AppFailure) return inner;
      return ErrorMapper.fromDioException(e);
    }
    return UnknownFailure(originalError: e, stackTrace: st);
  }
}
