import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/bootstrap/providers.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/error/failure_text.dart';
import '../../../../core/session/company_id.dart';
import '../../../../core/util/either.dart';
import '../../../../l10n/app_localizations.dart';
import '../../auth/domain/password_rules.dart';

enum ChangePasswordPhase {
  idle,
  submitting,
  success,
}

final class ChangePasswordPage extends ConsumerStatefulWidget {
  const ChangePasswordPage({super.key});

  @override
  ConsumerState<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends ConsumerState<ChangePasswordPage> {
  final current = TextEditingController();
  final password = TextEditingController();
  final confirm = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool currentVisible = false;
  bool newVisible = false;
  bool confirmVisible = false;
  ChangePasswordPhase phase = ChangePasswordPhase.idle;
  String? serverError;

  @override
  void dispose() {
    current.dispose();
    password.dispose();
    confirm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    const min = PasswordRules.minLength;
    const max = PasswordRules.maxLength;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.passwordTitle)),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            if (serverError != null) ...[
              Card(
                color: Theme.of(context).colorScheme.errorContainer,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline, color: Theme.of(context).colorScheme.onErrorContainer),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          serverError!,
                          style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
            _PasswordField(
              controller: current,
              label: l10n.passwordCurrentLabel,
              placeholder: '••••••••••••',
              visible: currentVisible,
              showLabel: l10n.passwordToggleShow,
              hideLabel: l10n.passwordToggleHide,
              onToggle: () => setState(() => currentVisible = !currentVisible),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return l10n.passwordCurrentLabel;
                return null;
              },
            ),
            const SizedBox(height: 14),
            _PasswordField(
              controller: password,
              label: l10n.passwordNewLabel,
              placeholder: '••••••••••••',
              visible: newVisible,
              showLabel: l10n.passwordToggleShow,
              hideLabel: l10n.passwordToggleHide,
              onToggle: () => setState(() => newVisible = !newVisible),
              validator: (v) {
                final value = v ?? '';
                final check = PasswordRules.validate(value);
                if (check.tooShort) return l10n.passwordTooShort(min);
                if (check.tooLong) return l10n.passwordTooLong(max);
                return null;
              },
            ),
            const SizedBox(height: 14),
            _PasswordField(
              controller: confirm,
              label: l10n.passwordConfirmLabel,
              placeholder: '••••••••••••',
              visible: confirmVisible,
              showLabel: l10n.passwordToggleShow,
              hideLabel: l10n.passwordToggleHide,
              onToggle: () => setState(() => confirmVisible = !confirmVisible),
              validator: (v) {
                final check = PasswordRules.validate(password.text, confirm: v);
                if (check.tooShort) return l10n.passwordTooShort(min);
                if (check.tooLong) return l10n.passwordTooLong(max);
                if (!check.matchesConfirm) return l10n.passwordMismatch;
                if (password.text.isNotEmpty && password.text == current.text) {
                  return l10n.passwordSameAsCurrent;
                }
                return null;
              },
            ),
            const SizedBox(height: 20),
            FilledButton(
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              onPressed: phase == ChangePasswordPhase.submitting ? null : _submit,
              child: phase == ChangePasswordPhase.submitting
                  ? Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        const SizedBox(width: 10),
                        Text(l10n.passwordLoading),
                      ],
                    )
                  : Text(l10n.passwordSubmit),
            ),
            if (phase == ChangePasswordPhase.success) ...[
              const SizedBox(height: 12),
              Card(
                color: Theme.of(context).colorScheme.primaryContainer,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Icon(Icons.check_circle_outline, color: Theme.of(context).colorScheme.onPrimaryContainer),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          l10n.passwordSuccess,
                          style: TextStyle(color: Theme.of(context).colorScheme.onPrimaryContainer),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      serverError = null;
    });
    if (!_form.currentState!.validate()) return;
    final CompanyId? id = ref.read(activeCompanyIdProvider);
    if (id == null) {
      setState(() => serverError = l10n.passwordSameAsCurrent);
      return;
    }
    setState(() => phase = ChangePasswordPhase.submitting);
    final repo = ref.read(authRepositoryProvider);
    final Either<AppFailure, void> r = await repo.setPassword(
      id,
      password: password.text,
      currentPassword: current.text,
    );
    if (!mounted) return;
    r.when(left: (f) {
      setState(() {
        phase = ChangePasswordPhase.idle;
        serverError = describeFailure(l10n, f);
      });
    }, right: (_) {
      current.clear();
      password.clear();
      confirm.clear();
      _form.currentState?.reset();
      setState(() => phase = ChangePasswordPhase.success);
      Future.delayed(const Duration(milliseconds: 800), () {
        if (mounted && GoRouter.of(context).canPop()) context.pop();
      });
    });
  }
}

final class _PasswordField extends StatelessWidget {
  const _PasswordField({
    required this.controller,
    required this.label,
    required this.placeholder,
    required this.visible,
    required this.showLabel,
    required this.hideLabel,
    required this.onToggle,
    required this.validator,
  });

  final TextEditingController controller;
  final String label;
  final String placeholder;
  final bool visible;
  final String showLabel;
  final String hideLabel;
  final VoidCallback onToggle;
  final String? Function(String? v) validator;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      textField: true,
      child: TextFormField(
        controller: controller,
        obscureText: !visible,
        keyboardType: TextInputType.visiblePassword,
        enableSuggestions: false,
        autocorrect: false,
        decoration: InputDecoration(
          labelText: label,
          hintText: placeholder,
          suffixIcon: IconButton(
            tooltip: visible ? hideLabel : showLabel,
            onPressed: onToggle,
            icon: Icon(visible ? Icons.visibility_off : Icons.visibility),
          ),
          border: const OutlineInputBorder(),
        ),
        autovalidateMode: AutovalidateMode.onUserInteraction,
        validator: validator,
      ),
    );
  }
}
