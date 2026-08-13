const { Telegraf, Scenes, session, Markup } = require('telegraf');
const {
  getRegions,
  getDistrictsByRegion,
  getRegionById,
  getDistrictById,
} = require('./regions');
const { pgSessionStore, nextApplicationId, saveApplication } = require('./store');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID || '-1002734287812';

if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set');
}

const PROPERTY_TYPES = [
  'Kvartira',
  "Xususiy uy",
  'Noturar bino',
  'Yer uchastka'
];

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function regionsKeyboard() {
  const rows = chunk(
    getRegions().map((r) => Markup.button.callback(r.name, `reg_${r.id}`)),
    2,
  );
  return Markup.inlineKeyboard(rows);
}

function districtsKeyboard(regionId) {
  const districts = getDistrictsByRegion(regionId);
  const rows = chunk(
    districts.map((d) => Markup.button.callback(d.name, `dist_${d.id}`)),
    2,
  );
  rows.push([Markup.button.callback('⬅️ Orqaga (viloyat)', 'back_to_region')]);
  return Markup.inlineKeyboard(rows);
}

function propertyTypeKeyboard() {
  const rows = chunk(
    PROPERTY_TYPES.map((label, idx) => Markup.button.callback(label, `ptype_${idx}`)),
    2,
  );
  return Markup.inlineKeyboard(rows);
}

function phoneKeyboard() {
  return Markup.keyboard([Markup.button.contactRequest('📱 Kontaktni yuborish')])
    .oneTime()
    .resize();
}

function doneKeyboard(label, action) {
  return Markup.inlineKeyboard([[Markup.button.callback(label, action)]]);
}

function documentsKeyboard(hasAny) {
  const rows = [];
  if (hasAny) rows.push([Markup.button.callback('✅ Tayyor', 'doc_done')]);
  rows.push([Markup.button.callback("⏭ O'tkazib yuborish", 'doc_skip')]);
  return Markup.inlineKeyboard(rows);
}

const SKIP_LOCATION_TEXT = "⏭ O'tkazib yuborish";

function locationKeyboard() {
  return Markup.keyboard([
    [Markup.button.locationRequest('📍 Joylashuvni yuborish')],
    [SKIP_LOCATION_TEXT],
  ])
    .oneTime()
    .resize();
}

function summaryText(s) {
  return (
    `📋 <b>Ma'lumotlarni tekshiring:</b>\n\n` +
    `📍 Viloyat: ${s.regionName}\n` +
    `🏙 Tuman: ${s.districtName}\n` +
    `🏘 Manzil: ${s.address}\n` +
    `🏠 Mulk turi: ${s.propertyType}\n` +
    `💰 Narxi: ${s.price}\n` +
    `📞 Telefon: ${s.phone}\n` +
    `🖼 Tashqi rasmlar: ${s.exteriorPhotos.length} ta\n` +
    `🖼 Ichki rasmlar: ${s.interiorPhotos.length} ta\n` +
    `📄 Hujjatlar: ${s.documents.length > 0 ? `${s.documents.length} ta yuklandi` : "yuklanmadi (o'tkazib yuborildi)"}\n` +
    `🗺 Lokatsiya: ${s.location ? 'yuborildi' : "yuborilmadi (o'tkazib yuborildi)"}\n\n` +
    `Hammasi to'g'rimi?`
  );
}

function confirmKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Tasdiqlash va yuborish', 'confirm')],
    [Markup.button.callback('❌ Bekor qilish', 'cancel')],
  ]);
}

// ---------------------------------------------------------------------
// Wizard steps
// ---------------------------------------------------------------------

async function stepWelcome(ctx) {
  ctx.scene.session.data = {
    userId: ctx.from.id,
    username: ctx.from.username || null,
    fullName: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' '),
    exteriorPhotos: [],
    interiorPhotos: [],
    documents: [],
  };
  await ctx.reply(
    "Assalomu alaykum! 🏡 Ko'chmas mulk e'lonini joylashtirish uchun bir nechta savolga javob bering.\n\nIstalgan vaqtda /cancel buyrug'i bilan bekor qilishingiz mumkin.\n\n1️⃣ Viloyatni tanlang:",
    regionsKeyboard(),
  );
  return ctx.wizard.next();
}

async function stepRegion(ctx) {
  if (ctx.updateType !== 'callback_query' || !ctx.callbackQuery.data.startsWith('reg_')) {
    await ctx.reply('Iltimos, ro\'yxatdan viloyatni tanlang 👆');
    return;
  }
  const regionId = ctx.callbackQuery.data.replace('reg_', '');
  const region = getRegionById(regionId);
  await ctx.answerCbQuery();
  ctx.scene.session.data.regionId = regionId;
  ctx.scene.session.data.regionName = region.name;
  await ctx.editMessageText(`Viloyat: ${region.name} ✅`, { reply_markup: { inline_keyboard: [] } });
  await ctx.reply('2️⃣ Endi tumanni/shaharni tanlang:', districtsKeyboard(regionId));
  return ctx.wizard.next();
}

async function stepDistrict(ctx) {
  if (ctx.updateType !== 'callback_query') {
    await ctx.reply("Iltimos, ro'yxatdan tumanni tanlang 👆");
    return;
  }
  await ctx.answerCbQuery();
  const data = ctx.callbackQuery.data;

  if (data === 'back_to_region') {
    await ctx.editMessageText("1️⃣ Viloyatni tanlang:", regionsKeyboard());
    return ctx.wizard.selectStep(1);
  }

  if (!data.startsWith('dist_')) {
    await ctx.reply("Iltimos, ro'yxatdan tumanni tanlang 👆");
    return;
  }

  const districtId = data.replace('dist_', '');
  const district = getDistrictById(districtId);
  ctx.scene.session.data.districtId = districtId;
  ctx.scene.session.data.districtName = district.name;
  await ctx.editMessageText(`Tuman/shahar: ${district.name} ✅`, { reply_markup: { inline_keyboard: [] } });
  await ctx.reply(
    "3️⃣ Mahalla, ko'cha nomi va uy raqamini yozing.\n\nMasalan: <i>Istiqlol MFY, Nukus ko'chasi, 1-uy</i>",
    { parse_mode: 'HTML' },
  );
  return ctx.wizard.next();
}

async function stepAddress(ctx) {
  if (!ctx.message || !ctx.message.text) {
    await ctx.reply("Iltimos, manzilni matn ko'rinishida yozing.");
    return;
  }
  ctx.scene.session.data.address = ctx.message.text.trim();
  await ctx.reply("4️⃣ Ko'chmas mulk turini tanlang:", propertyTypeKeyboard());
  return ctx.wizard.next();
}

async function stepPropertyType(ctx) {
  if (ctx.updateType !== 'callback_query' || !ctx.callbackQuery.data.startsWith('ptype_')) {
    await ctx.reply("Iltimos, ro'yxatdan mulk turini tanlang 👆");
    return;
  }
  const idx = Number(ctx.callbackQuery.data.replace('ptype_', ''));
  const label = PROPERTY_TYPES[idx] || 'Boshqa';
  await ctx.answerCbQuery();
  ctx.scene.session.data.propertyType = label;
  await ctx.editMessageText(`Mulk turi: ${label} ✅`, { reply_markup: { inline_keyboard: [] } });
  await ctx.reply("5️⃣ Narxini yozing (so'mda yoki dollarda). Masalan: 300000000");
  return ctx.wizard.next();
}

async function stepPrice(ctx) {
  if (!ctx.message || !ctx.message.text) {
    await ctx.reply('Iltimos, narxni raqam bilan yozing.');
    return;
  }
  const digits = ctx.message.text.replace(/[^\d]/g, '');
  if (!digits) {
    await ctx.reply("Narx noto'g'ri formatda. Faqat raqam kiriting, masalan: 300000000");
    return;
  }
  const formatted = Number(digits).toLocaleString('uz-UZ').replace(/,/g, ' ');
  ctx.scene.session.data.price = `${formatted} so'm`;
  await ctx.reply(
    "6️⃣ Telefon raqamingizni yuboring (tugma orqali) yoki qo'lda yozing:",
    phoneKeyboard(),
  );
  return ctx.wizard.next();
}

async function stepPhone(ctx) {
  let phone = null;
  if (ctx.message && ctx.message.contact) {
    phone = ctx.message.contact.phone_number;
  } else if (ctx.message && ctx.message.text) {
    const cleaned = ctx.message.text.replace(/[^\d+]/g, '');
    if (cleaned.length >= 9) phone = cleaned;
  }
  if (!phone) {
    await ctx.reply(
      "Iltimos, telefon raqamini tugma orqali yuboring yoki to'g'ri formatda yozing (masalan: +998 55 517 22 20).",
    );
    return;
  }
  ctx.scene.session.data.phone = phone;
  await ctx.reply('Rahmat! ✅', Markup.removeKeyboard());
  await ctx.reply(
    "7️⃣ Endi obyektning TASHQI ko'rinish rasmlarini yuboring (bittadan yoki bir nechtadan).\n\nKamida 1 ta rasm yuboring, so'ng \"Tayyor\" tugmasini bosing.",
  );
  return ctx.wizard.next();
}

async function stepExteriorPhotos(ctx) {
  if (ctx.updateType === 'callback_query') {
    await ctx.answerCbQuery();
    if (ctx.callbackQuery.data === 'ext_done') {
      const photos = ctx.scene.session.data.exteriorPhotos;
      if (!photos.length) {
        await ctx.reply("Hali birorta ham rasm yubormadingiz. Kamida 1 ta rasm yuboring.");
        return;
      }
      await ctx.reply(
        "8️⃣ Endi obyektning ICHKI ko'rinish rasmlarini yuboring.\n\nKamida 1 ta rasm yuboring, so'ng \"Tayyor\" tugmasini bosing.",
      );
      return ctx.wizard.next();
    }
    return;
  }
  if (ctx.message && ctx.message.photo) {
    const best = ctx.message.photo[ctx.message.photo.length - 1];
    ctx.scene.session.data.exteriorPhotos.push(best.file_id);
    const count = ctx.scene.session.data.exteriorPhotos.length;
    await ctx.reply(
      `📸 Qabul qilindi (${count} ta). Yana rasm yuborishingiz mumkin yoki "Tayyor" tugmasini bosing.`,
      doneKeyboard('✅ Tayyor', 'ext_done'),
    );
    return;
  }
  await ctx.reply('Iltimos, rasm yuboring yoki "Tayyor" tugmasini bosing.');
}

async function stepInteriorPhotos(ctx) {
  if (ctx.updateType === 'callback_query') {
    await ctx.answerCbQuery();
    if (ctx.callbackQuery.data === 'int_done') {
      const photos = ctx.scene.session.data.interiorPhotos;
      if (!photos.length) {
        await ctx.reply('Hali birorta ham rasm yubormadingiz. Kamida 1 ta rasm yuboring.');
        return;
      }
      await ctx.reply(
        "9️⃣ Hujjatlarni yuklang (kadastr ko'chirma, kadastr pasport va h.k.) — bu ixtiyoriy.\n\n" +
          "Hujjat yuklasangiz, e'loningizda \"Ҳужжатлар текширилган ✅\" belgisi chiqadi va xaridorlar uchun ishonchliroq bo'ladi.\n\n" +
          "Hujjat yuborishingiz mumkin yoki o'tkazib yuborishingiz mumkin.",
        documentsKeyboard(false),
      );
      return ctx.wizard.next();
    }
    return;
  }
  if (ctx.message && ctx.message.photo) {
    const best = ctx.message.photo[ctx.message.photo.length - 1];
    ctx.scene.session.data.interiorPhotos.push(best.file_id);
    const count = ctx.scene.session.data.interiorPhotos.length;
    await ctx.reply(
      `📸 Qabul qilindi (${count} ta). Yana rasm yuborishingiz mumkin yoki "Tayyor" tugmasini bosing.`,
      doneKeyboard('✅ Tayyor', 'int_done'),
    );
    return;
  }
  await ctx.reply('Iltimos, rasm yuboring yoki "Tayyor" tugmasini bosing.');
}

async function goToConfirm(ctx) {
  const s = ctx.scene.session.data;
  await ctx.reply(summaryText(s), { parse_mode: 'HTML', ...confirmKeyboard() });
  return ctx.wizard.next();
}

async function stepDocuments(ctx) {
  if (ctx.updateType === 'callback_query') {
    await ctx.answerCbQuery();
    const data = ctx.callbackQuery.data;
    if (data === 'doc_skip' || data === 'doc_done') {
      await ctx.reply(
        "🔟 Obyektning xaritadagi joylashuvini yuboring (ixtiyoriy).",
        locationKeyboard(),
      );
      return ctx.wizard.next();
    }
    return;
  }
  if (ctx.message && ctx.message.photo) {
    const best = ctx.message.photo[ctx.message.photo.length - 1];
    ctx.scene.session.data.documents.push({ type: 'photo', fileId: best.file_id });
  } else if (ctx.message && ctx.message.document) {
    ctx.scene.session.data.documents.push({
      type: 'document',
      fileId: ctx.message.document.file_id,
      fileName: ctx.message.document.file_name,
    });
  } else {
    await ctx.reply('Iltimos, hujjat/rasm yuboring yoki "O\'tkazib yuborish" tugmasini bosing.');
    return;
  }
  const count = ctx.scene.session.data.documents.length;
  await ctx.reply(`📄 Qabul qilindi (${count} ta).`, documentsKeyboard(true));
}

async function stepLocation(ctx) {
  if (ctx.message && ctx.message.location) {
    ctx.scene.session.data.location = {
      latitude: ctx.message.location.latitude,
      longitude: ctx.message.location.longitude,
    };
    await ctx.reply('📍 Lokatsiya qabul qilindi ✅', Markup.removeKeyboard());
    return goToConfirm(ctx);
  }
  if (ctx.message && ctx.message.text === SKIP_LOCATION_TEXT) {
    await ctx.reply("Lokatsiya o'tkazib yuborildi.", Markup.removeKeyboard());
    return goToConfirm(ctx);
  }
  await ctx.reply(
    'Iltimos, lokatsiyani tugma orqali yuboring yoki "O\'tkazib yuborish" tugmasini bosing.',
    locationKeyboard(),
  );
}

async function stepConfirm(ctx) {
  if (ctx.updateType !== 'callback_query') {
    await ctx.reply('Iltimos, tugmalardan birini tanlang 👆');
    return;
  }
  await ctx.answerCbQuery();
  const action = ctx.callbackQuery.data;

  if (action === 'cancel') {
    await ctx.editMessageText("❌ Bekor qilindi. Qaytadan boshlash uchun /start bosing.", {
      reply_markup: { inline_keyboard: [] },
    });
    return ctx.scene.leave();
  }

  if (action !== 'confirm') return;

  const s = ctx.scene.session.data;
  const id = await nextApplicationId();
  const application = {
    id,
    status: 'yuborilgan',
    createdAt: new Date().toISOString(),
    telegramUserId: s.userId,
    username: s.username,
    fullName: s.fullName,
    regionId: s.regionId,
    regionName: s.regionName,
    districtId: s.districtId,
    districtName: s.districtName,
    address: s.address,
    propertyType: s.propertyType,
    price: s.price,
    phone: s.phone,
    exteriorPhotos: s.exteriorPhotos,
    interiorPhotos: s.interiorPhotos,
    documents: s.documents,
    documentsVerifiedBadge: s.documents.length > 0,
    location: s.location || null,
  };

  await saveApplication(application);
  await postApplicationToGroup(ctx, application);

  await ctx.editMessageText(
    `✅ Arizangiz qabul qilindi!\n🆔 Murojaat raqami: ${id}\n\n` +
      'Tekshirish va joylashtirish amalga oshiriladi. Keyin biz siz bilan tez orada bog\'lanamiz.',
    { reply_markup: { inline_keyboard: [] } },
  );
  return ctx.scene.leave();
}

async function postApplicationToGroup(ctx, app) {
  const badge = app.documentsVerifiedBadge
    ? 'Ҳужжатлар текширилган ✅'
    : "📄 Hujjatlar: yuklanmagan (o'tkazib yuborilgan)";

  const text =
    `🆕 <b>YANGI MUROJAAT</b>\n\n` +
    `🆔 ID: ${app.id}\n` +
    `📍 Manzil: ${app.regionName}, ${app.districtName}, ${app.address}\n` +
    `🏠 Mulk turi: ${app.propertyType}\n` +
    `💰 Narxi: ${app.price}\n` +
    `📞 Telefon: ${app.phone}\n` +
    `👤 Mijoz: ${app.fullName || 'Nomaʼlum'}${app.username ? ` (@${app.username})` : ''} — id:${app.telegramUserId}\n` +
    `🗓 Sana: ${new Date(app.createdAt).toLocaleString('uz-UZ')}\n\n` +
    `${badge}`;

  await ctx.telegram.sendMessage(GROUP_CHAT_ID, text, { parse_mode: 'HTML' });

  if (app.location) {
    await ctx.telegram.sendLocation(GROUP_CHAT_ID, app.location.latitude, app.location.longitude);
  }

  await sendPhotoGroup(ctx, app.exteriorPhotos, "🏠 Tashqi ko'rinish");
  await sendPhotoGroup(ctx, app.interiorPhotos, "🛋 Ichki ko'rinish");

  for (let i = 0; i < app.documents.length; i += 1) {
    const doc = app.documents[i];
    const caption = i === 0 ? '📄 Hujjatlar' : undefined;
    if (doc.type === 'photo') {
      await ctx.telegram.sendPhoto(GROUP_CHAT_ID, doc.fileId, { caption });
    } else {
      await ctx.telegram.sendDocument(GROUP_CHAT_ID, doc.fileId, { caption });
    }
  }
}

async function sendPhotoGroup(ctx, fileIds, caption) {
  if (!fileIds || !fileIds.length) return;
  const chunks = chunk(fileIds, 10);
  for (let i = 0; i < chunks.length; i += 1) {
    const media = chunks[i].map((fileId, idx) => ({
      type: 'photo',
      media: fileId,
      caption: i === 0 && idx === 0 ? caption : undefined,
    }));
    await ctx.telegram.sendMediaGroup(GROUP_CHAT_ID, media);
  }
}

const propertyFormScene = new Scenes.WizardScene(
  'propertyForm',
  stepWelcome, // 0
  stepRegion, // 1
  stepDistrict, // 2
  stepAddress, // 3
  stepPropertyType, // 4
  stepPrice, // 5
  stepPhone, // 6
  stepExteriorPhotos, // 7
  stepInteriorPhotos, // 8
  stepDocuments, // 9
  stepLocation, // 10
  stepConfirm, // 11
);

function createBot() {
  const bot = new Telegraf(BOT_TOKEN);
  const stage = new Scenes.Stage([propertyFormScene]);

  // /start and /cancel are registered directly on the `stage` composer
  // (not on `bot`) so that `ctx.scene` is already attached when they run,
  // and so they take priority over whatever step the wizard is currently
  // on — meaning they work at ANY point in the flow, not just outside it.
  stage.command('start', (ctx) => ctx.scene.enter('propertyForm'));
  stage.command('cancel', async (ctx) => {
    await ctx.scene.leave();
    await ctx.reply("Bekor qilindi. Qaytadan boshlash uchun /start bosing.", Markup.removeKeyboard());
  });

  bot.use(session({ store: pgSessionStore }));

  bot.help((ctx) =>
    ctx.reply(
      "🏡 Ko'chmas mulk e'lon botiga xush kelibsiz!\n\n/start — yangi e'lon joylashtirish\n/cancel — joriy jarayonni bekor qilish",
    ),
  );

  bot.use(stage.middleware());

  bot.on('message', (ctx) => {
    // Foydalanuvchi biror sabab bilan scene'dan tashqarida bo'lsa.
    if (!ctx.scene.current) {
      return ctx.reply("Boshlash uchun /start buyrug'ini bosing.");
    }
  });

  return bot;
}

module.exports = { createBot, GROUP_CHAT_ID };
