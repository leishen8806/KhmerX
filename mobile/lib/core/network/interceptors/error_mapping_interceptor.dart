import 'package:dio/dio.dart';

import '../../error/error_mapper.dart';
import '../../error/failure.dart';
import '../endpoints.dart';

final class ErrorMappingInterceptor extends Interceptor {
  ErrorMappingInterceptor({this.onSessionExpired});

  /// Invoked when a session-requiring request is answered with a 401
  /// "no valid session" error, so the app can drop the local session.
  final void Function()? onSessionExpired;

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final AppFailure failure = ErrorMapper.fromDioException(err);
    final endpoint = err.requestOptions.extra['endpoint'];
    if (failure is AuthFailure &&
        failure.messageKey == 'error.auth.session_expired' &&
        endpoint is Endpoint &&
        endpoint.requiresSession) {
      onSessionExpired?.call();
    }
    handler.reject(
      DioException(
        requestOptions: err.requestOptions,
        response: err.response,
        type: err.type,
        error: failure,
        stackTrace: err.stackTrace,
      ),
    );
  }
}
