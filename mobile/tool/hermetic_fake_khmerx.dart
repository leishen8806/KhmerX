// Hermetic fake KhmerX server for Android runtime smoke (Case A / Case B).
// Run as: dart hermetic_fake_khmerx.dart  <companyId>  <logfile>
// Binds 0.0.0.0:80 so the Android emulator's 10.0.2.2:80 (dev AppConfig baseUrl) reaches it.
// For a valid DEFAULT_COMPANY_ID it replies 200 to GET /api/h5/auth with an unauthenticated
// preflight (so startup resolves -> preflight 2xx -> Login). For a non-matching / unknown
// company it replies 403 so startup routes to Recovery (unavailable path).
//
// Also records every request to <logfile> for deterministic network-count evidence.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

Future<void> main(List<String> args) async {
  final companyId = args.isNotEmpty ? args[0] : 't_00000000-0000-0000-0000-000000000001';
  final logSink = (args.length > 1) ? args[1] : 'hermetic_fake_khmerx.log';
  final buffer = StringBuffer();

  void log(String line) {
    final ts = DateTime.now().toIso8601String();
    final entry = '$ts $line';
    buffer.writeln(entry);
    stdout.writeln(entry);
  }

  final server = await HttpServer.bind(
    InternetAddress.anyIPv4,
    80,
    shared: true,
  );
  log('HERMETIC_FAKE_LISTENING port=80 companyId=$companyId');

  await for (final req in server) {
    final bytes = await req.expand((c) => c).toList();
    final headers = <String, String>{};
    req.headers.forEach((k, v) => headers[k.toLowerCase()] = v.join(', '));
    final body = utf8.decode(bytes, allowMalformed: true);
    log('REQ ${req.method} ${req.uri.path} cookie="${headers['cookie'] ?? ''}" bodyLen=${body.length}');
    final resp = req.response;

    // Emulate /api/h5/auth preflight.
    if (req.method == 'GET' && req.uri.path == '/api/h5/auth') {
      // Determine company from the payease_company cookie if present.
      final cookieRaw = headers['cookie'] ?? '';
      final m = RegExp(r'payease_company=([^;]+)').firstMatch(cookieRaw);
      final reqCompany = m != null ? m.group(1)!.trim() : '';
      fsync(logSink, buffer);
      if (reqCompany == companyId) {
        log('RESP /api/h5/auth 200 UNAUTHENTICATED company=$reqCompany');
        resp.statusCode = HttpStatus.ok;
        resp.headers.set(HttpHeaders.contentTypeHeader, 'application/json; charset=utf-8');
        resp.headers.set(HttpHeaders.cacheControlHeader, 'no-store');
        resp.headers.set('Set-Cookie', 'session=hermetic; Path=/; HttpOnly');
        resp.add(utf8.encode(jsonEncode({
          'company': 'Hermetic Test Co. Ltd',
          'authenticated': false,
          'session': null,
          'pending': null,
          'policy': {},
          'languages': {'en': true, 'km': true, 'zh': true},
        })));
      } else {
        log('RESP /api/h5/auth 403 FORBIDDEN company="$reqCompany" expected="$companyId"');
        resp.statusCode = HttpStatus.forbidden;
        resp.headers.set(HttpHeaders.contentTypeHeader, 'application/json; charset=utf-8');
        resp.add(utf8.encode(jsonEncode({
          'error': 'forbidden',
          'code': 'cross_site_unknown_company',
          'message': 'Unknown or mismatched company',
        })));
      }
    } else {
      fsync(logSink, buffer);
      log('RESP 404 ${req.method} ${req.uri.path}');
      resp.statusCode = HttpStatus.notFound;
      resp.headers.set(HttpHeaders.contentTypeHeader, 'application/json; charset=utf-8');
      resp.add(utf8.encode(jsonEncode({'error': 'not-found'})));
    }
    await resp.close();
  }
}

void fsync(String path, StringBuffer buf) {
  try {
    final f = File(path);
    f.writeAsStringSync(buf.toString(), mode: FileMode.append, flush: true);
  } catch (_) {}
}