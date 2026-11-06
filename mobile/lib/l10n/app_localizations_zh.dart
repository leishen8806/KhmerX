// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Chinese (`zh`).
class AppLocalizationsZh extends AppLocalizations {
  AppLocalizationsZh([String locale = 'zh']) : super(locale);

  @override
  String get appName => 'KhmerX';

  @override
  String get errorNetworkConnectionTimeout => '连接超时，请重试。';

  @override
  String get errorNetworkSendTimeout => '请求超时，请重试。';

  @override
  String get errorNetworkReceiveTimeout => '响应超时，请重试。';

  @override
  String get errorNetworkUnknown => '发生网络错误。';

  @override
  String get errorAuthUnauthenticated => '请先登录以继续。';

  @override
  String get errorAuthSessionExpired => '会话已过期，请重新登录。';

  @override
  String get errorAuthLoginPageExpired => '登录页面已过期，请刷新。';

  @override
  String get errorAuthInvalidCredentials => '手机号或密码错误。';

  @override
  String get errorAuthOtpUndeliverable => '无法发送验证码，请稍后重试。';

  @override
  String get errorAuthTooManyAttempts => '尝试次数过多，请稍后再试。';

  @override
  String get errorForbiddenCrossSite => '不允许跨站访问。';

  @override
  String get errorForbiddenInvalidCompany => '无效的公司访问。';

  @override
  String get errorForbiddenRegistrationIncomplete => '请先完成注册。';

  @override
  String get errorForbiddenNotOwner => '您无权执行此操作。';

  @override
  String get errorConflictDataChanged => '数据已被修改，请刷新。';

  @override
  String get errorConflictVersionMismatch => '版本不匹配，请刷新。';

  @override
  String get errorConflictQuoteExpired => '报价已过期，请重新申请。';

  @override
  String get errorConflictAlreadySigned => '文档已签署。';

  @override
  String get errorConflictStatusChanged => '状态已变更，请刷新。';

  @override
  String get errorRateLimit => '请求过于频繁，请稍候。';

  @override
  String get errorServiceUnavailable => '服务暂不可用。';

  @override
  String get errorOffline => '您已离线，请检查网络连接。';

  @override
  String get errorUnknown => '发生未知错误，请重试。';

  @override
  String get appTitle => 'KhmerX';

  @override
  String get commonLoading => '加载中...';

  @override
  String get commonError => '出现错误';

  @override
  String get commonRetry => '重试';

  @override
  String get commonCancel => '取消';

  @override
  String get commonConfirm => '确认';

  @override
  String get commonContinue => '继续';

  @override
  String get commonSave => '保存';

  @override
  String get commonBack => '返回';

  @override
  String get commonOk => '好的';

  @override
  String get commonOffline => '您已离线。';

  @override
  String get errorConflict => '数据已被修改，请刷新。';

  @override
  String get errorSessionExpired => '会话已过期，请重新登录。';

  @override
  String get errorForbidden => '访问被拒绝。';

  @override
  String get errorCompanyInvalid => '该公司不可用。';

  @override
  String get errorAuthInvalid => '手机号或密码错误。';

  @override
  String get errorNetwork => '网络错误。';

  @override
  String get startupTitle => '启动中...';

  @override
  String get companySelectTitle => '选择公司';

  @override
  String get companySelectScan => '扫描二维码';

  @override
  String get companySelectPaste => '粘贴链接';

  @override
  String get companySelectRecent => '最近使用的公司';

  @override
  String get authLoginTitle => '登录';

  @override
  String get authLoginPhoneHint => '手机号码';

  @override
  String get authLoginPasswordHint => '密码';

  @override
  String get authLoginOtp => '验证码验证';

  @override
  String get authLoginPassword => '使用密码登录';

  @override
  String get homePlaceholderTitle => '首页';

  @override
  String get homePlaceholderBody => 'Waiting for UX contract.';

  @override
  String get featureWithdrawDisabled => '功能暂未开放';

  @override
  String get featureRepayDisabled => '功能暂未开放';

  @override
  String get languageTitle => '语言';

  @override
  String get languageEn => 'English';

  @override
  String get languageKm => 'ភាសាខ្មែរ';

  @override
  String get languageZh => '中文';

  @override
  String get settingsTitle => '设置';

  @override
  String get aboutTitle => '关于 KhmerX';

  @override
  String aboutVersion(String version) {
    return '版本 $version';
  }

  @override
  String get homeTitle => '首页';

  @override
  String get homeRefresh => '刷新';

  @override
  String get homeEmptyPrimary => '继续';

  @override
  String get home_company_label => '所属公司';

  @override
  String get home_user_label => '当前账号';

  @override
  String get home_status_label => '当前状态';

  @override
  String get home_loan_summary_label => '借款概览';

  @override
  String get home_remaining_label => '剩余应还';

  @override
  String get home_due_date_label => '到期日';

  @override
  String get home_due_date_missing => '—';

  @override
  String get home_term_label => '期限';

  @override
  String get home_term_days_unit => '天';

  @override
  String get home_principal_label => '本金';

  @override
  String get home_total_repay_label => '应还总额';

  @override
  String get home_paid_label => '已还';

  @override
  String get home_last_updated => '最近更新';

  @override
  String get home_last_updated_never => '暂无更新';

  @override
  String get home_semantics_business_card => '业务状态卡片';

  @override
  String get home_semantics_status_panel_open => '打开当前状态说明面板';

  @override
  String get home_freshness_stale_offline => '当前离线，显示的内容可能不是最新。';

  @override
  String get home_freshness_refresh_failed => '刷新失败，保留上次已加载的数据。';

  @override
  String get home_freshness_session_invalid => '登录已过期，请重新登录。';

  @override
  String get home_waiting_state_hint => '正在等待处理结果，本页保持打开时将自动刷新。';

  @override
  String get home_open_loan_kyc_notice_extra => '您的身份资料仍需关注，可能会影响借款进度。';

  @override
  String get home_status_panel_title => '当前状态说明';

  @override
  String get home_status_panel_close => '关闭';

  @override
  String get home_status_panel_section_current => '1. 当前状态';

  @override
  String get home_status_panel_section_meaning => '2. 这意味着什么';

  @override
  String get home_status_panel_section_available => '3. 当前版本可以做什么';

  @override
  String get home_status_panel_section_not_available => '4. 当前版本暂不可做什么';

  @override
  String get panel_none_status => '尚未开始身份认证';

  @override
  String get panel_none_meaning => '您还未开始借款业务所需的身份认证流程。';

  @override
  String get panel_none_available => '查看公司上下文、切换公司、切换语言、修改密码，以及在有记录时查看借款历史。';

  @override
  String get panel_none_not_available =>
      '在当前 App 版本中发起 KYC 或提交借款申请，请先前往网页或小程序端完成身份认证。';

  @override
  String get panel_draft_status => 'KYC 草稿已保存';

  @override
  String get panel_draft_meaning => '您有一份尚未提交审核的身份资料草稿。';

  @override
  String get panel_draft_available => '查看当前状态，以及访问其他只读功能。';

  @override
  String get panel_draft_not_available =>
      '编辑或提交 KYC，也不能发起新的借款申请；如需继续，请在网页或小程序端打开 KYC 草稿。';

  @override
  String get panel_submitted_status => '身份资料审核中';

  @override
  String get panel_submitted_meaning => '您的身份资料已提交，审核人员正在处理，请耐心等待结果。';

  @override
  String get panel_submitted_available => '随时回到这里查看最新审核结果，以及浏览已有借款记录。';

  @override
  String get panel_submitted_not_available => '编辑 KYC、上传更多资料或发起新的借款申请。';

  @override
  String get panel_needs_info_status => '需要补充身份资料';

  @override
  String get panel_needs_info_meaning => '审核人员需要您补充资料，才能继续完成 KYC 审批。';

  @override
  String get panel_needs_info_available => '查看当前状态以及已有的借款记录详情。';

  @override
  String get panel_needs_info_not_available =>
      '当前 App 版本不支持提交补件、编辑 KYC 或发起新的借款申请；如需补充，请使用网页或小程序端。';

  @override
  String get panel_rejected_status => '身份资料未通过（终态）';

  @override
  String get panel_rejected_meaning => '身份认证未通过，当前版本为终态结果，不可再编辑。';

  @override
  String get panel_rejected_available => '在这里查看未通过状态的总体说明。';

  @override
  String get panel_rejected_not_available => '重新提交 KYC、修改身份资料或在当前版本发起借款申请。';

  @override
  String get panel_approved_noloan_status => '身份认证已通过 · 具备借款资格';

  @override
  String get panel_approved_noloan_meaning => '您已通过身份认证，待借款功能上线后即可发起借款申请。';

  @override
  String get panel_approved_noloan_available => '查看借款历史、修改密码、切换显示语言以及管理公司上下文。';

  @override
  String get panel_approved_noloan_not_available => '发起新的借款申请，借款申请入口将在后续版本开放。';

  @override
  String get panel_unknown_status => '状态暂不可识别';

  @override
  String get panel_unknown_meaning => '服务端返回了当前客户端版本未识别的状态，系统未做任何自动推断。';

  @override
  String get panel_unknown_available => '下拉刷新或点击重试，以加载最新状态。';

  @override
  String get panel_unknown_not_available =>
      '任何与特定状态绑定的动作；在未知状态下不提供 KYC 或借款类变更。';

  @override
  String get home_offline_no_snapshot_title => '暂时无法加载';

  @override
  String get home_offline_no_snapshot_summary => '无法连接到服务，且本地暂无缓存数据，请检查网络后重试。';

  @override
  String get home_offline_no_snapshot_primary => '重试';

  @override
  String get home_h1_title => '尚未开始身份认证';

  @override
  String get home_h1_summary => '完成身份认证后方可办理借款。';

  @override
  String get home_h1_primary => '开始身份认证';

  @override
  String get home_h1_secondary => '查看当前状态';

  @override
  String get home_h2_title => '身份资料草稿未提交';

  @override
  String get home_h2_summary => '您保存的身份资料尚未提交审核。';

  @override
  String get home_h2_primary => '继续完善资料';

  @override
  String get home_h2_secondary => '查看当前状态';

  @override
  String get home_h3_title => '身份资料审核中';

  @override
  String get home_h3_summary => '审核结果将在此页面更新。';

  @override
  String get home_h3_primary => '查看当前状态';

  @override
  String get home_h4_title => '需要补充身份资料';

  @override
  String get home_h4_summary => '审核人员需要您补充资料后才能继续审批。';

  @override
  String get home_h4_primary => '补充资料';

  @override
  String get home_h4_secondary => '查看当前状态';

  @override
  String get home_h5_title => '身份资料未通过';

  @override
  String get home_h5_summary => '该结果为终态，当前版本无法在 App 内重新提交。';

  @override
  String get home_h5_primary => '查看当前状态';

  @override
  String get home_h6_title => '身份认证已通过';

  @override
  String get home_h6_summary => '已具备借款资格，借款申请入口将在后续版本开放。';

  @override
  String get home_h6_primary => '申请借款';

  @override
  String get home_h6_secondary => '查看借款记录';

  @override
  String get home_h7_title => '上一笔借款已结清';

  @override
  String get home_h7_summary => '当前没有未结清的借款。';

  @override
  String get home_h7_primary => '查看借款记录';

  @override
  String get home_h8_title => '上一笔申请未通过';

  @override
  String get home_h8_summary => '可查看被拒申请的具体详情。';

  @override
  String get home_h8_primary => '查看借款详情';

  @override
  String get home_h9_title => '借款申请已创建';

  @override
  String get home_h9_summary => '费用账单待确认。';

  @override
  String get home_h9_primary => '查看借款详情';

  @override
  String get home_h10_title => '借款待签署';

  @override
  String get home_h10_summary => '相关协议已准备好。';

  @override
  String get home_h10_primary => '查看借款详情';

  @override
  String get home_h11_title => '协议已签署';

  @override
  String get home_h11_summary => '等待提交最终审批。';

  @override
  String get home_h11_primary => '查看借款详情';

  @override
  String get home_h12_title => '等待机构审批';

  @override
  String get home_h12_summary => '合作方正在审核已签署的申请。';

  @override
  String get home_h12_primary => '查看借款详情';

  @override
  String get home_h13_title => '已通过，等待放款';

  @override
  String get home_h13_summary => '借款审批已通过，正在处理放款。';

  @override
  String get home_h13_primary => '查看借款详情';

  @override
  String get home_h14_title => '还款中';

  @override
  String home_h14_summary(String remaining, String dueDate) {
    return '剩余应还 $remaining · 到期日 $dueDate';
  }

  @override
  String get home_h14_primary => '查看借款详情';

  @override
  String get home_h15_title => '借款处理中（旧流程）';

  @override
  String get home_h15_summary => '这是一笔较早流程的借款，仍在处理中。';

  @override
  String get home_h15_primary => '查看借款详情';

  @override
  String get home_h16_title => '借款状态更新中';

  @override
  String get home_h16_summary => '当前版本暂未识别该状态，以服务端后续更新为准。';

  @override
  String get home_h16_primary => '查看借款详情';

  @override
  String get home_h17_title => '借款处理中 · 身份资料需关注';

  @override
  String get home_h17_summary => '借款正在处理；同时，您的身份资料仍需关注。';

  @override
  String get home_h17_primary => '查看借款详情';

  @override
  String get home_h18_title => '身份状态更新中';

  @override
  String get home_h18_summary => '当前 KYC 状态未被识别，系统未做任何自动动作。';

  @override
  String get home_h18_primary => '查看当前状态';

  @override
  String get home_h19_primary => '加载中…';

  @override
  String get home_h19_title => '正在加载状态';

  @override
  String get home_h19_summary => '请稍候，正在加载最新数据。';

  @override
  String get home_h20_primary => '重试刷新';

  @override
  String get home_h20_title => '刷新失败';

  @override
  String get home_h20_summary => '保留上次已加载的数据，可重试获取最新更新。';

  @override
  String get home_h21_primary => '重试连接';

  @override
  String get home_h21_title => '离线';

  @override
  String get home_h21_summary => '保留上次已加载的数据，重新联网后可重试。';

  @override
  String get home_h21p_title => '无法加载';

  @override
  String get home_h21p_summary => '暂无缓存数据，且服务暂不可达。';

  @override
  String get home_h21p_primary => '重试';

  @override
  String get home_h22_title => '登录已过期';

  @override
  String get home_h22_summary => '请重新登录以继续。';

  @override
  String get home_h22_primary => '重新登录';

  @override
  String get home_future_cta_hint_generic => '该功能在当前版本暂不可用。';

  @override
  String get home_future_cta_hint_kyc_edit => '当前版本暂不支持 KYC 编辑，请使用网页或小程序端。';

  @override
  String get home_future_cta_hint_apply => '借款申请入口将在后续版本开放。';

  @override
  String get home_currency_usd => '美元';

  @override
  String get home_amount_missing => '—';

  @override
  String get shellTabHome => '首页';

  @override
  String get shellTabLoans => '借款';

  @override
  String get shellTabMe => '我的';

  @override
  String get shellSemanticHome => '首页标签';

  @override
  String get shellSemanticLoans => '借款标签';

  @override
  String get shellSemanticMe => '我的标签';

  @override
  String get loansTitle => '借款';

  @override
  String get loansEmptyTitle => '暂无借款记录';

  @override
  String get loansEmptyBody => '后续可在此查看您的借款记录。';

  @override
  String get loansRefreshFailed => '刷新失败，正在展示上一次成功加载的记录。';

  @override
  String get loansOfflineWarm => '当前离线，正在展示最新可用的本地记录。';

  @override
  String get loansSessionInvalid => '登录已过期，请重新登录查看借款。';

  @override
  String get loansUnknownStatus => '当前 APP 版本暂未识别此状态。';

  @override
  String get loanShortIdLabel => '借款编号';

  @override
  String get loanCreatedLabel => '创建时间';

  @override
  String get loanTermLabel => '期限';

  @override
  String get loanPrincipalLabel => '本金';

  @override
  String get loanStatusLabel => '状态';

  @override
  String get loanStatusKycApproved => 'KYC 已通过';

  @override
  String get loanStatusDecisionPending => '合作方审核中';

  @override
  String get loanStatusSigned => '已签约';

  @override
  String get loanStatusActive => '还款中';

  @override
  String get loanStatusRegistered => '已登记';

  @override
  String get loanStatusKycPending => 'KYC 待处理';

  @override
  String get loanStatusNeedsInfo => '需补充信息';

  @override
  String get loanStatusLegacyApproved => '已通过 (旧流程)';

  @override
  String get loanStatusUnknown => '状态未识别';

  @override
  String get loanStatusClosed => '已结清';

  @override
  String get loanStatusRejected => '未通过';

  @override
  String get loanDetailTitle => '借款详情';

  @override
  String get loanDetailNotFoundTitle => '借款不可用';

  @override
  String get loanDetailNotFoundBody => '当前账户暂不存在该笔借款记录。';

  @override
  String get loanFieldStatus => '状态';

  @override
  String get loanFieldPrincipal => '本金金额';

  @override
  String get loanFieldTerm => '期限';

  @override
  String get loanFieldActualReceived => '实际到账';

  @override
  String get loanFieldTotalRepayment => '应还合计';

  @override
  String get loanFieldPaid => '已还';

  @override
  String get loanFieldRemaining => '剩余待还';

  @override
  String get loanFieldDueDate => '到期日';

  @override
  String get loanSectionBillingTitle => '账单概要';

  @override
  String get loanSectionEventsTitle => '最近动态';

  @override
  String get loanEventCreated => '创建借款';

  @override
  String get loanEventSubmitted => '已提交申请';

  @override
  String get loanEventSigned => '签署协议';

  @override
  String get loanEventFunded => '已放款';

  @override
  String get loanEventRepayment => '登记还款';

  @override
  String get loanEventClosed => '借款结清';

  @override
  String get loanEventRejected => '申请未通过';

  @override
  String get loanEventUnknown => '活动已更新';

  @override
  String get meTitle => '账户';

  @override
  String get meAccountSummaryTitle => '当前会话';

  @override
  String get meCompanyLabel => '所属公司';

  @override
  String get meLanguageLabel => '显示语言';

  @override
  String get meAccountMaskedLabel => '账号';

  @override
  String get meSectionActionsTitle => '常用操作';

  @override
  String get meActionLanguageTitle => '语言';

  @override
  String get meActionLanguageSubtitle => '切换显示语言';

  @override
  String get meActionPasswordTitle => '修改密码';

  @override
  String get meActionPasswordSubtitle => '更新登录密码';

  @override
  String get meActionCompanyTitle => '切换公司';

  @override
  String get meActionCompanySubtitle => '切换或新增机构';

  @override
  String get meActionLogoutTitle => '退出登录';

  @override
  String get meActionLogoutSubtitle => '结束本机当前会话';

  @override
  String get passwordTitle => '修改密码';

  @override
  String get passwordCurrentLabel => '当前密码';

  @override
  String get passwordNewLabel => '新密码';

  @override
  String get passwordConfirmLabel => '确认新密码';

  @override
  String get passwordToggleShow => '显示密码';

  @override
  String get passwordToggleHide => '隐藏密码';

  @override
  String get passwordSubmit => '更新密码';

  @override
  String get passwordLoading => '正在更新…';

  @override
  String get passwordSuccess => '密码已成功更新。';

  @override
  String get passwordMismatch => '两次输入的新密码不一致。';

  @override
  String passwordTooShort(int min) {
    return '密码至少需要 $min 位。';
  }

  @override
  String passwordTooLong(int max) {
    return '密码不能超过 $max 位。';
  }

  @override
  String get passwordSameAsCurrent => '新密码与当前密码不能相同。';

  @override
  String get passwordSetTitle => '设置密码';

  @override
  String get passwordSetSubmit => '保存密码';

  @override
  String get logoutConfirmTitle => '确认退出登录?';

  @override
  String get logoutConfirmBody => '退出登录将结束当前机构的会话。';

  @override
  String get logoutConfirmConfirm => '退出登录';

  @override
  String get logoutFailed => '暂时无法退出，请稍后重试。';

  @override
  String get companySwitchTitle => '切换公司';

  @override
  String get companySwitchCurrentLabel => '当前公司';

  @override
  String get companySwitchKnownSection => '最近使用的公司';

  @override
  String get companySwitchAddButton => '新增或选择其他公司';

  @override
  String get companySwitchSwitching => '正在准备新公司…';

  @override
  String get tabBackHome => '首页';

  @override
  String get tabBackLoans => '借款';

  @override
  String get tabBackMe => '账户';

  @override
  String get companyRecoveryTitle => '无法识别服务机构';

  @override
  String get companyRecoverySwitchTitle => '更换服务机构';

  @override
  String get companyRecoveryBody => '暂时无法识别您的服务机构，请使用以下方式连接。';

  @override
  String get companyRecoveryPersistedUnavailable =>
      '您上次使用的服务机构当前不可用。请使用邀请链接重新连接，或联系客服。';

  @override
  String get companyRecoveryLinkInvalid => '此邀请链接无法验证，或该机构暂不可用。';

  @override
  String get companyRecoveryDefaultUnavailable => '服务暂不可用。请稍后重试，或使用您的邀请链接连接。';

  @override
  String get companyRecoveryPasteCta => '粘贴邀请链接';

  @override
  String get companyRecoveryScanCta => '扫描机构二维码';

  @override
  String get companyRecoveryRecentSection => '最近使用的服务机构';

  @override
  String get companyRecoveryHint => '使用机构提供的邀请链接或机构二维码连接。';

  @override
  String get authLoginChangeInstitution => '更换服务机构';

  @override
  String get authLoginInstitutionLabel => '服务机构';

  @override
  String get authLoginChooseMethod => '请选择一种安全方式登录您的账户。';

  @override
  String get companyRecoveryGoLogin => '返回登录';

  @override
  String get startupFailureTitle => '暂时无法启动';

  @override
  String get startupFailureBody => '当前无法连接到服务。请检查网络后重试。';

  @override
  String get languagePageTitle => '语言';

  @override
  String get authSignInTitle => '登录';

  @override
  String get authContinuePhone => '使用手机号继续';

  @override
  String get authUsePassword => '使用密码登录';

  @override
  String get authForgotPassword => '忘记密码？';

  @override
  String get authPhoneInvalidE164 => '请输入有效的电话号码，例如 +85512345678 或 012345678。';

  @override
  String get authPhoneVerificationTitle => '手机号验证';

  @override
  String get authPhoneLabel => '手机号';

  @override
  String get authConsentPhoneCode => '我同意通过手机号接收验证码。';

  @override
  String get authSendCode => '发送验证码';

  @override
  String get authPhoneMissing => '手机号缺失或无效，请重新输入。';

  @override
  String get authCodeExpiredResend => '验证码已过期，请重新发送。';

  @override
  String get authEnterCodeTitle => '输入手机号验证码';

  @override
  String authCodeSentTo(String phone) {
    return '验证码已发送至 $phone';
  }

  @override
  String get authYourPhone => '你的手机';

  @override
  String get authCodeLabel => '6 位验证码';

  @override
  String authResendIn(String time) {
    return '$time 后可重新发送';
  }

  @override
  String get authCodeExpiredTapResend => '验证码已过期，请点击“重新发送”。';

  @override
  String get authTapResendHint => '倒计时结束后请点击“重新发送”。';

  @override
  String get authVerify => '验证';

  @override
  String get authResendCode => '重新发送';

  @override
  String get authPasswordSignInTitle => '密码登录';

  @override
  String get authPasswordLabel => '密码';

  @override
  String get authRecoverTitle => '找回密码';

  @override
  String get authConsentResetCode => '我同意通过手机号接收重置验证码。';

  @override
  String authRateLimited(int seconds) {
    return '请求过于频繁，请 $seconds 秒后重试。';
  }

  @override
  String get authSendResetCode => '发送重置验证码';

  @override
  String get authPasswordMin12 => '密码至少需要 12 个字符。';

  @override
  String get authPasswordsMismatch => '两次输入的密码不一致。';

  @override
  String get authResetTitle => '重置密码';

  @override
  String authEnterResetCode(String phone) {
    return '请输入发送至 $phone 的重置验证码。';
  }

  @override
  String get authResetCodeLabel => '重置验证码';

  @override
  String get authNewPasswordLabel => '新密码（12–128 个字符）';

  @override
  String get authConfirmPasswordLabel => '确认新密码';

  @override
  String get authResetPassword => '重置密码';

  @override
  String get errNetwork => '网络错误，请检查网络连接。';

  @override
  String get errOffline => '当前离线，请联网后重试。';

  @override
  String get errServiceUnavailable => '服务暂不可用，请稍后重试。';

  @override
  String get errSessionExpired => '登录已过期，请重新登录。';

  @override
  String get errInvalidCredentials => '手机号或密码不正确。';

  @override
  String get errLoginPageExpired => '登录页面已过期，请重新开始。';

  @override
  String get errSignInFailed => '登录失败，请重试。';

  @override
  String get errFinishPassword => '请先完成密码设置。';

  @override
  String get errSecurity => '安全校验未通过。';

  @override
  String get errForbidden => '暂不支持此操作。';

  @override
  String get errStatusChanged => '状态已变化，请刷新后重试。';

  @override
  String get errPhoneInUse => '该手机号已被其他账号使用。';

  @override
  String get errConflict => '操作冲突，请重试。';

  @override
  String get errCodeIncorrect => '验证码不正确。';

  @override
  String get errCodeExpired => '验证码已过期。';

  @override
  String get errTooManyAttempts => '尝试次数过多，请重新获取验证码。';

  @override
  String get errPasswordLength => '密码长度须为 12–128 个字符。';

  @override
  String get errRequestTooLarge => '请求内容过大，请减少输入。';

  @override
  String get errInvalidInput => '输入无效。';

  @override
  String errTooManyRequests(int seconds) {
    return '请求过于频繁，请 $seconds 秒后重试。';
  }

  @override
  String get errGeneric => '出了点问题，请重试。';

  @override
  String get logoutLocalOnly => '已在本设备退出登录，服务器会话将自动过期。';

  @override
  String authAttemptsRemaining(int count) {
    return '还可尝试 $count 次，之后需重新获取验证码。';
  }

  @override
  String get kycSection_identity => '个人与身份资料';

  @override
  String get kycSection_contacts => '紧急联系人';

  @override
  String get kycSection_employment => '工作与资产';

  @override
  String get kycSection_bank => '收款账户资料';

  @override
  String get kycSection_consent => '资料授权确认';

  @override
  String get kycField_surname => '姓';

  @override
  String get kycField_givenName => '名';

  @override
  String get kycField_gender => '性别';

  @override
  String get kycField_education => '学历';

  @override
  String get kycField_marital => '婚姻状态';

  @override
  String get kycField_province => '省 / 直辖市';

  @override
  String get kycField_district => '区 / 县 / 市';

  @override
  String get kycField_address => '详细住址';

  @override
  String get kycField_workType => '工作类型';

  @override
  String get kycField_company => '公司 / 商店名称';

  @override
  String get kycField_industry => '行业';

  @override
  String get kycField_position => '职位';

  @override
  String get kycField_income => '月收入区间';

  @override
  String get kycField_tenure => '工作年限';

  @override
  String get kycField_supervisorName => '部门上司姓名（选填）';

  @override
  String get kycField_supervisorPhone => '部门上司电话，含国家区号（选填）';

  @override
  String get kycField_vehicle => '车辆类型（选填）';

  @override
  String get kycField_housing => '住房类型（选填）';

  @override
  String get kycField_bankName => '选择银行';

  @override
  String get kycField_bankAccount => '银行账号';

  @override
  String get kycField_bankHolder => '账户姓名';

  @override
  String kycContactRelation(int n) {
    return '联系人 $n 关系';
  }

  @override
  String kycContactName(int n) {
    return '联系人 $n 姓名';
  }

  @override
  String kycContactPhone(int n) {
    return '联系人 $n 电话（含国家区号）';
  }

  @override
  String get kycContactOptional => '联系人 3 为选填：三项全填或全部留空。';

  @override
  String get kycSlot_idFront => '身份证正面';

  @override
  String get kycSlot_idBack => '身份证反面';

  @override
  String get kycSlot_selfie => '个人自拍照';

  @override
  String get kycSlot_incomeProof => '收入 / 工作证明';

  @override
  String get kycSlot_vehicleInvoice => '购车发票';

  @override
  String get kycSlot_vehicleContract => '购车合同';

  @override
  String get kycSlot_vehiclePhoto => '车辆照片';

  @override
  String get kycSlot_rentContract => '租房合同';

  @override
  String get kycSlot_propertyCertificate => '房屋产权证';

  @override
  String get kycVehicleMaterialHint => '车辆材料请上传一份：发票、合同或照片。';

  @override
  String get kycTitle => '实名资料';

  @override
  String get kycScopeNote => '资料由人工审核，不代表外部身份、银行账户或活体核验。';

  @override
  String get kycStatusDraft => '草稿 — 尚未提交';

  @override
  String get kycStatusSubmitted => '已提交 — 等待审核';

  @override
  String get kycStatusNeedsInfo => '需要补充资料';

  @override
  String get kycStatusApproved => '审核通过';

  @override
  String get kycStatusRejected => '审核未通过';

  @override
  String get kycStatusUnknown => '状态暂不可用';

  @override
  String get kycStatusSubmittedBody => '审核期间无法修改。';

  @override
  String get kycStatusApprovedBody => '你的资料已通过人工审核。';

  @override
  String get kycStatusRejectedBody => '你的资料未通过审核。';

  @override
  String get kycStatusNeedsInfoBody => '请查看下方审核意见，修改资料后重新提交。';

  @override
  String get kycReviewerNote => '审核意见';

  @override
  String get kycSectionDone => '已完成';

  @override
  String get kycSectionTodo => '待完善';

  @override
  String get kycSubmit => '提交审核';

  @override
  String get kycSaveDraft => '保存';

  @override
  String get kycSavedDraft => '已保存';

  @override
  String get kycSubmittedOk => '已提交，我们会尽快审核。';

  @override
  String get kycReload => '重新加载';

  @override
  String get kycTakePhoto => '拍照';

  @override
  String get kycChooseGallery => '从相册选择';

  @override
  String get kycReplace => '更换';

  @override
  String get kycUploaded => '已上传';

  @override
  String get kycUploading => '上传中…';

  @override
  String get kycRequired => '必填';

  @override
  String get kycOptional => '选填';

  @override
  String get kycSelectPlaceholder => '请选择';

  @override
  String get kycConsentTitle => '资料授权';

  @override
  String get kycConsentBody =>
      '我确认所提供的资料和证件真实且属于本人，授权 KhmerX 及其出借合作方为评估我的贷款申请而进行人工审核，并为此安全保存。';

  @override
  String get kycConsentNotice => '授权文案为占位文本，正式法务文本将在上线前替换。';

  @override
  String get kycConsentCheckbox => '我已阅读并同意';

  @override
  String get kycLockedNote => '资料已锁定，无法修改。';

  @override
  String get kycRuleMismatch => '请更新应用后再继续实名。';

  @override
  String get kycPickFailed => '无法读取照片，请重试。';

  @override
  String kycProblemMissingField(String item) {
    return '请填写：$item';
  }

  @override
  String kycProblemMissingSlot(String item) {
    return '请上传：$item';
  }

  @override
  String kycProblemInvalidPhone(String item) {
    return '电话格式不正确：$item。请使用国际格式，例如 +85512345678。';
  }

  @override
  String get kycProblemVehicle => '车辆材料只需上传一份。';

  @override
  String get kycProblemContact3 => '联系人 3：三项全填或全部留空。';

  @override
  String get kycProblemSupervisor => '上司姓名与电话需一并填写。';

  @override
  String get kycProblemDupRelation => '紧急联系人关系不能重复。';

  @override
  String get kycProblemDupPhone => '紧急联系人电话不能重复。';

  @override
  String get kycProblemConsent => '请阅读并同意授权。';

  @override
  String get kycErrConflict => '资料已变化或已锁定，已重新加载。';

  @override
  String get kycErrFileTooLarge => '图片不得超过 5 MB，PDF 文件不得超过 10 MB。';

  @override
  String get kycErrFileRejected => '文件未被接受，请更换照片。';

  @override
  String get kycErrInvalid => '部分资料无效，请检查后重试。';

  @override
  String get kycErrUnavailable => '服务暂不可用，资料未保存，请重试。';

  @override
  String get kycOpt_Male => '男';

  @override
  String get kycOpt_Female => '女';

  @override
  String get kycOpt_Married => '已婚';

  @override
  String get kycOpt_Single => '未婚';

  @override
  String get kycOpt_Parent => '父母';

  @override
  String get kycOpt_Spouse => '配偶';

  @override
  String get kycOpt_Relative => '亲属';

  @override
  String get kycOpt_Friend => '朋友';

  @override
  String get kycOpt_VillageChief => '村长';

  @override
  String get kycOpt_CompanySupervisor => '公司主管';

  @override
  String get kycOpt_Motorbike => '摩托车';

  @override
  String get kycOpt_TukTuk => '嘟嘟车';

  @override
  String get kycOpt_Car => '汽车';

  @override
  String get kycOpt_None => '无';

  @override
  String get kycOpt_Rented => '租房';

  @override
  String get kycOpt_OwnedProperty => '个人房产';

  @override
  String get kycSwitchKeyboard => '切换键盘';

  @override
  String get kycErrPhoneFormat => '请输入有效的电话号码，例如 +85512345678 或 012345678。';

  @override
  String get kycErrFieldIssue => '已保存。部分内容暂未保存（格式不正确或重复），请修改标红的输入项。';

  @override
  String get startupTagline => '简单透明的小额借款';

  @override
  String get kycNext => '下一步';

  @override
  String get kycBack => '上一步';

  @override
  String get kycFieldRequired => '此项必填';

  @override
  String kycStepProgress(String current, String total) {
    return '第 $current/$total 步';
  }

  @override
  String kycOverallProgress(String done, String total) {
    return '已完成 $done/$total 项';
  }

  @override
  String get authBrandEyebrow => '为柬埔寨而生';

  @override
  String get authBrandSlogan => '简单的金融，服务日常生活。';

  @override
  String get authTrustClear => '条款清晰';

  @override
  String get authTrustSecure => '数据安全';

  @override
  String get authTrustProgress => '进度可见';

  @override
  String get kycUseLocation => '使用我当前的位置';

  @override
  String get kycLocating => '定位中...';

  @override
  String get kycLocHint => '根据当前位置填写地址，请核对并修改。';

  @override
  String get kycLocDenied => '定位权限已关闭。请在系统设置中允许，或手动填写地址。';

  @override
  String get kycLocServiceOff => '定位服务未开启。请开启，或手动填写地址。';

  @override
  String get kycLocFailed => '无法获取地址，请手动填写。';

  @override
  String get kycLocStagePosition => '正在获取你的位置...';

  @override
  String get kycLocStageAddress => '正在查找对应的地址...';

  @override
  String get kycLocWait => '请稍候，最多可能需要 30 秒。';

  @override
  String get errInternalError => '服务处理失败，请稍后重试。';

  @override
  String get errValidationFailed => '请检查填写的信息后重试。';

  @override
  String get errAccountRegistered => '该账号已注册，请直接登录。';

  @override
  String get errPayloadTooLarge => '文件超出上传大小限制。';

  @override
  String errWithRequestId(String message, String requestId) {
    return '$message 参考编号：$requestId';
  }

  @override
  String get kycUploadRetrying => '正在重试上传…';

  @override
  String get kycUploadCancel => '取消上传';

  @override
  String get kycNeedsSupplement => '需补充';

  @override
  String get kycReasonBlurred => '照片模糊';

  @override
  String get kycReasonIncomplete => '证件不完整';

  @override
  String get kycReasonSelfie => '自拍与证件不符';

  @override
  String get kycReasonData => '信息与证件不一致';

  @override
  String get kycReasonContact => '联系人无法接通';

  @override
  String get kycReasonIncome => '收入证明不清';

  @override
  String get kycReasonOther => '其他';
}
