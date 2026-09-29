document.documentElement.classList.add('js');

// The public website defaults to Khmer for Khmer-speaking browsers and English
// for all other system languages. A visitor can override the choice and the
// preference is kept locally for the next visit.
const siteTranslations = {
  'Platform': 'វេទិកា',
  'PayEase': 'PayEase',
  'News': 'ព័ត៌មាន',
  'News & Updates': 'ព័ត៌មាន និងការធ្វើបច្ចុប្បន្នភាព',
  'For partners': 'សម្រាប់ដៃគូ',
  'About us': 'អំពី KhmerX',
  'Support': 'ជំនួយ',
  'Open PayEase': 'បើក PayEase',
  'Open the Mini App': 'បើក Mini App',
  'Contact us': 'ទាក់ទងយើង',
  'Start a conversation': 'ចាប់ផ្តើមការសន្ទនា',
  'Help centre →': 'មជ្ឈមណ្ឌលជំនួយ →',
  'Customer support': 'ជំនួយអតិថិជន',
  'Made for Cambodia': 'បង្កើតឡើងសម្រាប់កម្ពុជា',
  'Simple finance for everyday life.': 'ហិរញ្ញវត្ថុសាមញ្ញ សម្រាប់ជីវិតប្រចាំថ្ងៃ។',
  'KhmerX is a Cambodia-native Lending OS: configurable products, governed decisions and clear digital services for everyday people and licensed partners.': 'KhmerX គឺជាប្រព័ន្ធហិរញ្ញប្បទានឌីជីថលសម្រាប់កម្ពុជា ដែលមានផលិតផលអាចកំណត់បាន ការសម្រេចចិត្តមានអភិបាលកិច្ច និងសេវាឌីជីថលច្បាស់លាស់។',
  'Clear terms': 'លក្ខខណ្ឌច្បាស់លាស់',
  'Secure data': 'ទិន្នន័យមានសុវត្ថិភាព',
  'Visible progress': 'ដំណើរការអាចមើលឃើញ',
  'One platform, three paths': 'វេទិកាមួយ សម្រាប់បីផ្លូវ',
  'For individuals': 'សម្រាប់បុគ្គល',
  'For businesses': 'សម្រាប់អាជីវកម្ម',
  'For financial partners': 'សម្រាប់ដៃគូហិរញ្ញវត្ថុ',
  'Apply, complete KYC and track your loan in one place.': 'ដាក់ពាក្យ បំពេញ KYC និងតាមដានកម្ចីរបស់អ្នកនៅកន្លែងតែមួយ។',
  'Support trusted verification with clear access controls.': 'គាំទ្រការផ្ទៀងផ្ទាត់ដែលអាចទុកចិត្តបាន ជាមួយការគ្រប់គ្រងសិទ្ធិច្បាស់លាស់។',
  'Review and serve customers through governed workflows.': 'ពិនិត្យ និងបម្រើអតិថិជនតាមលំហូរការងារដែលមានអភិបាលកិច្ច។',
  'Discover PayEase': 'ស្វែងយល់អំពី PayEase',
  'Partner with us': 'សហការជាមួយយើង',
  'Work with KhmerX': 'សហការជាមួយ KhmerX',
  'PayEase · by KhmerX': 'PayEase · ដោយ KhmerX',
  'Apply clearly.': 'ដាក់ពាក្យយ៉ាងច្បាស់លាស់។',
  'Know your next step.': 'ដឹងពីជំហានបន្ទាប់របស់អ្នក។',
  'PayEase shows your fees, net amount and repayment before you sign.': 'PayEase បង្ហាញថ្លៃសេវា ចំនួនទឹកប្រាក់ទទួលបាន និងការសងប្រាក់ មុនពេលអ្នកចុះហត្ថលេខា។',
  'Register': 'ចុះឈ្មោះ',
  'Start in Telegram.': 'ចាប់ផ្តើមក្នុង Telegram។',
  'Complete KYC': 'បំពេញ KYC',
  'Submit the required details.': 'បញ្ជូនព័ត៌មានដែលត្រូវការ។',
  'Review & quote': 'ពិនិត្យ និងសម្រង់តម្លៃ',
  'See the full cost.': 'មើលចំណាយពេញលេញ។',
  'Sign & follow': 'ចុះហត្ថលេខា និងតាមដាន',
  'Track every update.': 'តាមដានរាល់ការធ្វើបច្ចុប្បន្នភាព។',
  'Built for trust': 'បង្កើតឡើងលើទំនុកចិត្ត',
  'Local in feel.': 'មានអារម្មណ៍ជាមូលដ្ឋាន។',
  'Strong in structure.': 'រឹងមាំក្នុងរចនាសម្ព័ន្ធ។',
  'Configurable by design': 'អាចកំណត់បានតាមការរចនា',
  'Products, rules and workflows can evolve without rebuilding the core.': 'ផលិតផល ច្បាប់ និងលំហូរការងារ អាចអភិវឌ្ឍបានដោយមិនចាំបាច់សាងសង់ស្នូលឡើងវិញ។',
  'Independent decisions': 'ការសម្រេចចិត្តឯករាជ្យ',
  'Licensed partners make the final credit decision.': 'ដៃគូមានអាជ្ញាបណ្ណជាអ្នកសម្រេចចិត្តឥណទានចុងក្រោយ។',
  'Accountable throughout': 'មានការទទួលខុសត្រូវគ្រប់ជំហាន',
  'From KYC to repayment, every key action stays traceable.': 'ចាប់ពី KYC ដល់ការសងប្រាក់ រាល់សកម្មភាពសំខាន់អាចតាមដានបាន។',
  'Digital finance for Cambodia.': 'ហិរញ្ញវត្ថុឌីជីថលសម្រាប់កម្ពុជា។',
  'Simple services, trusted partners and clearer next steps.': 'សេវាសាមញ្ញ ដៃគូដែលអាចទុកចិត្តបាន និងជំហានបន្ទាប់កាន់តែច្បាស់។',
  'News and useful updates.': 'ព័ត៌មាន និងការធ្វើបច្ចុប្បន្នភាពមានប្រយោជន៍។',
  'View all': 'មើលទាំងអស់',
  'Read article': 'អានអត្ថបទ',
  'Quick answers': 'ចម្លើយរហ័ស',
  'KhmerX in three answers.': 'KhmerX ក្នុងចម្លើយបី។',
  'What is KhmerX?': 'តើ KhmerX ជាអ្វី?',
  'What is PayEase?': 'តើ PayEase ជាអ្វី?',
  'Who approves a loan?': 'តើអ្នកណាអនុម័តកម្ចី?',
  'The licensed financial partner makes the final credit decision.': 'ដៃគូហិរញ្ញវត្ថុដែលមានអាជ្ញាបណ្ណជាអ្នកសម្រេចចិត្តឥណទានចុងក្រោយ។',
  'Help centre': 'មជ្ឈមណ្ឌលជំនួយ',
  'Quick answers,': 'ចម្លើយរហ័ស',
  'clear next steps.': 'ជំហានបន្ទាប់ច្បាស់លាស់។',
  'Account & login': 'គណនី និងការចូលប្រើ',
  'KYC': 'KYC',
  'Safety': 'សុវត្ថិភាព',
  'Common questions': 'សំណួរទូទៅ',
  'How do I start?': 'តើខ្ញុំចាប់ផ្តើមដោយរបៀបណា?',
  'How does KYC work?': 'តើ KYC ដំណើរការយ៉ាងដូចម្តេច?',
  'What should I never share in chat?': 'តើព័ត៌មានអ្វីខ្លះដែលខ្ញុំមិនគួរចែករំលែកក្នុងការជជែក?',
  'Security & privacy': 'សុវត្ថិភាព និងឯកជនភាព',
  'Security & Privacy': 'សុវត្ថិភាព និងឯកជនភាព',
  'Contact KhmerX': 'ទាក់ទង KhmerX',
  'Use the official channel.': 'ប្រើប្រាស់បណ្តាញផ្លូវការ។',
  'Chat with customer support': 'ជជែកជាមួយជំនួយអតិថិជន',
  'Open Telegram support': 'បើកជំនួយ Telegram',
  'Start a support chat': 'ចាប់ផ្តើមជជែកជាមួយជំនួយ',
  'About KhmerX': 'អំពី KhmerX',
  'Digital finance with a': 'ហិរញ្ញវត្ថុឌីជីថលដែលមាន',
  'local point of view.': 'ទស្សនៈមូលដ្ឋាន។',
  'For enterprises': 'សម្រាប់សហគ្រាស',
  'For financial partners': 'សម្រាប់ដៃគូហិរញ្ញវត្ថុ',
  'Cambodia-native Lending OS': 'ប្រព័ន្ធហិរញ្ញប្បទានសម្រាប់កម្ពុជា',
  'One lending core.': 'ស្នូលកម្ចីមួយ។',
  'Many clearer journeys.': 'ដំណើរការច្បាស់លាស់ជាច្រើន។',
  'Products that fit the market.': 'ផលិតផលសមស្របនឹងទីផ្សារ។',
  'Rules before guesswork.': 'ច្បាប់ជាមុន មិនមែនការស្មាន។',
  'Every loan has a record.': 'កម្ចីគ្រប់ករណីមានកំណត់ត្រា។',
  'Local context. Strong controls.': 'បរិបទមូលដ្ឋាន។ ការគ្រប់គ្រងរឹងមាំ។',
  'A clearer lending lifecycle.': 'វដ្តកម្ចីដែលកាន់តែច្បាស់។',
  'Open to people, not just employers.': 'បើកចំហសម្រាប់មនុស្សគ្រប់រូប មិនមែនតែបុគ្គលិកទេ។',
  'Enterprise checks are optional.': 'ការផ្ទៀងផ្ទាត់សហគ្រាសគឺជាជម្រើស។',
  'Our boundary': 'ព្រំដែនរបស់យើង',
  'Builds the journey.': 'បង្កើតដំណើរការ។',
  'Make the decision.': 'ជាអ្នកសម្រេចចិត្ត។',
  'PayEase is the KhmerX Telegram Mini App for a simple, visible loan journey.': 'PayEase គឺជា Telegram Mini App របស់ KhmerX សម្រាប់ដំណើរការកម្ចីដែលសាមញ្ញ និងអាចមើលឃើញ។',
  'The journey': 'ដំណើរការ',
  'Start securely through Telegram.': 'ចាប់ផ្តើមដោយសុវត្ថិភាពតាម Telegram។',
  'Submit the details and documents the process needs.': 'បញ្ជូនព័ត៌មាន និងឯកសារដែលដំណើរការត្រូវការ។',
  'Review the offer': 'ពិនិត្យសំណើ',
  'See fees, net amount and repayment before signing.': 'មើលថ្លៃសេវា ចំនួនទឹកប្រាក់ទទួលបាន និងការសងប្រាក់ មុនចុះហត្ថលេខា។',
  'Sign and follow': 'ចុះហត្ថលេខា និងតាមដាន',
  'Confirm digitally and track every update.': 'បញ្ជាក់តាមឌីជីថល និងតាមដានរាល់ការធ្វើបច្ចុប្បន្នភាព។',
  'Transparent': 'តម្លាភាព',
  'See the full cost.': 'មើលចំណាយពេញលេញ។',
  'Responsible': 'មានទំនួលខុសត្រូវ',
  'Licensed review.': 'ការពិនិត្យដោយដៃគូមានអាជ្ញាបណ្ណ។',
  'Applicable fees, deductions, amount received and repayment schedule are shown before confirmation.': 'ថ្លៃសេវា ការកាត់ទុក ចំនួនទឹកប្រាក់ទទួលបាន និងកាលវិភាគសងប្រាក់ ត្រូវបានបង្ហាញមុនការបញ្ជាក់។',
  'A licensed financial partner makes the final credit decision and contract offer.': 'ដៃគូហិរញ្ញវត្ថុដែលមានអាជ្ញាបណ្ណជាអ្នកសម្រេចចិត្តឥណទាន និងសំណើកិច្ចសន្យាចុងក្រោយ។',
  'Security & privacy': 'សុវត្ថិភាព និងឯកជនភាព',
  'Trust is built into': 'ទំនុកចិត្តត្រូវបានបង្កើតក្នុង',
  'every step.': 'គ្រប់ជំហាន។',
  'Data minimisation': 'កាត់បន្ថយទិន្នន័យ',
  'Protected access': 'ការចូលប្រើមានការការពារ',
  'Traceable actions': 'សកម្មភាពអាចតាមដានបាន',
  'Clear boundaries': 'ព្រំដែនច្បាស់លាស់',
  'Need help?': 'ត្រូវការជំនួយមែនទេ?',
  'Open Help centre': 'បើកមជ្ឈមណ្ឌលជំនួយ',
  'For partners': 'សម្រាប់ដៃគូ',
  'Build responsible finance': 'បង្កើតហិរញ្ញវត្ថុមានទំនួលខុសត្រូវ',
  'together.': 'រួមគ្នា។',
  'Licensed institutions': 'ស្ថាប័នមានអាជ្ញាបណ្ណ',
  'Payment & technology': 'ការទូទាត់ និងបច្ចេកវិទ្យា',
  'Reach customers clearly.': 'ឈានដល់អតិថិជនយ៉ាងច្បាស់លាស់។',
  'Connect safely.': 'ភ្ជាប់ដោយសុវត្ថិភាព។',
  'How we work': 'របៀបដែលយើងធ្វើការ',
  'Scope': 'កំណត់វិសាលភាព',
  'Connect': 'ភ្ជាប់',
  'Review': 'ពិនិត្យ',
  'Launch': 'ដាក់ឱ្យដំណើរការ',
  'News & Updates': 'ព័ត៌មាន និងការធ្វើបច្ចុប្បន្នភាព',
  'News, product and': 'ព័ត៌មាន ផលិតផល និង',
  'useful information.': 'ព័ត៌មានមានប្រយោជន៍។',
  'Company news': 'ព័ត៌មានក្រុមហ៊ុន',
  'Product': 'ផលិតផល',
  'Safety': 'សុវត្ថិភាព',
  'Building clearer digital finance for Cambodia.': 'បង្កើតហិរញ្ញវត្ថុឌីជីថលដែលច្បាស់លាស់សម្រាប់កម្ពុជា។',
  'PayEase keeps fees and next steps visible.': 'PayEase បង្ហាញថ្លៃសេវា និងជំហានបន្ទាប់យ៉ាងច្បាស់។',
  'Stay safe with official KhmerX channels.': 'រក្សាសុវត្ថិភាពជាមួយបណ្តាញផ្លូវការរបស់ KhmerX។',
  'News, partnerships and KhmerX updates.': 'ព័ត៌មាន ភាពជាដៃគូ និងការធ្វើបច្ចុប្បន្នភាពរបស់ KhmerX។',
  'Product notices and service changes.': 'សេចក្តីជូនដំណឹងផលិតផល និងការផ្លាស់ប្តូរសេវា។',
  'Security reminders and help updates.': 'ការរំលឹកសុវត្ថិភាព និងព័ត៌មានជំនួយ។',
  'Published by KhmerX': 'បោះពុម្ពផ្សាយដោយ KhmerX',
  'Never share passwords, verification codes, full card numbers or identity documents with unofficial accounts.': 'កុំចែករំលែកពាក្យសម្ងាត់ លេខកូដផ្ទៀងផ្ទាត់ លេខកាតពេញលេញ ឬឯកសារអត្តសញ្ញាណជាមួយគណនីមិនផ្លូវការ។',
  'KhmerX collects only what the journey needs, protects it carefully and records important actions for accountability.': 'KhmerX ប្រមូលតែព័ត៌មានដែលដំណើរការត្រូវការ ការពារវាយ៉ាងប្រុងប្រយ័ត្ន និងកត់ត្រាសកម្មភាពសំខាន់ៗសម្រាប់ការទទួលខុសត្រូវ។',
  'Only required identity, contact and application details are requested.': 'ស្នើសុំតែព័ត៌មានអត្តសញ្ញាណ ទំនាក់ទំនង និងពាក្យស្នើសុំដែលចាំបាច់ប៉ុណ្ណោះ។',
  'Role-based permissions, encrypted data and controlled file access.': 'សិទ្ធិតាមតួនាទី ទិន្នន័យបានអ៊ិនគ្រីប និងការចូលប្រើឯកសារដែលបានគ្រប់គ្រង។',
  'Login, review, changes and decisions leave an audit trail.': 'ការចូលប្រើ ការពិនិត្យ ការកែប្រែ និងការសម្រេចចិត្ត សុទ្ធតែមានស្នាមសវនកម្ម។',
  'Licensed partners decide credit; KhmerX does not promise approval.': 'ដៃគូមានអាជ្ញាបណ្ណជាអ្នកសម្រេចឥណទាន ហើយ KhmerX មិនធានាការអនុម័តទេ។',
  'Use official channels.': 'ប្រើប្រាស់បណ្តាញផ្លូវការ។',
  'Submit KYC, sign agreements and manage your wallet only inside the official Mini App at': 'បញ្ជូន KYC ចុះហត្ថលេខាលើកិច្ចព្រមព្រៀង និងគ្រប់គ្រងកាបូបរបស់អ្នកតែនៅក្នុង Mini App ផ្លូវការនៅ',
  'Building clearer digital finance for Cambodia.': 'បង្កើតហិរញ្ញវត្ថុឌីជីថលដែលច្បាស់លាស់សម្រាប់កម្ពុជា។',
  'KhmerX brings people and licensed financial partners together through simple digital journeys.': 'KhmerX ភ្ជាប់បុគ្គល និងដៃគូហិរញ្ញវត្ថុមានអាជ្ញាបណ្ណ តាមរយៈដំណើរការឌីជីថលសាមញ្ញ។',
  'PayEase keeps fees and next steps visible.': 'PayEase បង្ហាញថ្លៃសេវា និងជំហានបន្ទាប់យ៉ាងច្បាស់។',
  'Before signing, users can review the applicable fees, amount received and repayment details.': 'មុនចុះហត្ថលេខា អ្នកប្រើអាចពិនិត្យថ្លៃសេវា ចំនួនទឹកប្រាក់ទទួលបាន និងព័ត៌មានសងប្រាក់។',
  'Stay safe with official KhmerX channels.': 'រក្សាសុវត្ថិភាពជាមួយបណ្តាញផ្លូវការរបស់ KhmerX។',
  'Never share passwords, OTPs, full card numbers or identity documents in private chats.': 'កុំចែករំលែកពាក្យសម្ងាត់ OTP លេខកាតពេញលេញ ឬឯកសារអត្តសញ្ញាណក្នុងការជជែកឯកជន។',
  'Use the official website, Mini App and support paths.': 'ប្រើប្រាស់គេហទំព័រ Mini App និងបណ្តាញជំនួយផ្លូវការ។',
  '← Back to News': '← ត្រឡប់ទៅព័ត៌មាន'
};

const originalTextNodes = new Map();
const normalizeSiteText = (value) => value.replace(/\s+/g, ' ').trim();
const preferredSiteLocale = () => {
  try {
    const saved = window.localStorage.getItem('khmerx.site.locale');
    if (saved === 'km' || saved === 'en') return saved;
  } catch (_) { /* local storage may be unavailable in hardened browsers */ }
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
  return languages.some((language) => language.toLowerCase().startsWith('km')) ? 'km' : 'en';
};
const applySiteLocale = (locale) => {
  document.documentElement.lang = locale === 'km' ? 'km' : 'en';
  document.querySelectorAll('body *').forEach((element) => {
    element.childNodes.forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE || !normalizeSiteText(node.nodeValue)) return;
      if (!originalTextNodes.has(node)) originalTextNodes.set(node, node.nodeValue);
      const english = normalizeSiteText(originalTextNodes.get(node));
      node.nodeValue = locale === 'km' && siteTranslations[english]
        ? originalTextNodes.get(node).replace(english, siteTranslations[english])
        : originalTextNodes.get(node);
    });
  });
  document.querySelectorAll('.language').forEach((button) => {
    button.textContent = locale === 'km' ? 'English' : 'ខ្មែរ';
    button.setAttribute('aria-label', locale === 'km' ? 'Switch to English' : 'ប្តូរទៅភាសាខ្មែរ');
    button.classList.toggle('is-open', locale === 'km');
  });
  const title = document.title;
  if (locale === 'km' && !document.documentElement.dataset.kmTitle) {
    document.documentElement.dataset.enTitle = title;
    document.documentElement.dataset.kmTitle = title.replace(/Platform|Help Centre|Contact KhmerX|About KhmerX|Security & Privacy|Security & privacy|News & Updates|PayEase|KhmerX/g, (word) => siteTranslations[word] || siteTranslations[word.toLowerCase()] || word);
  }
  if (locale === 'km' && document.documentElement.dataset.kmTitle) document.title = document.documentElement.dataset.kmTitle;
  if (locale === 'en' && document.documentElement.dataset.enTitle) document.title = document.documentElement.dataset.enTitle;
};
let siteLocale = preferredSiteLocale();
applySiteLocale(siteLocale);

const iconHref = new URL('./assets/khmerx-logo-transparent.png', document.currentScript?.src || window.location.href).href;
if (!document.head.querySelector('link[data-khmerx-favicon]')) {
  const icon = document.createElement('link');
  icon.rel = 'icon';
  icon.type = 'image/png';
  icon.href = iconHref;
  icon.dataset.khmerxFavicon = 'true';
  document.head.appendChild(icon);
  const appleIcon = document.createElement('link');
  appleIcon.rel = 'apple-touch-icon';
  appleIcon.href = iconHref;
  document.head.appendChild(appleIcon);
}

const revealItems = document.querySelectorAll('main section, .audience-grid article, .journey-step, .trust-list > div, .faq-grid details');
revealItems.forEach((item, index) => {
  item.dataset.reveal = '';
  item.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
});

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('[data-reveal]').forEach((item) => revealObserver.observe(item));

const header = document.querySelector('.site-header');
const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 12);
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

const supportButton = document.querySelector('.site-support');
const footer = document.querySelector('footer');
if (supportButton && footer && 'IntersectionObserver' in window) {
  const supportObserver = new IntersectionObserver(([entry]) => {
    supportButton.classList.toggle('is-hidden', entry.isIntersecting);
  }, { threshold: 0.08 });
  supportObserver.observe(footer);
}

const navLinks = [...document.querySelectorAll('.desktop-nav a')];
const sections = navLinks.filter((link) => link.getAttribute('href')?.startsWith('#')).map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
const activeObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`));
  });
}, { rootMargin: '-35% 0px -55% 0px' });
sections.forEach((section) => activeObserver.observe(section));

document.querySelectorAll('.language').forEach((button) => {
  button.addEventListener('click', () => {
    siteLocale = siteLocale === 'km' ? 'en' : 'km';
    try { window.localStorage.setItem('khmerx.site.locale', siteLocale); } catch (_) { /* ignore unavailable storage */ }
    applySiteLocale(siteLocale);
  });
});

document.querySelectorAll('.news-grid').forEach((grid) => {
  const cards = [...grid.querySelectorAll(':scope > article, :scope > .news-card')];
  cards.forEach((card) => {
    const link = card.matches('.news-card') ? card : card.querySelector('a[href]');
    if (link && !card.dataset.href) card.dataset.href = link.getAttribute('href');
    if (card.dataset.href) card.tabIndex = 0;
    const published = card.dataset.published || card.textContent.match(/\d{1,2} Sep \d{4}/)?.[0] || '';
    card.dataset.published = published;
  });
  cards.sort((a, b) => b.dataset.published.localeCompare(a.dataset.published));
  cards.forEach((card) => grid.appendChild(card));
  grid.querySelectorAll('[data-href]').forEach((card) => {
    const open = () => { window.location.href = card.dataset.href; };
    card.addEventListener('click', (event) => { if (!event.target.closest('a')) open(); });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    });
  });
});
