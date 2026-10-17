import 'dart:async';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/app/config/app_config.dart';
import 'package:khmerx_app/core/error/failure.dart';
import 'package:khmerx_app/core/network/api_client_factory.dart';
import 'package:khmerx_app/core/session/company_cookie_store.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/core/util/either.dart';
import 'package:khmerx_app/features/kyc/data/kyc_repository.dart';
import 'package:khmerx_app/features/kyc/domain/kyc_case.dart';
import '../../support/fake_secure_kv.dart';

class UploadAdapter implements HttpClientAdapter {
  UploadAdapter(this.status, {this.failure, this.retryAfter = 1});
  int status, retryAfter;
  final DioExceptionType? failure;
  final bodies = <List<int>>[];
  final slots = <Object?>[];
  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    bodies.add(List<int>.from(options.data as List<int>));slots.add(options.headers['x-kyc-slot']);
    if (failure != null) {throw DioException(requestOptions: options, type: failure!);}
    return ResponseBody.fromString(status == 200 ? '{"id":"synthetic-file","size":16}' :
        '{"code":"SERVICE_UNAVAILABLE","params":{"retryAfterSeconds":$retryAfter}}', status,
        headers: {'content-type': ['application/json']});
  }
  @override
  void close({bool force = false}) {}
}
Future<KycRepository> repository(UploadAdapter adapter) async {
  final factory = ApiClientFactory(config: AppConfig.dev(), store: CompanyCookieStore(), secureKv: FakeSecureKv());
  final client = await factory.get(CompanyId.publicWorkspace);
  client.dio.httpClientAdapter = adapter;
  return KycRepository(factory: factory);
}
Future<void> flush(WidgetTester tester) async {for (var i = 0; i < 15; i++) {await tester.pump(const Duration(milliseconds: 1));}}

void main() {
  for (final status in [503, 429]) {
    testWidgets('upload $status: three delayed retries only, immutable file and slot', (tester) async {
      final adapter = UploadAdapter(status), repo = await repository(adapter);
      final bytes = Uint8List.fromList(List.filled(16, 7)), attempts = <int>[], delays = <int>[];
      Either<AppFailure, KycFileRef>? result;
      unawaited(repo.upload(CompanyId.publicWorkspace, slot: 'idFront', bytes: bytes,
          onRetry: (attempt, delay) {attempts.add(attempt);delays.add(delay.inSeconds);bytes[0] = 9;})
          .then((value) => result = value));
      await flush(tester);expect(adapter.bodies.length, 1);expect(result, isNull);
      for (var i = 0; i < 3; i++) {await tester.pump(const Duration(seconds: 1));await flush(tester);}
      expect(adapter.bodies.length, 4);expect(attempts, [1, 2, 3]);expect(delays, [1, 1, 1]);expect(result, isA<Left<AppFailure, KycFileRef>>());
      for (final body in adapter.bodies) {expect(body, List.filled(16, 7));}expect(adapter.slots.toSet(), {'idFront'});
      await tester.pump(const Duration(minutes: 1));expect(adapter.bodies.length, 4);
    });
  }
  testWidgets('upload succeeds after explicit rejection', (tester) async {
    final adapter = UploadAdapter(503), repo = await repository(adapter);Either<AppFailure, KycFileRef>? result;
    unawaited(repo.upload(CompanyId.publicWorkspace, slot: 'idBack', bytes: Uint8List(16),
        onRetry: (_, _) => adapter.status = 200).then((value) => result = value));
    await flush(tester);await tester.pump(const Duration(seconds: 1));await flush(tester);
    expect(result, isA<Right<AppFailure, KycFileRef>>());expect(adapter.bodies.length, 2);
  });
  testWidgets('upload delay clamps at 30 seconds and cancellation stops retries', (tester) async {
    final adapter = UploadAdapter(503, retryAfter: 9999), repo = await repository(adapter), token = CancelToken();
    Either<AppFailure, KycFileRef>? result;Duration? observed;
    unawaited(repo.upload(CompanyId.publicWorkspace, slot: 'selfie', bytes: Uint8List(16), cancelToken: token,
        onRetry: (_, delay) {observed = delay;}).then((value) => result = value));
    await flush(tester);expect(observed?.inSeconds, 30);expect(result, isNull);await tester.pump(const Duration(seconds: 29));expect(adapter.bodies.length, 1);
    token.cancel();await flush(tester);await tester.pump(const Duration(minutes: 1));await flush(tester);
    expect(adapter.bodies.length, 1);expect(result, isA<Left<AppFailure, KycFileRef>>());
  });
  for (final status in [500, 413, 409, 400, 401, 403]) {
    testWidgets('upload $status is never retried', (tester) async {
      final adapter = UploadAdapter(status), repo = await repository(adapter);Either<AppFailure, KycFileRef>? result;
      unawaited(repo.upload(CompanyId.publicWorkspace, slot: 'idFront', bytes: Uint8List(16)).then((value) => result = value));
      await flush(tester);await tester.pump(const Duration(minutes: 2));await flush(tester);
      expect(adapter.bodies.length, 1);expect(result, isA<Left<AppFailure, KycFileRef>>());
    });
  }
  for (final type in [DioExceptionType.connectionTimeout, DioExceptionType.sendTimeout,
    DioExceptionType.receiveTimeout, DioExceptionType.connectionError]) {
    testWidgets('upload transport $type is ambiguous and never retried', (tester) async {
      final adapter = UploadAdapter(0, failure: type), repo = await repository(adapter);Either<AppFailure, KycFileRef>? result;
      unawaited(repo.upload(CompanyId.publicWorkspace, slot: 'idFront', bytes: Uint8List(16)).then((value) => result = value));
      await flush(tester);await tester.pump(const Duration(minutes: 2));await flush(tester);
      expect(adapter.bodies.length, 1);expect(result, isA<Left<AppFailure, KycFileRef>>());
    });
  }
  for (final pdf in [false, true]) {
    for (final excess in [0, 1]) {
      testWidgets('local ${pdf ? "PDF" : "image"} limit +$excess prevents oversized HTTP', (tester) async {
        final adapter = UploadAdapter(200), repo = await repository(adapter);
        final bytes = Uint8List((pdf ? kKycPdfMaxBytes : kKycImageMaxBytes) + excess);
        if (pdf) {bytes.setAll(0, [37, 80, 68, 70, 45]);}
        Either<AppFailure, KycFileRef>? result;
        unawaited(repo.upload(CompanyId.publicWorkspace, slot: 'incomeProof', bytes: bytes).then((value) => result = value));
        await flush(tester);expect(adapter.bodies.length, excess == 0 ? 1 : 0);
        expect(result is Right<AppFailure, KycFileRef>, excess == 0);
      });
    }
  }
}
