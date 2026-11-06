import type {Locale} from './i18n';

type TicketLabelKind='kind'|'status'|'priority';

const labels:Record<Locale,Record<TicketLabelKind,Record<string,string>>>={
 zh:{kind:{ticket:'客服工单',complaint:'投诉',dispute:'争议'},status:{open:'处理中',in_progress:'跟进中',resolved:'已解决',closed:'已关闭'},priority:{low:'低',normal:'普通',high:'高'}},
 en:{kind:{ticket:'Support ticket',complaint:'Complaint',dispute:'Dispute'},status:{open:'Open',in_progress:'In progress',resolved:'Resolved',closed:'Closed'},priority:{low:'Low',normal:'Normal',high:'High'}},
 km:{kind:{ticket:'សំបុត្រគាំទ្រ',complaint:'បណ្តឹង',dispute:'វិវាទ'},status:{open:'កំពុងដំណើរការ',in_progress:'កំពុងតាមដាន',resolved:'បានដោះស្រាយ',closed:'បានបិទ'},priority:{low:'ទាប',normal:'ធម្មតា',high:'ខ្ពស់'}},
};

export function ticketLabel(kind:TicketLabelKind,value:unknown,locale:Locale='zh'){
 const key=String(value??'');
 return labels[locale][kind][key]||key;
}
