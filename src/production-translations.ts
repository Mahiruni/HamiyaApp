const en = {
  navOrders: 'Orders',
  navProfile: 'Profile',
  add: 'Increase quantity',
  quantityInvalid: 'Enter a whole number of at least 20 cartons, within available stock.',
  startupFailed: 'HAMIYA could not connect. Check your connection, then try again.',
  screenLoadFailed: 'This screen is taking too long to load. Check your connection and try again.',
  sheetSize: 'Adjust product sheet size',
  sheetCompact: 'Compact product details',
  sheetStandard: 'Product details',
  sheetExpanded: 'Expanded product details',
  secureUpdateHint: 'Install the signed Android update to continue receiving secure releases.',
};
export const productionCopy = {
  en,
  am: {
    navOrders: 'ትዕዛዞች',
    navProfile: 'መገለጫ',
    add: 'ብዛት ጨምር',
    quantityInvalid: 'ቢያንስ 20 ካርቶን እና ካለው ክምችት ያልበለጠ ሙሉ ቁጥር ያስገቡ።',
    startupFailed: 'ሀሚያ መገናኘት አልቻለም። ግንኙነትዎን ያረጋግጡና እንደገና ይሞክሩ።',
    screenLoadFailed: 'ይህ ገጽ ለመጫን እየዘገየ ነው። ግንኙነትዎን ያረጋግጡና እንደገና ይሞክሩ።',
    sheetSize: 'የምርት ዝርዝር መጠን ያስተካክሉ',
    sheetCompact: 'አጭር የምርት ዝርዝር',
    sheetStandard: 'የምርት ዝርዝር',
    sheetExpanded: 'የተስፋፋ የምርት ዝርዝር',
    secureUpdateHint: 'ደህንነቱ የተጠበቀ ማሻሻያ ለማግኘት የተፈረመውን የአንድሮይድ ማሻሻያ ይጫኑ።',
  },
  om: {
    navOrders: 'Ajajawwan',
    navProfile: 'Piroofaayilii',
    add: 'Baayʼina dabali',
    quantityInvalid:
      'Lakkoofsa guutuu kaartoonii yoo xiqqaate 20, kan kuusaa jiru hin caalle galchi.',
    startupFailed:
      'HAMIYA walqunnamuu hin dandeenye. Walqunnamtii kee mirkaneessiitii irra deebiʼii yaali.',
    screenLoadFailed:
      'Fuulli kun feʼamuuf yeroo dheeraa fudhachaa jira. Walqunnamtii kee mirkaneessiitii irra deebiʼii yaali.',
    sheetSize: 'Hammamtaa ibsa oomishaa sirreessi',
    sheetCompact: 'Ibsa oomishaa gabaabaa',
    sheetStandard: 'Ibsa oomishaa',
    sheetExpanded: 'Ibsa oomishaa balʼaa',
    secureUpdateHint: 'Haaromsa nageenya qabu argachuuf haaromsa Andirooyidii mallatteeffame feʼi.',
  },
} satisfies Record<string, Record<keyof typeof en, string>>;
