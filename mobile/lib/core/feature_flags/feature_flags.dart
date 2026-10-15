import 'package:equatable/equatable.dart';

final class FeatureFlags extends Equatable {
  const FeatureFlags({
    this.withdraw = false,
    this.repay = false,
  });

  final bool withdraw;
  final bool repay;

  @override
  List<Object?> get props => [withdraw, repay];
}
