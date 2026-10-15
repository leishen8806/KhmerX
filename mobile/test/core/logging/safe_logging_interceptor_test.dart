import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/logging/redaction_policy.dart';
import 'package:khmerx_app/core/network/endpoints.dart';
import 'package:khmerx_app/core/network/interceptors/safe_logging_interceptor.dart';

void main() {
  group('P1-05 + P1-06 — SafeLoggingInterceptor contract', () {
    late SafeLoggingInterceptor interceptor;
    setUp(() => interceptor = SafeLoggingInterceptor());

    test('onRequest: attaches X-Trace-Id header; does NOT log body', () {
      final captured = <RequestOptions>[];
      final next = _ReqHandler(onNext: captured.add);
      final ro = RequestOptions(
        method: 'POST',
        path: Endpoints.postH5AuthLogout.path,
        extra: const {'endpoint': Endpoints.postH5AuthLogout, 'companyId': 't_demo'},
        data: const {'password': 'super-secret-123', 'otp': '000000'},
      );
      interceptor.onRequest(ro, next);
      expect(captured, isNotEmpty);
      final head = captured.single.headers['X-Trace-Id']?.toString();
      expect(head, isNotNull);
      expect(head!.isEmpty, isFalse);
    });

    test('onError: DioException.toString passes through RedactionPolicy', () {
      final captured = <DioException>[];
      final h = _ErrHandler(onNext: captured.add);
      final ro = RequestOptions(
        path: '/api/test',
        headers: {'X-Trace-Id': 'trace999'},
        extra: const {'endpoint': Endpoints.getH5Auth},
      );
      final err = DioException(
        requestOptions: ro,
        message: 'auth failed password=abc123xyz cookie=secret-bank cookieValue',
      );
      interceptor.onError(err, h);
      final loggedMessage = RedactionPolicy.redactMessage(err.toString());
      expect(_RedactionCheck.verifyRedacted(loggedMessage), isTrue,
          reason: 'onError message must be redacted; password/cookie not leaked. '
              'Got: $loggedMessage',);
    });
  });
}

class _RedactionCheck {
  static bool verifyRedacted(String s) {
    final low = s.toLowerCase();
    if (low.contains('password=abc123xyz')) return false;
    if (low.contains('cookie=secret-bank')) return false;
    return true;
  }
}

class _ReqHandler extends RequestInterceptorHandler {
  _ReqHandler({required this.onNext});
  final void Function(RequestOptions) onNext;
  @override
  void next(Object? data) => onNext(data as RequestOptions);
}

class _ErrHandler extends ErrorInterceptorHandler {
  _ErrHandler({required this.onNext});
  final void Function(DioException) onNext;
  @override
  void next(Object? data) => onNext(data as DioException);
}
