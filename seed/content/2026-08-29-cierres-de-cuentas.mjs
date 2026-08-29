// Nota editorial sembrada desde el repo (ver scripts/embed-schema.mjs).
// Firma: Andreea Blidar · Sección: Economía · Redacción asistida por IA (marcada).
//
// NOTA EDITORIAL IMPORTANTE, para quien vuelva a este archivo:
// El tema llegó como «Bank of America cierra cuentas por ser latinos». Esa versión concreta, la que
// se hizo viral en 2025, es un BULO desmentido por Factchequeado y por el propio banco. Publicarla
// como cierta habría sido difamación, y además habría hecho daño: quien se lo cree saca su dinero
// en pánico y no se defiende de lo que sí le está pasando.
// Lo que sí está documentado es más grave y más útil: una ola real de cierres sin explicación
// (20.682 quejas al CFPB en seis meses), una multa de 225 millones de dólares a Bank of America por
// congelar cuentas ilegalmente, una demanda viva por cierres discriminatorios, y una lista opaca
// —ChexSystems— que deja a la gente cinco años sin banco. Cada dato de esta nota está enlazado a su
// fuente. No se añade nada que no esté probado.
export default {
  id: "2026-08-29-cierres-de-cuentas",
  article: {
    id: "art-2026-08-29-cierres-de-cuentas",
    section_id: "economia",
    author_id: "andreea-blidar",
    status: "published",
    kind: "news",
    origin: "editorial",
    ai_assisted: 1,
    published_at: "2026-08-29T18:00:00.000Z",
    updated_at: "2026-08-29T18:00:00.000Z",
    sources: [
      {
        title:
          "CFPB — Federal Regulators Fine Bank of America $225 Million Over Botched Disbursement of State Unemployment Benefits",
        url: "https://www.consumerfinance.gov/about-us/newsroom/federal-regulators-fine-bank-of-america-225-million-over-botched-disbursement-of-state-unemployment-benefits-at-height-of-pandemic/",
      },
      {
        title: "American Banker — As banks close accounts, experts point to immigration crackdown",
        url: "https://www.americanbanker.com/news/as-banks-close-accounts-experts-point-to-immigration-crackdown",
      },
      {
        title:
          "Factchequeado / Enlace Latino NC — No, Bank of America no está congelando ni cerrando las cuentas de inmigrantes",
        url: "https://enlacelatinonc.org/en/No--Bank-of-America-is-not-freezing-or-closing-immigrants'-accounts./",
      },
      {
        title: "ChexSystems — Summary of Rights (FCRA)",
        url: "https://www.chexsystems.com/-/media/Project/ChexSystems/ChexSystems/PDF/SummaryofRights.pdf",
      },
      {
        title: "ChexSystems — Preguntas frecuentes",
        url: "https://www.chexsystems.com/answers-to-frequently-asked-questions",
      },
      {
        title: "CFPB — Chex Systems, Inc. (ficha de agencia de reportes al consumidor)",
        url: "https://www.consumerfinance.gov/consumer-tools/credit-reports-and-scores/consumer-reporting-companies/companies-list/chex-systems/",
      },
      {
        title:
          "Migliaccio & Rathod LLP — Nia v. Bank of America: demanda colectiva por cierres discriminatorios",
        url: "https://classlawdc.com/2022/05/09/bank-of-america-discrimination-against-non-citizens-class-action-lawsuit/",
      },
      {
        title: "Departamento del Tesoro de EE. UU. — Estrategia sobre de-risking (2023)",
        url: "https://home.treasury.gov/system/files/136/Treasury_AMLA_23_508.pdf",
      },
    ],
  },
  i18n: {
    es: {
      slug: "cierres-de-cuentas-bancarias-inmigrantes-estados-unidos-chexsystems-bank-of-america",
      title:
        "20.682 quejas en seis meses: la ola de cierres de cuentas bancarias que golpea a los inmigrantes en Estados Unidos",
      excerpt:
        "El banco cierra tu cuenta, no te dice por qué y la ley le prohíbe decírtelo. Miles de personas están pasando por eso ahora mismo en Estados Unidos, y muchas terminan en una lista privada que las deja cinco años sin poder abrir otra. Esto es lo que está documentado, lo que es mentira, y lo que puedes hacer.",
      meta_title: "Cierres de cuentas bancarias e inmigrantes en EE. UU.: qué está pasando de verdad",
      meta_description:
        "20.682 quejas al CFPB en seis meses por cierres de cuentas sin explicación, 225 millones de multa a Bank of America y la lista ChexSystems que deja cinco años sin banco. Qué es cierto, qué es bulo y cómo defenderte.",
      tags: [
        "bancos",
        "inmigrantes",
        "Bank of America",
        "ChexSystems",
        "CFPB",
        "Estados Unidos",
        "derechos del consumidor",
      ],
      content_html: `
<p>La carta llega por correo y cabe en un párrafo. El banco ha decidido cerrar su cuenta. Tiene treinta días. No hay un número al que llamar para discutirlo, no hay una explicación, y si usted va a la sucursal el cajero le dirá —con toda sinceridad— que él tampoco sabe por qué.</p>

<p>Le está pasando a mucha gente. Entre <strong>diciembre de 2025 y mayo de 2026</strong>, la Oficina para la Protección Financiera del Consumidor (CFPB) recibió <strong>20.682 quejas</strong> de personas que se quedaron fuera de su cuenta bancaria sin que nadie les dijera por qué, según el análisis de la firma McCarthy Hatch <a href="https://www.americanbanker.com/news/as-banks-close-accounts-experts-point-to-immigration-crackdown" target="_blank" rel="noopener noreferrer">publicado por American Banker</a>. Fueron 609.000 quejas en total en ese periodo: alrededor de un 3 % eran cierres de cuenta.</p>

<p>Y esa cifra se queda corta a propósito. La mayoría de la gente a la que le cierran una cuenta no escribe una queja federal: cambia de banco y sigue con su vida. «El número de cuentas que se cierran de repente se está disparando», dice Jim McCarthy, presidente de la firma que hizo el conteo.</p>

<h2>Por qué el banco no le explica nada</h2>

<p>Esta es la parte que más rabia da, y conviene entenderla bien porque cambia lo que uno puede hacer.</p>

<p>Cuando un banco cierra una cuenta por sospecha de actividad irregular, presenta un reporte confidencial ante el gobierno. La <strong>Ley de Secreto Bancario</strong> le prohíbe expresamente decirle al cliente que ese reporte existe. No es mala educación ni desprecio: es que el empleado que atiende el teléfono se expone a un delito si se lo cuenta.</p>

<p>El resultado, sin embargo, es el que usted ya conoce: una persona que no ha hecho nada se queda sin acceso a su dinero, sin explicación y con la sensación de ser tratada como delincuente. Casi siempre recupera el saldo, pero puede tardar semanas.</p>

<p>Diane Thompson, del Centro Nacional de Derecho del Consumidor, lo resume así: <em>«En el clima actual hay un deseo de muchas instituciones financieras de sobrecumplir»</em>. Sobrecumplir significa cerrar primero y no preguntar después, porque una multa del regulador cuesta mucho más que perder a un cliente.</p>

<p>El fenómeno tiene nombre en la jerga del sector: <strong>de-risking</strong>, quitarse el riesgo de encima. El propio <a href="https://home.treasury.gov/system/files/136/Treasury_AMLA_23_508.pdf" target="_blank" rel="noopener noreferrer">Departamento del Tesoro reconoció en 2023</a> que es un problema, y que golpea especialmente a los negocios de envío de remesas y a las organizaciones que trabajan con comunidades inmigrantes. Los bancos no cierran cuentas de a una: a veces se van de un mercado entero.</p>

<h2>Lo que sí está probado contra Bank of America</h2>

<p>Aquí no hay que suponer nada, porque hay una orden federal firmada.</p>

<p>En <strong>julio de 2022</strong>, dos reguladores multaron a Bank of America con <strong>225 millones de dólares</strong> —100 millones el CFPB y 125 millones la Oficina del Contralor de la Moneda— por la forma en que manejó las tarjetas de beneficios de desempleo de doce estados durante la pandemia. La <a href="https://www.consumerfinance.gov/about-us/newsroom/federal-regulators-fine-bank-of-america-225-million-over-botched-disbursement-of-state-unemployment-benefits-at-height-of-pandemic/" target="_blank" rel="noopener noreferrer">orden del CFPB</a> describe exactamente lo que mucha gente ha vivido después:</p>

<ul>
<li>Desde el otoño de 2020 y hasta mediados de 2021, el banco <strong>sustituyó las investigaciones de fraude por un filtro automático</strong> que congelaba cuentas con señales muy simples. El regulador escribió que ese filtro «puso un listón muy bajo» y perjudicó a miles de titulares legítimos.</li>
<li>Aplicó el filtro <strong>hacia atrás</strong>, para negar reclamos que ya habían sido investigados.</li>
<li>Puso a la gente en un laberinto para descongelar su dinero: no se podía reportar el problema por internet ni en la sucursal, las esperas al teléfono eran de horas, y se anunciaba una atención «24 horas al día, siete días a la semana» que en realidad no existía.</li>
<li>Mandaba a los clientes de vuelta a la agencia estatal de desempleo de California <strong>sabiendo que estaba desbordada</strong> y no podía atenderlos.</li>
</ul>

<p>«Los contribuyentes confiaron en los bancos para hacer llegar el dinero a las familias y a los pequeños negocios cuando llegó la pandemia», dijo entonces Rohit Chopra, director del CFPB. <em>«Bank of America no estuvo a la altura de sus obligaciones legales»</em>. La orden obligó además a devolver el dinero negado y a pagar una compensación por el tiempo que cada cuenta estuvo congelada, un monto que el propio regulador estimó en «cientos de millones de dólares».</p>

<h2>Y una demanda que sigue viva</h2>

<p>Hay otro frente abierto, y este va justamente sobre cerrar cuentas por el origen de la persona. En la demanda colectiva <strong><em>Nia contra Bank of America</em></strong> (caso 3:21-cv-01799, Distrito Sur de California), un residente permanente de origen iraní alega que el banco le cerró las cuentas pese a haber entregado toda la documentación que le pidieron, y que no fue un caso aislado sino un patrón contra personas de ese origen.</p>

<p>El banco pidió que se desestimara la demanda. El <strong>18 de mayo de 2022</strong>, la jueza Cynthia Bashant <a href="https://classlawdc.com/2022/05/09/bank-of-america-discrimination-against-non-citizens-class-action-lawsuit/" target="_blank" rel="noopener noreferrer">rechazó esa petición</a> y dejó el caso avanzar a la fase de pruebas. Que un juez permita que un caso siga adelante no significa que esté probado, y conviene decirlo con claridad; significa que las acusaciones son lo bastante serias como para obligar al banco a abrir sus archivos.</p>

<h2>Ahora, la parte que hay que decir aunque incomode: el bulo</h2>

<p>En 2025 se hizo viral un video de TikTok —más de <strong>727.000 reproducciones</strong>— en el que una mujer, presentándose como empleada de atención al cliente de Bank of America, aseguraba que el banco estaba congelando y cerrando las cuentas de los inmigrantes y exigiendo comprobar el estatus migratorio. Circuló también por Facebook, Instagram, Reddit y YouTube.</p>

<p><strong>Es falso.</strong> El banco respondió que las afirmaciones eran «completamente falsas», que «no ha habido cambios en nuestra política» y que esa mujer no trabajaba allí. <a href="https://enlacelatinonc.org/en/No--Bank-of-America-is-not-freezing-or-closing-immigrants'-accounts./" target="_blank" rel="noopener noreferrer">Factchequeado revisó el caso</a> y no encontró un solo reporte creíble que lo respaldara.</p>

<p>Y no lo contamos para defender a ningún banco. Lo contamos porque creer el bulo <strong>le hace daño a usted</strong>. Quien se lo cree saca su dinero en efectivo por miedo, deja de usar la cuenta que sí necesita para cobrar su sueldo, y —lo peor— se queda sin ver el problema de verdad, que existe, que está documentado más arriba y que <strong>sí tiene defensas legales</strong>. Un rumor falso sobre un problema real es la forma más eficaz de dejar a la gente indefensa.</p>

<p>Conviene tener claro un punto legal: para abrir una cuenta, la Ley Patriota exige comprobar la identidad —nombre, fecha de nacimiento, dirección y una identificación oficial—, <strong>pero no exige comprobar la ciudadanía</strong>. Millones de personas tienen cuenta con ITIN y con pasaporte extranjero, y eso no ha cambiado. Lo que sí reporta American Banker es que algunos bancos han empezado a negarse a abrir cuentas a quien no tiene número de Seguro Social: eso es una política de cada banco, no una ley.</p>

<h2>ChexSystems: la lista de la que nadie le habló</h2>

<p>Esta es la parte que convierte un mal rato en un problema de años, y la que casi nadie conoce hasta que la sufre.</p>

<p>Cuando un banco cierra una cuenta —sobre todo si quedó en negativo o si hubo sospecha de fraude—, puede reportarlo a <strong>Chex Systems, Inc.</strong>, una agencia privada de reportes al consumidor. Es el equivalente al buró de crédito, pero para cuentas bancarias. Casi todos los bancos la consultan antes de abrirle una cuenta a alguien.</p>

<p>Si usted aparece ahí, le van a negar la cuenta en un banco tras otro sin decirle el motivo. Y ese registro <strong>se queda cinco años</strong>, <a href="https://www.chexsystems.com/answers-to-frequently-asked-questions" target="_blank" rel="noopener noreferrer">según la propia empresa</a>, salvo que quien lo reportó pida quitarlo o la ley obligue a borrarlo.</p>

<p>La buena noticia es que ChexSystems <strong>está regulada</strong>. La Ley de Informes Justos de Crédito (FCRA) le da a usted derechos concretos, y la empresa <a href="https://www.chexsystems.com/-/media/Project/ChexSystems/ChexSystems/PDF/SummaryofRights.pdf" target="_blank" rel="noopener noreferrer">los reconoce por escrito</a>:</p>

<ul>
<li><strong>Su informe, gratis.</strong> Tiene derecho a pedirlo al menos una vez cada doce meses. Y también gratis dentro de los <strong>60 días</strong> siguientes a que le nieguen una cuenta por culpa de ese archivo. Se pide en <a href="https://www.chexsystems.com/request-reports/consumer-disclosure" target="_blank" rel="noopener noreferrer">chexsystems.com</a> o por correo a Consumer Relations, PO Box 583399, Minneapolis, MN 55458.</li>
<li><strong>Disputar lo que esté mal.</strong> Si hay un dato incorrecto o incompleto, usted lo disputa y ellos tienen que investigarlo <strong>gratis y en 30 días</strong>. Quien reportó el dato erróneo está obligado a corregirlo y a avisar a todos los que lo recibieron.</li>
<li><strong>Demandar.</strong> Si ChexSystems reporta información equivocada, la FCRA permite demandarla; y si usted gana, la empresa paga sus honorarios de abogado y las costas. Ese detalle importa: significa que hay abogados dispuestos a tomar el caso sin cobrarle por adelantado.</li>
</ul>

<p>El CFPB mantiene <a href="https://www.consumerfinance.gov/consumer-tools/credit-reports-and-scores/consumer-reporting-companies/companies-list/chex-systems/" target="_blank" rel="noopener noreferrer">una ficha oficial de Chex Systems</a> con los datos de contacto y el procedimiento.</p>

<h2>Si le acaban de cerrar la cuenta</h2>

<p>Orden de lo primero a lo último. No hay que hacerlo todo el mismo día, pero sí en este orden.</p>

<ol>
<li><strong>Saque su dinero y ponga a salvo lo que se cobra solo.</strong> El depósito directo del sueldo, la renta, la luz, el teléfono. Si esos pagos rebotan, el daño se multiplica.</li>
<li><strong>Pida todo por escrito.</strong> Que le confirmen por escrito la fecha del cierre y cómo le devuelven el saldo. No discuta por teléfono: pida papel o correo electrónico.</li>
<li><strong>Pida su informe de ChexSystems.</strong> Es gratis y es lo que le va a explicar por qué el siguiente banco también le dice que no. Hágalo antes de intentar abrir otra cuenta.</li>
<li><strong>Si hay un error, dispútelo.</strong> Por escrito, guardando copia. Tienen 30 días.</li>
<li><strong>Ponga su queja en el CFPB</strong>, en <a href="https://www.consumerfinance.gov/es/" target="_blank" rel="noopener noreferrer">consumerfinance.gov/es</a>. Es gratis, está en español, y el banco está obligado a responder. Esas 20.682 quejas de las que habla esta nota son exactamente eso: gente que dejó constancia. Sin ese registro, para el regulador el problema no existe.</li>
<li><strong>Si le llama un cobrador, conozca la regla.</strong> Cuando una cuenta cierra en negativo, la deuda suele ir a una agencia de cobranza. La <strong>Ley de Prácticas Justas en el Cobro de Deudas</strong> le prohíbe a esa agencia amenazarlo, insultarlo, llamarlo a horas indebidas o decirle que va a ir preso por una deuda de consumo. Puede exigir por escrito que le validen la deuda y que dejen de llamarlo.</li>
<li><strong>Mientras tanto, busque un banco que no lo cierre la puerta.</strong> Muchas cooperativas de crédito comunitarias y las cuentas certificadas como <em>Bank On</em> están pensadas justo para quien viene de un cierre: no cobran sobregiro y varias no consultan ChexSystems.</li>
</ol>

<h2>Por qué esto importa</h2>

<p>Quedarse sin cuenta bancaria en Estados Unidos no es un fastidio: es una condena silenciosa. Sin cuenta usted paga por cobrar su propio cheque, no puede recibir depósito directo, no puede alquilar en muchos sitios y cada envío de dinero a su familia le sale más caro.</p>

<p>La FDIC ha documentado que cerca de la mitad de las personas sin cuenta bancaria en el país <strong>llegaron a tenerla antes</strong>. Es decir: en buena medida no es gente que nunca entró al sistema, sino gente a la que el sistema dejó fuera.</p>

<p>El abuso, cuando existe, no está en un rumor de TikTok. Está en un filtro automático que congela el dinero de miles de personas sin que nadie lo revise, en un teléfono que anuncia atención de 24 horas y no la da, y en una lista privada que lo deja a uno cinco años sin banco sin que le expliquen por qué. Todo eso está escrito en documentos públicos, con multas firmadas y con demandas en curso. Y contra eso sí hay dónde reclamar.</p>
`,
    },
    en: {
      slug: "bank-account-closures-immigrants-united-states-chexsystems-bank-of-america",
      title:
        "20,682 complaints in six months: the wave of bank account closures hitting immigrants in the United States",
      excerpt:
        "Your bank closes your account, won't tell you why, and by law it can't. Thousands of people are going through this right now in the U.S., and many end up on a private list that keeps them from opening another account for five years. Here is what is documented, what is false, and what you can do.",
      meta_title: "Bank account closures and immigrants in the U.S.: what is really going on",
      meta_description:
        "20,682 CFPB complaints in six months over unexplained account closures, a $225 million fine against Bank of America, and the ChexSystems list that locks people out for five years. What's true, what's a hoax, and how to fight back.",
      tags: [
        "banking",
        "immigrants",
        "Bank of America",
        "ChexSystems",
        "CFPB",
        "United States",
        "consumer rights",
      ],
      content_html: `
<p>The letter arrives in the mail and fits in a single paragraph. The bank has decided to close your account. You have thirty days. There is no number to call and argue, no explanation, and if you walk into a branch the teller will tell you — honestly — that they don't know why either.</p>

<p>This is happening to a lot of people. Between <strong>December 2025 and May 2026</strong>, the Consumer Financial Protection Bureau received <strong>20,682 complaints</strong> from customers locked out of their bank accounts with no explanation, according to an analysis by the firm McCarthy Hatch <a href="https://www.americanbanker.com/news/as-banks-close-accounts-experts-point-to-immigration-crackdown" target="_blank" rel="noopener noreferrer">reported by American Banker</a>. There were 609,000 complaints in total over that period; roughly 3 percent were about account closures.</p>

<p>And that number understates the problem on purpose. Most people whose accounts get closed never file a federal complaint — they switch banks and move on. "The number of accounts that are suddenly closed is going through the roof," says Jim McCarthy, chairman of the firm behind the count.</p>

<h2>Why the bank won't explain</h2>

<p>This is the maddening part, and it is worth understanding because it changes what you can actually do about it.</p>

<p>When a bank closes an account over suspected irregular activity, it files a confidential report with the government. The <strong>Bank Secrecy Act</strong> flatly prohibits telling the customer that report exists. It is not rudeness or contempt: the employee on the phone would be breaking the law by telling you.</p>

<p>The outcome is the one you already know. Someone who has done nothing wrong loses access to their money, gets no explanation, and is left feeling like a suspect. The balance almost always comes back — but it can take weeks.</p>

<p>Diane Thompson, of the National Consumer Law Center, puts it plainly: <em>"In the current climate there is a desire by many financial institutions to overcomply."</em> Overcomplying means closing first and not asking later, because a regulatory fine costs far more than losing a customer.</p>

<p>The industry has a word for it: <strong>de-risking</strong>. The <a href="https://home.treasury.gov/system/files/136/Treasury_AMLA_23_508.pdf" target="_blank" rel="noopener noreferrer">Treasury Department acknowledged in 2023</a> that it is a real problem, and that it falls hardest on remittance businesses and on organizations serving immigrant communities. Banks don't always close accounts one at a time — sometimes they walk away from an entire market.</p>

<h2>What has actually been proven against Bank of America</h2>

<p>Nothing here needs to be assumed, because there is a signed federal order.</p>

<p>In <strong>July 2022</strong>, two regulators fined Bank of America <strong>$225 million</strong> — $100 million from the CFPB and $125 million from the Office of the Comptroller of the Currency — over how it handled unemployment benefit cards for twelve states during the pandemic. The <a href="https://www.consumerfinance.gov/about-us/newsroom/federal-regulators-fine-bank-of-america-225-million-over-botched-disbursement-of-state-unemployment-benefits-at-height-of-pandemic/" target="_blank" rel="noopener noreferrer">CFPB's order</a> describes precisely what many people have lived through since:</p>

<ul>
<li>From fall 2020 through mid-2021, the bank <strong>replaced real fraud investigations with an automated filter</strong> that froze accounts on very simple flags. Regulators wrote that it "set a low bar" and harmed thousands of legitimate cardholders.</li>
<li>It applied that filter <strong>retroactively</strong>, to deny claims that had already been investigated.</li>
<li>It put people through a maze to unfreeze their own money: problems couldn't be reported online or in a branch, hold times ran for hours, and the bank advertised service "24 hours a day, seven days a week" that did not actually exist.</li>
<li>It sent customers back to California's unemployment agency <strong>knowing that agency was overwhelmed</strong> and could not help them.</li>
</ul>

<p>"Taxpayers relied on banks to distribute needed funds to families and small businesses to rescue the economy from collapse when the pandemic hit," CFPB Director Rohit Chopra said at the time. <em>"Bank of America failed to live up to its legal obligations."</em> The order also required the bank to repay wrongly denied benefits and to pay compensation scaled to how long each account stayed frozen — an amount regulators estimated would reach "hundreds of millions of dollars."</p>

<h2>And a lawsuit that is still alive</h2>

<p>There is a second front, and it goes directly to closing accounts because of who someone is. In the class action <strong><em>Nia v. Bank of America</em></strong> (case 3:21-cv-01799, Southern District of California), a permanent resident of Iranian origin alleges the bank closed his accounts even after he provided every document requested, and that this was not an isolated case but a pattern affecting people of that background.</p>

<p>The bank asked the court to throw the case out. On <strong>May 18, 2022</strong>, Judge Cynthia Bashant <a href="https://classlawdc.com/2022/05/09/bank-of-america-discrimination-against-non-citizens-class-action-lawsuit/" target="_blank" rel="noopener noreferrer">denied that motion</a> and let the case move into discovery. A judge allowing a case to proceed does not mean the allegations are proven — that deserves saying plainly. It means they are serious enough to force the bank to open its files.</p>

<h2>Now the part that needs saying, even if it is uncomfortable: the hoax</h2>

<p>In 2025 a TikTok video went viral — more than <strong>727,000 views</strong> — in which a woman presenting herself as a Bank of America customer service employee claimed the bank was freezing and closing immigrants' accounts and demanding proof of immigration status. It spread across Facebook, Instagram, Reddit and YouTube too.</p>

<p><strong>It is false.</strong> The bank said the claims were "completely false," that "there have been no changes to our policy," and that the woman did not work there. <a href="https://enlacelatinonc.org/en/No--Bank-of-America-is-not-freezing-or-closing-immigrants'-accounts./" target="_blank" rel="noopener noreferrer">Factchequeado reviewed the claim</a> and found no credible reporting to support it.</p>

<p>We are not saying this to defend any bank. We are saying it because believing the hoax <strong>hurts you</strong>. People who believe it pull their money out in cash, stop using the account they need to get paid, and — worst of all — never see the real problem, the one documented above, the one that <strong>does have legal remedies</strong>. A false rumor about a real problem is the most efficient way to leave people defenseless.</p>

<p>One legal point worth knowing: to open an account, the USA Patriot Act requires verifying identity — name, date of birth, address and a government ID — <strong>but it does not require proving citizenship</strong>. Millions of people bank with an ITIN and a foreign passport, and that has not changed. What American Banker does report is that some banks have started refusing to open accounts for people without a Social Security number. That is each bank's policy, not the law.</p>

<h2>ChexSystems: the list nobody told you about</h2>

<p>This is what turns a bad week into a years-long problem, and almost nobody hears about it until it happens to them.</p>

<p>When a bank closes an account — especially one left with a negative balance or flagged for suspected fraud — it can report that to <strong>Chex Systems, Inc.</strong>, a private consumer reporting agency. Think of it as a credit bureau, but for checking accounts. Nearly every bank checks it before opening an account for you.</p>

<p>If you show up there, bank after bank will turn you down without telling you why. And the record <strong>stays for five years</strong>, <a href="https://www.chexsystems.com/answers-to-frequently-asked-questions" target="_blank" rel="noopener noreferrer">according to the company itself</a>, unless whoever reported it asks for removal or the law requires it to come off.</p>

<p>The good news is that ChexSystems <strong>is regulated</strong>. The Fair Credit Reporting Act gives you concrete rights, and the company <a href="https://www.chexsystems.com/-/media/Project/ChexSystems/ChexSystems/PDF/SummaryofRights.pdf" target="_blank" rel="noopener noreferrer">spells them out in writing</a>:</p>

<ul>
<li><strong>Your report, free.</strong> You can request it at least once every twelve months — and also free within <strong>60 days</strong> of being denied an account because of that file. Request it at <a href="https://www.chexsystems.com/request-reports/consumer-disclosure" target="_blank" rel="noopener noreferrer">chexsystems.com</a> or by mail to Consumer Relations, PO Box 583399, Minneapolis, MN 55458.</li>
<li><strong>Dispute what's wrong.</strong> If something is inaccurate or incomplete, you dispute it and they must investigate <strong>free of charge, within 30 days</strong>. Whoever supplied the bad information has to correct it and notify everyone who received it.</li>
<li><strong>Sue.</strong> If ChexSystems reports wrong information, the FCRA lets you sue — and if you win, the company pays your attorney's fees and costs. That detail matters: it means lawyers will take these cases without charging you up front.</li>
</ul>

<p>The CFPB keeps <a href="https://www.consumerfinance.gov/consumer-tools/credit-reports-and-scores/consumer-reporting-companies/companies-list/chex-systems/" target="_blank" rel="noopener noreferrer">an official page on Chex Systems</a> with contact details and the process.</p>

<h2>If your account was just closed</h2>

<p>First things first. You don't have to do all of it in one day, but do it in this order.</p>

<ol>
<li><strong>Get your money out and protect anything that pays itself.</strong> Direct deposit, rent, utilities, phone. If those payments bounce, the damage multiplies.</li>
<li><strong>Get everything in writing.</strong> Ask for written confirmation of the closing date and how your balance will be returned. Don't argue by phone — ask for paper or email.</li>
<li><strong>Pull your ChexSystems report.</strong> It's free, and it is what will explain why the next bank also says no. Do this before you try to open another account.</li>
<li><strong>If there's an error, dispute it.</strong> In writing, and keep a copy. They have 30 days.</li>
<li><strong>File a complaint with the CFPB</strong> at <a href="https://www.consumerfinance.gov/complaint/" target="_blank" rel="noopener noreferrer">consumerfinance.gov</a>. It's free, it's available in Spanish, and the bank is required to respond. Those 20,682 complaints this story is built on are exactly that: people who put it on the record. Without that record, the problem does not exist as far as regulators are concerned.</li>
<li><strong>If a collector calls, know the rule.</strong> When an account closes in the negative, the debt usually goes to a collection agency. The <strong>Fair Debt Collection Practices Act</strong> bars that agency from threatening you, abusing you, calling at odd hours, or telling you that you'll go to jail over a consumer debt. You can demand written validation of the debt and tell them in writing to stop calling.</li>
<li><strong>Meanwhile, find a bank that won't shut the door.</strong> Many community credit unions and <em>Bank On</em> certified accounts are built for exactly this situation: no overdraft fees, and several don't screen through ChexSystems at all.</li>
</ol>

<h2>Why this matters</h2>

<p>Losing your bank account in the United States isn't an inconvenience — it's a quiet sentence. Without an account you pay a fee to cash your own paycheck, you can't get direct deposit, you can't rent in many places, and every dollar you send home costs more.</p>

<p>The FDIC has documented that close to half of the people without a bank account in this country <strong>used to have one</strong>. In other words: this is largely not about people who never got in. It's about people the system pushed out.</p>

<p>The abuse, where it exists, isn't in a TikTok rumor. It's in an automated filter that freezes thousands of people's money with nobody reviewing it, in a phone line advertising 24-hour help that isn't there, and in a private list that keeps you out of the banking system for five years without telling you why. All of that is in public documents, with signed fines and open lawsuits. And all of that you can actually fight.</p>
`,
    },
  },
};
