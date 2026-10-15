import 'package:equatable/equatable.dart';

sealed class Either<L, R> extends Equatable {
  const Either();
  bool get isLeft => this is Left<L, R>;
  bool get isRight => this is Right<L, R>;
}

final class Left<L, R> extends Either<L, R> {
  const Left(this.value);
  final L value;

  @override
  List<Object?> get props => [value];
}

final class Right<L, R> extends Either<L, R> {
  const Right(this.value);
  final R value;

  @override
  List<Object?> get props => [value];
}

extension EitherWhen<L, R> on Either<L, R> {
  void when({
    required void Function(L) left,
    required void Function(R) right,
  }) {
    switch (this) {
      case Left<L, R>(value: final l):
        left(l);
      case Right<L, R>(value: final r):
        right(r);
    }
  }
}
