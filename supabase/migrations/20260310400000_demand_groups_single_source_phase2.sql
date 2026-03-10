-- Demand Groups: Single Source of Truth — Phase 2
--
-- Seeds ALL sub-groups from demand-groups-list.ts into demand_sub_groups.
-- Uses ON CONFLICT (code) DO NOTHING so existing rows are preserved.
-- Also creates Non-Food meta-categories M15–M20 and sets parent_group
-- for all Non-Food groups.

BEGIN;

-- =====================================================================
-- 1. Seed ALL sub-groups from demand-groups-list.ts
--    Code format: "{demand_group_code}-{sub_num}", e.g. "06-01"
--    ON CONFLICT (code) DO NOTHING preserves existing rows
-- =====================================================================
INSERT INTO demand_sub_groups (code, name, demand_group_code, sort_position) VALUES
  -- 01-Spirituosen
  ('01-01', 'Spirituosen',                         '01',  1),
  ('01-02', 'Liköre/Bitter',                       '01',  2),
  ('01-03', 'Mixgetränke',                          '01',  3),

  -- 02-Sekt/Schaumwein
  ('02-01', 'Sekt/Schaumwein',                      '02',  1),

  -- 03-Wein
  ('03-01', 'Rotwein',                              '03',  1),
  ('03-02', 'Weißwein',                             '03',  2),
  ('03-03', 'Roséwein',                             '03',  3),
  ('03-04', 'Likör-/Dessertwein',                   '03',  4),
  ('03-05', 'Weinhaltige Getränke/Weine, sortiert', '03',  5),

  -- 04-Bier
  ('04-01', 'Bier',                                 '04',  1),
  ('04-02', 'Biergetränke',                         '04',  2),

  -- 05-Wasser
  ('05-01', 'Wasser',                               '05',  1),
  ('05-02', 'Wasser, aromatisiert',                 '05',  2),

  -- 06-Wasch-/Putz-/Reinigungsmittel
  ('06-01', 'Waschmittel',                          '06',  1),
  ('06-02', 'Waschhilfsmittel',                     '06',  2),
  ('06-03', 'Spülmittel',                           '06',  3),
  ('06-04', 'Putzmittel',                           '06',  4),
  ('06-06', 'Lufterfrischer',                       '06',  5),
  ('06-07', 'WC',                                   '06',  6),
  ('06-08', 'MGR (Maschinengeschirrreinigung)',      '06',  7),
  ('06-09', 'Autopflege',                           '06',  8),

  -- 07-Kosmetik/Körperpflege
  ('07-01', 'Haarpflege/Accessoires',               '07',  1),
  ('07-02', 'Hautpflege',                           '07',  2),
  ('07-06', 'Nagel-/Kosmetik Accessoires',          '07',  3),

  -- 08-Körperhygiene
  ('08-01', 'Waschen/Duschen/Baden',                '08',  1),
  ('08-02', 'Deodorants',                           '08',  2),
  ('08-03', 'Zahn-/Mundhygiene',                    '08',  3),
  ('08-04', 'Rasur/Haarentfernung',                 '08',  4),
  ('08-05', 'Damenhygiene',                         '08',  5),
  ('08-06', 'Inkontinenzprodukte',                  '08',  6),

  -- 09-Babyartikel
  ('09-02', 'Beikost nass',                         '09',  1),
  ('09-04', 'Pflegeprodukte',                       '09',  2),
  ('09-06', 'Snacks/Getränke',                      '09',  3),
  ('09-07', 'Windeln',                              '09',  4),

  -- 10-Papierwaren
  ('10-01', 'Toilettenpapier',                      '10',  1),
  ('10-02', 'Küchentücher',                         '10',  2),
  ('10-03', 'Taschentücher/Kosmetiktücher',         '10',  3),
  ('10-04', 'Servietten/Geschirr',                  '10',  4),

  -- 11-Folien/Tücher
  ('11-01', 'Haushaltsfolien',                      '11',  1),
  ('11-02', 'Tragetaschen',                         '11',  2),
  ('11-03', 'Reinigungstücher/Schwämme/Handschuhe', '11',  3),

  -- 12-Audio/Video/Batterien
  ('12-02', 'Batterien/Akkus',                      '12',  1),
  ('12-03', 'Datenträger, bespielt',                '12',  2),

  -- 13-Apothekenprodukte
  ('13-02', 'Wundversorgung/Hausapotheke',          '13',  1),
  ('13-03', 'Orale Arzneimittel',                   '13',  2),
  ('13-04', 'Nahrungsergänzungsmittel',             '13',  3),
  ('13-06', 'Sportnahrung',                         '13',  4),

  -- 14-Kinder-Textilien
  ('14-01', 'Unterwäsche',                          '14',  1),
  ('14-02', 'Nachtwäsche',                          '14',  2),
  ('14-04', 'Tops/Shirts/Pullover',                 '14',  3),
  ('14-07', 'Socken, Strümpfe',                     '14',  4),

  -- 15-Herren-Textilien
  ('15-01', 'Unterwäsche',                          '15',  1),
  ('15-02', 'Nachtwäsche',                          '15',  2),
  ('15-04', 'Shirts/Pullover',                      '15',  3),
  ('15-05', 'Jacken/Westen',                        '15',  4),
  ('15-07', 'Socken, Strümpfe',                     '15',  5),

  -- 16-Damen-Textilien
  ('16-01', 'Unterwäsche',                          '16',  1),
  ('16-02', 'Nachtwäsche',                          '16',  2),
  ('16-03', 'Hosen',                                '16',  3),
  ('16-04', 'Tops/Shirts/Pullover',                 '16',  4),
  ('16-05', 'Jacken/Westen',                        '16',  5),
  ('16-07', 'Socken, Feinstrümpfe',                 '16',  6),
  ('16-09', 'Accessoires',                          '16',  7),

  -- 17-Sport & Sportbekleidung
  ('17-02', 'Hosen',                                '17',  1),
  ('17-06', 'Socken, Strümpfe',                     '17',  2),
  ('17-07', 'Arbeits-/Berufsbekleidung',            '17',  3),

  -- 18-Heimtextilien
  ('18-01', 'Bettwäsche',                           '18',  1),
  ('18-04', 'Bettwaren',                            '18',  2),
  ('18-05', 'Frottierwaren',                        '18',  3),
  ('18-06', 'Küchentextilien',                      '18',  4),
  ('18-07', 'Teppiche/Badteppiche/Fußmatten',       '18',  5),
  ('18-08', 'Kissen/Kissenhüllen',                  '18',  6),
  ('18-09', 'Decken',                               '18',  7),

  -- 19-Möbel
  ('19-06', 'Badezimmermöbel',                      '19',  1),

  -- 20-Unterhaltungselektronik
  ('20-01', 'TV',                                   '20',  1),
  ('20-02', 'Audio',                                '20',  2),
  ('20-03', 'Foto/Kamera/Optik',                    '20',  3),
  ('20-04', 'PCs/Hardware',                         '20',  4),
  ('20-06', 'Telekommunikation',                    '20',  5),
  ('20-07', 'Zubehör',                              '20',  6),

  -- 22-Heimwerkerbedarf
  ('22-01', 'Elektrogeräte',                        '22',  1),
  ('22-02', 'Zubehör für Elektrogeräte',            '22',  2),
  ('22-03', 'Handwerkzeuge',                        '22',  3),
  ('22-04', 'Metallwaren/Befestigungsmaterial',     '22',  4),
  ('22-05', 'Leitern/Arbeitsvorrichtungen',         '22',  5),
  ('22-06', 'Farben/Lacke',                         '22',  6),
  ('22-07', 'Malerzubehör',                         '22',  7),
  ('22-08', 'Taschenlampen/Arbeitsleuchten',        '22',  8),
  ('22-09', 'Elektrozubehör',                       '22',  9),
  ('22-10', 'Sanitär/Heizung/Klimatechnik',         '22', 10),
  ('22-11', 'Aufbewahrungssysteme',                 '22', 11),
  ('22-12', 'Sicherheitsprodukte',                  '22', 12),
  ('22-13', 'Rollen/Transporthilfen',               '22', 13),
  ('22-14', 'Sonstiger Werkstattbedarf',            '22', 14),

  -- 25-Haushaltsartikel
  ('25-01', 'Kerzen/Aromatherapie',                 '25',  1),
  ('25-02', 'Aufbewahrungssysteme',                 '25',  2),
  ('25-03', 'Koch-/Küchenzubehör',                  '25',  3),
  ('25-04', 'Geschirr/Besteck',                     '25',  4),
  ('25-05', 'Badzubehör',                           '25',  5),
  ('25-07', 'Wäsche-/Waschzubehör',                 '25',  6),
  ('25-08', 'Haushaltszubehör',                     '25',  7),

  -- 27-Pflanzen/Blumen
  ('27-01', 'Schnittblumen',                        '27',  1),
  ('27-02', 'Zimmerpflanzen',                       '27',  2),
  ('27-03', 'Balkon-/Terrassenpflanzen',            '27',  3),
  ('27-04', 'Beetpflanzen',                         '27',  4),
  ('27-06', 'Sträucher/Bäume/Stauden',              '27',  5),
  ('27-08', 'Saatgut/Anzucht',                      '27',  6),
  ('27-09', 'Nahrungspflanzen',                     '27',  7),

  -- 28-Schreibwaren/Büroartikel/Papeterie
  ('28-02', 'Schreib-/Malartikel',                  '28',  1),
  ('28-04', 'Papierwaren',                          '28',  2),
  ('28-07', 'Bürobedarf',                           '28',  3),
  ('28-08', 'Bastelbedarf',                         '28',  4),
  ('28-09', 'Handarbeit/Kurzwaren (Nähzubehör)',    '28',  5),

  -- 29-Deko-Artikel
  ('29-06', 'Seidenblumen/Kunstpflanzen',           '29',  1),

  -- 30-Koffer/Taschen
  ('30-01', 'Koffer',                               '30',  1),
  ('30-03', 'Rucksäcke',                            '30',  2),

  -- 31-Gartenbedarf
  ('31-01', 'Gartenmöbel',                          '31',  1),
  ('31-02', 'Düngemittel/Pflanzenpflege',           '31',  2),
  ('31-03', 'Motorbetriebene Geräte',               '31',  3),
  ('31-04', 'Gartenwerkzeuge',                      '31',  4),
  ('31-06', 'Blumentöpfe/Kübel',                    '31',  5),
  ('31-08', 'Gartenzubehör',                        '31',  6),
  ('31-09', 'Blumenerde',                           '31',  7),
  ('31-10', 'Gartendekoration',                     '31',  8),

  -- 32-Spielwaren
  ('32-01', 'Spielfiguren',                         '32',  1),
  ('32-02', 'Spielzeugautos/-fahrzeuge',            '32',  2),
  ('32-07', 'Plüsch',                               '32',  3),
  ('32-10', 'Kleinkinderspielzeug',                 '32',  4),

  -- 33-Auto/Motorrad/Fahrrad
  ('33-01', 'Autozubehör',                          '33',  1),

  -- 34-Sport/Camping/Freizeit
  ('34-01', 'Sportartikel Indoor',                  '34',  1),
  ('34-02', 'Camping/Outdoor',                      '34',  2),
  ('34-04', 'Grillen',                              '34',  3),

  -- 35-Haushaltsgeräte
  ('35-01', 'Elektr. Haushaltsgeräte',              '35',  1),
  ('35-02', 'Elektr. Küchengeräte',                 '35',  2),
  ('35-03', 'Elektr. Körperpflegegeräte',           '35',  3),
  ('35-04', 'Elektrogroßgeräte (weiße Ware)',        '35',  4),
  ('35-05', 'Med. Haushaltsgeräte',                 '35',  5),

  -- 36-Schuhe
  ('36-06', 'Sportschuhe',                          '36',  1),
  ('36-08', 'Hausschuhe',                           '36',  2),

  -- 38-Gemüse (already seeded, ON CONFLICT preserves)
  ('38-01', 'Gemüse (hart)',                        '38',  1),
  ('38-02', 'Paprika',                              '38',  2),
  ('38-03', 'Tomaten',                              '38',  3),
  ('38-04', 'Kohlgemüse',                           '38',  4),
  ('38-05', 'Wurzel-/Knollengemüse',                '38',  5),
  ('38-06', 'Kartoffeln',                           '38',  6),
  ('38-07', 'Zwiebelgemüse',                        '38',  7),
  ('38-08', 'Pilze',                                '38',  8),
  ('38-09', 'Hülsenfrüchte',                        '38',  9),
  ('38-10', 'Kürbisse',                             '38', 10),
  ('38-11', 'Zucchini',                             '38', 11),
  ('38-12', 'Spargel',                              '38', 12),
  ('38-13', 'Frische Kräuter',                      '38', 13),
  ('38-14', 'Gewürze',                              '38', 14),
  ('38-16', 'Sonstiges Gemüse',                     '38', 15),
  ('38-17', 'Snacks/Gemüse, verzehrfertig',         '38', 16),

  -- 39-Tierbedarf
  ('39-02', 'Katzenzubehör',                        '39',  1),

  -- 40-Bonbons/Kaugummi
  ('40-01', 'Kaugummi',                             '40',  1),
  ('40-02', 'Bonbons (mit Zucker/zuckerfrei)',      '40',  2),
  ('40-03', 'Kaubonbons',                           '40',  3),
  ('40-04', 'Fruchtgummi',                          '40',  4),
  ('40-05', 'Lutschbonbons',                        '40',  5),

  -- 41-Schokolade/Pralinen (already seeded)
  ('41-01', 'Tafelschokolade',                      '41',  1),
  ('41-02', 'Schokoriegel',                         '41',  2),
  ('41-03', 'Pralinen',                             '41',  3),
  ('41-04', 'Süßwaren mit Schokolade',              '41',  4),

  -- 42-Gebäck
  ('42-01', 'Gebäck',                               '42',  1),
  ('42-02', 'Waffeln',                              '42',  2),

  -- 43-Saisonartikel Süßwaren
  ('43-01', 'Weihnachten',                          '43',  1),
  ('43-02', 'Ostern',                               '43',  2),

  -- 44-Salzgebäck
  ('44-01', 'Salzgebäck/Kräcker',                   '44',  1),

  -- 45-Kaffee/Kakao (already seeded)
  ('45-01', 'Löslicher Kaffee',                     '45',  1),
  ('45-02', 'Bohnenkaffee',                         '45',  2),
  ('45-03', 'Kaffeehaltige Heißgetränke',           '45',  3),
  ('45-04', 'Pulvergetränke',                       '45',  4),
  ('45-05', 'Kaffeekapseln',                        '45',  5),
  ('45-06', 'Einzelportionen/Trinkfertig',          '45',  6),

  -- 46-Tee
  ('46-01', 'Kräutertee',                           '46',  1),
  ('46-02', 'Schwarztee',                           '46',  2),
  ('46-03', 'Instanttee',                           '46',  3),
  ('46-04', 'Früchtetee',                           '46',  4),
  ('46-06', 'Gemischte Sorten',                     '46',  5),

  -- 47-Konserven (already seeded)
  ('47-01', 'Obstkonserven',                        '47',  1),
  ('47-02', 'Gemüsekonserven',                      '47',  2),
  ('47-03', 'Sauerkonserven',                       '47',  3),
  ('47-04', 'Pilzkonserven',                        '47',  4),
  ('47-06', 'Antipasti, ungekühlt',                  '47',  5),

  -- 48-Fertiggerichte/Suppen (already seeded)
  ('48-01', 'Fertiggerichte',                       '48',  1),
  ('48-02', 'Eintöpfe/Nasssuppen',                  '48',  2),
  ('48-04', 'Instantgerichte',                      '48',  3),
  ('48-05', 'Trockensuppen/Fixprodukte/trockene Suppe', '48', 4),

  -- 49-Dauerwurst/Speck
  ('49-01', 'Dauerwurst/Speck',                     '49',  1),

  -- 50-H-Milchprodukte (already seeded)
  ('50-01', 'H-Käse',                               '50',  1),
  ('50-02', 'H-Milch',                              '50',  2),
  ('50-03', 'H-Sahne',                              '50',  3),
  ('50-04', 'Milchersatzprodukte',                  '50',  4),

  -- 51-Joghurts/Quark (already seeded)
  ('51-01', 'Joghurt, Natur',                       '51',  1),
  ('51-02', 'Joghurt, Frucht',                      '51',  2),
  ('51-03', 'Joghurtersatzprodukte',                '51',  3),
  ('51-04', 'Quark',                                '51',  4),

  -- 52-Dressings/Öle/Soßen (already seeded)
  ('52-01', 'Ketchup/Senf',                         '52',  1),
  ('52-02', 'Speiseöle',                            '52',  2),
  ('52-03', 'Mayonnaise',                           '52',  3),
  ('52-04', 'Soßen/Pesto',                          '52',  4),
  ('52-05', 'Essig',                                '52',  5),
  ('52-06', 'Dressings/Marinaden',                  '52',  6),
  ('52-07', 'Meerrettich',                          '52',  7),

  -- 53-Konfitüren/Brotaufstriche (already seeded)
  ('53-01', 'Fruchtaufstriche',                     '53',  1),
  ('53-02', 'Honig',                                '53',  2),
  ('53-03', 'Sirup/Garnierung',                     '53',  3),
  ('53-04', 'Nussaufstriche',                       '53',  4),
  ('53-05', 'Herzhafte Aufstriche',                 '53',  5),
  ('53-06', 'Süße Aufstriche',                      '53',  6),

  -- 54-Nährmittel (already seeded)
  ('54-01', 'Reis',                                 '54',  1),
  ('54-02', 'Teigwaren',                            '54',  2),
  ('54-03', 'Kartoffelprodukte',                    '54',  3),
  ('54-04', 'Kräuter/Gewürze/Würzzutaten',          '54',  4),
  ('54-06', 'Hülsenfrüchte/Getreide',               '54',  5),

  -- 55-Eier
  ('55-01', 'Rohe Eier',                            '55',  1),
  ('55-02', 'Gekochte Eier',                        '55',  2),

  -- 56-Bake-Off (already seeded)
  ('56-01', 'Weißbrot',                             '56',  1),
  ('56-02', 'Schwarz-/Vollkornbrot',                '56',  2),
  ('56-03', 'Spezialbrot',                          '56',  3),
  ('56-04', 'Pikante Snacks',                       '56',  4),
  ('56-05', 'Feinbackwaren',                        '56',  5),
  ('56-06', 'Brötchen/Semmeln',                     '56',  6),

  -- 57-Brot/Kuchen (already seeded)
  ('57-01', 'Aufbackartikel',                       '57',  1),
  ('57-02', 'Frischbrot',                           '57',  2),
  ('57-03', 'Frische Feinbackwaren',                '57',  3),
  ('57-04', 'Frische Kleinbackwaren',               '57',  4),
  ('57-05', 'Haltbare Feinbackwaren',               '57',  5),
  ('57-06', 'Haltbarer Kuchen',                     '57',  6),
  ('57-07', 'Haltbares Brot',                       '57',  7),
  ('57-09', 'Brötchen/Semmeln',                     '57',  8),
  ('57-10', 'Alternativen zum Sandwich',            '57',  9),
  ('57-11', 'Frischer Kuchen',                      '57', 10),
  ('57-12', 'Kleingebäck',                          '57', 11),

  -- 58-Obst (already seeded)
  ('58-01', 'Äpfel',                                '58',  1),
  ('58-02', 'Birnen',                               '58',  2),
  ('58-03', 'Steinobst',                            '58',  3),
  ('58-04', 'Beeren',                               '58',  4),
  ('58-05', 'Trauben',                              '58',  5),
  ('58-06', 'Zitrusfrüchte',                        '58',  6),
  ('58-07', 'Exotische Früchte',                    '58',  7),
  ('58-08', 'Bananen',                              '58',  8),
  ('58-10', 'Melonen',                              '58',  9),
  ('58-11', 'Mangos',                               '58', 10),
  ('58-12', 'Avocados',                             '58', 11),
  ('58-15', 'Snacks/Obst, verzehrfertig',           '58', 12),

  -- 59-Tabakwaren
  ('59-01', 'Zigaretten',                           '59',  1),
  ('59-02', 'Tabak',                                '59',  2),
  ('59-03', 'Zubehör',                              '59',  3),

  -- 60-Margarine/pflanzliche Fette
  ('60-01', 'Margarine/pflanzliche Fette',          '60',  1),

  -- 62-Frischfleisch (ohne Schwein/Geflügel)
  ('62-01', 'Rind, frisch',                         '62',  1),
  ('62-02', 'Lamm, frisch',                         '62',  2),
  ('62-03', 'Frischfleisch-Spezialitäten',          '62',  3),
  ('62-04', 'Hackfleisch, diverse',                 '62',  4),

  -- 63-Geschenkkarten/Gutscheine
  ('63-02', 'Externe Geschenkkarten',               '63',  1),

  -- 64-Fisch, frisch
  ('64-01', 'Fisch',                                '64',  1),
  ('64-02', 'Meeresfrüchte',                        '64',  2),

  -- 67-Geflügel, frisch
  ('67-01', 'Hühnchen, frisch',                     '67',  1),
  ('67-02', 'Pute, frisch',                         '67',  2),
  ('67-04', 'Geflügelwaren-Spezialitäten, frisch',  '67',  3),
  ('67-05', 'Hackfleisch, Geflügel',                '67',  4),

  -- 68-Schweinefleisch, frisch
  ('68-01', 'Schwein, frisch',                      '68',  1),
  ('68-05', 'Hackfleisch, Schwein',                 '68',  2),

  -- 69-Gekühlte Wurstwaren (partially seeded)
  ('69-01', 'Aspikware/Sülze',                      '69',  1),
  ('69-02', 'Bratwurst',                            '69',  2),
  ('69-03', 'Brühwurst',                            '69',  3),
  ('69-04', 'Kochwurst',                            '69',  4),
  ('69-05', 'Rohwurst',                             '69',  5),
  ('69-06', 'Würstchen',                            '69',  6),
  ('69-07', 'Schinken gekocht/gepökelt',            '69',  7),
  ('69-08', 'Schinken roh/gepökelt/luftgetrocknet', '69',  8),
  ('69-09', 'Restliche Pökelware',                  '69',  9),
  ('69-10', 'Sonstige Wurst',                       '69', 10),
  ('69-11', 'Speck/Rohschinken',                    '69', 11),
  ('69-12', 'Fleisch geschnitten/Wurst geschnitten', '69', 12),
  ('69-13', 'Kochschinken',                         '69', 13),
  ('69-15', 'Aufschnitt roh/gepökelt',              '69', 14),
  ('69-16', 'Gegarter Aufschnitt',                  '69', 15),
  ('69-17', 'Pasteten',                             '69', 16),
  ('69-18', 'Sonstige Fleischwaren',                '69', 17),

  -- 70-Gekühltes verzehrfertiges Fleisch
  ('70-02', 'Verzehrfertiges Fleisch',              '70',  1),
  ('70-04', 'Fleischersatzprodukte',                '70',  2),

  -- 71-Gekühlter verzehrfertiger Fisch
  ('71-01', 'Fisch/Meeresfrüchte',                  '71',  1),

  -- 72-Gekühlte Fertiggerichte (already seeded)
  ('72-01', 'Fertiggerichte',                       '72',  1),
  ('72-02', 'Pizza',                                '72',  2),
  ('72-03', 'Kartoffelprodukte',                    '72',  3),
  ('72-04', 'Teigwaren',                            '72',  4),
  ('72-05', 'Backwaren',                            '72',  5),

  -- 73-Gekühlte Feinkost (already seeded)
  ('73-01', 'Feinkost',                             '73',  1),
  ('73-02', 'Aufstriche/Dips/Dressings',            '73',  2),
  ('73-04', 'Salat, verzehrfertig',                 '73',  3),
  ('73-06', 'Sandwiches/Snacks',                    '73',  4),
  ('73-07', 'Desserts',                             '73',  5),

  -- 74-Gekühlte Getränke
  ('74-01', 'Säfte',                                '74',  1),

  -- 75-TK Fleisch/Fisch (already seeded)
  ('75-01', 'Fisch/Meeresfrüchte',                  '75',  1),
  ('75-02', 'Hühnchen',                             '75',  2),
  ('75-03', 'Pute',                                 '75',  3),
  ('75-04', 'Schwein',                              '75',  4),
  ('75-05', 'Rind',                                 '75',  5),
  ('75-07', 'Sonstige Fleischwaren',                '75',  6),
  ('75-10', 'Fleischersatzprodukte',                '75',  7),

  -- 76-TK Obst/Gemüse (already seeded)
  ('76-01', 'Gemüse',                               '76',  1),
  ('76-02', 'Kartoffelprodukte',                    '76',  2),
  ('76-03', 'Obst',                                 '76',  3),

  -- 77-TK Desserts/Backwaren/Eis (already seeded)
  ('77-01', 'Backwaren',                            '77',  1),
  ('77-02', 'Eis',                                  '77',  2),
  ('77-03', 'Desserts/Mehlspeisen',                 '77',  3),

  -- 78-TK Fertiggerichte/Pizzas (already seeded)
  ('78-01', 'Fertig-/Teilfertiggerichte',           '78',  1),
  ('78-02', 'Pizza/Baguettes',                      '78',  2),
  ('78-03', 'Snacks/Kuchen',                        '78',  3),

  -- 79-Funktionsgetränke/Eistee
  ('79-01', 'Sport-/Energy Drinks',                 '79',  1),
  ('79-02', 'ACE',                                  '79',  2),
  ('79-03', 'Eistee',                               '79',  3),

  -- 80-CO2 Erfrischungsgetränke
  ('80-01', 'Softdrinks/Fruchthaltige Erfrischungsget', '80', 1),
  ('80-02', 'Tonics/Mixgetränke',                   '80',  2),

  -- 81-Fruchtsäfte/Sirupe
  ('81-01', 'Fruchtsäfte (Säfte, Nektar)',           '81',  1),
  ('81-02', 'Sirupe',                               '81',  2),

  -- 82-Wurst-/Fleisch-/Fischkonserven (already seeded)
  ('82-01', 'Fischkonserven',                       '82',  1),
  ('82-02', 'Wurst-/Fleischkonserven',              '82',  2),

  -- 83-Milch/Sahne/Butter (already seeded)
  ('83-01', 'Milchgetränke',                        '83',  1),
  ('83-02', 'Milch',                                '83',  2),
  ('83-03', 'Sahne',                                '83',  3),
  ('83-04', 'Butter/tierische Fette',               '83',  4),

  -- 84-Käse (already seeded)
  ('84-01', 'Hart-/Schnittkäse',                    '84',  1),
  ('84-02', 'Weichkäse',                            '84',  2),
  ('84-03', 'Frischkäse',                           '84',  3),
  ('84-04', 'Schmelzkäse',                          '84',  4),
  ('84-05', 'Käseerzeugnisse eigener Art',          '84',  5),
  ('84-06', 'Cheddar am Stück',                     '84',  6),
  ('84-07', 'Käse gerieben/zerkleinert',            '84',  7),
  ('84-09', 'Käse geschnitten',                     '84',  8),
  ('84-10', 'Käsesnacks',                           '84',  9),
  ('84-11', 'Käsespezialitäten',                    '84', 10),

  -- 85-Tiernahrung
  ('85-01', 'Hundenahrung',                         '85',  1),
  ('85-02', 'Katzennahrung',                        '85',  2),
  ('85-03', 'Vogelnahrung',                         '85',  3),

  -- 86-Chips/Snacks
  ('86-01', 'Chips',                                '86',  1),
  ('86-02', 'Snacks',                               '86',  2),

  -- 87-Nüsse/Trockenfrüchte
  ('87-01', 'Nüsse',                                '87',  1),
  ('87-02', 'Trockenfrüchte',                       '87',  2),

  -- 88-Salate
  ('88-01', 'Blattsalate',                          '88',  1),
  ('88-02', 'Sonstige Salate',                      '88',  2),

  -- 89-Backartikel (already seeded)
  ('89-01', 'Mehl',                                 '89',  1),
  ('89-02', 'Backzutaten',                          '89',  2),
  ('89-03', 'Zucker/Süßungsmittel',                 '89',  3),
  ('89-04', 'Dessertpulver',                        '89',  4),
  ('89-05', 'Backmischungen',                       '89',  5),

  -- 90-Cerealien/Snacks (already seeded)
  ('90-01', 'Cerealien',                            '90',  1),
  ('90-02', 'Warme Cerealien/Haferbrei',            '90',  2),
  ('90-03', 'Snack-/Energie-/Müsliriegel',          '90',  3),

  -- 92-Beleuchtung
  ('92-02', 'Leuchtmittel',                         '92',  1),
  ('92-03', 'Innenbeleuchtung',                     '92',  2),

  -- 93-ALDI Services
  ('93-03', 'ALDI/HOFER Talk',                      '93',  1)
ON CONFLICT (code) DO NOTHING;

-- =====================================================================
-- 2. Create Non-Food meta-categories M15–M20
-- =====================================================================
INSERT INTO demand_groups (code, name, name_en, icon, color, sort_position, is_meta, source)
VALUES
  ('M15', 'Textilien & Schuhe',       'Textiles & Shoes',       '👕', '#7986CB', 15, true, 'curated'),
  ('M16', 'Technik & Elektronik',     'Technology & Electronics','📱', '#78909C', 16, true, 'curated'),
  ('M17', 'Heim & Garten',            'Home & Garden',          '🏡', '#4CAF50', 17, true, 'curated'),
  ('M18', 'Sport & Freizeit',         'Sports & Leisure',       '⚽', '#66BB6A', 18, true, 'curated'),
  ('M19', 'Schreibwaren & Büro',      'Stationery & Office',    '✏️', '#B0BEC5', 19, true, 'curated'),
  ('M20', 'Sonstiges & Services',     'Other & Services',       '🏷️', '#9E9E9E', 20, true, 'curated')
ON CONFLICT (code) DO NOTHING;

-- =====================================================================
-- 3. Set parent_group for Non-Food groups
-- =====================================================================
-- M15: Textilien & Schuhe
UPDATE demand_groups SET parent_group = 'M15' WHERE code IN ('14','15','16','17','18','36');

-- M16: Technik & Elektronik
UPDATE demand_groups SET parent_group = 'M16' WHERE code IN ('12','20','35');

-- M17: Heim & Garten
UPDATE demand_groups SET parent_group = 'M17' WHERE code IN ('19','22','27','29','31','92');

-- M18: Sport & Freizeit
UPDATE demand_groups SET parent_group = 'M18' WHERE code IN ('30','32','33','34');

-- M19: Schreibwaren & Büro
UPDATE demand_groups SET parent_group = 'M19' WHERE code IN ('28');

-- M20: Sonstiges & Services
UPDATE demand_groups SET parent_group = 'M20' WHERE code IN ('39','59','63','93');

COMMIT;
