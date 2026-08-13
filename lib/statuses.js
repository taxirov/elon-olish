// Application workflow statuses shown/managed on the admin page
// (api/applications.js, api/set-status.js). "yuborilgan" is the value
// lib/bot.js sets on every new submission and must stay first/unchanged
// for backwards compatibility with already-stored applications.
const STATUS_ORDER = [
  'yuborilgan',
  'korib_chiqilmoqda',
  'analog_tayyor',
  'joylashtirildi',
  'rad_etildi',
];

const STATUS_LABELS = {
  yuborilgan: 'Yangi',
  korib_chiqilmoqda: "Ko'rib chiqilmoqda",
  analog_tayyor: 'Analog tayyor',
  joylashtirildi: 'Joylashtirildi',
  rad_etildi: 'Rad etildi',
};

// Admin sahifasida (api/applications.js) statuslarga mos SVG icon kalitlari.
const STATUS_ICONS = {
  yuborilgan: 'sparkle',
  korib_chiqilmoqda: 'search',
  analog_tayyor: 'copy',
  joylashtirildi: 'checkCircle',
  rad_etildi: 'xCircle',
};

const STATUS_COLORS = {
  yuborilgan: '#2563eb',
  korib_chiqilmoqda: '#d97706',
  analog_tayyor: '#0891b2',
  joylashtirildi: '#16a34a',
  rad_etildi: '#dc2626',
};

// Foydalanuvchilar ro'yxati — "Ko'rib chiqilmoqda" statusiga o'tkazganda
// murojaat kimga biriktirilganini belgilash uchun.
const ASSIGNEES = ['Sevinchbek', 'Asadbek', 'Otabek', 'Ilyosbek', 'Islombek', 'Akbarali'];

const ASSIGNEE_COLORS = {
  Sevinchbek: '#6366f1',
  Asadbek: '#0891b2',
  Otabek: '#16a34a',
  Ilyosbek: '#d97706',
  Islombek: '#dc2626',
  Akbarali: '#7c3aed',
};

module.exports = {
  STATUS_ORDER,
  STATUS_LABELS,
  STATUS_ICONS,
  STATUS_COLORS,
  ASSIGNEES,
  ASSIGNEE_COLORS,
};
