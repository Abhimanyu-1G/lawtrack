import 'server-only';

import type { GuideStatus, Language } from '../../../shared/enums';

/**
 * First guide batch (Phase 0). Phase 3 extends this to the full 30+ bilingual
 * set. Content is deliberately conservative: it explains the law in plain
 * language, cites the real Act, avoids outcome predictions and tells the reader
 * when to consult a lawyer.
 *
 * All summaries are seeded as `Valid` after curator review; Phase 3 adds the
 * Draft / Requires AI Update rows that give the curator console work to do.
 */
export interface SeedGuide {
  /** Stable pairing key shared by the English and Hindi versions. */
  topicKey: string;
  status: GuideStatus;
  title: string;
  category: string;
  language: Language;
  plainSummary: string;
  sourceStatute: string;
  sourceExcerpt: string;
}

export const INITIAL_GUIDES: SeedGuide[] = [
  // ---------------------------------------------------------------------
  // Traffic & Motor Vehicles
  // ---------------------------------------------------------------------
  {
    topicKey: 'traffic-challan',
    status: 'Valid',
    title: 'Traffic challans: what a police officer can and cannot do',
    category: 'Traffic & Motor Vehicles',
    language: 'English',
    sourceStatute:
      'Motor Vehicles Act, 1988 (amended by the Motor Vehicles (Amendment) Act, 2019): sections 177, 185, 194B, 200',
    plainSummary:
      'A traffic police officer can stop your vehicle to check your licence, registration, insurance, permit and fitness papers, and can issue a challan for a traffic offence. For many offences the officer may offer "compounding" — you pay the prescribed fine on the spot or at a designated office instead of going to court. Always ask for a receipt or an e-challan number; never pay cash without one.\n\nMost challans in cities are now issued electronically. You can check and pay an e-challan on the Parivahan portal or your state transport department portal, and you can usually see the photograph or video evidence linked to it. If you believe the challan is wrong, you can dispute it before the traffic court instead of paying.\n\nFines for many offences were increased by the Motor Vehicles (Amendment) Act, 2019 — for example, the general penalty under section 177, seat-belt penalties under section 194B and drunk-driving penalties under section 185. State governments notify the amounts that apply locally, so the figure printed on your challan is the one to check. This is general information; if a challan is large or you face a court date, speak to a lawyer.',
    sourceExcerpt:
      'Section 200 of the Motor Vehicles Act, 1988 allows an offence to be compounded by payment of the prescribed sum. Section 177 provides the general penalty for contravention of the Act or rules, and section 185 deals with driving by a drunken person. Amounts are notified by the State Government.',
  },
  {
    topicKey: 'traffic-challan',
    status: 'Valid',
    title: 'ट्रैफिक चालान: पुलिस अधिकारी क्या कर सकता है और क्या नहीं',
    category: 'Traffic & Motor Vehicles',
    language: 'Hindi',
    sourceStatute:
      'मोटर वाहन अधिनियम, 1988 (मोटर वाहन (संशोधन) अधिनियम, 2019 सहित): धारा 177, 185, 194B, 200',
    plainSummary:
      'ट्रैफिक पुलिस आपको वाहन रोककर लाइसेंस, रजिस्ट्रेशन, बीमा, परमिट और फिटनेस कागजात जाँचने के लिए कह सकती है और ट्रैफिक नियम तोड़ने पर चालान काट सकती है। कई अपराधों में पुलिस "कम्पाउंडिंग" का विकल्प देती है — यानी तय जुर्माना देकर अदालत जाने से बचा जा सकता है। हमेशा रसीद या ई-चालान नंबर लें; बिना रसीद के नकद भुगतान न करें।\n\nआजकल अधिकांश चालान इलेक्ट्रॉनिक होते हैं। आप परिवहन विभाग के पोर्टल या Parivahan पोर्टल पर चालान देख और भर सकते हैं, और अक्सर उसके साथ फोटो या वीडियो सबूत भी दिखता है। यदि चालान गलत लगता है, तो भुगतान के बजाय ट्रैफिक कोर्ट में चुनौती दी जा सकती है।\n\nमोटर वाहन (संशोधन) अधिनियम, 2019 ने कई अपराधों का जुर्माना बढ़ाया है — जैसे धारा 177 का सामान्य जुर्माना, धारा 194B का सीट-बेल्ट जुर्माना और धारा 185 का नशे में वाहन चलाने का जुर्माना। जुर्माने की राशि राज्य सरकार तय करती है, इसलिए अपने चालान पर छपी राशि देखें। यह सामान्य जानकारी है, कानूनी सलाह नहीं; बड़े चालान या कोर्ट तारीख की स्थिति में वकील से बात करें।',
    sourceExcerpt:
      'मोटर वाहन अधिनियम, 1988 की धारा 200 कई अपराधों को निर्धारित राशि जमा करने पर कम्पाउंड करने की अनुमति देती है। धारा 177 सामान्य जुर्माना और धारा 185 नशे में वाहन चलाने से संबंधित है। राशि राज्य सरकार अधिसूचना से तय होती है।',
  },

  // ---------------------------------------------------------------------
  // Landlord–Tenant
  // ---------------------------------------------------------------------
  {
    topicKey: 'rent-rajasthan',
    status: 'Valid',
    title: 'Rent, eviction and security deposits for tenants in Rajasthan',
    category: 'Landlord–Tenant',
    language: 'English',
    sourceStatute:
      'Rajasthan Rent Control Act, 2001 (rent, eviction and appeals) and the Model Tenancy Act, 2021 (advisory model law)',
    plainSummary:
      "In Rajasthan, residential and commercial tenancies are governed mainly by the Rajasthan Rent Control Act, 2001. The Act controls rent increases and, importantly, means a landlord cannot simply remove a tenant by force. Eviction normally requires an order of the Rent Tribunal on recognised grounds such as long-term non-payment of rent, unauthorised sub-letting, nuisance, or the landlord's genuine need for the premises.\n\nA landlord may not cut off water or electricity to pressure a tenant to leave; those are essential services and disconnection can be challenged. Rent paid in cash should be against a written receipt, and bank transfer is safer because it leaves a record.\n\nSecurity deposits are governed by your written agreement. Ask for a clear clause on how much is deducted, when the deposit is refunded, and what counts as damage beyond normal wear and tear. When leaving, take photographs, give written notice as the agreement requires, and get the refund timeline in writing.\n\nThe Model Tenancy Act, 2021 is not itself the law in Rajasthan — it is a model that states may adopt. This summary is general information; for an eviction notice or a deposit dispute, consult a lawyer.",
    sourceExcerpt:
      'The Rajasthan Rent Control Act, 2001 regulates rent and provides for eviction of tenants only on specified grounds by the Rent Tribunal. The Model Tenancy Act, 2021 is a model statute recommended for adoption by States; it is not automatically applicable in Rajasthan.',
  },
  {
    topicKey: 'rent-rajasthan',
    status: 'Valid',
    title: 'राजस्थान में किराया, बेदखली और सिक्योरिटी डिपॉजिट',
    category: 'Landlord–Tenant',
    language: 'Hindi',
    sourceStatute:
      'राजस्थान रेंट कंट्रोल अधिनियम, 2001 (किराया, बेदखली और अपील) तथा मॉडल टेनेंसी अधिनियम, 2021 (आदर्श कानून)',
    plainSummary:
      'राजस्थान में आवासीय और व्यावसायिक किरायेदारी मुख्य रूप से राजस्थान रेंट कंट्रोल अधिनियम, 2001 से नियंत्रित होती है। यह कानून किराए की वृद्धि को नियंत्रित करता है और यह भी सुनिश्चित करता है कि मकान मालिक किरायेदार को बिना प्रक्रिया के बलपूर्वक नहीं निकाल सकता। बेदखली के लिए आम तौर पर रेंट ट्रिब्यूनल का आदेश जरूरी होता है, और आधार होते हैं — लंबे समय तक किराया न देना, बिना अनुमति उप-किरायेदारी, उपद्रव, या मकान मालिक की वास्तविक आवश्यकता।\n\nमकान मालिक किरायेदार पर दबाव डालने के लिए पानी या बिजली नहीं काट सकता; ये आवश्यक सेवाएँ हैं और इनसे जुड़ी शिकायत की जा सकती है। नकद किराया देने पर लिखित रसीद लें; बैंक ट्रांसफर में रिकॉर्ड रहता है, इसलिए वह अधिक सुरक्षित है।\n\nसिक्योरिटी डिपॉजिट आपके लिखित समझौते से तय होता है। समझौते में स्पष्ट रखें कि कितनी राशि काटी जा सकती है, डिपॉजिट कब लौटाया जाएगा और सामान्य टूट-फूट के अलावा क्या नुकसान माना जाएगा। मकान खाली करते समय तस्वीरें लें, लिखित नोटिस दें और रिफंड की तारीख लिखित में लें।\n\nमॉडल टेनेंसी अधिनियम, 2021 अपने आप राजस्थान का कानून नहीं है — यह राज्यों के लिए एक आदर्श कानून है। यह जानकारी सामान्य है; बेदखली नोटिस या डिपॉजिट विवाद में वकील से परामर्श करें।',
    sourceExcerpt:
      'राजस्थान रेंट कंट्रोल अधिनियम, 2001 किराए को नियंत्रित करता है और निर्धारित आधारों पर ही रेंट ट्रिब्यूनल द्वारा बेदखली की अनुमति देता है। मॉडल टेनेंसी अधिनियम, 2021 राज्यों के लिए आदर्श कानून है और स्वतः लागू नहीं होता।',
  },

  // ---------------------------------------------------------------------
  // Consumer Rights
  // ---------------------------------------------------------------------
  {
    topicKey: 'consumer-complaint',
    status: 'Valid',
    title: 'How to file a consumer complaint under the Consumer Protection Act, 2019',
    category: 'Consumer Rights',
    language: 'English',
    sourceStatute:
      'Consumer Protection Act, 2019: sections 2(7), 2(11), 34, 35 and 69; Consumer Protection (E-Commerce) Rules, 2020',
    plainSummary:
      'A consumer is a person who buys goods or hires services for personal use — including online purchases. If goods are defective, services are deficient, or a seller uses unfair or misleading practices, you can complain under the Consumer Protection Act, 2019.\n\nYou can file a complaint yourself; a lawyer is not mandatory. A complaint must normally be filed within two years of the cause of action (section 69). You file before the District Commission where you live or where the opposite party works, based on the value of the goods or services. The 2021 pecuniary limits are up to ₹50 lakh for the District Commission, ₹50 lakh to ₹2 crore for the State Commission, and above ₹2 crore for the National Commission.\n\nAttach the bill or invoice, warranty, photographs, chat or email records, and a short written account of what happened and what you want. Send a written notice to the seller or service provider first; many complaints settle at that stage. E-commerce complaints can be filed online through the e-Daakhil portal. Keep every acknowledgement.\n\nThis is general information. For a large claim or a dispute about medical negligence or insurance, speak to a lawyer.',
    sourceExcerpt:
      'Section 2(7) defines "consumer"; section 2(11) defines "deficiency"; section 34 sets out the jurisdiction of the District Commission; section 35 describes how a complaint is made; section 69 provides a two-year limitation period from the date on which the cause of action arises.',
  },
  {
    topicKey: 'consumer-complaint',
    status: 'Valid',
    title: 'उपभोक्ता संरक्षण अधिनियम, 2019 के तहत शिकायत कैसे करें',
    category: 'Consumer Rights',
    language: 'Hindi',
    sourceStatute:
      'उपभोक्ता संरक्षण अधिनियम, 2019: धारा 2(7), 2(11), 34, 35 और 69; उपभोक्ता संरक्षण (ई-कॉमर्स) नियम, 2020',
    plainSummary:
      'उपभोक्ता वह व्यक्ति है जो व्यक्तिगत उपयोग के लिए सामान खरीदता है या सेवा लेता है — ऑनलाइन खरीदारी भी इसमें शामिल है। यदि सामान खराब है, सेवा में कमी है, या विक्रेता अनुचित या भ्रामक तरीका अपनाता है, तो उपभोक्ता संरक्षण अधिनियम, 2019 के तहत शिकायत की जा सकती है।\n\nशिकायत आप स्वयं दायर कर सकते हैं; वकील अनिवार्य नहीं है। शिकायत आम तौर पर कारण उत्पन्न होने की तारीख से दो वर्ष के भीतर दायर करनी होती है (धारा 69)। शिकायत उस जिला आयोग में दी जाती है जहाँ आप रहते हैं या जहाँ विपक्षी कार्य करता है, और यह सामान या सेवा के मूल्य पर निर्भर करता है। 2021 की सीमा के अनुसार जिला आयोग में ₹50 लाख तक, राज्य आयोग में ₹50 लाख से ₹2 करोड़ तक और राष्ट्रीय आयोग में ₹2 करोड़ से अधिक के मामले आते हैं।\n\nबिल या इनवॉइस, वारंटी, तस्वीरें, चैट या ईमेल रिकॉर्ड, और क्या हुआ तथा क्या चाहते हैं — इनका संक्षिप्त लिखित विवरण संलग्न करें। पहले विक्रेता या सेवा प्रदाता को लिखित नोटिस भेजें; कई मामले इसी चरण में सुलझ जाते हैं। ई-कॉमर्स शिकायतें e-Daakhil पोर्टल पर ऑनलाइन दायर की जा सकती हैं। हर पावती संभालकर रखें।\n\nयह सामान्य जानकारी है। बड़े दावे, मेडिकल नेग्लिजेंस या बीमा विवाद में वकील से सलाह लें।',
    sourceExcerpt:
      'धारा 2(7) "उपभोक्ता" को परिभाषित करती है; धारा 2(11) "सेवा में कमी" को; धारा 34 जिला आयोग की अधिकारिता तय करती है; धारा 35 शिकायत दायर करने की प्रक्रिया बताती है; धारा 69 कारण उत्पन्न होने से दो वर्ष की समय-सीमा देती है।',
  },

  // ---------------------------------------------------------------------
  // RTI
  // ---------------------------------------------------------------------
  {
    topicKey: 'rti-application',
    status: 'Valid',
    title: 'Your right to information: filing an RTI application',
    category: 'RTI',
    language: 'English',
    sourceStatute: 'Right to Information Act, 2005: sections 6, 7, 8, 19 and 24',
    plainSummary:
      'The Right to Information Act, 2005 gives every citizen the right to ask a public authority for information it holds. You do not have to give a reason for the request, and the authority must normally reply within 30 days (within 48 hours where the information concerns the life or liberty of a person).\n\nAddress the application to the Public Information Officer (PIO) of the correct public authority. Many departments accept applications online through their state RTI portal, or by post or in person. A fee of ₹10 is usual; applicants below the poverty line are exempt, and some states waive the fee for certain categories. Keep the acknowledgement or postal proof.\n\nIf no reply arrives, or the reply is incomplete or refused, file a first appeal with the appellate authority of the same department within 30 days. If that fails, a second appeal can be filed with the State or Central Information Commission within 90 days. Certain information is exempt under section 8 (for example, national security and personal privacy), and some intelligence and security organisations are excluded under section 24.\n\nAsk for specific documents or periods rather than opinions, and keep the request short. This is general information; a lawyer can help if an appeal is complicated.',
    sourceExcerpt:
      'Section 6 describes how a request is made; section 7 requires disposal within thirty days (forty-eight hours where life or liberty is involved); section 8 lists exemptions; section 19 provides first and second appeals; section 24 lists organisations excluded from the Act.',
  },
  {
    topicKey: 'rti-application',
    status: 'Valid',
    title: 'सूचना का अधिकार: आरटीआई आवेदन कैसे करें',
    category: 'RTI',
    language: 'Hindi',
    sourceStatute: 'सूचना का अधिकार अधिनियम, 2005: धारा 6, 7, 8, 19 और 24',
    plainSummary:
      'सूचना का अधिकार अधिनियम, 2005 हर नागरिक को यह अधिकार देता है कि वह किसी लोक प्राधिकरण से उसके पास उपलब्ध जानकारी माँग सके। आवेदन में कारण बताना जरूरी नहीं है, और सामान्यतः 30 दिनों में जवाब देना होता है (किसी व्यक्ति के जीवन या स्वतंत्रता से जुड़ी सूचना में 48 घंटे)।\n\nआवेदन संबंधित लोक प्राधिकरण के जन सूचना अधिकारी (PIO) के नाम भेजें। कई विभाग राज्य के आरटीआई पोर्टल से ऑनलाइन आवेदन लेते हैं, या डाक/हाथ से भी लिया जा सकता है। सामान्य शुल्क ₹10 है; गरीबी रेखा से नीचे के आवेदकों को छूट है और कुछ राज्यों में विशेष श्रेणियों को भी छूट है। पावती या डाक का सबूत रखें।\n\nजवाब न आए, अधूरा आए या मना कर दिया जाए, तो 30 दिनों के भीतर उसी विभाग के अपीलीय अधिकारी के पास प्रथम अपील करें। वहाँ भी न हो तो 90 दिनों के भीतर राज्य या केंद्रीय सूचना आयोग में द्वितीय अपील की जा सकती है। धारा 8 में कुछ सूचनाएँ छूट में हैं (जैसे राष्ट्रीय सुरक्षा और व्यक्तिगत गोपनीयता) और धारा 24 में कुछ सुरक्षा एजेंसियाँ अधिनियम से बाहर हैं।\n\nराय के बजाय ठोस दस्तावेज या अवधि माँगें और आवेदन संक्षिप्त रखें। यह सामान्य जानकारी है; जटिल अपील में वकील मदद कर सकता है।',
    sourceExcerpt:
      'धारा 6 आवेदन की प्रक्रिया बताती है; धारा 7 में तीस दिन (जीवन या स्वतंत्रता के मामले में अड़तालीस घंटे) में निपटान का प्रावधान है; धारा 8 में छूट; धारा 19 में प्रथम और द्वितीय अपील; धारा 24 में अधिनियम से बाहर रखे गए संगठन।',
  },

  // ---------------------------------------------------------------------
  // Cyber & Online Fraud
  // ---------------------------------------------------------------------
  {
    topicKey: 'cyber-fraud',
    status: 'Valid',
    title: 'Online fraud: the first 24 hours and your legal options',
    category: 'Cyber & Online Fraud',
    language: 'English',
    sourceStatute:
      'Information Technology Act, 2000: sections 66C and 66D; Bharatiya Nyaya Sanhita, 2023: sections 318 and 319; RBI circular on unauthorised electronic transactions (2017)',
    plainSummary:
      'If money is taken from your account through fraud, act immediately. Call the national cyber-fraud helpline 1930 and report the transaction on the cybercrime.gov.in portal. Reporting quickly gives the bank and police the best chance of freezing the money before it is moved again — this is often called the "golden hour".\n\nInform your bank at once in writing or through its app, block the card or UPI access, and ask for a written complaint number. Under the Reserve Bank of India\'s 2017 circular on unauthorised electronic transactions, if a third-party breach is reported within three working days, the customer\'s liability is generally zero; delay can increase your share of the loss. Keep screenshots, SMS alerts, transaction ids, the caller\'s number and any chat or email.\n\nFraud is investigated under the Information Technology Act, 2000 (for example sections 66C and 66D on identity theft and cheating by personation) and the Bharatiya Nyaya Sanhita, 2023 (cheating and impersonation). You can file an FIR at a cyber police station or through the online portal; the bank complaint and the police complaint are separate steps and both matter.\n\nNever pay a "recovery agent" who promises to get your money back. This is general information; for large amounts or a court case, consult a lawyer.',
    sourceExcerpt:
      'Section 66C of the Information Technology Act, 2000 punishes identity theft; section 66D punishes cheating by personation using a computer resource. The Reserve Bank of India circular of 6 July 2017 on customer protection limits customer liability for unauthorised electronic transactions when the fraud is reported promptly.',
  },
  {
    topicKey: 'cyber-fraud',
    status: 'Valid',
    title: 'ऑनलाइन धोखाधड़ी: पहले 24 घंटे और कानूनी विकल्प',
    category: 'Cyber & Online Fraud',
    language: 'Hindi',
    sourceStatute:
      'सूचना प्रौद्योगिकी अधिनियम, 2000: धारा 66C और 66D; भारतीय न्याय संहिता, 2023: धारा 318 और 319; आरबीआई का अनधिकृत इलेक्ट्रॉनिक लेनदेन पर परिपत्र (2017)',
    plainSummary:
      'यदि धोखाधड़ी से आपके खाते से पैसे निकले हैं, तो तुरंत कार्रवाई करें। राष्ट्रीय साइबर फ्रॉड हेल्पलाइन 1930 पर कॉल करें और cybercrime.gov.in पोर्टल पर शिकायत दर्ज करें। जल्दी शिकायत करने पर बैंक और पुलिस को पैसा आगे ट्रांसफर होने से पहले रोकने का बेहतर मौका मिलता है — इसे "गोल्डन आवर" कहा जाता है।\n\nतुरंत बैंक को लिखित में या ऐप के जरिए सूचित करें, कार्ड या यूपीआई बंद करवाएँ और लिखित शिकायत नंबर लें। भारतीय रिजर्व बैंक के 2017 के परिपत्र के अनुसार, तीसरे पक्ष की धोखाधड़ी की सूचना तीन कार्यदिवसों के भीतर देने पर आम तौर पर ग्राहक की जिम्मेदारी शून्य होती है; देरी से नुकसान में आपका हिस्सा बढ़ सकता है। स्क्रीनशॉट, एसएमएस अलर्ट, ट्रांजैक्शन आईडी, कॉलर का नंबर और चैट/ईमेल सुरक्षित रखें।\n\nजाँच सूचना प्रौद्योगिकी अधिनियम, 2000 (जैसे पहचान की चोरी और प्रतिरूपण से ठगी की धारा 66C और 66D) तथा भारतीय न्याय संहिता, 2023 (ठगी और प्रतिरूपण) के तहत होती है। साइबर थाने में या ऑनलाइन पोर्टल से एफआईआर दर्ज कराई जा सकती है; बैंक शिकायत और पुलिस शिकायत दो अलग कदम हैं और दोनों जरूरी हैं।\n\nऐसे "रिकवरी एजेंट" को पैसे न दें जो पैसा वापस दिलाने का वादा करते हैं। यह सामान्य जानकारी है; बड़ी राशि या कोर्ट केस में वकील से सलाह लें।',
    sourceExcerpt:
      'सूचना प्रौद्योगिकी अधिनियम, 2000 की धारा 66C पहचान की चोरी और धारा 66D कंप्यूटर संसाधन का उपयोग करके प्रतिरूपण से ठगी पर दंड देती है। आरबीआई के 6 जुलाई 2017 के परिपत्र में समय पर शिकायत पर ग्राहक की जिम्मेदारी सीमित की गई है।',
  },

  // ---------------------------------------------------------------------
  // Labour & Employment — wages
  // ---------------------------------------------------------------------
  {
    topicKey: 'labour-wages',
    status: 'Valid',
    title: 'Unpaid salary: wages, deductions and how to raise a claim',
    category: 'Labour & Employment',
    language: 'English',
    sourceStatute:
      'Payment of Wages Act, 1936: sections 4, 5, 7 and 15; Code on Wages, 2019 (being brought into force in stages)',
    plainSummary:
      'Your salary is not a favour; it is a legal entitlement for work you have done. The Payment of Wages Act, 1936 applies to employees covered by it and sets wage periods, the date by which wages must be paid, and the deductions an employer may make. Deductions are limited and generally need a written basis; arbitrary fines or unexplained cuts can be challenged.\n\nKeep your appointment letter, salary slips, attendance or shift records, bank statements and any written promise about pay. If wages are delayed or withheld, first ask the employer in writing and keep a copy. You can complain to the labour commissioner or the authority under section 15 of the Payment of Wages Act, which can order payment of the shortfall. The Code on Wages, 2019 consolidates wage law and is being notified in stages, so the rule that applies depends on your state and establishment.\n\nDo not sign a full-and-final settlement unless you understand what it gives up. This is general information; for a large claim or a threatened dismissal, speak to a lawyer.',
    sourceExcerpt:
      'Section 4 fixes wage periods, section 5 requires payment before the prescribed date, section 7 limits deductions, and section 15 provides a claim before the prescribed authority for wages deducted or delayed.',
  },
  {
    topicKey: 'labour-wages',
    status: 'Valid',
    title: 'बकाया वेतन: मजदूरी, कटौती और दावा कैसे करें',
    category: 'Labour & Employment',
    language: 'Hindi',
    sourceStatute:
      'पेमेंट ऑफ वेजेज अधिनियम, 1936: धारा 4, 5, 7 और 15; कोड ऑन वेजेज, 2019 (चरणों में लागू)',
    plainSummary:
      'आपका वेतन कोई एहसान नहीं, बल्कि किए गए काम का कानूनी अधिकार है। पेमेंट ऑफ वेजेज अधिनियम, 1936 उन कर्मचारियों पर लागू होता है जो इसके दायरे में आते हैं; यह वेतन अवधि, वेतन देने की तारीख और नियोक्ता द्वारा कटौती की सीमा तय करता है। कटौतियाँ सीमित हैं और सामान्यतः लिखित आधार पर की जाती हैं; मनमाने जुर्माने या बिना कारण कटौती को चुनौती दी जा सकती है।\n\nअपना नियुक्ति पत्र, वेतन पर्ची, उपस्थिति या शिफ्ट रिकॉर्ड, बैंक स्टेटमेंट और वेतन से जुड़ा कोई लिखित वादा संभालकर रखें। वेतन देर से मिलने या रोके जाने पर पहले नियोक्ता को लिखित में माँगें और उसकी प्रति रखें। आप श्रम आयुक्त या पेमेंट ऑफ वेजेज अधिनियम की धारा 15 के तहत निर्धारित प्राधिकारी के पास शिकायत कर सकते हैं, जो बकाया भुगतान का आदेश दे सकता है। कोड ऑन वेजेज, 2019 वेतन कानूनों को समेकित करता है और चरणों में लागू किया जा रहा है, इसलिए लागू नियम आपके राज्य और प्रतिष्ठान पर निर्भर करता है।\n\nपूर्ण और अंतिम निपटान पर तब तक हस्ताक्षर न करें जब तक आप समझ न लें कि उससे क्या अधिकार छूट रहे हैं। यह सामान्य जानकारी है; बड़े दावे या नौकरी से निकाले जाने की धमकी में वकील से बात करें।',
    sourceExcerpt:
      'धारा 4 वेतन अवधि तय करती है, धारा 5 निर्धारित तारीख से पहले भुगतान की माँग करती है, धारा 7 कटौतियों को सीमित करती है, और धारा 15 रोके या काटे गए वेतन के लिए निर्धारित प्राधिकारी के समक्ष दावे का प्रावधान देती है।',
  },

  // ---------------------------------------------------------------------
  // Labour & Employment — termination
  // ---------------------------------------------------------------------
  {
    topicKey: 'labour-termination',
    status: 'Valid',
    title: 'Lost your job: notice, retrenchment and your options',
    category: 'Labour & Employment',
    language: 'English',
    sourceStatute:
      'Industrial Disputes Act, 1947: sections 2(oo), 25F, 25G and 25N; Industrial Relations Code, 2020 (partly notified); state Shops and Establishments Acts',
    plainSummary:
      'Losing a job raises two separate questions: whether the employer followed the law, and what money is due to you. For many workers covered by the Industrial Disputes Act, 1947, retrenchment requires notice or pay in lieu, retrenchment compensation of fifteen days average pay for each completed year of service, and a valid reason. Section 25F sets these conditions; section 25G sets a rule of last-in-first-out within the same category, subject to exceptions; section 25N requires prior government permission for large establishments in some situations.\n\nAsk for the termination letter in writing and the reason. Collect your appointment letter, salary slips, attendance records, emails and the names of witnesses. Do not sign blank papers or a resignation you did not intend to give. A resignation is legally different from a termination, so read before signing.\n\nYou can raise an industrial dispute through a union or directly before the labour authority; conciliation often comes first, and a labour court can hear the dispute if it is not settled. State Shops and Establishments Acts and the new labour codes may apply instead depending on your workplace and state. This is general information; act quickly and consult a lawyer or union about time limits.',
    sourceExcerpt:
      'Section 2(oo) defines retrenchment; section 25F requires one month notice or pay in lieu plus retrenchment compensation of fifteen days average pay per completed year of service; section 25G provides the last-in-first-out rule; section 25N requires prior permission in certain large establishments.',
  },
  {
    topicKey: 'labour-termination',
    status: 'Valid',
    title: 'नौकरी छूटी: नोटिस, छंटनी और आपके विकल्प',
    category: 'Labour & Employment',
    language: 'Hindi',
    sourceStatute:
      'औद्योगिक विवाद अधिनियम, 1947: धारा 2(oo), 25F, 25G और 25N; औद्योगिक संबंध संहिता, 2020 (आंशिक रूप से अधिसूचित); राज्य दुकान और प्रतिष्ठान अधिनियम',
    plainSummary:
      'नौकरी जाने पर दो अलग प्रश्न उठते हैं: क्या नियोक्ता ने कानून का पालन किया, और आपको कितना पैसा मिलना चाहिए। औद्योगिक विवाद अधिनियम, 1947 के दायरे में आने वाले कई कर्मचारियों के लिए छंटनी में नोटिस या उसके बदले वेतन, हर पूरे वर्ष की सेवा पर पंद्रह दिन के औसत वेतन के बराबर मुआवजा और वैध कारण आवश्यक है। धारा 25F ये शर्तें तय करती है; धारा 25G उसी श्रेणी में अंतिम आने वाले को पहले निकालने का नियम देती है, कुछ अपवादों के साथ; धारा 25N कुछ बड़े प्रतिष्ठानों में पहले सरकारी अनुमति की माँग करती है।\n\nनौकरी समाप्ति का पत्र लिखित में और कारण भी माँगें। नियुक्ति पत्र, वेतन पर्ची, उपस्थिति रिकॉर्ड, ईमेल और गवाहों के नाम इकट्ठा करें। खाली कागजों पर या ऐसे इस्तीफे पर हस्ताक्षर न करें जो आप देना नहीं चाहते। इस्तीफा और नौकरी से निकाला जाना कानूनी रूप से अलग हैं, इसलिए हस्ताक्षर से पहले पढ़ें।\n\nआप यूनियन के जरिए या सीधे श्रम प्राधिकारी के पास औद्योगिक विवाद उठा सकते हैं; अक्सर पहले सुलह होती है, और न सुलझने पर श्रम न्यायालय सुनवाई कर सकता है। आपके कार्यस्थल और राज्य के अनुसार राज्य दुकान और प्रतिष्ठान अधिनियम या नए श्रम संहिताएँ लागू हो सकती हैं। यह सामान्य जानकारी है; समय-सीमा के बारे में जल्दी वकील या यूनियन से सलाह लें।',
    sourceExcerpt:
      'धारा 2(oo) छंटनी को परिभाषित करती है; धारा 25F एक माह का नोटिस या उसके बदले वेतन तथा हर पूरे सेवा वर्ष पर पंद्रह दिन के औसत वेतन के मुआवजे की माँग करती है; धारा 25G अंतिम आने वाले को पहले निकालने का नियम देती है; धारा 25N कुछ बड़े प्रतिष्ठानों में पूर्व अनुमति की माँग करती है।',
  },

  // ---------------------------------------------------------------------
  // Women's Safety — domestic violence
  // ---------------------------------------------------------------------
  {
    topicKey: 'women-domestic-violence',
    status: 'Valid',
    title: 'Domestic violence: protection orders and safe first steps',
    category: "Women's Safety",
    language: 'English',
    sourceStatute:
      'Protection of Women from Domestic Violence Act, 2005: sections 3, 12, 18 to 23 and 26',
    plainSummary:
      'Domestic violence is not only physical. Under the Protection of Women from Domestic Violence Act, 2005 it includes physical, sexual, verbal, emotional and economic abuse by a spouse, partner or family member in a shared household. Stalking, threats, forced isolation, controlling money and preventing you from working can all be part of the pattern.\n\nIn an emergency call 112. You can approach a Protection Officer, a service provider or the Magistrate directly. A Magistrate can pass an interim protection order, a residence order so you are not thrown out of the shared home, a monetary relief order, and orders about custody or compensation. A written domestic incident report helps; keep dates, messages, photographs, medical records and witness details.\n\nA criminal complaint is separate: cruelty or hurt may also be investigated by the police. Free legal aid is available through the District Legal Services Authority, and the national womens helpline is 181. A protection order is not a divorce or a property judgment; those are separate proceedings.\n\nThis is general information. If you are in danger, contact the police or a protection officer first, then consult a lawyer.',
    sourceExcerpt:
      'Section 3 defines domestic violence, including physical, sexual, verbal, emotional and economic abuse. Section 12 allows an application to the Magistrate; sections 18 to 22 provide protection, residence, monetary relief, custody and compensation orders; section 23 allows interim and ex parte orders.',
  },
  {
    topicKey: 'women-domestic-violence',
    status: 'Valid',
    title: 'घरेलू हिंसा: संरक्षण आदेश और सुरक्षित पहले कदम',
    category: "Women's Safety",
    language: 'Hindi',
    sourceStatute:
      'घरेलू हिंसा से महिलाओं का संरक्षण अधिनियम, 2005: धारा 3, 12, 18 से 23 और 26',
    plainSummary:
      'घरेलू हिंसा केवल शारीरिक नहीं होती। घरेलू हिंसा से महिलाओं का संरक्षण अधिनियम, 2005 के तहत इसमें पति, साथी या परिवार के सदस्य द्वारा साझा घर में शारीरिक, यौन, मौखिक, भावनात्मक और आर्थिक शोषण शामिल है। पीछा करना, धमकी देना, अकेला कर देना, पैसे पर नियंत्रण और काम करने से रोकना भी इसी पैटर्न का हिस्सा हो सकता है।\n\nआपात स्थिति में 112 पर कॉल करें। आप संरक्षण अधिकारी, सेवा प्रदाता या सीधे मजिस्ट्रेट के पास जा सकती हैं। मजिस्ट्रेट अंतरिम संरक्षण आदेश, साझा घर से बाहर निकाले जाने से रोकने का निवास आदेश, आर्थिक राहत आदेश, और बच्चों की अभिरक्षा या मुआवजे के आदेश दे सकता है। लिखित घरेलू घटना रिपोर्ट मदद करती है; तारीखें, संदेश, तस्वीरें, चिकित्सा रिकॉर्ड और गवाहों का विवरण रखें।\n\nआपराधिक शिकायत अलग होती है: क्रूरता या चोट की जाँच पुलिस भी कर सकती है। जिला विधिक सेवा प्राधिकरण से मुफ्त कानूनी सहायता मिलती है, और राष्ट्रीय महिला हेल्पलाइन 181 है। संरक्षण आदेश तलाक या संपत्ति का फैसला नहीं है; वे अलग कार्यवाहियाँ हैं।\n\nयह सामान्य जानकारी है। यदि आप खतरे में हैं तो पहले पुलिस या संरक्षण अधिकारी से संपर्क करें, फिर वकील से सलाह लें।',
    sourceExcerpt:
      'धारा 3 घरेलू हिंसा को परिभाषित करती है, जिसमें शारीरिक, यौन, मौखिक, भावनात्मक और आर्थिक शोषण शामिल है। धारा 12 मजिस्ट्रेट के समक्ष आवेदन की अनुमति देती है; धारा 18 से 22 संरक्षण, निवास, आर्थिक राहत, अभिरक्षा और मुआवजे के आदेश देती हैं; धारा 23 अंतरिम और एकपक्षीय आदेश देती है।',
  },

  // ---------------------------------------------------------------------
  // Women's Safety — workplace harassment
  // ---------------------------------------------------------------------
  {
    topicKey: 'women-workplace-harassment',
    status: 'Valid',
    title: 'Sexual harassment at work: what the POSH Act requires',
    category: "Women's Safety",
    language: 'English',
    sourceStatute:
      'Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013: sections 2, 4, 9, 11, 13 and 26',
    plainSummary:
      'The POSH Act, 2013 protects women from sexual harassment at the workplace. Harassment includes unwelcome physical contact, a demand or request for sexual favours, sexually coloured remarks, showing pornography, and any other unwelcome physical, verbal or non-verbal conduct of a sexual nature. It can happen at the office, on a field visit, in transport provided by the employer, or online during work.\n\nAn employer with ten or more workers must set up an Internal Committee (IC); smaller workplaces and the informal sector are covered by the Local Committee. You can make a written complaint to the IC, normally within three months of the incident, and the committee may extend the period for good reason. The employer must keep the complaint confidential, protect you from retaliation, and provide interim relief such as transfer or leave if needed. After inquiry, the IC recommends action, and the employer must act.\n\nYou can also file an FIR for conduct that is a criminal offence. An appeal against the committees findings lies to the appellate authority under the Act. Do not wait to collect perfect evidence; save messages, emails, dates and names. This is general information; for a complaint or retaliation, consult a lawyer.',
    sourceExcerpt:
      'Section 2 defines sexual harassment and workplace; section 4 requires an Internal Committee in establishments with ten or more workers; section 9 provides for a Local Committee; section 11 sets out the complaint procedure; section 13 provides for inquiry and action; section 26 lists employer duties.',
  },
  {
    topicKey: 'women-workplace-harassment',
    status: 'Valid',
    title: 'कार्यस्थल पर यौन उत्पीड़न: पॉश अधिनियम क्या कहता है',
    category: "Women's Safety",
    language: 'Hindi',
    sourceStatute:
      'कार्यस्थल पर महिलाओं का यौन उत्पीड़न (रोकथाम, निषेध और निवारण) अधिनियम, 2013: धारा 2, 4, 9, 11, 13 और 26',
    plainSummary:
      'पॉश अधिनियम, 2013 महिलाओं को कार्यस्थल पर यौन उत्पीड़न से बचाता है। उत्पीड़न में अनचाहा शारीरिक संपर्क, यौन लाभ की माँग या अनुरोध, यौन रंग की टिप्पणी, अश्लील सामग्री दिखाना, और यौन प्रकृति का कोई भी अनचाहा शारीरिक, मौखिक या गैर-मौखिक आचरण शामिल है। यह दफ्तर में, फील्ड विजिट में, नियोक्ता द्वारा दिए गए वाहन में, या काम के दौरान ऑनलाइन हो सकता है।\n\nदस या अधिक कर्मचारियों वाले नियोक्ता को आंतरिक समिति (IC) बनानी होती है; छोटे कार्यस्थल और अनौपचारिक क्षेत्र स्थानीय समिति के दायरे में आते हैं। आप आम तौर पर घटना के तीन महीने के भीतर IC को लिखित शिकायत दे सकती हैं, और समिति उचित कारण से अवधि बढ़ा सकती है। नियोक्ता को शिकायत गोपनीय रखनी होती है, आपको बदले की कार्रवाई से बचाना होता है, और जरूरत पर स्थानांतरण या अवकाश जैसी अंतरिम राहत देनी होती है। जाँच के बाद IC कार्रवाई की सिफारिश करती है और नियोक्ता को उस पर कार्रवाई करनी होती है।\n\nआपराधिक अपराध बनने वाले आचरण के लिए एफआईआर भी दर्ज की जा सकती है। समिति के निष्कर्ष के खिलाफ अधिनियम के तहत अपीलीय प्राधिकारी में अपील होती है। सही सबूत जमा करने का इंतजार न करें; संदेश, ईमेल, तारीखें और नाम सुरक्षित रखें। यह सामान्य जानकारी है; शिकायत या बदले की कार्रवाई की स्थिति में वकील से सलाह लें।',
    sourceExcerpt:
      'धारा 2 यौन उत्पीड़न और कार्यस्थल को परिभाषित करती है; धारा 4 दस या अधिक कर्मचारियों वाले प्रतिष्ठान में आंतरिक समिति अनिवार्य करती है; धारा 9 स्थानीय समिति का प्रावधान देती है; धारा 11 शिकायत प्रक्रिया बताती है; धारा 13 जाँच और कार्रवाई का प्रावधान देती है; धारा 26 नियोक्ता के कर्तव्य बताती है।',
  },

  // ---------------------------------------------------------------------
  // Property — buying
  // ---------------------------------------------------------------------
  {
    topicKey: 'property-sale-deed',
    status: 'Valid',
    title: 'Buying property: sale deed, registration and due diligence',
    category: 'Property',
    language: 'English',
    sourceStatute:
      'Transfer of Property Act, 1882: sections 54 and 55; Registration Act, 1908: section 17; Real Estate (Regulation and Development) Act, 2016',
    plainSummary:
      'Buying a flat or plot is a chain of checks, not one signature. A sale of immovable property worth more than one hundred rupees is valid only when made by a registered instrument (section 54, Transfer of Property Act), so the sale deed must be stamped and registered with the sub-registrar. Registration is strong evidence of the transfer, but it does not cure a defective title.\n\nBefore paying, verify the ownership chain for at least 30 years, obtain an encumbrance certificate, check property tax and society or municipal dues, confirm approved plans and the land use, and see whether the project is registered with the state RERA authority. Match the sellers identity and the property description on every document. Pay by bank transfer so there is a trail, and collect the stamped registered deed and the original title documents.\n\nA general power of attorney is not a substitute for the owners participation or a registered sale deed; transactions built only on power of attorney carry risk. A family settlement or gift deed has different rules. This is general information; appoint a property lawyer to do the title search before you pay.',
    sourceExcerpt:
      'Section 54 of the Transfer of Property Act, 1882 provides that a sale of immovable property of the value of one hundred rupees and upwards can be made only by a registered instrument. Section 17 of the Registration Act, 1908 requires the registration of documents that create or transfer rights in immovable property.',
  },
  {
    topicKey: 'property-sale-deed',
    status: 'Valid',
    title: 'संपत्ति खरीदना: विक्रय विलेख, पंजीकरण और जाँच',
    category: 'Property',
    language: 'Hindi',
    sourceStatute:
      'संपत्ति अंतरण अधिनियम, 1882: धारा 54 और 55; पंजीकरण अधिनियम, 1908: धारा 17; रियल एस्टेट (विनियमन और विकास) अधिनियम, 2016',
    plainSummary:
      'फ्लैट या प्लॉट खरीदना एक हस्ताक्षर नहीं, कई जाँचों की श्रृंखला है। संपत्ति अंतरण अधिनियम की धारा 54 के अनुसार एक सौ रुपये से अधिक मूल्य की अचल संपत्ति का विक्रय केवल पंजीकृत विलेख से हो सकता है, इसलिए विक्रय विलेख पर स्टांप लगाकर उप-पंजीयक के पास पंजीकरण कराना जरूरी है। पंजीकरण अंतरण का मजबूत सबूत है, लेकिन खराब टाइटल को ठीक नहीं करता।\n\nभुगतान से पहले कम से कम 30 वर्ष की स्वामित्व श्रृंखला जाँचें, भार प्रमाणपत्र लें, संपत्ति कर और सोसाइटी या नगर निगम के बकाया देखें, अनुमोदित नक्शे और भूमि उपयोग की पुष्टि करें, और देखें कि प्रोजेक्ट राज्य रेरा प्राधिकरण में पंजीकृत है या नहीं। हर दस्तावेज पर विक्रेता की पहचान और संपत्ति का विवरण मिलाएँ। बैंक ट्रांसफर से भुगतान करें ताकि रिकॉर्ड रहे, और स्टांप लगा पंजीकृत विलेख तथा मूल टाइटल दस्तावेज लें।\n\nसामान्य पावर ऑफ अटॉर्नी मालिक की भागीदारी या पंजीकृत विक्रय विलेख का विकल्प नहीं है; केवल पावर ऑफ अटॉर्नी पर बने लेनदेन में जोखिम रहता है। पारिवारिक समझौते या दान विलेख के नियम अलग हैं। यह सामान्य जानकारी है; भुगतान से पहले संपत्ति वकील से टाइटल जाँच कराएँ।',
    sourceExcerpt:
      'संपत्ति अंतरण अधिनियम, 1882 की धारा 54 के अनुसार एक सौ रुपये और उससे अधिक मूल्य की अचल संपत्ति का विक्रय केवल पंजीकृत विलेख से किया जा सकता है। पंजीकरण अधिनियम, 1908 की धारा 17 अचल संपत्ति में अधिकार बनाने या हस्तांतरित करने वाले दस्तावेजों का पंजीकरण अनिवार्य करती है।',
  },

  // ---------------------------------------------------------------------
  // Property — inheritance
  // ---------------------------------------------------------------------
  {
    topicKey: 'property-inheritance',
    status: 'Valid',
    title: 'Inheritance and succession: who inherits property',
    category: 'Property',
    language: 'English',
    sourceStatute:
      'Hindu Succession Act, 1956: sections 6, 8 and 15; Indian Succession Act, 1925: sections 211, 212 and 213',
    plainSummary:
      'When a person dies without a will (intestate), the property passes under the personal law that applies to them. For Hindus, the Hindu Succession Act, 1956 governs; since the 2005 amendment, a daughter is a coparcener by birth in joint Hindu family property and has the same rights as a son. On a death, Class I heirs — spouse, children, mother and specified relatives — take first, and the schedule to the Act sets out the shares.\n\nA will lets a person choose who receives their property, subject to maintenance rights and rules in the applicable law. A will should be signed and attested by two witnesses; registration is optional but helps prove it. For some communities and for property in certain states, the Indian Succession Act, 1925 or local laws apply, and probate or letters of administration may be needed before a bank or registrar acts.\n\nMutation of revenue records after a death records possession for tax purposes; it does not by itself decide ownership. A legal heir certificate, death certificate and the family tree are commonly asked for. Disputes are often resolved by a family settlement deed, but get it drafted properly.\n\nThis is general information. Inheritance depends on religion, the type of property and the state; consult a lawyer before distributing assets.',
    sourceExcerpt:
      'Section 6 of the Hindu Succession Act, 1956 deals with devolution of interest in coparcenary property and treats a daughter as a coparcener; section 8 sets out the general rules of succession and the Class I heirs; section 15 governs succession to the property of a female Hindu. The Indian Succession Act, 1925 applies to wills and to intestate succession for communities it covers.',
  },
  {
    topicKey: 'property-inheritance',
    status: 'Valid',
    title: 'विरासत और उत्तराधिकार: संपत्ति किसे मिलती है',
    category: 'Property',
    language: 'Hindi',
    sourceStatute:
      'हिंदू उत्तराधिकार अधिनियम, 1956: धारा 6, 8 और 15; भारतीय उत्तराधिकार अधिनियम, 1925: धारा 211, 212 और 213',
    plainSummary:
      'जब किसी व्यक्ति की मृत्यु बिना वसीयत के होती है, तो संपत्ति उस व्यक्ति पर लागू व्यक्तिगत कानून के अनुसार हस्तांतरित होती है। हिंदुओं के लिए हिंदू उत्तराधिकार अधिनियम, 1956 लागू होता है; 2005 के संशोधन के बाद बेटी जन्म से ही हिंदू संयुक्त परिवार की संपत्ति में सहदायिक है और उसके अधिकार बेटे के समान हैं। मृत्यु पर प्रथम श्रेणी के उत्तराधिकारी — पति या पत्नी, बच्चे, माता और अधिनियम में निर्दिष्ट संबंधी — पहले अधिकार पाते हैं, और अधिनियम की अनुसूची हिस्से तय करती है।\n\nवसीयत से व्यक्ति चुन सकता है कि संपत्ति किसे मिले, लेकिन लागू कानून में भरण-पोषण के अधिकार और नियम लागू रहते हैं। वसीयत पर हस्ताक्षर होने चाहिए और दो गवाहों से सत्यापित होनी चाहिए; पंजीकरण वैकल्पिक है पर साबित करने में मदद करता है। कुछ समुदायों और कुछ राज्यों की संपत्ति के लिए भारतीय उत्तराधिकार अधिनियम, 1925 या स्थानीय कानून लागू होते हैं, और बैंक या रजिस्ट्रार की कार्रवाई से पहले प्रोबेट या प्रशासन पत्र की जरूरत हो सकती है।\n\nमृत्यु के बाद राजस्व रिकॉर्ड में दर्ज नाम कर वसूली के लिए कब्जा दर्ज करता है; यह अपने आप मालिकाना तय नहीं करता। कानूनी उत्तराधिकारी प्रमाणपत्र, मृत्यु प्रमाणपत्र और वंशावली सामान्यतः माँगी जाती है। विवाद अक्सर पारिवारिक समझौता विलेख से सुलझते हैं, पर उसे ठीक से तैयार कराएँ।\n\nयह सामान्य जानकारी है। विरासत धर्म, संपत्ति के प्रकार और राज्य पर निर्भर करती है; संपत्ति बाँटने से पहले वकील से सलाह लें।',
    sourceExcerpt:
      'हिंदू उत्तराधिकार अधिनियम, 1956 की धारा 6 सहदायिक संपत्ति में हित के हस्तांतरण और बेटी को सहदायिक मानने से संबंधित है; धारा 8 उत्तराधिकार के सामान्य नियम और प्रथम श्रेणी के उत्तराधिकारी बताती है; धारा 15 हिंदू महिला की संपत्ति के उत्तराधिकार को नियंत्रित करती है। भारतीय उत्तराधिकार अधिनियम, 1925 वसीयत और उसके दायरे वाले समुदायों के बिना वसीयत उत्तराधिकार पर लागू होता है।',
  },

  // ---------------------------------------------------------------------
  // Criminal law — FIR
  // ---------------------------------------------------------------------
  {
    topicKey: 'bns-fir',
    status: 'Valid',
    title: 'How to file an FIR under the new criminal law (BNS 2023)',
    category: 'Criminal Law (BNS 2023)',
    language: 'English',
    sourceStatute:
      'Bharatiya Nagarik Suraksha Sanhita, 2023: sections 173, 174, 175 and 193; Bharatiya Nyaya Sanhita, 2023',
    plainSummary:
      'An FIR (First Information Report) is the first written record of a cognizable offence — an offence for which the police can investigate without a magistrates order. From 1 July 2024 the Bharatiya Nagarik Suraksha Sanhita, 2023 replaced the Code of Criminal Procedure, and the Bharatiya Nyaya Sanhita, 2023 replaced the Indian Penal Code. The procedure for giving information is now in section 173 BNSS.\n\nGo to the police station with jurisdiction, or any police station for a zero FIR, which is then sent to the right station. Give the facts in writing, sign it, and ask for a free copy of the FIR; the police must register a cognizable offence and give you the copy. For some offences, an electronic FIR is allowed with the physical signature taken later. If the police refuse to register, you can send the information in writing to the Superintendent of Police, and a Magistrate can also order an investigation under section 175(3) BNSS.\n\nKeep the FIR copy, the complaint receipt and any evidence. A non-cognizable offence is recorded in a different register and needs a magistrates direction for investigation. Do not exaggerate or leave out facts; a false complaint has consequences.\n\nThis is general information. For a serious offence or if the police do not act, consult a lawyer promptly.',
    sourceExcerpt:
      'Section 173 of the BNSS, 2023 deals with information in cognizable cases, including the free copy of the FIR and electronic registration in specified cases; section 174 deals with non-cognizable cases; section 175(3) allows a Magistrate to order investigation; section 193 requires a police report on completion of investigation.',
  },
  {
    topicKey: 'bns-fir',
    status: 'Valid',
    title: 'नए आपराधिक कानून (बीएनएस 2023) के तहत एफआईआर कैसे दर्ज करें',
    category: 'Criminal Law (BNS 2023)',
    language: 'Hindi',
    sourceStatute:
      'भारतीय नागरिक सुरक्षा संहिता, 2023: धारा 173, 174, 175 और 193; भारतीय न्याय संहिता, 2023',
    plainSummary:
      'एफआईआर (प्रथम सूचना रिपोर्ट) संज्ञेय अपराध की पहली लिखित रिपोर्ट है — ऐसा अपराध जिसकी जाँच पुलिस मजिस्ट्रेट के आदेश के बिना कर सकती है। 1 जुलाई 2024 से भारतीय नागरिक सुरक्षा संहिता, 2023 ने दंड प्रक्रिया संहिता का और भारतीय न्याय संहिता, 2023 ने भारतीय दंड संहिता का स्थान लिया। सूचना देने की प्रक्रिया अब बीएनएसएस की धारा 173 में है।\n\nअपने क्षेत्र के थाने जाएँ, या जीरो एफआईआर के लिए किसी भी थाने में, जिसे सही थाने भेजा जाता है। तथ्य लिखित में दें, हस्ताक्षर करें और एफआईआर की मुफ्त प्रति माँगें; संज्ञेय अपराध दर्ज करना और आपको प्रति देना पुलिस का कर्तव्य है। कुछ अपराधों में इलेक्ट्रॉनिक एफआईआर की अनुमति है और बाद में भौतिक हस्ताक्षर लिए जाते हैं। यदि पुलिस दर्ज करने से मना करे, तो सूचना लिखित में पुलिस अधीक्षक को भेजें, और मजिस्ट्रेट भी बीएनएसएस की धारा 175(3) के तहत जाँच का आदेश दे सकता है।\n\nएफआईआर की प्रति, शिकायत की पावती और सबूत संभालकर रखें। असंज्ञेय अपराध अलग रजिस्टर में दर्ज होता है और जाँच के लिए मजिस्ट्रेट के निर्देश की जरूरत होती है। तथ्य बढ़ा-चढ़ाकर न बताएँ और न छिपाएँ; झूठी शिकायत के परिणाम होते हैं।\n\nयह सामान्य जानकारी है। गंभीर अपराध या पुलिस के कार्रवाई न करने पर तुरंत वकील से सलाह लें।',
    sourceExcerpt:
      'बीएनएसएस, 2023 की धारा 173 संज्ञेय मामलों में सूचना, एफआईआर की मुफ्त प्रति और निर्दिष्ट मामलों में इलेक्ट्रॉनिक पंजीकरण से संबंधित है; धारा 174 असंज्ञेय मामलों से; धारा 175(3) मजिस्ट्रेट को जाँच का आदेश देने की अनुमति देती है; धारा 193 जाँच पूरी होने पर पुलिस रिपोर्ट की माँग करती है।',
  },

  // ---------------------------------------------------------------------
  // Criminal law — bail
  // ---------------------------------------------------------------------
  {
    topicKey: 'bns-bail',
    status: 'Valid',
    title: 'Bail basics: how release works under the BNSS 2023',
    category: 'Criminal Law (BNS 2023)',
    language: 'English',
    sourceStatute:
      'Bharatiya Nagarik Suraksha Sanhita, 2023: Chapter XXXV (bail and bonds), including section 482 (anticipatory bail) and section 187 (default bail)',
    plainSummary:
      'Bail is the release of an accused person while the case continues, usually with conditions and a bond. Offences are either bailable (bail is a right) or non-bailable (the court decides). For a non-bailable offence, a lawyer applies to the Magistrate or Sessions Court, showing the accuseds roots in the community, cooperation with investigation, and the nature of the allegation. Bail is not a finding of innocence.\n\nAnticipatory bail under section 482 BNSS lets a person who fears arrest apply to the Court of Session or the High Court before arrest. If investigation is not completed within the prescribed period (generally 60 or 90 days, depending on the offence), section 187 BNSS gives a right to default bail unless a chargesheet has been filed. Conditions can include sureties, passport deposit, reporting to the police station and not contacting witnesses.\n\nNever miss a court date or violate a bail condition; that can lead to cancellation. If the accused cannot afford a lawyer, free legal aid is available through the District Legal Services Authority. A surety must be able to show the required documents and accept responsibility.\n\nThis is general information and not a prediction of any outcome. Bail law is technical; engage a criminal lawyer as early as possible.',
    sourceExcerpt:
      'Chapter XXXV of the BNSS, 2023 consolidates the bail provisions. Section 482 provides for anticipatory bail; section 187 deals with the procedure when investigation cannot be completed within twenty-four hours and the right to default bail after the prescribed period; courts may impose conditions under the bail provisions.',
  },
  {
    topicKey: 'bns-bail',
    status: 'Valid',
    title: 'जमानत की मूल बातें: बीएनएसएस 2023 के तहत रिहाई कैसे होती है',
    category: 'Criminal Law (BNS 2023)',
    language: 'Hindi',
    sourceStatute:
      'भारतीय नागरिक सुरक्षा संहिता, 2023: अध्याय XXXV (जमानत और बांड), जिसमें धारा 482 (अग्रिम जमानत) और धारा 187 (डिफ़ॉल्ट जमानत) शामिल हैं',
    plainSummary:
      'जमानत आरोपी की रिहाई है जबकि मामला चलता रहता है, आम तौर पर शर्तों और बांड के साथ। अपराध जमानती (जमानत अधिकार है) या गैर-जमानती (अदालत तय करती है) होते हैं। गैर-जमानती अपराध में वकील मजिस्ट्रेट या सत्र न्यायालय में आवेदन करता है, जिसमें आरोपी का समुदाय में जुड़ाव, जाँच में सहयोग और आरोप की प्रकृति दिखाई जाती है। जमानत निर्दोषता का फैसला नहीं है।\n\nबीएनएसएस की धारा 482 के तहत अग्रिम जमानत में गिरफ्तारी की आशंका वाला व्यक्ति गिरफ्तारी से पहले सत्र न्यायालय या उच्च न्यायालय में आवेदन कर सकता है। यदि निर्धारित अवधि (अपराध के अनुसार सामान्यतः 60 या 90 दिन) में जाँच पूरी न हो, तो धारा 187 बीएनएसएस डिफ़ॉल्ट जमानत का अधिकार देती है, जब तक आरोप पत्र दायर न हो चुका हो। शर्तों में जमानतदार, पासपोर्ट जमा, थाने में उपस्थिति और गवाहों से संपर्क न करना शामिल हो सकता है।\n\nअदालत की तारीख न चूकें और जमानत की शर्त न तोड़ें; इससे जमानत रद्द हो सकती है। यदि आरोपी वकील का खर्च नहीं उठा सकता, तो जिला विधिक सेवा प्राधिकरण से मुफ्त कानूनी सहायता मिलती है। जमानतदार को आवश्यक दस्तावेज दिखाने और जिम्मेदारी स्वीकार करने की क्षमता होनी चाहिए।\n\nयह सामान्य जानकारी है और किसी परिणाम का अनुमान नहीं। जमानत कानून तकनीकी है; आपराधिक वकील से जल्द से जल्द सलाह लें।',
    sourceExcerpt:
      'बीएनएसएस, 2023 का अध्याय XXXV जमानत के प्रावधानों को समेकित करता है। धारा 482 अग्रिम जमानत का प्रावधान देती है; धारा 187 उस स्थिति से संबंधित है जब जाँच चौबीस घंटे में पूरी नहीं हो सकती और निर्धारित अवधि के बाद डिफ़ॉल्ट जमानत का अधिकार देती है; अदालतें जमानत प्रावधानों के तहत शर्तें लगा सकती हैं।',
  },

  // ---------------------------------------------------------------------
  // Traffic & Motor Vehicles — accidents and insurance
  // ---------------------------------------------------------------------
  {
    topicKey: 'traffic-accident-insurance',
    status: 'Valid',
    title: 'Road accidents: insurance claims and compensation',
    category: 'Traffic & Motor Vehicles',
    language: 'English',
    sourceStatute:
      'Motor Vehicles Act, 1988: sections 140, 161, 164, 166 and 168; Motor Vehicles (Amendment) Act, 2019',
    plainSummary:
      'If you are in a road accident, safety comes first: call 112 or 108, get medical help, and note the vehicles, numbers and witnesses. Every motor vehicle on a public road must have at least third-party insurance. Inform your insurer and the police promptly, and keep the FIR, medical papers, repair estimates, bills and photographs.\n\nA claim for compensation for death or injury is decided by the Motor Accident Claims Tribunal (MACT) under section 166 of the Motor Vehicles Act, 1988. The tribunal can award compensation for loss of income, treatment, pain and suffering, and other heads. Section 164 provides a no-fault compensation route with fixed amounts for death and grievous hurt, and section 161 deals with hit-and-run cases through the solatium scheme. The 2019 amendment raised several penalties and introduced faster claim processes.\n\nDo not settle with the insurer or the other driver without legal advice, especially where injury is serious. An insurer may dispute liability or the amount; the tribunal decides. Keep track of dates because delay can affect evidence.\n\nThis is general information. For a serious injury, a death or a disputed claim, consult a lawyer and do not sign a release you do not understand.',
    sourceExcerpt:
      'Section 140 provides interim compensation in certain cases; section 161 provides a solatium scheme for hit-and-run victims; section 164 provides no-fault compensation; section 166 allows an application to the Motor Accident Claims Tribunal, which decides compensation under section 168.',
  },
  {
    topicKey: 'traffic-accident-insurance',
    status: 'Valid',
    title: 'सड़क दुर्घटना: बीमा दावा और मुआवजा',
    category: 'Traffic & Motor Vehicles',
    language: 'Hindi',
    sourceStatute:
      'मोटर वाहन अधिनियम, 1988: धारा 140, 161, 164, 166 और 168; मोटर वाहन (संशोधन) अधिनियम, 2019',
    plainSummary:
      'सड़क दुर्घटना में सबसे पहले सुरक्षा: 112 या 108 पर कॉल करें, चिकित्सा सहायता लें, और वाहन, नंबर तथा गवाहों के विवरण नोट करें। सार्वजनिक सड़क पर हर मोटर वाहन के लिए कम से कम तृतीय-पक्ष बीमा अनिवार्य है। बीमा कंपनी और पुलिस को जल्द सूचित करें, और एफआईआर, चिकित्सा कागजात, मरम्मत अनुमान, बिल और तस्वीरें रखें।\n\nमृत्यु या चोट के मुआवजे का दावा मोटर वाहन अधिनियम, 1988 की धारा 166 के तहत मोटर दुर्घटना दावा अधिकरण तय करता है। अधिकरण आय के नुकसान, इलाज, दर्द और कष्ट तथा अन्य मदों पर मुआवजा दे सकता है। धारा 164 मृत्यु और गंभीर चोट के लिए निर्धारित राशि के साथ दोष-रहित मुआवजे का रास्ता देती है, और धारा 161 सोलेटियम योजना के जरिए हिट-एंड-रन मामलों से संबंधित है। 2019 के संशोधन ने कई दंड बढ़ाए और दावों की तेज प्रक्रिया शुरू की।\n\nगंभीर चोट की स्थिति में बीमा कंपनी या दूसरे चालक से कानूनी सलाह के बिना समझौता न करें। बीमा कंपनी दायित्व या राशि पर विवाद कर सकती है; अधिकरण फैसला करता है। तारीखों का रिकॉर्ड रखें क्योंकि देरी सबूत को प्रभावित कर सकती है।\n\nयह सामान्य जानकारी है। गंभीर चोट, मृत्यु या विवादित दावे में वकील से सलाह लें और बिना समझे किसी रिलीज पर हस्ताक्षर न करें।',
    sourceExcerpt:
      'धारा 140 कुछ मामलों में अंतरिम मुआवजा देती है; धारा 161 हिट-एंड-रन पीड़ितों के लिए सोलेटियम योजना देती है; धारा 164 दोष-रहित मुआवजा देती है; धारा 166 मोटर दुर्घटना दावा अधिकरण में आवेदन की अनुमति देती है, जो धारा 168 के तहत मुआवजा तय करता है।',
  },

  // ---------------------------------------------------------------------
  // Consumer Rights — online shopping
  // ---------------------------------------------------------------------
  {
    topicKey: 'consumer-ecommerce',
    status: 'Valid',
    title: 'Online shopping problems: refunds, returns and e-commerce rules',
    category: 'Consumer Rights',
    language: 'English',
    sourceStatute: 'Consumer Protection Act, 2019; Consumer Protection (E-Commerce) Rules, 2020',
    plainSummary:
      'When you buy from an online marketplace, the Consumer Protection Act, 2019 and the E-Commerce Rules, 2020 give you rights against the seller and, in some situations, the platform. An e-commerce entity must display the sellers identity and contact details, the return, refund and warranty policy, and the grievance officers details. It must acknowledge a complaint within 48 hours and try to resolve it within one month.\n\nIf a product is defective, different from what was described, or never delivered, first raise it with the platform and seller in writing and keep the order id, invoice, chat and photographs. A payment dispute can also be raised with your bank or card network. If it is not resolved, file a consumer complaint before the District Commission; e-Daakhil is the online filing portal. Complaints are normally filed within two years.\n\nThe platform is not automatically liable for every seller, but it must follow due diligence and takedown rules. Do not accept a refund as a coupon if you are entitled to money back, and read the return window before ordering.\n\nThis is general information. For a large amount or a fraud allegation, consult a lawyer.',
    sourceExcerpt:
      'The Consumer Protection (E-Commerce) Rules, 2020 require e-commerce entities to display seller details, return and refund policies and grievance officer information, and to acknowledge complaints within 48 hours and resolve them within one month. The Consumer Protection Act, 2019 provides the complaint mechanism before the consumer commissions.',
  },
  {
    topicKey: 'consumer-ecommerce',
    status: 'Valid',
    title: 'ऑनलाइन खरीदारी की समस्या: रिफंड, वापसी और ई-कॉमर्स नियम',
    category: 'Consumer Rights',
    language: 'Hindi',
    sourceStatute: 'उपभोक्ता संरक्षण अधिनियम, 2019; उपभोक्ता संरक्षण (ई-कॉमर्स) नियम, 2020',
    plainSummary:
      'ऑनलाइन मार्केटप्लेस से खरीदते समय उपभोक्ता संरक्षण अधिनियम, 2019 और ई-कॉमर्स नियम, 2020 आपको विक्रेता और कुछ स्थितियों में प्लेटफॉर्म के खिलाफ अधिकार देते हैं। ई-कॉमर्स इकाई को विक्रेता की पहचान और संपर्क, वापसी, रिफंड और वारंटी नीति, तथा शिकायत अधिकारी का विवरण दिखाना होता है। शिकायत 48 घंटे में स्वीकार करनी होती है और एक माह में हल करने का प्रयास करना होता है।\n\nयदि सामान खराब है, विवरण से अलग है, या पहुँचा ही नहीं, तो पहले प्लेटफॉर्म और विक्रेता से लिखित में शिकायत करें और ऑर्डर आईडी, इनवॉइस, चैट और तस्वीरें रखें। भुगतान विवाद बैंक या कार्ड नेटवर्क के पास भी उठाया जा सकता है। न सुलझने पर जिला आयोग में उपभोक्ता शिकायत दायर करें; e-Daakhil ऑनलाइन पोर्टल है। शिकायत सामान्यतः दो वर्ष के भीतर दायर की जाती है।\n\nप्लेटफॉर्म हर विक्रेता के लिए अपने आप जिम्मेदार नहीं होता, लेकिन उसे ड्यू डिलिजेंस और सामग्री हटाने के नियमों का पालन करना होता है। यदि आपको पैसा वापस मिलना चाहिए तो कूपन को रिफंड के रूप में स्वीकार न करें, और ऑर्डर से पहले वापसी की अवधि पढ़ें।\n\nयह सामान्य जानकारी है। बड़ी राशि या धोखाधड़ी के आरोप में वकील से सलाह लें।',
    sourceExcerpt:
      'उपभोक्ता संरक्षण (ई-कॉमर्स) नियम, 2020 ई-कॉमर्स इकाइयों को विक्रेता विवरण, वापसी और रिफंड नीति तथा शिकायत अधिकारी की जानकारी दिखाने, 48 घंटे में शिकायत स्वीकार करने और एक माह में हल करने की माँग करते हैं। उपभोक्ता संरक्षण अधिनियम, 2019 उपभोक्ता आयोगों के समक्ष शिकायत का तंत्र देता है।',
  },

  // ---------------------------------------------------------------------
  // Curator work queue: drafts awaiting validation
  // ---------------------------------------------------------------------
  {
    topicKey: 'labour-maternity',
    status: 'Draft',
    title: 'Maternity benefits: leave and pay during pregnancy',
    category: 'Labour & Employment',
    language: 'English',
    sourceStatute: 'Maternity Benefit Act, 1961: sections 4, 5, 6, 12 and 27',
    plainSummary:
      'The Maternity Benefit Act, 1961 applies to establishments covered by it. Eligible women workers are entitled to paid maternity leave, a medical bonus, and protection from dismissal during maternity leave. The 2017 amendment increased the leave period to 26 weeks for most women, with different rules for adoptive and commissioning mothers. A woman may also be entitled to lighter work or leave on medical advice.\n\nTo claim the benefit, inform your employer in writing with the expected date of delivery and provide the medical certificate the rules require. Keep copies of your appointment letter, salary slips and the notice. If the employer refuses, a complaint can be made to the labour authority.\n\nThis draft is being reviewed by a curator and is not yet published. For your own case, consult a lawyer.',
    sourceExcerpt:
      'Section 4 provides maternity benefit; section 5 sets the rate of benefit; section 6 deals with notice; section 12 protects a woman from dismissal during maternity leave; section 27 provides for forfeiture of benefit in specified cases.',
  },
  {
    topicKey: 'cyber-upi',
    status: 'Draft',
    title: 'UPI fraud and chargebacks: a step-by-step complaint',
    category: 'Cyber & Online Fraud',
    language: 'English',
    sourceStatute:
      'Information Technology Act, 2000: sections 66C and 66D; RBI circular on unauthorised electronic transactions (2017)',
    plainSummary:
      'If a UPI payment is made without your authorisation, report it immediately through your bank or UPI app, call 1930 and file a complaint on cybercrime.gov.in. Ask for a written complaint number and block the linked device or SIM if it is compromised.\n\nThe RBI 2017 circular on customer protection limits your liability when an unauthorised transaction is reported promptly. The bank may ask for a written declaration and a police complaint. Keep the transaction id, screenshots and the banks responses.\n\nThis draft is awaiting curator review. Do not share your UPI PIN or OTP with anyone, including a caller claiming to be from the bank.',
    sourceExcerpt:
      'The RBI circular of 6 July 2017 on customer protection limits customer liability for unauthorised electronic transactions when the fraud is reported within the specified time. Sections 66C and 66D of the Information Technology Act, 2000 punish identity theft and cheating by personation.',
  },
  {
    topicKey: 'property-mutation',
    status: 'Draft',
    title: 'Property mutation after a sale or death: what it does',
    category: 'Property',
    language: 'English',
    sourceStatute: 'State land revenue laws and municipal records; Registration Act, 1908: section 17',
    plainSummary:
      'Mutation is the updating of revenue or municipal records to show who is in possession and who pays the tax. It is an administrative step, not a substitute for a registered sale deed or a succession certificate. A buyer should apply for mutation after registration; an heir should apply after a death with the death certificate and proof of succession.\n\nRules and forms differ by state. Check the local tehsil or municipal office for the current process and keep the receipt. If a mutation is refused or a name is wrongly entered, an appeal or correction application is usually available.\n\nThis draft is awaiting curator review and is not yet published.',
    sourceExcerpt:
      'Mutation entries in revenue records are made under state land revenue laws and municipal rules. They record possession for revenue purposes and do not by themselves confer title, which depends on a registered transfer or succession.',
  },

  // ---------------------------------------------------------------------
  // Flagged for re-validation after a legislative/administrative change
  // ---------------------------------------------------------------------
  {
    topicKey: 'traffic-fine-update',
    status: 'Requires AI Update',
    title: 'Updated traffic fines: checking the amount that applies to you',
    category: 'Traffic & Motor Vehicles',
    language: 'English',
    sourceStatute: 'Motor Vehicles Act, 1988 (as amended in 2019); state notifications under section 200',
    plainSummary:
      'Traffic penalties were increased by the Motor Vehicles (Amendment) Act, 2019, but the exact amount for many offences is notified by the state government. The figure on your challan, or the state transport departments published schedule, is the one that applies. Do not rely on an old printed list.\n\nCheck the challan on the Parivahan or state portal, match the section and the vehicle type, and keep the receipt. If the amount looks wrong, ask the traffic court or the issuing office rather than paying twice.\n\nThis guide is flagged for an AI update because state fine schedules change. A curator will re-validate it before it is shown again.',
    sourceExcerpt:
      'The Motor Vehicles (Amendment) Act, 2019 amended penalties in the Motor Vehicles Act, 1988, including sections 177, 185 and 194B. State governments notify the amounts that apply within their jurisdiction.',
  },
  {
    topicKey: 'rti-online-portal',
    status: 'Requires AI Update',
    title: 'आरटीआई ऑनलाइन पोर्टल: आवेदन और अपील की प्रक्रिया',
    category: 'RTI',
    language: 'Hindi',
    sourceStatute: 'सूचना का अधिकार अधिनियम, 2005: धारा 6, 7 और 19; राज्य आरटीआई पोर्टल नियम',
    plainSummary:
      'कई राज्य और केंद्रीय विभाग अब आरटीआई आवेदन ऑनलाइन स्वीकार करते हैं। पोर्टल पर सही लोक प्राधिकरण चुनें, माँगी गई सूचना को क्रमांकित बिंदुओं में लिखें, शुल्क ऑनलाइन भरें और भुगतान की पावती सहेजें। आवेदन की प्रति और पंजीकरण संख्या रखें।\n\nजवाब न मिलने या अधूरा मिलने पर 30 दिनों के भीतर प्रथम अपील और उसके बाद सूचना आयोग में द्वितीय अपील की जा सकती है। पोर्टल की प्रक्रिया राज्य के अनुसार बदलती है।\n\nयह गाइड AI अपडेट के लिए चिह्नित है क्योंकि पोर्टल प्रक्रियाएँ बदलती रहती हैं। क्यूरेटर दोबारा सत्यापन के बाद ही इसे प्रकाशित करेंगे।',
    sourceExcerpt:
      'सूचना का अधिकार अधिनियम, 2005 की धारा 6 आवेदन की प्रक्रिया, धारा 7 जवाब की समय-सीमा और धारा 19 प्रथम तथा द्वितीय अपील का प्रावधान देती है। ऑनलाइन पोर्टल की प्रक्रिया राज्य स्तर पर भिन्न होती है।',
  },
];
