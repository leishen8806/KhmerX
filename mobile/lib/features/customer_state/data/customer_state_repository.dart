import 'package:dio/dio.dart';

import '../../../core/error/error_mapper.dart';
import '../../../core/error/failure.dart';
import '../../../core/network/api_client_factory.dart';
import '../../../core/network/endpoints.dart';
import '../../../core/session/company_id.dart';
import '../../../core/util/either.dart';
import '../domain/customer_snapshot.dart';
import 'dto/h5_state_dto.dart';
import 'h5_state_mapper.dart';

final class CustomerStateRepository {
  CustomerStateRepository({required this.factory});

  final ApiClientFactory factory;

  Future<Either<AppFailure, CustomerSnapshot>> fetchState(
    CompanyId companyId,
  ) async {
    final client = await factory.get(companyId);
    try {
      final resp = await client.request<Object?>(Endpoints.getH5State);
      if (resp.statusCode == 200 || resp.statusCode == 204) {
        final envelope = H5StateEnvelopeDto.fromJson(resp.data);
        final snapshot = H5StateMapper.toSnapshot(companyId, envelope);
        return Right(snapshot);
      }
      return Left(
        UnknownFailure(
          originalError: 'Unexpected status ${resp.statusCode}',
          statusCode: resp.statusCode,
        ),
      );
    } on Object catch (e, st) {
      return Left(_map(e, st));
    }
  }

  AppFailure _map(Object e, StackTrace st) {
    if (e is AppFailure) return e;
    if (e is DioException) return ErrorMapper.fromDioException(e);
    return UnknownFailure(originalError: e, stackTrace: st);
  }
}
