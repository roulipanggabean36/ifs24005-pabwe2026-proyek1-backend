INSERT INTO products (name, brand, category, opened_date, expiry_date, quantity, price, notes) VALUES
('Wardah Facial Wash',             'Wardah',    'cleanser',    '2026-08-01', '2027-08-01', 1, 25000, 'Dipakai pagi dan malam'),
('Implora Sunscreen SPF 40++',     'Implora',   'sunscreen',   '2026-09-10', '2027-09-10', 1, 30000, 'Aplikasikan ulang tiap 3 jam jika di luar ruangan'),
('Glowies Dreamy Moisturizer',     'Glowies',   'moisturizer', '2026-07-15', '2027-07-15', 1, 65000, 'Tekstur ringan, cocok untuk pagi'),
('Wardah Lightening Day Cream',    'Wardah',    'moisturizer', '2026-04-20', '2026-11-10', 1, 35000, 'Segera habiskan, mendekati kedaluwarsa'),
('Somethinc Niacinamide Serum',    'Somethinc', 'serum',       '2026-09-01', '2027-03-01', 1, 90000, 'Pakai malam hari');

INSERT INTO routines (product_id, used_at, time_of_day, skin_condition, skin_rating, notes) VALUES
(1, '2026-10-20', 'morning', 'good',     4, 'Kulit bersih dan segar'),
(3, '2026-10-20', 'morning', 'good',     4, 'Lembap sepanjang pagi'),
(2, '2026-10-20', 'morning', 'normal',   4, 'Tidak lengket'),
(1, '2026-10-20', 'night',   'normal',   3, 'Sedikit berminyak di zona T'),
(5, '2026-10-20', 'night',   'good',     4, 'Pori terlihat lebih halus'),
(1, '2026-10-21', 'morning', 'oily',     3, 'Wajah berminyak setelah begadang'),
(2, '2026-10-21', 'morning', 'normal',   4, NULL),
(5, '2026-10-21', 'night',   'breakout', 2, 'Muncul satu jerawat kecil di dagu'),
(3, '2026-10-22', 'morning', 'great',    5, 'Kulit terlihat glowing hari ini');
