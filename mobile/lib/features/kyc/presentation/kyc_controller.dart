import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../app/bootstrap/providers.dart';
import '../../../core/error/failure.dart';
import '../../../core/session/company_id.dart';
import '../../../core/util/either.dart';
import '../../customer_state/presentation/customer_state_notifier.dart';
import '../data/kyc_repository.dart';
import '../domain/kyc_case.dart';
import '../domain/kyc_options.dart';
import '../domain/kyc_schema.dart';
import 'kyc_location.dart';

/// One-shot messages for the UI (snack bars). Localized in the view.
enum KycNotice {
  saved,
  submitted,
  conflict,
  fileTooLarge,
  fileRejected,
  invalid,
  unavailable,
  pickFailed,
  phoneFormat,
  duplicatePhone,
  duplicateRelation,
  locationDenied,
  locationServiceOff,
  locationFailed,
}

enum KycLoadPhase { loading, ready, error }

final class KycUiState {
  const KycUiState({
    this.phase = KycLoadPhase.loading,
    this.loadFailure,
    this.serverCase,
    this.values = const {},
    this.files = const {},
    this.consent = false,
    this.busy = false,
    this.uploading = const {},
    this.notice,
    this.problems = const [],
    this.locating = false,
    this.locationStage = KycLocationStage.position,
    this.addressEpoch = 0,
  });

  final KycLoadPhase phase;
  final AppFailure? loadFailure;
  final KycCase? serverCase;

  /// The editable draft. Starts as the server's view and is replaced by it
  /// after every successful save/submit.
  final Map<String, String> values;
  final Map<String, KycFileRef> files;
  final bool consent;
  final bool busy;
  final Set<String> uploading;
  final KycNotice? notice;
  final List<KycProblem> problems;

  /// A location lookup is running.
  final bool locating;
  final KycLocationStage locationStage;

  /// Bumped when the address is filled in from outside the text field so the
  /// field shows the new text.
  final int addressEpoch;

  KycCaseStatus get status => serverCase?.status ?? KycCaseStatus.unknown;
  bool get editable => serverCase != null && status.editable;

  /// The bundled options do not match the server rules: fail closed.
  bool get ruleMismatch =>
      serverCase != null && serverCase!.ruleVersion != kKycRuleVersion;

  Set<String> get uploadedSlots => files.keys.toSet();

  KycUiState copyWith({
    KycLoadPhase? phase,
    AppFailure? loadFailure,
    bool clearLoadFailure = false,
    KycCase? serverCase,
    Map<String, String>? values,
    Map<String, KycFileRef>? files,
    bool? consent,
    bool? busy,
    Set<String>? uploading,
    KycNotice? notice,
    bool clearNotice = false,
    List<KycProblem>? problems,
    bool? locating,
    KycLocationStage? locationStage,
    int? addressEpoch,
  }) {
    return KycUiState(
      phase: phase ?? this.phase,
      loadFailure: clearLoadFailure ? null : (loadFailure ?? this.loadFailure),
      serverCase: serverCase ?? this.serverCase,
      values: values ?? this.values,
      files: files ?? this.files,
      consent: consent ?? this.consent,
      busy: busy ?? this.busy,
      uploading: uploading ?? this.uploading,
      notice: clearNotice ? null : (notice ?? this.notice),
      problems: problems ?? this.problems,
      locating: locating ?? this.locating,
      locationStage: locationStage ?? this.locationStage,
      addressEpoch: addressEpoch ?? this.addressEpoch,
    );
  }
}

/// Source of material images (camera / gallery). Abstracted for tests.
abstract interface class KycImageSource {
  /// Returns JPEG/PNG bytes already downscaled for upload, or null if the user
  /// cancelled.
  Future<Uint8List?> pick({required bool camera});
}

final class DeviceKycImageSource implements KycImageSource {
  DeviceKycImageSource([ImagePicker? picker]) : _picker = picker ?? ImagePicker();
  final ImagePicker _picker;

  @override
  Future<Uint8List?> pick({required bool camera}) async {
    // Downscale on the device so the upload stays far below the 10 MB limit.
    final file = await _picker.pickImage(
      source: camera ? ImageSource.camera : ImageSource.gallery,
      maxWidth: 2000,
      maxHeight: 2000,
      imageQuality: 85,
    );
    if (file == null) return null;
    return file.readAsBytes();
  }
}

final kycLocationSourceProvider =
    Provider<KycLocationSource>((ref) => DeviceKycLocationSource());

final kycImageSourceProvider = Provider<KycImageSource>((ref) => DeviceKycImageSource());

final kycRepositoryProvider = Provider<KycRepository>((ref) {
  return KycRepository(factory: ref.watch(apiClientFactoryProvider));
});

final kycOptionsProvider = FutureProvider<KycOptions>((ref) => KycOptions.load());

final class KycController extends Notifier<KycUiState> {
  CompanyId get _id => ref.read(activeCompanyIdProvider) ?? CompanyId.publicWorkspace;

  @override
  KycUiState build() => const KycUiState();

  Future<void> load() async {
    state = state.copyWith(phase: KycLoadPhase.loading, clearLoadFailure: true);
    final r = await ref.read(kycRepositoryProvider).fetch(_id);
    r.when(
      left: (f) => state = state.copyWith(phase: KycLoadPhase.error, loadFailure: f),
      right: (c) => state = _adopt(c, phase: KycLoadPhase.ready),
    );
  }

  KycUiState _adopt(KycCase c, {KycLoadPhase? phase}) => state.copyWith(
        phase: phase,
        serverCase: c,
        values: Map<String, String>.from(c.values),
        files: Map<String, KycFileRef>.from(c.files),
        consent: c.consent && c.declarationVersion == kKycConsentVersion,
        clearLoadFailure: true,
      );

  /// Fills the detailed address from the device location. The user can edit
  /// the text afterwards; nothing is saved until they save the step.
  Future<void> fillAddressFromLocation(String languageCode) async {
    if (!state.editable || state.locating) return;
    state = state.copyWith(
      locating: true,
      locationStage: KycLocationStage.position,
      clearNotice: true,
    );
    final r = await ref.read(kycLocationSourceProvider).currentAddress(
          languageCode: languageCode,
          onStage: (stage) => state = state.copyWith(locationStage: stage),
        );
    if (r.status == KycLocationStatus.ok) {
      final next = Map<String, String>.from(state.values)..['address'] = r.address;
      state = state.copyWith(
        values: next,
        locating: false,
        addressEpoch: state.addressEpoch + 1,
        problems: const [],
      );
      return;
    }
    state = state.copyWith(
      locating: false,
      notice: switch (r.status) {
        KycLocationStatus.denied ||
        KycLocationStatus.deniedForever =>
          KycNotice.locationDenied,
        KycLocationStatus.serviceOff => KycNotice.locationServiceOff,
        _ => KycNotice.locationFailed,
      },
    );
  }

  void setValue(String id, String value) {
    if (!state.editable) return;
    final next = Map<String, String>.from(state.values);
    final f = kycFieldById(id);
    if (value.isEmpty) {
      next.remove(id);
    } else {
      next[id] = f == null ? value : value;
    }
    // Changing the province invalidates the district.
    if (id == 'province') next.remove('district');
    state = state.copyWith(values: next, problems: const []);
  }

  void setConsent(bool v) {
    if (!state.editable) return;
    state = state.copyWith(consent: v, problems: const []);
  }

  void clearNotice() => state = state.copyWith(clearNotice: true);

  /// Local completeness check (mirror of the server's rules).
  List<KycProblem> validate() => kycValidate(
        values: {
          for (final e in state.values.entries)
            e.key: _normalized(e.key, e.value),
        },
        uploadedSlots: state.uploadedSlots,
        consent: state.consent,
      );

  String _normalized(String id, String v) {
    final f = kycFieldById(id);
    return f == null ? v.trim() : kycNormalize(f, v);
  }

  Future<bool> saveDraft({bool announce = true}) => _send(submit: false, announce: announce);

  /// Returns true when the case was submitted. When the local check fails the
  /// problems are published in the state and nothing is sent.
  Future<bool> submit() async {
    if (!state.editable || state.busy) return false;
    if (state.ruleMismatch) return false;
    final problems = validate();
    if (problems.isNotEmpty) {
      state = state.copyWith(problems: problems);
      return false;
    }
    return _send(submit: true, announce: true);
  }

  Future<bool> _send({required bool submit, required bool announce}) async {
    final c = state.serverCase;
    if (c == null || !state.editable || state.busy) return false;
    state = state.copyWith(busy: true, clearNotice: true);
    // The server rejects the whole draft when a phone number is malformed or
    // two contacts share a relationship. A draft is saved without those values
    // (they stay on screen and the user is told); a submit never gets here with
    // one (validate() blocks it).
    final held = <String, String>{};
    final sendValues = Map<String, String>.from(state.values);
    if (!submit) {
      for (final f in kKycFields) {
        if (kycFieldIssue(state.values, f.id) != null) {
          held[f.id] = state.values[f.id]!;
          sendValues.remove(f.id);
        }
      }
    }
    final r = await ref.read(kycRepositoryProvider).save(
          _id,
          revision: c.revision,
          values: sendValues,
          files: state.files,
          consent: state.consent,
          submit: submit,
        );
    switch (r) {
      case Right<AppFailure, KycCase>(value: final updated):
        state = _adopt(updated).copyWith(
          busy: false,
          problems: const [],
          notice: held.isNotEmpty
              ? _heldNotice(held.keys.map((id) => kycFieldIssue(state.values, id)))
              : (announce ? (submit ? KycNotice.submitted : KycNotice.saved) : null),
        );
        if (held.isNotEmpty) {
          // Keep what the user typed so they can correct it.
          state = state.copyWith(values: {...state.values, ...held});
        }
        if (submit) {
          // Home shows the KYC status from /api/h5/state: refresh it.
          unawaited(ref
              .read(customerStateProvider.notifier)
              .load(companyId: _id, force: true));
        }
        return true;
      case Left<AppFailure, KycCase>(value: final f):
        state = state.copyWith(busy: false, notice: _noticeFor(f));
        if (f.statusCode == 409) await load();
        return false;
    }
  }

  /// Picks an image, uploads it for [slot] and attaches it by saving the draft.
  Future<void> uploadSlot(String slot, {required bool camera}) async {
    if (!state.editable || state.uploading.contains(slot)) return;
    Uint8List? bytes;
    try {
      bytes = await ref.read(kycImageSourceProvider).pick(camera: camera);
    } on Object {
      state = state.copyWith(notice: KycNotice.pickFailed);
      return;
    }
    if (bytes == null) return;
    state = state.copyWith(
      uploading: {...state.uploading, slot},
      clearNotice: true,
    );
    final r = await ref.read(kycRepositoryProvider).upload(_id, slot: slot, bytes: bytes);
    final still = {...state.uploading}..remove(slot);
    switch (r) {
      case Right<AppFailure, KycFileRef>(value: final ref0):
        state = state.copyWith(
          uploading: still,
          files: {...state.files, slot: ref0},
        );
        // The upload only stores the file; attach it to the case.
        await saveDraft(announce: false);
      case Left<AppFailure, KycFileRef>(value: final f):
        state = state.copyWith(uploading: still, notice: _noticeFor(f));
    }
  }

  /// Which message to show when a save left some entries out. Duplicates are
  /// named explicitly; a malformed phone is the fallback.
  KycNotice _heldNotice(Iterable<KycProblemKind?> issues) {
    final set = issues.toSet();
    if (set.contains(KycProblemKind.duplicatePhone)) return KycNotice.duplicatePhone;
    if (set.contains(KycProblemKind.duplicateRelation)) return KycNotice.duplicateRelation;
    return KycNotice.phoneFormat;
  }

  KycNotice _noticeFor(AppFailure f) {
    final code = f.statusCode ?? 0;
    if (f is OfflineFailure || f is NetworkFailure || code >= 500) {
      return KycNotice.unavailable;
    }
    return switch (code) {
      409 => KycNotice.conflict,
      413 => KycNotice.fileTooLarge,
      422 => KycNotice.fileRejected,
      _ => KycNotice.invalid,
    };
  }
}

final kycControllerProvider =
    NotifierProvider<KycController, KycUiState>(KycController.new);
