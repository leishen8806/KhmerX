import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemChannels;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/bootstrap/providers.dart';
import '../../l10n/app_localizations.dart';

/// Whether numeric inputs (phone numbers, verification codes) use the full
/// keyboard instead of the number keypad. Some devices and emulators do not
/// draw the number keypad, and some hardware keyboards / CJK input methods
/// cannot type into it, so the full keyboard is one tap away. Remembered on the
/// device (secure storage), shared by every numeric input in the app.
final class FullKeyboardNotifier extends Notifier<bool> {
  static const String _key = 'v1/app/fullKeyboard';
  // Same storage key the KYC screens used before this became app-wide.
  static const String _legacyKey = 'v1/app/kycFullKeyboard';

  @override
  bool build() {
    unawaited(_load());
    return false;
  }

  Future<void> _load() async {
    try {
      final kv = ref.read(secureKvProvider);
      final v = await kv.read(_key) ?? await kv.read(_legacyKey);
      if (v == '1') state = true;
    } on Object {
      // Keep the default.
    }
  }

  void toggle() {
    state = !state;
    // The input method only re-reads the field's keyboard type when the text
    // connection is re-created: drop focus and take it back on the next frame.
    final node = FocusManager.instance.primaryFocus;
    if (node != null && node.hasPrimaryFocus) {
      node.unfocus();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (node.canRequestFocus) node.requestFocus();
      });
    }
    unawaited(
      ref.read(secureKvProvider).write(_key, state ? '1' : '0').catchError((Object _) {}),
    );
  }
}

final fullKeyboardProvider =
    NotifierProvider<FullKeyboardNotifier, bool>(FullKeyboardNotifier.new);

/// Keyboard type for a numeric input, honouring the user's choice.
TextInputType numericKeyboardType(WidgetRef ref, {bool phone = true}) =>
    ref.watch(fullKeyboardProvider)
        ? TextInputType.text
        : (phone ? TextInputType.phone : TextInputType.number);

/// Small button for the input's suffix that switches number keypad <-> full
/// keyboard.
Widget keyboardSwitchButton(BuildContext context, WidgetRef ref, {bool enabled = true}) {
  final l = AppLocalizations.of(context);
  final full = ref.watch(fullKeyboardProvider);
  return IconButton(
    tooltip: l.kycSwitchKeyboard,
    icon: Icon(full ? Icons.dialpad : Icons.keyboard_alt_outlined),
    onPressed: enabled ? () => ref.read(fullKeyboardProvider.notifier).toggle() : null,
  );
}

/// Safety net for devices / emulators whose input method never draws the
/// number keypad: when a phone / number field gets focus and no keyboard shows
/// up shortly after, switch the whole app to the full keyboard (remembered) and
/// ask for the keyboard again. Wrap the app once.
class KeyboardFallbackHost extends ConsumerStatefulWidget {
  const KeyboardFallbackHost({super.key, required this.child});
  final Widget child;

  @override
  ConsumerState<KeyboardFallbackHost> createState() => _KeyboardFallbackState();
}

class _KeyboardFallbackState extends ConsumerState<KeyboardFallbackHost> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    FocusManager.instance.addListener(_onFocus);
  }

  @override
  void dispose() {
    FocusManager.instance.removeListener(_onFocus);
    _timer?.cancel();
    super.dispose();
  }

  bool _numericFocused() {
    final ctx = FocusManager.instance.primaryFocus?.context;
    final editable = ctx?.findAncestorWidgetOfExactType<EditableText>();
    final t = editable?.keyboardType;
    return t == TextInputType.phone || t == TextInputType.number;
  }

  void _onFocus() {
    _timer?.cancel();
    if (ref.read(fullKeyboardProvider) || !_numericFocused()) return;
    _timer = Timer(const Duration(milliseconds: 1000), () {
      if (!mounted || ref.read(fullKeyboardProvider) || !_numericFocused()) return;
      final views = WidgetsBinding.instance.platformDispatcher.views;
      // A blank input-method window (no keys drawn) is only tens of dp tall; a
      // real keypad is well above 120 dp.
      final shown = views.isNotEmpty &&
          views.first.viewInsets.bottom / views.first.devicePixelRatio > 120;
      if (shown) return;
      ref.read(fullKeyboardProvider.notifier).toggle();
      // Rebuild with the text keyboard type, then ask for the keyboard again.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        unawaited(SystemChannels.textInput.invokeMethod<void>('TextInput.show'));
      });
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
