import 'dart:async';
import 'dart:convert';
import 'dart:io';

final class CapturedRequest {
  CapturedRequest({
    required this.method,
    required this.path,
    required this.headers,
    required this.bodyBytes,
  });

  final String method;
  final String path;
  final Map<String, String> headers;
  final List<int> bodyBytes;

  String? header(String name) => headers[name.toLowerCase()];

  String? get cookie => header('cookie');

  Map<String, Object?> get bodyAsJson {
    if (bodyBytes.isEmpty) return const {};
    try {
      final s = utf8.decode(bodyBytes, allowMalformed: true);
      if (s.trim().isEmpty) return const {};
      final decoded = json.decode(s);
      if (decoded is Map<String, Object?>) return decoded;
      return {'_root': decoded};
    } catch (_) {
      return {};
    }
  }
}

typedef FakeHandler = FutureOr<HttpResponseData> Function(CapturedRequest req);

final class HttpResponseData {
  HttpResponseData({
    required this.statusCode,
    this.body = const <int>[],
    this.headers = const <String, String>{},
  });

  final int statusCode;
  final List<int> body;
  final Map<String, String> headers;

  static HttpResponseData fromJson(int status, Object data, {
    Map<String, String> headers = const {},
  }) {
    final bytes = utf8.encode(const JsonCodec().encode(data));
    final merged = Map<String, String>.from(headers)
      ..[HttpHeaders.contentTypeHeader] = 'application/json; charset=utf-8';
    return HttpResponseData(statusCode: status, body: bytes, headers: merged);
  }

  static HttpResponseData ok(Object data) =>
      HttpResponseData.fromJson(HttpStatus.ok, data);
}

final class FakeKhmerxServer {
  FakeKhmerxServer._(this._server);

  final HttpServer _server;
  final List<CapturedRequest> requests = <CapturedRequest>[];
  final Map<String, FakeHandler> _routes = <String, FakeHandler>{};

  static Future<FakeKhmerxServer> bind() async {
    final server = await HttpServer.bind('127.0.0.1', 0);
    final fks = FakeKhmerxServer._(server);
    fks._start();
    return fks;
  }

  String get baseUrl => 'http://127.0.0.1:${_server.port}';

  void register(String key, FakeHandler handler) => _routes[key] = handler;

  Future<void> close() => _server.close(force: true);

  void _start() {
    _server.listen((request) async {
      final bytes = await request.expand((c) => c).toList();
      final headers = <String, String>{};
      request.headers.forEach((name, values) {
        headers[name.toLowerCase()] = values.join(', ');
      });
      final captured = CapturedRequest(
        method: request.method.toUpperCase(),
        path: request.uri.path,
        headers: headers,
        bodyBytes: bytes,
      );
      requests.add(captured);
      final method = captured.method;
      final routeKey = '$method ${request.uri.path}';
      final handler =
          _routes[routeKey] ?? _routes['$method *'] ?? _defaultHandler;
      final response = await handler(captured);
      final resp = request.response;
      resp.statusCode = response.statusCode;
      resp.headers.set(HttpHeaders.contentLengthHeader, response.body.length);
      resp.headers.set(HttpHeaders.cacheControlHeader, 'no-store');
      for (final e in response.headers.entries) {
        resp.headers.set(e.key, e.value);
      }
      resp.add(response.body);
      await resp.close();
    },);
  }

  static HttpResponseData _defaultHandler(CapturedRequest _) =>
      HttpResponseData.fromJson(404, {'error': 'not-found'});
}
