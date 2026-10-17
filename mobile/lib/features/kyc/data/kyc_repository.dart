import 'dart:typed_data';
import 'dart:async';

import 'package:dio/dio.dart';

import '../../../core/error/error_mapper.dart';
import '../../../core/error/failure.dart';
import '../../../core/network/api_client_factory.dart';
import '../../../core/network/endpoints.dart';
import '../../../core/session/company_id.dart';
import '../../../core/util/either.dart';
import '../domain/kyc_case.dart';
import '../domain/kyc_schema.dart';

// Single source: lib/kyc/limits.ts. Recheck these when the server contract changes.
const kKycImageMaxBytes = 5 * 1024 * 1024;
const kKycPdfMaxBytes = 10 * 1024 * 1024;
int kycUploadLimit(Uint8List bytes) => bytes.length >= 5 &&
    bytes[0] == 37 && bytes[1] == 80 && bytes[2] == 68 && bytes[3] == 70 && bytes[4] == 45
    ? kKycPdfMaxBytes : kKycImageMaxBytes;

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
    CancelToken? cancelToken,
    void Function(int attempt, Duration delay)? onRetry,
  }) async {
    final limit = kycUploadLimit(bytes);
    if (bytes.length > limit) {
      return Left(ValidationFailure.bodyTooLarge(limitBytes: limit, actualBytes: bytes.length, statusCode: 413));
    }
    final payload = Uint8List.fromList(bytes);
    try {
      final client = await factory.get(id);
      for (var retries = 0; ; retries++) {
        try {
          final resp = await client.request<Object?>(
            Endpoints.postKycFile,
            data: payload,
            headers: {'x-kyc-slot': slot},
            contentType: 'application/octet-stream',
            cancelToken: cancelToken,
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
          final failure = _map(e, st);
          // Retry only an explicit HTTP rejection, never an ambiguous transport failure.
          if (e is! DioException || e.type != DioExceptionType.badResponse ||
              ![429, 503].contains(e.response?.statusCode) || retries >= 3 ||
              cancelToken?.isCancelled == true) {
            return Left(failure);
          }
          final delay = Duration(seconds: ErrorMapper.retryAfterSeconds(e.response).clamp(1, 30));
          onRetry?.call(retries + 1, delay);
          await _wait(delay, cancelToken);
        }
      }
    } on Object catch (e, st) {
      return Left(_map(e, st));
    }
  }

  Future<void> _wait(Duration delay, CancelToken? token) async {
    final done = Completer<void>();
    final timer = Timer(delay, done.complete);
    try {
      if (token == null) {await done.future;}
      else {
        await Future.any<void>([done.future, token.whenCancel.then<void>((e) => throw e)]);
        if (token.isCancelled) {throw token.cancelError!;}
      }
    } finally {timer.cancel();}
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
